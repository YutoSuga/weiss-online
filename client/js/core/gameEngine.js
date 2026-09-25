import {
  PHASE,
  PHASE_LABELS,
  PHASE_VALUES,
} from "../constants/phase.js";
import { ZONE } from "../constants/zone.js";
import {
  ACT_ABILITY_STEP,
  AUTO_ABILITY_STEP,
  CLOCK_STEP,
  DRAW_STEP,
  MAIN_STEP,
  MOVE_STAGE_STEP,
  PLAY_CHARACTER_STEP,
  PROCESS_STATUS,
  PROCESS_TYPE,
  LEVEL_UP_STEP,
  REFRESH_PENALTY_STEP,
  REFRESH_STEP,
  SEARCH_DECK_STEP,
  SWAP_STAGE_STEP,
  PENDING_AUTO_STEP,
} from "../constants/process.js";
import { ABILITY_SOURCE, ABILITY_TYPE, EFFECT_TYPE } from "../constants/ability.js";
import { getCostsDisabledReason, getPreparedCostsDisabledReason, payCosts, prepareCostSelections } from "../abilities/costResolver.js";
import {
  cardMatchesSearchFilter,
  resolveEffect,
  resolveEffectResult,
  validateEffects,
} from "../abilities/effectResolver.js";
import {
  DEFEAT_REASON,
  RULE_CHECK_RESULT,
} from "../constants/ruleCheck.js";
import { POSITION } from "../models/card.js";
import { GameState } from "../models/gameState.js";
import { ProcessManager } from "./processManager.js";
import { GameEventDispatcher } from "./gameEventDispatcher.js";
import { locateCard } from "../abilities/autoTriggerDetector.js";
import { GAME_EVENT_TYPE } from "../constants/gameEvent.js";
import { getRuleAutoAbility } from "../abilities/ruleAbilityProvider.js";

const PHASE_ORDER = Object.freeze([
  PHASE.STAND,
  PHASE.DRAW,
  PHASE.CLOCK,
  PHASE.MAIN,
  PHASE.CLIMAX,
  PHASE.ATTACK,
  PHASE.ENCORE,
  PHASE.END,
]);

const INITIAL_HAND_SIZE = 5;
const MAX_LOG_ENTRIES = 20;
const MULLIGAN_MESSAGES = Object.freeze({
  self: "交換する手札を選択してください。",
  opponent: "相手が手札交換中です",
});
const PLAYER_IDS = Object.freeze(["self", "opponent"]);
const MAIN_STAGE_DESTINATIONS = Object.freeze([
  Object.freeze({ owner: "self", zone: ZONE.STAGE, row: "front", index: 1 }),
  Object.freeze({ owner: "self", zone: ZONE.STAGE, row: "front", index: 2 }),
  Object.freeze({ owner: "self", zone: ZONE.STAGE, row: "front", index: 3 }),
  Object.freeze({ owner: "self", zone: ZONE.STAGE, row: "back", index: 1 }),
  Object.freeze({ owner: "self", zone: ZONE.STAGE, row: "back", index: 2 }),
]);

/**
 * ゲームルールの進行とGameStateの更新を担当する。
 * DOM操作とUIロジックは持たず、画面更新はRendererへ委譲する。
 */
export class GameEngine {
  /**
   * @param {object} params
   * @param {GameState} params.gameState
   * @param {{render: (gameState: GameState) => void}} params.renderer
   * @param {ProcessManager} [params.processManager]
   */
  constructor({
    gameState,
    renderer,
    processManager = new ProcessManager(gameState),
  }) {
    if (!(gameState instanceof GameState)) {
      throw new TypeError("gameState must be a GameState instance.");
    }

    if (!renderer || typeof renderer.render !== "function") {
      throw new TypeError("renderer must provide a render() method.");
    }

    if (!(processManager instanceof ProcessManager)) {
      throw new TypeError("processManager must be a ProcessManager instance.");
    }

    if (processManager.gameState !== gameState) {
      throw new TypeError("processManager must use the supplied gameState.");
    }

    this.gameState = gameState;
    this.renderer = renderer;
    this.processManager = processManager;
    this.gameEventDispatcher = new GameEventDispatcher(gameState);
    /** @type {Set<(gameState: GameState) => void>} */
    this.renderListeners = new Set();
  }

  /**
   * 両山札をシャッフルし、初期手札配布後にマリガンを開始する。
   * 通常ターンは後攻プレイヤーのマリガン完了まで開始しない。
   *
   * @returns {void}
   */
  startGame() {
    const { first, second } = this.gameState.turnOrder;

    this.gameState.started = false;
    this.gameState.gameResult.finished = false;
    this.gameState.gameResult.winner = null;
    this.gameState.gameResult.loser = null;
    this.gameState.gameResult.reason = null;
    this.gameState.players[first].deck.shuffle();
    this.gameState.players[second].deck.shuffle();
    this.gameState.turn.player = null;
    this.gameState.turn.number = 0;
    this.addLog(null, "ゲームの初期準備を開始しました。");

    this.drawInitialHand();
    this.startMulligan();
    this.render();
  }

  /**
   * 先攻・後攻の順に初期手札を5枚ずつ配る。
   *
   * @returns {{first: import("../models/card.js").Card[], second: import("../models/card.js").Card[]}}
   */
  drawInitialHand() {
    const { first, second } = this.gameState.turnOrder;

    return {
      first: this.drawCards(first, INITIAL_HAND_SIZE),
      second: this.drawCards(second, INITIAL_HAND_SIZE),
    };
  }

  /**
   * 先攻プレイヤーからマリガンを開始する。
   *
   * @returns {void}
   */
  startMulligan() {
    const { first } = this.gameState.turnOrder;

    this.gameState.mulliganState.active = true;
    this.gameState.mulliganState.currentPlayer = first;
    this.gameState.phase = PHASE.MULLIGAN;
    this.#updateMulliganOverlay();
    this.addLog(first, "手札交換を開始しました。");
  }

  /**
   * 選択した手札を控え室へ送り、同じ枚数を引く。
   * `handIndexes`は1始まりで、0枚選択も許可する。
   *
   * @param {'self'|'opponent'} playerId
   * @param {number[]} handIndexes
   * @returns {import("../models/card.js").Card[]} 控え室へ送ったカード
   */
  mulligan(playerId, handIndexes) {
    this.#assertPlayerId(playerId);

    if (!this.gameState.mulliganState.active) {
      throw new Error("Mulligan is not active.");
    }

    if (this.gameState.mulliganState.currentPlayer !== playerId) {
      throw new Error(`It is not ${playerId}'s mulligan turn.`);
    }

    if (!Array.isArray(handIndexes)) {
      throw new TypeError("handIndexes must be an array.");
    }

    const uniqueIndexes = new Set(handIndexes);
    if (
      uniqueIndexes.size !== handIndexes.length ||
      handIndexes.some((index) => !Number.isInteger(index) || index < 1)
    ) {
      throw new TypeError(
        "handIndexes must contain unique positive integers.",
      );
    }

    const player = this.gameState.players[playerId];
    const sortedIndexes = [...uniqueIndexes].sort((left, right) => left - right);

    if (sortedIndexes.some((index) => index > player.hand.length)) {
      throw new RangeError("handIndexes contains an index outside the hand.");
    }

    const selectedIndexSet = new Set(sortedIndexes);
    const discardedCards = sortedIndexes.map((index) => player.hand[index - 1]);
    const remainingCards = player.hand.filter(
      (_card, arrayIndex) => !selectedIndexSet.has(arrayIndex + 1),
    );

    player.hand.splice(0, player.hand.length, ...remainingCards);
    this.#reindexCards(player.hand);

    discardedCards.forEach((card) => {
      const waitingRoomIndex = player.waitingRoom.length + 1;
      card.moveTo({
        zone: ZONE.WAITING_ROOM,
        row: null,
        index: waitingRoomIndex,
      });
      player.waitingRoom.push(card);
    });

    this.drawCards(playerId, discardedCards.length);
    this.addLog(
      playerId,
      `${discardedCards.length}枚を手札交換しました。`,
    );

    const { first, second } = this.gameState.turnOrder;
    if (playerId === first) {
      this.gameState.mulliganState.currentPlayer = second;
      this.#updateMulliganOverlay();
      this.addLog(second, "手札交換を開始しました。");
    } else {
      this.gameState.mulliganState.active = false;
      this.gameState.mulliganState.currentPlayer = null;
      this.gameState.turn.player = first;
      this.gameState.turn.number = 1;
      this.gameState.started = true;
      this.#updateMulliganOverlay();
      this.addLog(first, "Turn 1を開始しました。");
      this.enterPhase(PHASE.STAND);
    }

    if (playerId === first) {
      this.render();
    }
    return discardedCards;
  }

  /**
   * 指定プレイヤーが複数枚引く。
   *
   * @param {'self'|'opponent'} playerId
   * @param {number} [count=1]
   * @returns {import("../models/card.js").Card[]} 実際に引けたカード
   */
  drawCards(playerId, count = 1) {
    this.#assertPlayerId(playerId);

    if (!Number.isInteger(count) || count < 0) {
      throw new TypeError("count must be a non-negative integer.");
    }

    /** @type {import("../models/card.js").Card[]} */
    const drawnCards = [];

    for (let index = 0; index < count; index += 1) {
      const card = this.drawCard(playerId);
      if (!card) {
        break;
      }

      drawnCards.push(card);
    }

    if (drawnCards.length > 0) {
      this.addLog(playerId, `${drawnCards.length}枚引きました。`);
    }

    return drawnCards;
  }

  /**
   * 通常ターンのフェイズを次へ進める。
   * DRAWフェイズへ入った際は現在プレイヤーが1枚引く。
   *
   * @returns {void}
   */
  nextPhase() {
    if (this.gameState.gameResult.finished) {
      throw new Error("Cannot advance phases after the game has finished.");
    }
    if (this.gameState.mulliganState.active) {
      throw new Error("Cannot advance phases during mulligan.");
    }

    if (this.#isWaitingForProcessInput()) {
      throw new Error("Cannot advance phases while a Process is waiting for input.");
    }
    if (this.#hasPendingInterruptSelection()) {
      throw new Error("Cannot advance phases while interrupt order is pending.");
    }

    const nextPhase = this.getNextPhase();
    this.enterPhase(nextPhase);
  }

  /**
   * 現在フェイズから次に入るフェイズだけを決定する。
   * ENDの次は次プレイヤーのSTANDとなる。
   *
   * @private
   * @returns {string}
   */
  getNextPhase() {
    const currentIndex = PHASE_ORDER.indexOf(this.gameState.phase);

    if (currentIndex === -1) {
      throw new RangeError(`Unknown phase: ${this.gameState.phase}.`);
    }

    if (this.gameState.phase === PHASE.END) {
      return PHASE.STAND;
    }

    return PHASE_ORDER[currentIndex + 1];
  }

  /**
   * 指定フェイズへ入り、そのフェイズ固有の開始処理後に再描画する。
   *
   * @private
   * ENDからSTANDへ入る場合は、先にターン交代を行う。
   *
   * @param {string} phase
   * @param {{turnTransitionHandled?: boolean}} [options]
   * @returns {void}
   */
  enterPhase(phase, { turnTransitionHandled = false } = {}) {
    if (!PHASE_VALUES.includes(phase)) {
      throw new RangeError(`Unknown phase: ${phase}.`);
    }

    if (
      phase === PHASE.STAND &&
      this.gameState.phase === PHASE.END &&
      !turnTransitionHandled
    ) {
      this.endTurn();
      return;
    }

    const previousPhase = this.gameState.phase;
    if (previousPhase !== phase) {
      this.emitGameEvent(GAME_EVENT_TYPE.PHASE_ENDED, this.gameState.turn.player, {
        phase: previousPhase,
        turnPlayerId: this.gameState.turn.player,
        turnNumber: this.gameState.turn.number,
      });
    }
    this.gameState.phase = phase;
    this.#updatePhaseMessageOverlay(phase);
    if (previousPhase !== phase) {
      this.emitGameEvent(GAME_EVENT_TYPE.PHASE_STARTED, this.gameState.turn.player, {
        phase,
        turnPlayerId: this.gameState.turn.player,
        turnNumber: this.gameState.turn.number,
      });
    }

    switch (phase) {
      case PHASE.STAND:
        this.startStandPhase();
        break;
      case PHASE.DRAW:
        this.startDrawPhase();
        break;
      case PHASE.CLOCK:
        this.startClockPhase();
        break;
      case PHASE.MAIN:
        this.startMainPhase();
        break;
      default:
        break;
    }

    this.render();
  }

  /**
   * 現在ターンのプレイヤーの舞台にある全カードをSTANDにする。
   *
   * @private
   * @returns {void}
   */
  startStandPhase() {
    const playerId = this.gameState.turn.player;
    this.#assertPlayerId(playerId);

    this.gameState.players[playerId].stage.forEach((card) => {
      this.changeCardPosition(card, POSITION.STAND, playerId);
    });
  }

  /** 確定済みの小さいsnapshotを発行し、AUTO検出とPending化まで同期実行する。 */
  emitGameEvent(type, actorPlayerId, payload) {
    return this.gameEventDispatcher.emit(type, actorPlayerId, payload);
  }

  /** collection membershipを正本としてCardの現在位置を読み取る。 */
  locateCard(instanceId) {
    return locateCard(this.gameState, instanceId);
  }

  /** 単一Card移動を完了してからCARD_MOVEDを一度だけ発行する。 */
  moveCard(card, to, actorPlayerId = card?.owner) {
    const located = this.locateCard(card?.instanceId);
    const from = { ownerId: located.playerId, ...located.location };
    const destinationPlayerId = to.ownerId ?? card.owner;
    this.#assertPlayerId(destinationPlayerId);
    const sourceCards = getZoneCollection(this.gameState.players[located.playerId], from.zone);
    const destinationCards = getZoneCollection(this.gameState.players[destinationPlayerId], to.zone);
    sourceCards.splice(sourceCards.indexOf(card), 1);
    this.#reindexCards(sourceCards);
    card.moveTo({ zone: to.zone, row: to.row ?? null,
      index: to.index ?? destinationCards.length + 1 });
    destinationCards.push(card);
    if (to.zone !== ZONE.STAGE) this.#reindexCards(destinationCards);
    const current = this.locateCard(card.instanceId);
    return this.emitGameEvent(GAME_EVENT_TYPE.CARD_MOVED, actorPlayerId, {
      cardInstanceId: card.instanceId,
      cardMasterId: card.masterId,
      cardType: card.cardType,
      ownerId: card.owner,
      from,
      to: { ownerId: current.playerId, ...current.location },
    });
  }

  /** 呼出側が完了させた既存mutationについて、移動後所在を検証してEvent化する。 */
  emitCardMovedAfterMutation(card, from, actorPlayerId = card?.owner) {
    const current = this.locateCard(card?.instanceId);
    return this.emitGameEvent(GAME_EVENT_TYPE.CARD_MOVED, actorPlayerId, {
      cardInstanceId: card.instanceId,
      cardMasterId: card.masterId,
      cardType: card.cardType,
      ownerId: card.owner,
      from: { ownerId: card.owner, row: null, index: null, ...from },
      to: { ownerId: current.playerId, ...current.location },
    });
  }

  /** position mutation完了後、実際に値が変わった場合だけEventを発行する。 */
  changeCardPosition(card, toPosition, actorPlayerId = card?.owner) {
    const located = this.locateCard(card?.instanceId);
    const fromPosition = card.position;
    if (fromPosition === toPosition) return null;
    card.setPosition(toPosition);
    return this.emitGameEvent(GAME_EVENT_TYPE.CARD_POSITION_CHANGED, actorPlayerId, {
      cardInstanceId: card.instanceId,
      cardMasterId: card.masterId,
      cardType: card.cardType,
      ownerId: card.owner,
      location: { ownerId: located.playerId, ...located.location },
      fromPosition,
      toPosition,
    });
  }

  /** 呼出側で完了済みのposition mutationをEvent化する。 */
  emitPositionChangedAfterMutation(card, fromPosition, actorPlayerId = card?.owner) {
    if (fromPosition === card?.position) return null;
    const located = this.locateCard(card.instanceId);
    return this.emitGameEvent(GAME_EVENT_TYPE.CARD_POSITION_CHANGED, actorPlayerId, {
      cardInstanceId: card.instanceId,
      cardMasterId: card.masterId,
      cardType: card.cardType,
      ownerId: card.owner,
      location: { ownerId: located.playerId, ...located.location },
      fromPosition,
      toPosition: card.position,
    });
  }

  /** Attack宣言が確定した境界から呼ぶ。F-5BではAttack Processや解決は開始しない。 */
  declareAttackEvent(attackerCard, attackType, actorPlayerId = attackerCard?.owner) {
    const located = this.locateCard(attackerCard?.instanceId);
    if (located.location.zone !== ZONE.STAGE) throw new Error("Attacker must be on Stage.");
    return this.emitGameEvent(GAME_EVENT_TYPE.ATTACK_DECLARED, actorPlayerId, {
      attackerCardInstanceId: attackerCard.instanceId,
      cardMasterId: attackerCard.masterId,
      cardType: attackerCard.cardType,
      ownerId: attackerCard.owner,
      attackType,
      location: { ownerId: located.playerId, ...located.location },
    });
  }

  /**
   * 現在ターンのDRAW Processを開始する。
   * 1枚ドロー後のCheck Pointから割り込みできるよう、再開stepをProcessへ保存する。
   *
   * @private
   * @returns {import("./processManager.js").Process}
   */
  startDrawPhase() {
    const playerId = this.gameState.turn.player;
    this.#assertPlayerId(playerId);

    const process = this.processManager.pushProcess({
      type: PROCESS_TYPE.DRAW_PHASE,
      playerId,
      step: DRAW_STEP.DRAW_CARD,
      status: PROCESS_STATUS.RUNNING,
      context: {},
    });

    this.executeDrawPhaseProcess();
    return process;
  }

  /**
   * スタック最上段のDRAW Processを、保存済みstepから実行する。
   * Check Pointで割り込みが始まった場合は、その場で処理を停止する。
   *
   * @returns {import("./processManager.js").Process|null}
   */
  executeDrawPhaseProcess() {
    const drawProcess = this.processManager.getCurrentProcess();
    if (!drawProcess) {
      return null;
    }

    if (drawProcess.type !== PROCESS_TYPE.DRAW_PHASE) {
      throw new Error("The current Process is not DRAW_PHASE.");
    }

    while (this.processManager.getCurrentProcess() === drawProcess) {
      switch (drawProcess.step) {
        case DRAW_STEP.DRAW_CARD:
          this.drawCards(drawProcess.playerId, 1);
          this.processManager.updateStep(DRAW_STEP.CHECK_POINT);
          break;
        case DRAW_STEP.CHECK_POINT: {
          this.processManager.updateStep(DRAW_STEP.COMPLETE);
          const result = this.resolveCheckPoint();
          if (result !== RULE_CHECK_RESULT.CONTINUE) {
            return drawProcess;
          }
          break;
        }
        case DRAW_STEP.COMPLETE:
          this.completeCurrentProcess();
          return drawProcess;
        default:
          throw new RangeError(`Unknown DRAW_PHASE step: ${drawProcess.step}.`);
      }
    }

    return drawProcess;
  }

  /**
   * CLOCKフェイズの選択待ちProcessを開始する。
   *
   * @returns {import("./processManager.js").Process}
   */
  startClockPhase() {
    const playerId = this.gameState.turn.player;
    this.#assertPlayerId(playerId);

    return this.processManager.pushProcess({
      type: PROCESS_TYPE.CLOCK_PHASE,
      playerId,
      step: CLOCK_STEP.WAIT_FOR_SELECTION,
      status: PROCESS_STATUS.WAITING_INPUT,
      context: {},
    });
  }

  /**
   * MAIN入力待ち中に、詳細確認のため手札Cardを選択できるか返す。
   * cardTypeやCharacterのプレイ条件はここでは判定しない。
   *
   * @param {unknown} card
   * @param {'self'|'opponent'} playerId
   * @returns {boolean}
   */
  canSelectCardForMain(card, playerId) {
    if (playerId !== "self" || this.gameState.turn.player !== playerId) {
      return false;
    }

    const process = this.processManager.getCurrentProcess();
    const hand = this.gameState.players[playerId]?.hand;

    return Boolean(
      this.gameState.phase === PHASE.MAIN &&
      process?.type === PROCESS_TYPE.MAIN_PHASE &&
      process.playerId === playerId &&
      process.step === MAIN_STEP.WAITING_INPUT &&
      process.status === PROCESS_STATUS.WAITING_INPUT &&
      Array.isArray(hand) &&
      hand.includes(card) &&
      card?.owner === playerId &&
      card?.zone === ZONE.HAND,
    );
  }

  /**
   * F-2Aで選択カードから表示する自分のStage候補5枠を返す。
   * 空枠と使用中枠を区別せず、カード移動は行わない。
   *
   * @param {unknown} card
   * @param {'self'|'opponent'} playerId
   * @returns {{owner: 'self', zone: string, row: string, index: number}[]}
   */
  getMainDestinationCandidates(card, playerId) {
    if (!isCharacter(card)) {
      return [];
    }
    if (this.getCharacterPlayDisabledReason(card, playerId) !== null) {
      return [];
    }

    return MAIN_STAGE_DESTINATIONS.map((destination) => ({ ...destination }));
  }

  /** Characterを現在のMAINでStageへプレイできない理由。nullはプレイ可能。 */
  getCharacterPlayDisabledReason(card, playerId) {
    if (!this.canSelectCardForMain(card, playerId)) {
      return "CHARACTERを選択できるMAIN操作状態ではありません。";
    }
    return this.#getCharacterPlayRuleDisabledReason(card, playerId);
  }

  /** @returns {boolean} */
  canPlayCharacterToStage(card, playerId) {
    return this.getCharacterPlayDisabledReason(card, playerId) === null;
  }

  /** Hand Character PlayをMAIN_PHASEの子Processとして開始する。 */
  playCharacterToStage(card, playerId, destination) {
    this.#assertMainPhaseAction(playerId);
    const reason = this.getCharacterPlayDisabledReason(card, playerId);
    if (reason) throw new Error(reason);
    if (!this.#isMainStageDestination(destination, playerId)) {
      throw new Error("Invalid Stage destination.");
    }
    const process = this.processManager.pushProcess({
      type: PROCESS_TYPE.PLAY_CHARACTER,
      playerId,
      step: PLAY_CHARACTER_STEP.VALIDATE,
      status: PROCESS_STATUS.RUNNING,
      context: {
        cardId: card.id,
        destination: { row: destination.row, index: destination.index },
      },
    });
    this.executePlayCharacterProcess();
    return process;
  }

  /** PLAY_CHARACTERを保存済みstepから実行する。 */
  executePlayCharacterProcess() {
    const process = this.processManager.getCurrentProcess();
    if (!process || process.type !== PROCESS_TYPE.PLAY_CHARACTER) return process;
    const player = this.gameState.players[process.playerId];
    const destination = process.context.destination;
    const getHandCard = () => player.hand.find((card) => card.id === process.context.cardId);
    while (this.processManager.getCurrentProcess() === process) {
      switch (process.step) {
        case PLAY_CHARACTER_STEP.VALIDATE: {
          const card = getHandCard();
          const parent = this.gameState.ruleState.processStack.at(-2);
          const reason = this.#getCharacterPlayRuleDisabledReason(card, process.playerId);
          const invalidParent =
            this.gameState.phase !== PHASE.MAIN ||
            this.gameState.turn.player !== process.playerId ||
            parent?.type !== PROCESS_TYPE.MAIN_PHASE ||
            parent.playerId !== process.playerId ||
            parent.step !== MAIN_STEP.WAITING_INPUT ||
            parent.status !== PROCESS_STATUS.WAITING_INPUT;
          if (reason || invalidParent || !this.#isMainStageDestination(destination, process.playerId)) {
            this.processManager.popProcess();
            throw new Error(reason ?? "Character Play context is no longer valid.");
          }
          this.processManager.updateStep(PLAY_CHARACTER_STEP.PAY_COST);
          break;
        }
        case PLAY_CHARACTER_STEP.PAY_COST: {
          const card = getHandCard();
          for (let count = 0; count < card.cost; count += 1) {
            const costCard = player.stock.pop();
            costCard.moveTo({ zone: ZONE.WAITING_ROOM, row: null, index: player.waitingRoom.length + 1 });
            costCard.setPosition(POSITION.STAND);
            costCard.setFace(null);
            player.waitingRoom.push(costCard);
            this.emitCardMovedAfterMutation(costCard, {
              zone: ZONE.STOCK, index: player.stock.length + 1,
            }, process.playerId);
          }
          this.processManager.updateStep(PLAY_CHARACTER_STEP.REMOVE_EXISTING);
          break;
        }
        case PLAY_CHARACTER_STEP.REMOVE_EXISTING: {
          const existingIndex = player.stage.findIndex(
            (card) => card.row === destination.row && card.index === destination.index,
          );
          if (existingIndex >= 0) {
            const [existing] = player.stage.splice(existingIndex, 1);
            const from = { zone: ZONE.STAGE, row: existing.row, index: existing.index };
            existing.moveTo({ zone: ZONE.WAITING_ROOM, row: null, index: player.waitingRoom.length + 1 });
            existing.setPosition(POSITION.STAND);
            existing.setFace(null);
            player.waitingRoom.push(existing);
            this.emitCardMovedAfterMutation(existing, from, process.playerId);
          }
          this.processManager.updateStep(PLAY_CHARACTER_STEP.MOVE_TO_STAGE);
          break;
        }
        case PLAY_CHARACTER_STEP.MOVE_TO_STAGE: {
          const handIndex = player.hand.findIndex((card) => card.id === process.context.cardId);
          const [card] = player.hand.splice(handIndex, 1);
          this.#reindexCards(player.hand);
          card.moveTo({ zone: ZONE.STAGE, row: destination.row, index: destination.index });
          card.setPosition(POSITION.STAND);
          card.setFace(null);
          player.stage.push(card);
          this.emitCardMovedAfterMutation(card, {
            zone: ZONE.HAND, index: handIndex + 1,
          }, process.playerId);
          this.addLog(process.playerId, `${card.name}を舞台に出しました。`);
          this.processManager.updateStep(PLAY_CHARACTER_STEP.CHECK_POINT);
          this.render();
          break;
        }
        case PLAY_CHARACTER_STEP.CHECK_POINT: {
          this.processManager.updateStep(PLAY_CHARACTER_STEP.COMPLETE);
          const result = this.resolveCheckPoint();
          if (result !== RULE_CHECK_RESULT.CONTINUE) return process;
          break;
        }
        case PLAY_CHARACTER_STEP.COMPLETE:
          this.completeCurrentProcess();
          return process;
        default:
          throw new RangeError(`Unknown PLAY_CHARACTER step: ${process.step}.`);
      }
    }
    return process;
  }

  /** MAIN入力待ち中に自分のStage Characterを選択できるか返す。 */
  canSelectStageCardForMain(card, playerId) {
    if (playerId !== "self" || this.gameState.turn.player !== playerId) {
      return false;
    }
    const process = this.processManager.getCurrentProcess();
    const stage = this.gameState.players[playerId]?.stage;
    return Boolean(
      this.gameState.phase === PHASE.MAIN &&
      process?.type === PROCESS_TYPE.MAIN_PHASE &&
      process.playerId === playerId &&
      process.step === MAIN_STEP.WAITING_INPUT &&
      process.status === PROCESS_STATUS.WAITING_INPUT &&
      Array.isArray(stage) &&
      stage.includes(card) &&
      card?.owner === playerId &&
      card?.zone === ZONE.STAGE &&
      isCharacter(card) &&
      this.#isMainStageDestination(card, playerId)
    );
  }

  /** Cardが持つACTだけを定義順に返す。使用可能性は判定しない。 */
  getActAbilities(card, _playerId = undefined) {
    if (!card || !Array.isArray(card.abilities)) return [];
    return card.abilities.filter((ability) => ability.type === ABILITY_TYPE.ACT);
  }

  /** F-4AでサポートするACTプレイタイミングと固有条件・全Costの不可理由。 */
  getActAbilityDisabledReason(card, ability, playerId) {
    if (!PLAYER_IDS.includes(playerId)) return "プレイヤーが不正です。";
    if (this.gameState.turn.player !== playerId) return "自分のターンではありません。";
    if (this.gameState.phase !== PHASE.MAIN) return "メインフェイズではありません。";
    const process = this.processManager.getCurrentProcess();
    if (process?.type !== PROCESS_TYPE.MAIN_PHASE ||
      process.playerId !== playerId ||
      process.step !== MAIN_STEP.WAITING_INPUT ||
      process.status !== PROCESS_STATUS.WAITING_INPUT) {
      return "メインフェイズの操作待ちではありません。";
    }
    const player = this.gameState.players[playerId];
    if (!player?.stage.includes(card) || card?.owner !== playerId || card?.zone !== ZONE.STAGE) {
      return "このカードは自分の舞台にありません。";
    }
    const registeredAbility = this.getActAbilities(card).find(({ id }) => id === ability?.id);
    if (!registeredAbility || registeredAbility !== ability) return "起動能力が見つかりません。";
    if (ability.conditions.length > 0) return "未対応の使用条件があります。";
    try {
      validateEffects(ability.effects);
      return getCostsDisabledReason(ability.costs, { player, sourceCard: card });
    } catch (error) {
      return error instanceof Error ? error.message : "未対応の能力です。";
    }
  }

  canUseActAbility(card, ability, playerId) {
    return this.getActAbilityDisabledReason(card, ability, playerId) === null;
  }

  /** Card.instanceId + CardAbility.idをcontextへ保存してACT Actionを開始する。 */
  useActAbility(card, ability, playerId) {
    this.#assertMainPhaseAction(playerId);
    const reason = this.getActAbilityDisabledReason(card, ability, playerId);
    if (reason) throw new Error(reason);
    const process = this.processManager.pushProcess({
      type: PROCESS_TYPE.ACT_ABILITY,
      playerId,
      step: ACT_ABILITY_STEP.VALIDATE,
      status: PROCESS_STATUS.RUNNING,
      context: {
        sourceCardInstanceId: card.instanceId,
        abilityId: ability.id,
        costIndex: 0,
        effectIndex: 0,
        effectResults: {},
        groupEffectIndex: null,
        brainstorm: null,
      },
    });
    this.executeActAbilityProcess();
    return process;
  }

  /** ACT_ABILITYを保存済みstep/indexから実行する。 */
  executeActAbilityProcess() {
    const process = this.processManager.getCurrentProcess();
    if (!process || process.type !== PROCESS_TYPE.ACT_ABILITY) return process;
    const player = this.gameState.players[process.playerId];
    const getSource = () => player.stage.find(
      (card) => card.instanceId === process.context.sourceCardInstanceId,
    );
    const getAbility = () => getSource()?.abilities.find(
      (ability) => ability.id === process.context.abilityId,
    );
    while (this.processManager.getCurrentProcess() === process) {
      switch (process.step) {
        case ACT_ABILITY_STEP.VALIDATE: {
          const sourceCard = getSource();
          const ability = getAbility();
          const parent = this.gameState.ruleState.processStack.at(-2);
          const parentValid = parent?.type === PROCESS_TYPE.MAIN_PHASE &&
            parent.playerId === process.playerId &&
            parent.step === MAIN_STEP.WAITING_INPUT &&
            parent.status === PROCESS_STATUS.WAITING_INPUT;
          // Query APIはcurrent ProcessがMAINであることを要求するため、子Process用に同じ条件を再検証する。
          let reason = null;
          if (this.gameState.turn.player !== process.playerId) reason = "自分のターンではありません。";
          else if (this.gameState.phase !== PHASE.MAIN || !parentValid) reason = "メインフェイズの操作待ちではありません。";
          else if (!sourceCard || sourceCard.owner !== process.playerId || sourceCard.zone !== ZONE.STAGE) reason = "このカードは自分の舞台にありません。";
          else if (!ability || ability.type !== ABILITY_TYPE.ACT) reason = "起動能力が見つかりません。";
          else if (ability.conditions.length > 0) reason = "未対応の使用条件があります。";
          else {
            validateEffects(ability.effects);
            reason = getCostsDisabledReason(ability.costs, { player, sourceCard });
          }
          if (reason) {
            this.processManager.popProcess();
            throw new Error(reason);
          }
          this.processManager.updateStep(ACT_ABILITY_STEP.PREPARE);
          break;
        }
        case ACT_ABILITY_STEP.PREPARE:
          process.context.costIndex = 0;
          process.context.effectIndex = 0;
          process.context.effectResults = {};
          process.context.groupEffectIndex = null;
          process.context.brainstorm = null;
          {
            const sourceCard = getSource();
            const ability = getAbility();
            const keyword = ability.keywords.includes("BRAINSTORM") ? "集中" : "能力";
            this.addLog(process.playerId, `「${sourceCard.name}」の【起】${keyword}を使用しました。`);
          }
          this.processManager.updateStep(ACT_ABILITY_STEP.PAY_COST);
          break;
        case ACT_ABILITY_STEP.PAY_COST: {
          const sourceCard = getSource();
          const ability = getAbility();
          const sourcePosition = sourceCard.position;
          // 1件も変更する前に全Costを再検証し、その後だけ記載順に一括支払いする。
          payCosts(ability.costs, { player, sourceCard }, (_cost, index) => {
            process.context.costIndex = index + 1;
          });
          if (sourceCard.position !== sourcePosition) {
            this.emitPositionChangedAfterMutation(sourceCard, sourcePosition, process.playerId);
          }
          this.processManager.updateStep(ACT_ABILITY_STEP.CHECK_POINT_AFTER_COST);
          break;
        }
        case ACT_ABILITY_STEP.CHECK_POINT_AFTER_COST:
          this.processManager.updateStep(ACT_ABILITY_STEP.RESOLVE_EFFECT);
          if (this.resolveCheckPoint() !== RULE_CHECK_RESULT.CONTINUE) return process;
          break;
        case ACT_ABILITY_STEP.RESOLVE_EFFECT: {
          const ability = getAbility();
          if (process.context.effectIndex >= ability.effects.length) {
            this.processManager.updateStep(ACT_ABILITY_STEP.COMPLETE);
            break;
          }
          const topEffect = ability.effects[process.context.effectIndex];
          if (topEffect.type === EFFECT_TYPE.EFFECT_GROUP && process.context.groupEffectIndex === null) {
            const { source, effectId, field } = topEffect.condition;
            const value = resolveEffectResult({ source, effectId, field }, process.context.effectResults, "integer");
            if (value < topEffect.condition.min) {
              process.context.effectIndex += 1;
              break;
            }
            process.context.groupEffectIndex = 0;
          }
          const effect = topEffect.type === EFFECT_TYPE.EFFECT_GROUP
            ? topEffect.effects[process.context.groupEffectIndex]
            : topEffect;
          const completed = this.#resolveActEffect(effect, process, player, getSource());
          if (!completed) return process;
          this.#advanceActEffect(process, topEffect);
          this.processManager.updateStep(ACT_ABILITY_STEP.CHECK_POINT_AFTER_EFFECT);
          break;
        }
        case ACT_ABILITY_STEP.WAIT_FOR_BRAINSTORM_CONFIRMATION:
          if (process.status !== PROCESS_STATUS.WAITING_INPUT) {
            throw new Error("BRAINSTORM_REVEAL confirmation must be waiting for input.");
          }
          return process;
        case ACT_ABILITY_STEP.CHECK_POINT_AFTER_EFFECT:
          this.processManager.updateStep(ACT_ABILITY_STEP.RESOLVE_EFFECT);
          if (this.resolveCheckPoint() !== RULE_CHECK_RESULT.CONTINUE) return process;
          break;
        case ACT_ABILITY_STEP.COMPLETE:
          this.completeCurrentProcess();
          return process;
        default:
          throw new RangeError(`Unknown ACT_ABILITY step: ${process.step}.`);
      }
    }
    return process;
  }

  #advanceActEffect(process, topEffect) {
    if (topEffect.type !== EFFECT_TYPE.EFFECT_GROUP) {
      process.context.effectIndex += 1;
      return;
    }
    process.context.groupEffectIndex += 1;
    if (process.context.groupEffectIndex >= topEffect.effects.length) {
      process.context.groupEffectIndex = null;
      process.context.effectIndex += 1;
    }
  }

  #resolveActEffect(effect, process, player, sourceCard) {
    const results = process.context.effectResults;
    if (effect.type === EFFECT_TYPE.TEST_LOG) {
      resolveEffect(effect, { gameEngine: this, player, playerId: process.playerId, sourceCard });
      return true;
    }
    if (effect.type === EFFECT_TYPE.BRAINSTORM_REVEAL) {
      const state = process.context.brainstorm ?? {
        effectId: effect.id,
        targetCount: effect.count,
        movedCardInstanceIds: [],
      };
      process.context.brainstorm = state;
      while (state.movedCardInstanceIds.length < state.targetCount) {
        const card = player.deck.draw();
        if (!card) {
          if (this.resolveCheckPoint() !== RULE_CHECK_RESULT.CONTINUE) return false;
          throw new Error("BRAINSTORM_REVEAL cannot continue from an empty Deck.");
        }
        card.moveTo({ zone: ZONE.RESOLUTION, index: player.resolution.length + 1 });
        card.setFace(null);
        player.resolution.push(card);
        state.movedCardInstanceIds.push(card.instanceId);
        this.#reindexCards(player.deck.cards);
        this.render();
      }
      const moved = state.movedCardInstanceIds.map((id) => {
        const card = player.resolution.find((candidate) => candidate.instanceId === id);
        if (!card) throw new Error(`Brainstorm card "${id}" is missing from Resolution.`);
        return card;
      });
      results[effect.id] = { climaxCount: moved.filter((card) => card.cardType === "CLIMAX").length };
      this.addLog(process.playerId, `山札の上から${state.targetCount}枚をめくりました。`);
      this.addLog(process.playerId, `クライマックスは${results[effect.id].climaxCount}枚でした。`);
      this.processManager.updateStep(ACT_ABILITY_STEP.WAIT_FOR_BRAINSTORM_CONFIRMATION);
      this.processManager.updateStatus(PROCESS_STATUS.WAITING_INPUT);
      this.render();
      return false;
    }
    if (effect.type === EFFECT_TYPE.SEARCH_DECK) {
      const maxSelect = typeof effect.maxSelect === "number"
        ? effect.maxSelect
        : resolveEffectResult(effect.maxSelect, results, "integer");
      this.processManager.pushProcess({
        type: PROCESS_TYPE.SEARCH_DECK,
        playerId: process.playerId,
        step: SEARCH_DECK_STEP.PREPARE,
        status: PROCESS_STATUS.RUNNING,
        context: {
          playerId: process.playerId,
          sourceCardInstanceId: sourceCard.instanceId,
          abilityId: process.context.abilityId,
          effectId: effect.id,
          minSelect: effect.minSelect,
          maxSelect,
          filter: effect.filter,
          selectedCardInstanceIds: [],
        },
      });
      this.executeSearchDeckProcess();
      return false;
    }
    if (effect.type === EFFECT_TYPE.ADD_TO_HAND) {
      const ids = resolveEffectResult(effect.cards, results, "instanceIds");
      ids.forEach((id) => {
        const card = player.deck.cards.find((candidate) => candidate.instanceId === id);
        if (!card) throw new Error(`Selected Deck card "${id}" does not exist.`);
        player.deck.remove(card);
        card.moveTo({ zone: ZONE.HAND, index: player.hand.length + 1 });
        player.hand.push(card);
      });
      this.#reindexCards(player.deck.cards);
      return true;
    }
    if (effect.type === EFFECT_TYPE.SHUFFLE_DECK) {
      player.deck.shuffle();
      this.#reindexCards(player.deck.cards);
      results[effect.id] = { shuffled: true };
      return true;
    }
    throw new RangeError(`Unsupported ACT effect: ${effect.type}.`);
  }

  getBrainstormConfirmationState(playerId = "self") {
    const process = this.processManager.getCurrentProcess();
    if (process?.type !== PROCESS_TYPE.ACT_ABILITY || process.playerId !== playerId ||
        process.step !== ACT_ABILITY_STEP.WAIT_FOR_BRAINSTORM_CONFIRMATION ||
        process.status !== PROCESS_STATUS.WAITING_INPUT || !process.context.brainstorm) return null;
    const state = process.context.brainstorm;
    const player = this.gameState.players[playerId];
    const cards = state.movedCardInstanceIds.map((id) =>
      player.resolution.find((card) => card.instanceId === id),
    );
    if (cards.some((card) => !card)) throw new Error("A revealed card is missing from Resolution.");
    return {
      count: state.targetCount,
      cards,
      climaxCount: process.context.effectResults[state.effectId].climaxCount,
    };
  }

  confirmBrainstormReveal(playerId = "self") {
    const process = this.processManager.getCurrentProcess();
    const state = this.getBrainstormConfirmationState(playerId);
    if (!state) throw new Error("BRAINSTORM_REVEAL is not waiting for confirmation.");
    const player = this.gameState.players[playerId];
    state.cards.forEach((card) => {
      const index = player.resolution.indexOf(card);
      if (index < 0) throw new Error(`Brainstorm card "${card.instanceId}" is missing from Resolution.`);
      player.resolution.splice(index, 1);
      card.moveTo({ zone: ZONE.WAITING_ROOM, index: player.waitingRoom.length + 1 });
      player.waitingRoom.push(card);
    });
    this.#reindexCards(player.resolution);
    process.context.brainstorm = null;
    const ability = player.stage.find((card) => card.instanceId === process.context.sourceCardInstanceId)
      ?.abilities.find((item) => item.id === process.context.abilityId);
    const topEffect = ability?.effects[process.context.effectIndex];
    this.#advanceActEffect(process, topEffect);
    process.step = ACT_ABILITY_STEP.CHECK_POINT_AFTER_EFFECT;
    process.status = PROCESS_STATUS.RUNNING;
    this.executeActAbilityProcess();
    return state.cards;
  }

  executeSearchDeckProcess() {
    const process = this.processManager.getCurrentProcess();
    if (!process || process.type !== PROCESS_TYPE.SEARCH_DECK) return process;
    if (process.step === SEARCH_DECK_STEP.PREPARE) {
      this.processManager.updateStep(SEARCH_DECK_STEP.WAIT_FOR_SELECTION);
      this.processManager.updateStatus(PROCESS_STATUS.WAITING_INPUT);
      this.render();
    } else if (process.step === SEARCH_DECK_STEP.COMPLETE) {
      this.completeCurrentProcess();
    }
    return process;
  }

  getSearchDeckState(playerId = "self") {
    const process = this.processManager.getCurrentProcess();
    if (process?.type !== PROCESS_TYPE.SEARCH_DECK || process.playerId !== playerId ||
        process.step !== SEARCH_DECK_STEP.WAIT_FOR_SELECTION) return null;
    const player = this.gameState.players[playerId];
    return {
      ...process.context,
      cards: [...player.deck.cards],
      eligibleCardInstanceIds: player.deck.cards
        .filter((card) => cardMatchesSearchFilter(card, process.context.filter))
        .map((card) => card.instanceId),
    };
  }

  toggleSearchDeckSelection(cardInstanceId, playerId = "self") {
    const process = this.processManager.getCurrentProcess();
    const state = this.getSearchDeckState(playerId);
    if (!state) throw new Error("SEARCH_DECK is not waiting for selection.");
    if (!state.eligibleCardInstanceIds.includes(cardInstanceId)) throw new Error("This card is not eligible for this search.");
    const selected = process.context.selectedCardInstanceIds;
    const index = selected.indexOf(cardInstanceId);
    if (index >= 0) selected.splice(index, 1);
    else {
      if (selected.length >= process.context.maxSelect) throw new Error("SEARCH_DECK maxSelect exceeded.");
      selected.push(cardInstanceId);
    }
    this.render();
    return [...selected];
  }

  confirmSearchDeckSelection(playerId = "self") {
    const search = this.processManager.getCurrentProcess();
    const state = this.getSearchDeckState(playerId);
    if (!state) throw new Error("SEARCH_DECK is not waiting for selection.");
    if (state.selectedCardInstanceIds.length < state.minSelect || state.selectedCardInstanceIds.length > state.maxSelect) throw new Error("SEARCH_DECK selection count is invalid.");
    if (new Set(state.selectedCardInstanceIds).size !== state.selectedCardInstanceIds.length ||
        state.selectedCardInstanceIds.some((id) => !state.eligibleCardInstanceIds.includes(id))) {
      throw new Error("SEARCH_DECK selection contains an invalid card.");
    }
    const parent = this.gameState.ruleState.processStack.at(-2);
    if (parent?.type !== PROCESS_TYPE.ACT_ABILITY) throw new Error("SEARCH_DECK parent must be ACT_ABILITY.");
    parent.context.effectResults[state.effectId] = { selectedCardInstanceIds: [...state.selectedCardInstanceIds] };
    const source = this.gameState.players[playerId].stage.find((card) => card.instanceId === parent.context.sourceCardInstanceId);
    const ability = source?.abilities.find((item) => item.id === parent.context.abilityId);
    const topEffect = ability?.effects[parent.context.effectIndex];
    this.#advanceActEffect(parent, topEffect);
    search.step = SEARCH_DECK_STEP.COMPLETE;
    search.status = PROCESS_STATUS.RUNNING;
    this.executeSearchDeckProcess();
    return [...state.selectedCardInstanceIds];
  }

  /** 選択中Stage Characterの現在slotを除く4つのDestinationを返す。 */
  getMainStageMoveDestinations(card, playerId) {
    if (!this.canSelectStageCardForMain(card, playerId)) return [];
    return MAIN_STAGE_DESTINATIONS
      .filter(({ row, index }) => row !== card.row || index !== card.index)
      .map((destination) => ({ ...destination }));
  }

  /** Stage Characterを指定DestinationへMove/Swapできる基本条件。 */
  canMoveStageCard(card, destination, playerId) {
    return this.canSelectStageCardForMain(card, playerId) &&
      this.#isMainStageDestination(destination, playerId) &&
      (card.row !== destination.row || card.index !== destination.index);
  }

  /** Stage Characterを空きslotへ移動する子Action Processを開始する。 */
  moveStageCard(card, playerId, destination) {
    this.#assertMainPhaseAction(playerId);
    if (!this.canMoveStageCard(card, destination, playerId)) {
      throw new Error("Stage Move条件を満たしていません。");
    }
    const destinationCard = this.#findStageCard(playerId, destination);
    if (destinationCard) throw new Error("Stage Move先にカードがあります。");
    const process = this.processManager.pushProcess({
      type: PROCESS_TYPE.MOVE_STAGE,
      playerId,
      step: MOVE_STAGE_STEP.VALIDATE,
      status: PROCESS_STATUS.RUNNING,
      context: {
        cardId: card.id,
        source: { row: card.row, index: card.index },
        destination: { row: destination.row, index: destination.index },
      },
    });
    this.executeMoveStageProcess();
    return process;
  }

  /** MOVE_STAGEを保存済みstepから実行する。 */
  executeMoveStageProcess() {
    const process = this.processManager.getCurrentProcess();
    if (!process || process.type !== PROCESS_TYPE.MOVE_STAGE) return process;
    const player = this.gameState.players[process.playerId];
    const getCard = () => player.stage.find((card) => card.id === process.context.cardId);
    while (this.processManager.getCurrentProcess() === process) {
      switch (process.step) {
        case MOVE_STAGE_STEP.VALIDATE: {
          const card = getCard();
          if (!this.#isValidStageActionParent(process) ||
            !this.#matchesStageLocation(card, process.context.source) ||
            !this.#isStageCardOwnedBy(card, process.playerId) ||
            !this.#isMainStageDestination(process.context.destination, process.playerId) ||
            (card.row === process.context.destination.row && card.index === process.context.destination.index) ||
            this.#findStageCard(process.playerId, process.context.destination)) {
            this.processManager.popProcess();
            throw new Error("Stage Move context is no longer valid.");
          }
          this.processManager.updateStep(MOVE_STAGE_STEP.MOVE);
          break;
        }
        case MOVE_STAGE_STEP.MOVE: {
          const card = getCard();
          card.moveTo({ zone: ZONE.STAGE, ...process.context.destination });
          this.addLog(process.playerId, `${card.name}を舞台内で移動しました。`);
          this.processManager.updateStep(MOVE_STAGE_STEP.CHECK_POINT);
          this.render();
          break;
        }
        case MOVE_STAGE_STEP.CHECK_POINT: {
          this.processManager.updateStep(MOVE_STAGE_STEP.COMPLETE);
          if (this.resolveCheckPoint() !== RULE_CHECK_RESULT.CONTINUE) return process;
          break;
        }
        case MOVE_STAGE_STEP.COMPLETE:
          this.completeCurrentProcess();
          return process;
        default:
          throw new RangeError(`Unknown MOVE_STAGE step: ${process.step}.`);
      }
    }
    return process;
  }

  /** 2枚のStage Characterを交換する子Action Processを開始する。 */
  swapStageCards(card, destinationCard, playerId) {
    this.#assertMainPhaseAction(playerId);
    const destination = destinationCard
      ? { row: destinationCard.row, index: destinationCard.index }
      : null;
    if (!this.canMoveStageCard(card, destination, playerId) ||
      !this.canSelectStageCardForMain(destinationCard, playerId)) {
      throw new Error("Stage Swap条件を満たしていません。");
    }
    const process = this.processManager.pushProcess({
      type: PROCESS_TYPE.SWAP_STAGE,
      playerId,
      step: SWAP_STAGE_STEP.VALIDATE,
      status: PROCESS_STATUS.RUNNING,
      context: {
        cardId: card.id,
        destinationCardId: destinationCard.id,
        source: { row: card.row, index: card.index },
        destination: { ...destination },
      },
    });
    this.executeSwapStageProcess();
    return process;
  }

  /** SWAP_STAGEを保存済みstepから実行する。 */
  executeSwapStageProcess() {
    const process = this.processManager.getCurrentProcess();
    if (!process || process.type !== PROCESS_TYPE.SWAP_STAGE) return process;
    const player = this.gameState.players[process.playerId];
    const getSource = () => player.stage.find((card) => card.id === process.context.cardId);
    const getDestination = () => player.stage.find((card) => card.id === process.context.destinationCardId);
    while (this.processManager.getCurrentProcess() === process) {
      switch (process.step) {
        case SWAP_STAGE_STEP.VALIDATE: {
          const source = getSource();
          const destination = getDestination();
          if (!this.#isValidStageActionParent(process) ||
            !this.#matchesStageLocation(source, process.context.source) ||
            !this.#matchesStageLocation(destination, process.context.destination) ||
            !this.#isStageCardOwnedBy(source, process.playerId) ||
            !this.#isStageCardOwnedBy(destination, process.playerId) ||
            !this.#isMainStageDestination(process.context.destination, process.playerId) ||
            (source.row === process.context.destination.row && source.index === process.context.destination.index)) {
            this.processManager.popProcess();
            throw new Error("Stage Swap context is no longer valid.");
          }
          this.processManager.updateStep(SWAP_STAGE_STEP.SWAP);
          break;
        }
        case SWAP_STAGE_STEP.SWAP: {
          const source = getSource();
          const destination = getDestination();
          const sourceLocation = { ...process.context.source };
          source.moveTo({ zone: ZONE.STAGE, ...process.context.destination });
          destination.moveTo({ zone: ZONE.STAGE, ...sourceLocation });
          this.addLog(process.playerId, `${source.name}と${destination.name}を入れ替えました。`);
          this.processManager.updateStep(SWAP_STAGE_STEP.CHECK_POINT);
          this.render();
          break;
        }
        case SWAP_STAGE_STEP.CHECK_POINT: {
          this.processManager.updateStep(SWAP_STAGE_STEP.COMPLETE);
          if (this.resolveCheckPoint() !== RULE_CHECK_RESULT.CONTINUE) return process;
          break;
        }
        case SWAP_STAGE_STEP.COMPLETE:
          this.completeCurrentProcess();
          return process;
        default:
          throw new RangeError(`Unknown SWAP_STAGE step: ${process.step}.`);
      }
    }
    return process;
  }

  /**
   * MAINフェイズの入力待ちProcessを開始する。
   * MAIN内の個別Actionは将来このProcessの上に積む。
   *
   * @returns {import("./processManager.js").Process}
   */
  startMainPhase() {
    const playerId = this.gameState.turn.player;
    this.#assertPlayerId(playerId);

    const process = this.processManager.pushProcess({
      type: PROCESS_TYPE.MAIN_PHASE,
      playerId,
      step: MAIN_STEP.START,
      status: PROCESS_STATUS.RUNNING,
      context: {},
    });

    this.executeMainPhaseProcess();
    return process;
  }

  /**
   * MAIN Processを保存済みstepから実行する。
   * F-1ではプレイヤーの終了操作を待つだけで、カードActionは実行しない。
   *
   * @returns {import("./processManager.js").Process|null}
   */
  executeMainPhaseProcess() {
    const mainProcess = this.processManager.getCurrentProcess();
    if (!mainProcess) {
      return null;
    }

    if (mainProcess.type !== PROCESS_TYPE.MAIN_PHASE) {
      throw new Error("The current Process is not MAIN_PHASE.");
    }

    while (this.processManager.getCurrentProcess() === mainProcess) {
      switch (mainProcess.step) {
        case MAIN_STEP.START:
          this.processManager.updateStep(MAIN_STEP.WAITING_INPUT);
          this.processManager.updateStatus(PROCESS_STATUS.WAITING_INPUT);
          return mainProcess;
        case MAIN_STEP.WAITING_INPUT:
          if (mainProcess.status !== PROCESS_STATUS.WAITING_INPUT) {
            throw new Error("MAIN phase input step must be waiting for input.");
          }
          return mainProcess;
        case MAIN_STEP.END_MAIN:
          this.processManager.updateStep(MAIN_STEP.COMPLETE);
          break;
        case MAIN_STEP.COMPLETE: {
          const result = this.completeCurrentProcess();
          if (
            result === RULE_CHECK_RESULT.CONTINUE &&
            !this.gameState.gameResult.finished &&
            this.gameState.phase === PHASE.MAIN
          ) {
            this.nextPhase();
          }
          return mainProcess;
        }
        default:
          throw new RangeError(`Unknown MAIN_PHASE step: ${mainProcess.step}.`);
      }
    }

    return mainProcess;
  }

  /**
   * MAINフェイズを終了し、次フェイズへ進める。
   *
   * @param {'self'|'opponent'} playerId
   * @returns {void}
   */
  endMainPhase(playerId) {
    this.#assertMainPhaseAction(playerId);
    this.processManager.updateStep(MAIN_STEP.END_MAIN);
    this.processManager.updateStatus(PROCESS_STATUS.RUNNING);
    this.executeMainPhaseProcess();
  }

  /**
   * CLOCK Processの選択を確定し、保存済みstepから処理を進める。
   *
   * @param {'self'|'opponent'} playerId
   * @param {number} handIndex
   * @returns {import("../models/card.js").Card} クロックへ置いたカード
   */
  clockCard(playerId, handIndex) {
    const clockProcess = this.#assertClockAction(playerId);
    const player = this.gameState.players[playerId];
    if (!Number.isInteger(handIndex) || handIndex < 1) {
      throw new TypeError("handIndex must be a positive integer.");
    }
    const card = player.hand[handIndex - 1];
    if (!card) {
      throw new RangeError("handIndex is outside the hand.");
    }

    clockProcess.context.handIndex = handIndex;
    this.processManager.updateStep(CLOCK_STEP.MOVE_TO_CLOCK);
    this.processManager.updateStatus(PROCESS_STATUS.RUNNING);
    this.executeClockPhaseProcess();

    return card;
  }

  /**
   * カードをクロックへ置かず、CLOCKフェイズを終了する。
   *
   * @param {'self'|'opponent'} playerId
   * @returns {void}
   */
  skipClockPhase(playerId) {
    this.#assertClockAction(playerId);
    this.addLog(playerId, "クロックに置かず次のフェイズへ進みました。");
    this.processManager.updateStep(CLOCK_STEP.COMPLETE);
    this.processManager.updateStatus(PROCESS_STATUS.RUNNING);
    this.executeClockPhaseProcess();
  }

  /**
   * スタック最上段のCLOCK Processを、保存済みstepから実行する。
   * Check Pointで割り込みが始まった場合は、その場で処理を停止する。
   *
   * @returns {import("./processManager.js").Process|null}
   */
  executeClockPhaseProcess() {
    const clockProcess = this.processManager.getCurrentProcess();
    if (!clockProcess) {
      return null;
    }

    if (clockProcess.type !== PROCESS_TYPE.CLOCK_PHASE) {
      throw new Error("The current Process is not CLOCK_PHASE.");
    }

    while (this.processManager.getCurrentProcess() === clockProcess) {
      switch (clockProcess.step) {
        case CLOCK_STEP.WAIT_FOR_SELECTION:
          if (clockProcess.status !== PROCESS_STATUS.WAITING_INPUT) {
            throw new Error("CLOCK selection step must be waiting for input.");
          }
          return clockProcess;
        case CLOCK_STEP.MOVE_TO_CLOCK:
          this.moveHandCardToClock(
            clockProcess.playerId,
            clockProcess.context.handIndex,
          );
          this.processManager.updateStep(CLOCK_STEP.CHECK_POINT_AFTER_CLOCK);
          this.addLog(clockProcess.playerId, "手札を1枚クロックに置きました。");
          this.render();
          break;
        case CLOCK_STEP.CHECK_POINT_AFTER_CLOCK: {
          this.processManager.updateStep(CLOCK_STEP.DRAW_1);
          const result = this.resolveCheckPoint();
          if (result !== RULE_CHECK_RESULT.CONTINUE) {
            return clockProcess;
          }
          break;
        }
        case CLOCK_STEP.DRAW_1:
          this.drawCards(clockProcess.playerId, 1);
          this.processManager.updateStep(CLOCK_STEP.CHECK_POINT_AFTER_DRAW_1);
          break;
        case CLOCK_STEP.CHECK_POINT_AFTER_DRAW_1: {
          this.processManager.updateStep(CLOCK_STEP.DRAW_2);
          const result = this.resolveCheckPoint();
          if (result !== RULE_CHECK_RESULT.CONTINUE) {
            return clockProcess;
          }
          break;
        }
        case CLOCK_STEP.DRAW_2:
          this.drawCards(clockProcess.playerId, 1);
          this.processManager.updateStep(CLOCK_STEP.CHECK_POINT_AFTER_DRAW_2);
          break;
        case CLOCK_STEP.CHECK_POINT_AFTER_DRAW_2: {
          this.processManager.updateStep(CLOCK_STEP.COMPLETE);
          const result = this.resolveCheckPoint();
          if (result !== RULE_CHECK_RESULT.CONTINUE) {
            return clockProcess;
          }
          break;
        }
        case CLOCK_STEP.COMPLETE: {
          const result = this.completeCurrentProcess();
          if (
            result === RULE_CHECK_RESULT.CONTINUE &&
            !this.gameState.gameResult.finished &&
            this.gameState.phase === PHASE.CLOCK
          ) {
            this.nextPhase();
          }
          return clockProcess;
        }
        default:
          throw new RangeError(`Unknown CLOCK_PHASE step: ${clockProcess.step}.`);
      }
    }

    return clockProcess;
  }

  /**
   * 手札1枚をクロックの末尾へ移動する低レベル操作。
   * GameStateだけを更新し、描画・ドロー・フェイズ進行は行わない。
   *
   * @param {'self'|'opponent'} playerId
   * @param {number} handIndex 1始まりの手札位置
   * @returns {import("../models/card.js").Card}
   */
  moveHandCardToClock(playerId, handIndex) {
    this.#assertPlayerId(playerId);

    if (!Number.isInteger(handIndex) || handIndex < 1) {
      throw new TypeError("handIndex must be a positive integer.");
    }

    const player = this.gameState.players[playerId];
    if (handIndex > player.hand.length) {
      throw new RangeError("handIndex is outside the hand.");
    }

    const [card] = player.hand.splice(handIndex - 1, 1);
    if (!card) {
      throw new RangeError("The selected hand card does not exist.");
    }

    this.#reindexCards(player.hand);
    card.owner = playerId;
    card.moveTo({
      zone: ZONE.CLOCK,
      row: null,
      index: player.clock.length + 1,
    });
    card.setPosition(POSITION.STAND);
    player.clock.push(card);

    return card;
  }

  /**
   * 山札の一番上のカードをクロック末尾へ移動する低レベル操作。
   * GameStateだけを更新し、描画・フェイズ進行・割り込み判定は行わない。
   *
   * @param {'self'|'opponent'} playerId
   * @returns {import("../models/card.js").Card|null}
   */
  moveDeckCardToClock(playerId) {
    this.#assertPlayerId(playerId);
    const player = this.gameState.players[playerId];
    const card = player.deck.draw();

    if (!card) {
      return null;
    }

    card.owner = playerId;
    card.moveTo({
      zone: ZONE.CLOCK,
      row: null,
      index: player.clock.length + 1,
    });
    card.setPosition(POSITION.STAND);
    player.clock.push(card);
    this.#reindexCards(player.deck.cards);
    return card;
  }

  /**
   * 指定プレイヤーの山札上から1枚をストック上へ移動する。
   * DEV補助用の低レベル操作であり、Rule CheckやProcess開始は行わない。
   *
   * @param {'self'|'opponent'} playerId
   * @returns {import("../models/card.js").Card|null}
   */
  moveDeckCardToStock(playerId) {
    this.#assertPlayerId(playerId);
    const player = this.gameState.players[playerId];
    const card = player.deck.draw();

    if (!card) {
      return null;
    }

    card.owner = playerId;
    card.moveTo({
      zone: ZONE.STOCK,
      row: null,
      index: player.stock.length + 1,
    });
    card.setPosition(POSITION.STAND);
    card.setFace(null);
    player.stock.push(card);
    this.#reindexCards(player.deck.cards);
    return card;
  }

  /**
   * 指定プレイヤーのREFRESH Processをスタックへ追加して実行する。
   * Phase Bでは自動検出を行わず、明示的な呼び出しだけを受け付ける。
   *
   * @param {'self'|'opponent'} playerId
   * @returns {import("./processManager.js").Process}
   */
  startRefresh(playerId) {
    this.#assertPlayerId(playerId);

    const process = this.processManager.pushProcess({
      type: PROCESS_TYPE.REFRESH,
      playerId,
      step: REFRESH_STEP.MOVE_WAITING_ROOM_TO_DECK,
      status: PROCESS_STATUS.RUNNING,
      context: {},
    });

    this.addLog(playerId, "リフレッシュを開始しました。");
    this.executeRefreshProcess();
    return process;
  }

  /**
   * スタック最上段のREFRESH Processを、次のstepから実行する。
   * 各確定stepで次stepを先に設定してから描画する。
   *
   * @returns {import("./processManager.js").Process|null}
   */
  executeRefreshProcess() {
    const refreshProcess = this.processManager.getCurrentProcess();
    if (!refreshProcess) {
      return null;
    }

    if (refreshProcess.type !== PROCESS_TYPE.REFRESH) {
      throw new Error("The current Process is not REFRESH.");
    }

    while (this.processManager.getCurrentProcess() === refreshProcess) {
      switch (refreshProcess.step) {
        case REFRESH_STEP.MOVE_WAITING_ROOM_TO_DECK: {
          const movedCount = this.moveWaitingRoomToDeck(
            refreshProcess.playerId,
          );
          this.processManager.updateStep(REFRESH_STEP.SHUFFLE_DECK);
          this.addLog(
            refreshProcess.playerId,
            `控え室のカード${movedCount}枚を山札に戻しました。`,
          );
          this.render();
          break;
        }
        case REFRESH_STEP.SHUFFLE_DECK: {
          const player = this.gameState.players[refreshProcess.playerId];
          player.deck.shuffle();
          this.#reindexCards(player.deck.cards);
          this.processManager.updateStep(REFRESH_STEP.COMPLETE);
          this.addLog(refreshProcess.playerId, "山札をシャッフルしました。");
          this.render();
          break;
        }
        case REFRESH_STEP.COMPLETE:
          this.gameState.ruleState.pendingChecks.push({
            type: PROCESS_TYPE.REFRESH_PENALTY,
            playerId: refreshProcess.playerId,
          });
          this.addLog(refreshProcess.playerId, "リフレッシュが完了しました。");
          this.completeCurrentProcess();
          return refreshProcess;
        default:
          throw new RangeError(
            `Unknown REFRESH step: ${refreshProcess.step}.`,
          );
      }
    }

    return refreshProcess;
  }

  /**
   * REFRESH完了で発生したリフレッシュペナルティを実行する。
   * pendingChecksからのconsumeは、呼び出し元のresolveRuleCheckが担当する。
   *
   * @param {'self'|'opponent'} playerId
   * @returns {import("./processManager.js").Process}
   */
  startRefreshPenalty(playerId) {
    this.#assertPlayerId(playerId);

    const process = this.processManager.pushProcess({
      type: PROCESS_TYPE.REFRESH_PENALTY,
      playerId,
      step: REFRESH_PENALTY_STEP.MOVE_TOP_CARD,
      status: PROCESS_STATUS.RUNNING,
      context: {},
    });

    this.addLog(playerId, "リフレッシュペナルティを開始しました。");
    this.executeRefreshPenaltyProcess();
    return process;
  }

  /**
   * スタック最上段のREFRESH_PENALTY Processを保存済みstepから実行する。
   * ペナルティカードをクロックへ置いた後は、必ずCheck Pointで停止判定する。
   *
   * @returns {import("./processManager.js").Process|null}
   */
  executeRefreshPenaltyProcess() {
    const penaltyProcess = this.processManager.getCurrentProcess();
    if (!penaltyProcess) {
      return null;
    }

    if (penaltyProcess.type !== PROCESS_TYPE.REFRESH_PENALTY) {
      throw new Error("The current Process is not REFRESH_PENALTY.");
    }

    while (this.processManager.getCurrentProcess() === penaltyProcess) {
      switch (penaltyProcess.step) {
        case REFRESH_PENALTY_STEP.MOVE_TOP_CARD:
          this.moveDeckCardToClock(penaltyProcess.playerId);
          this.processManager.updateStep(REFRESH_PENALTY_STEP.CHECK_POINT);
          this.addLog(penaltyProcess.playerId, "山札から1枚をクロックに置きました。");
          this.render();
          break;
        case REFRESH_PENALTY_STEP.CHECK_POINT: {
          this.processManager.updateStep(REFRESH_PENALTY_STEP.COMPLETE);
          const result = this.resolveCheckPoint();
          if (result !== RULE_CHECK_RESULT.CONTINUE) {
            return penaltyProcess;
          }
          break;
        }
        case REFRESH_PENALTY_STEP.COMPLETE:
          this.addLog(penaltyProcess.playerId, "リフレッシュペナルティが完了しました。");
          this.completeCurrentProcess();
          return penaltyProcess;
        default:
          throw new RangeError(
            `Unknown REFRESH_PENALTY step: ${penaltyProcess.step}.`,
          );
      }
    }

    return penaltyProcess;
  }

  /**
   * 控え室の全カードを山札末尾へ移す低レベル操作。
   * GameStateだけを更新し、シャッフル・描画・Process操作は行わない。
   *
   * @param {'self'|'opponent'} playerId
   * @returns {number} 山札へ移動した枚数
   */
  moveWaitingRoomToDeck(playerId) {
    this.#assertPlayerId(playerId);
    const player = this.gameState.players[playerId];
    const cards = player.waitingRoom.splice(0, player.waitingRoom.length);

    cards.forEach((card) => {
      card.owner = playerId;
      card.moveTo({
        zone: ZONE.DECK,
        row: null,
        index: player.deck.cards.length + 1,
      });
      card.setPosition(POSITION.STAND);
      player.deck.addBottom(card);
    });

    this.#reindexCards(player.deck.cards);
    return cards.length;
  }

  /**
   * 指定プレイヤーのLEVEL_UP Processを開始する。
   *
   * @param {'self'|'opponent'} playerId
   * @returns {import("./processManager.js").Process}
   */
  startLevelUp(playerId) {
    this.#assertPlayerId(playerId);

    const process = this.processManager.pushProcess({
      type: PROCESS_TYPE.LEVEL_UP,
      playerId,
      step: LEVEL_UP_STEP.PREPARE_SELECTION,
      status: PROCESS_STATUS.RUNNING,
      context: {},
    });

    try {
      this.addLog(playerId, "レベルアップを開始しました。");
      this.executeLevelUpProcess();
      return process;
    } catch (error) {
      if (this.processManager.getCurrentProcess() === process) {
        this.processManager.popProcess();
      }
      this.render();
      throw error;
    }
  }

  /**
   * 現在のLEVEL_UP Processを入力待ちまたは完了まで進める。
   *
   * @returns {import("./processManager.js").Process|null}
   */
  executeLevelUpProcess() {
    const levelUpProcess = this.processManager.getCurrentProcess();
    if (!levelUpProcess) {
      return null;
    }
    if (levelUpProcess.type !== PROCESS_TYPE.LEVEL_UP) {
      throw new Error("The current Process is not LEVEL_UP.");
    }

    while (this.processManager.getCurrentProcess() === levelUpProcess) {
      switch (levelUpProcess.step) {
        case LEVEL_UP_STEP.PREPARE_SELECTION:
          this.#assertLevelUpCandidates(levelUpProcess.playerId);
          this.processManager.updateStep(LEVEL_UP_STEP.WAIT_FOR_SELECTION);
          this.processManager.updateStatus(PROCESS_STATUS.WAITING_INPUT);
          this.#showLevelUpOverlay();
          this.render();
          return levelUpProcess;
        case LEVEL_UP_STEP.WAIT_FOR_SELECTION:
          if (levelUpProcess.status !== PROCESS_STATUS.WAITING_INPUT) {
            throw new Error("LEVEL_UP selection step must be waiting for input.");
          }
          return levelUpProcess;
        case LEVEL_UP_STEP.RESOLVE_SELECTION:
          this.#resolveLevelUpSelection(levelUpProcess);
          this.processManager.updateStep(LEVEL_UP_STEP.COMPLETE);
          this.render();
          break;
        case LEVEL_UP_STEP.COMPLETE:
          this.addLog(levelUpProcess.playerId, "レベルアップが完了しました。");
          this.#restorePhaseMessageOverlay();
          this.completeCurrentProcess();
          return levelUpProcess;
        default:
          throw new RangeError(`Unknown LEVEL_UP step: ${levelUpProcess.step}.`);
      }
    }

    return levelUpProcess;
  }

  /**
   * LEVEL_UPでレベルに置くクロックカードを確定する。
   * selectedClockIndexはclock配列の0始まりインデックス。
   *
   * @param {'self'|'opponent'} playerId
   * @param {number} selectedClockIndex
   * @returns {import("../models/card.js").Card}
   */
  submitLevelUpSelection(playerId, selectedClockIndex) {
    this.#assertPlayerId(playerId);
    const process = this.processManager.getCurrentProcess();

    if (!process || process.type !== PROCESS_TYPE.LEVEL_UP) {
      throw new Error("LEVEL_UP is not the current Process.");
    }
    if (
      process.step !== LEVEL_UP_STEP.WAIT_FOR_SELECTION ||
      process.status !== PROCESS_STATUS.WAITING_INPUT
    ) {
      throw new Error("LEVEL_UP is not waiting for a selection.");
    }
    if (process.playerId !== playerId) {
      throw new Error("playerId does not match the LEVEL_UP Process.");
    }

    this.#assertLevelUpSelection(playerId, selectedClockIndex);
    process.context.selectedClockIndex = selectedClockIndex;
    this.processManager.updateStep(LEVEL_UP_STEP.RESOLVE_SELECTION);
    this.processManager.updateStatus(PROCESS_STATUS.RUNNING);
    this.executeLevelUpProcess();

    return this.gameState.players[playerId].level.at(-1);
  }

  /**
   * 現在の両プレイヤー状態を読み取り、共通ルール事象を判定する。
   * GameState、Process、ログ、表示には副作用を与えない。
   *
   * @returns {{checkedPlayers: string[], turnPlayer: string, defeatCandidates: object[], defeats: object[], interrupts: object[], winner: string|null, loser: string|null, reason: string|null, simultaneousDefeatRule: object}}
   */
  runRuleCheck() {
    const turnPlayer = this.gameState.turn.player;
    this.#assertPlayerId(turnPlayer);

    const interrupts = [];
    const defeatCandidates = [];

    PLAYER_IDS.forEach((playerId) => {
      const player = this.gameState.players[playerId];
      const deckEmpty = player.deck.cards.length === 0;
      const waitingRoomEmpty = player.waitingRoom.length === 0;
      const levelUpOccurred = player.clock.length >= 7;
      const levelUpExecutable = levelUpOccurred && player.level.length < 3;

      if (deckEmpty) {
        interrupts.push({
          type: PROCESS_TYPE.REFRESH,
          playerId,
          occurred: true,
          executable: !waitingRoomEmpty,
          canResolveEmptyDeckAndWaitingRoom: !waitingRoomEmpty,
        });
      }

      if (levelUpOccurred) {
        interrupts.push({
          type: PROCESS_TYPE.LEVEL_UP,
          playerId,
          occurred: true,
          executable: levelUpExecutable,
          canResolveEmptyDeckAndWaitingRoom: levelUpExecutable,
        });
      }

      if (player.level.length >= 4) {
        defeatCandidates.push({
          playerId,
          reason: DEFEAT_REASON.LEVEL_LIMIT,
          deferred: false,
          deferredBy: [],
        });
      } else if (player.level.length >= 3 && levelUpOccurred) {
        defeatCandidates.push({
          playerId,
          reason: DEFEAT_REASON.LEVEL_AND_CLOCK,
          deferred: false,
          deferredBy: [],
        });
      }

      if (deckEmpty && waitingRoomEmpty) {
        const deferredBy = levelUpExecutable
          ? [{ type: PROCESS_TYPE.LEVEL_UP, playerId }]
          : [];
        defeatCandidates.push({
          playerId,
          reason: DEFEAT_REASON.EMPTY_DECK_AND_WAITING_ROOM,
          deferred: deferredBy.length > 0,
          deferredBy,
        });
      }
    });

    const defeats = defeatCandidates
      .filter((candidate) => !candidate.deferred)
      .map(({ playerId, reason }) => ({ playerId, reason }));
    const defeatedPlayers = [...new Set(defeats.map(({ playerId }) => playerId))];
    let winner = null;
    let loser = null;
    let reason = null;

    if (defeatedPlayers.length >= 2) {
      winner = turnPlayer;
      loser = PLAYER_IDS.find((playerId) => playerId !== winner) ?? null;
    } else if (defeatedPlayers.length === 1) {
      [loser] = defeatedPlayers;
      winner = PLAYER_IDS.find((playerId) => playerId !== loser) ?? null;
    }
    if (loser) {
      reason = defeats.find((defeat) => defeat.playerId === loser)?.reason ?? null;
    }

    return {
      checkedPlayers: [...PLAYER_IDS],
      turnPlayer,
      defeatCandidates,
      defeats,
      interrupts,
      winner,
      loser,
      reason,
      simultaneousDefeatRule: {
        winnerPlayerId: turnPlayer,
        appliesOnlyAfterBothDefeatsAreConfirmed: true,
      },
    };
  }

  /**
   * 共通Rule Checkの結果から、続行・割り込み・敗北を決定する。
   * 通常のCheck Pointはこのメソッドを呼び、runRuleCheck()を直接呼ばない。
   *
   * @returns {string} RULE_CHECK_RESULTのいずれか
   */
  resolveRuleCheck() {
    if (this.gameState.gameResult.finished) {
      return RULE_CHECK_RESULT.GAME_OVER;
    }

    const result = this.runRuleCheck();
    this.gameState.ruleState.pendingInterrupts.splice(
      0,
      this.gameState.ruleState.pendingInterrupts.length,
    );

    if (result.defeats.length > 0) {
      this.finishGame(result);
      return RULE_CHECK_RESULT.GAME_OVER;
    }

    const executableInterrupts = this.#uniqueInterrupts(
      result.interrupts.filter((interrupt) => interrupt.executable),
    );
    const pendingCheckCandidates = this.#getExecutablePendingChecks();
    const executionCandidates = [
      ...executableInterrupts,
      ...pendingCheckCandidates,
    ];

    if (executionCandidates.length === 0) {
      return RULE_CHECK_RESULT.CONTINUE;
    }

    if (executionCandidates.length > 1) {
      this.gameState.ruleState.pendingInterrupts.push(
        ...executionCandidates.map(({ type, playerId, pendingCheckIndex }) => ({
          type,
          playerId,
          ...(Number.isInteger(pendingCheckIndex) ? { pendingCheckIndex } : {}),
        })),
      );
      this.render();
      return RULE_CHECK_RESULT.WAITING_INTERRUPT_SELECTION;
    }

    const [interrupt] = executionCandidates;
    if (interrupt.type === PROCESS_TYPE.REFRESH) {
      this.startRefresh(interrupt.playerId);
    } else if (interrupt.type === PROCESS_TYPE.LEVEL_UP) {
      this.startLevelUp(interrupt.playerId);
    } else if (interrupt.type === PROCESS_TYPE.REFRESH_PENALTY) {
      this.#consumePendingCheck(interrupt.pendingCheckIndex);
      this.startRefreshPenalty(interrupt.playerId);
    } else {
      throw new RangeError(`Unsupported interrupt type: ${interrupt.type}.`);
    }
    return RULE_CHECK_RESULT.INTERRUPTED;
  }

  /**
   * 公式Check Timingの単一入口。Rule Checkを先に安定化し、現在の能力解決へ
   * 割り込まない場合だけTurn Player、次にNon-Turn PlayerのAUTO選択を開始する。
   */
  resolveCheckPoint() {
    const ruleResult = this.resolveRuleCheck();
    if (ruleResult !== RULE_CHECK_RESULT.CONTINUE) return ruleResult;
    const current = this.processManager.getCurrentProcess();
    if (current?.type === PROCESS_TYPE.AUTO_ABILITY || current?.type === PROCESS_TYPE.PENDING_AUTO) {
      return RULE_CHECK_RESULT.CONTINUE;
    }
    const turnPlayer = this.gameState.turn.player;
    const nonTurnPlayer = PLAYER_IDS.find((id) => id !== turnPlayer);
    const playerId = [turnPlayer, nonTurnPlayer].find((id) =>
      this.gameState.ruleState.pendingAutos.some((pending) => pending.masterPlayerId === id));
    if (!playerId) return RULE_CHECK_RESULT.CONTINUE;
    this.processManager.pushProcess({
      type: PROCESS_TYPE.PENDING_AUTO,
      playerId,
      step: PENDING_AUTO_STEP.SELECT_AUTO,
      status: PROCESS_STATUS.WAITING_INPUT,
      context: { selectedPendingAutoId: null, preparedCosts: [] },
    });
    this.render();
    return RULE_CHECK_RESULT.INTERRUPTED;
  }

  /** 現在のCheck Timing対象Playerが自由に選べるPending一覧。配列順は強制解決順ではない。 */
  getPendingAutoOptions() {
    const process = this.processManager.getCurrentProcess();
    if (process?.type !== PROCESS_TYPE.PENDING_AUTO || process.step !== PENDING_AUTO_STEP.SELECT_AUTO) return [];
    return this.gameState.ruleState.pendingAutos
      .filter(({ masterPlayerId }) => masterPlayerId === process.playerId)
      .map((pending) => {
        const { card, ability } = this.#resolvePendingAuto(pending);
        return { pending, card, ability, disabledReason: ability ? null : "能力定義が見つかりません。" };
      });
  }

  /** Pendingを選ぶ。選択Costがなければ最終再検証後ただちにAUTO Processへ移管する。 */
  selectPendingAuto(pendingAutoId) {
    const process = this.processManager.getCurrentProcess();
    if (process?.type !== PROCESS_TYPE.PENDING_AUTO || process.step !== PENDING_AUTO_STEP.SELECT_AUTO) {
      throw new Error("自動能力の選択待ちではありません。");
    }
    const pending = this.gameState.ruleState.pendingAutos.find(({ id }) => id === pendingAutoId);
    if (!pending || pending.masterPlayerId !== process.playerId) throw new Error("選択できる自動能力ではありません。");
    const { card, ability } = this.#resolvePendingAuto(pending);
    if (!ability) throw new Error("自動能力の定義が見つかりません。");
    const player = this.gameState.players[process.playerId];
    const preparedCosts = prepareCostSelections(ability.costs, { player, sourceCard: card });
    process.context.selectedPendingAutoId = pending.id;
    process.context.preparedCosts = preparedCosts;
    if (preparedCosts.length > 0) {
      process.step = PENDING_AUTO_STEP.SELECT_COST;
      this.render();
      return process;
    }
    return this.#commitPendingAuto(process, pending, card, ability);
  }

  /** Cost Selectionを破棄してAUTO一覧へ戻る（mutationもPending消費も行わない）。 */
  backToPendingAutoSelection() {
    const process = this.processManager.getCurrentProcess();
    if (process?.type !== PROCESS_TYPE.PENDING_AUTO || process.step !== PENDING_AUTO_STEP.SELECT_COST) {
      throw new Error("コスト選択待ちではありません。");
    }
    process.context.selectedPendingAutoId = null;
    process.context.preparedCosts = [];
    process.step = PENDING_AUTO_STEP.SELECT_AUTO;
    this.render();
  }

  confirmPreparedCosts(preparedCosts) {
    const process = this.processManager.getCurrentProcess();
    if (process?.type !== PROCESS_TYPE.PENDING_AUTO || process.step !== PENDING_AUTO_STEP.SELECT_COST) {
      throw new Error("コスト選択待ちではありません。");
    }
    const pending = this.gameState.ruleState.pendingAutos.find(({ id }) => id === process.context.selectedPendingAutoId);
    const { card, ability } = this.#resolvePendingAuto(pending);
    process.context.preparedCosts = structuredClone(preparedCosts);
    return this.#commitPendingAuto(process, pending, card, ability);
  }

  #commitPendingAuto(process, pending, card, ability) {
    if (!pending || !ability) throw new Error("自動能力が見つかりません。");
    const player = this.gameState.players[process.playerId];
    const reason = getPreparedCostsDisabledReason(ability.costs, process.context.preparedCosts, { player, sourceCard: card });
    // Cost可否は誘発事実・AUTOのプレイ可否とは分離する。払えない任意Costなら後続効果を行わない。
    const payCost = reason === null;
    const index = this.gameState.ruleState.pendingAutos.findIndex(({ id }) => id === pending.id);
    if (index < 0) throw new Error("Pending AUTOは既に消費されています。");
    this.gameState.ruleState.pendingAutos.splice(index, 1);
    this.processManager.popProcess();
    const autoProcess = this.processManager.pushProcess({
      type: PROCESS_TYPE.AUTO_ABILITY,
      playerId: process.playerId,
      step: AUTO_ABILITY_STEP.PAY_COST,
      status: PROCESS_STATUS.RUNNING,
      context: { pendingAuto: pending, preparedCosts: process.context.preparedCosts, payCost, effectIndex: 0 },
    });
    this.executeAutoAbilityProcess();
    return autoProcess;
  }

  executeAutoAbilityProcess() {
    const process = this.processManager.getCurrentProcess();
    if (process?.type !== PROCESS_TYPE.AUTO_ABILITY) return process;
    const { card, ability } = this.#resolvePendingAuto(process.context.pendingAuto);
    const player = this.gameState.players[process.playerId];
    while (this.processManager.getCurrentProcess() === process) {
      if (process.step === AUTO_ABILITY_STEP.PAY_COST) {
        if (process.context.payCost) {
          const reason = getPreparedCostsDisabledReason(ability.costs, process.context.preparedCosts, { player, sourceCard: card });
          if (reason) throw new Error(reason); // mutation直前の最終再検証
          payCosts(ability.costs, { player, sourceCard: card });
        }
        process.step = process.context.payCost ? AUTO_ABILITY_STEP.RESOLVE_EFFECT : AUTO_ABILITY_STEP.COMPLETE;
      } else if (process.step === AUTO_ABILITY_STEP.RESOLVE_EFFECT) {
        if (process.context.effectIndex >= ability.effects.length) process.step = AUTO_ABILITY_STEP.COMPLETE;
        else {
          resolveEffect(ability.effects[process.context.effectIndex++], { gameEngine: this, player, playerId: process.playerId, sourceCard: card });
        }
      } else if (process.step === AUTO_ABILITY_STEP.COMPLETE) {
        this.completeCurrentProcess();
        return process;
      } else throw new RangeError(`Unknown AUTO_ABILITY step: ${process.step}.`);
    }
    return process;
  }

  #resolvePendingAuto(pending) {
    if (!pending) return { card: null, ability: null };
    let card = null;
    try { card = locateCard(this.gameState, pending.source.cardInstanceId).card; } catch { /* LKIだけで残るPendingを許容 */ }
    const ability = pending.source.kind === ABILITY_SOURCE.RULE
      ? getRuleAutoAbility(pending.source.abilityId)
      : card?.abilities.find(({ id }) => id === pending.source.abilityId) ?? null;
    return { card, ability };
  }

  /**
   * 現在Processを終了し、最新状態を再チェックする共通出口。
   * CONTINUE時はスタック下の既知Processを保存済みstepから再開する。
   *
   * @returns {string}
   */
  completeCurrentProcess() {
    const completedProcess = this.processManager.popProcess();
    if (!completedProcess) {
      return RULE_CHECK_RESULT.CONTINUE;
    }

    const result = this.resolveCheckPoint();
    if (result === RULE_CHECK_RESULT.CONTINUE) {
      this.executeCurrentProcess();
      this.render();
    }
    return result;
  }

  /** 現在の既知Processを保存済みstepから再開する。 */
  executeCurrentProcess() {
    const process = this.processManager.getCurrentProcess();
    if (!process || process.status === PROCESS_STATUS.WAITING_INPUT) {
      return process;
    }
    if (process.type === PROCESS_TYPE.REFRESH) {
      return this.executeRefreshProcess();
    }
    if (process.type === PROCESS_TYPE.REFRESH_PENALTY) {
      return this.executeRefreshPenaltyProcess();
    }
    if (process.type === PROCESS_TYPE.CLOCK_PHASE) {
      return this.executeClockPhaseProcess();
    }
    if (process.type === PROCESS_TYPE.DRAW_PHASE) {
      return this.executeDrawPhaseProcess();
    }
    if (process.type === PROCESS_TYPE.MAIN_PHASE) {
      return this.executeMainPhaseProcess();
    }
    if (process.type === PROCESS_TYPE.PLAY_CHARACTER) {
      return this.executePlayCharacterProcess();
    }
    if (process.type === PROCESS_TYPE.MOVE_STAGE) {
      return this.executeMoveStageProcess();
    }
    if (process.type === PROCESS_TYPE.SWAP_STAGE) {
      return this.executeSwapStageProcess();
    }
    if (process.type === PROCESS_TYPE.ACT_ABILITY) {
      return this.executeActAbilityProcess();
    }
    if (process.type === PROCESS_TYPE.AUTO_ABILITY) return this.executeAutoAbilityProcess();
    if (process.type === PROCESS_TYPE.SEARCH_DECK) {
      return this.executeSearchDeckProcess();
    }
    if (process.type === PROCESS_TYPE.LEVEL_UP) {
      return this.executeLevelUpProcess();
    }
    return process;
  }

  /**
   * 敗北確定結果をGameStateと永続表示用messageOverlayへ反映する。
   *
   * @param {{winner: 'self'|'opponent', loser: 'self'|'opponent', reason: string}} result
   * @returns {void}
   */
  finishGame(result) {
    const { winner, loser, reason } = result;
    this.#assertPlayerId(winner);
    this.#assertPlayerId(loser);
    if (winner === loser || typeof reason !== "string") {
      throw new TypeError("finishGame requires distinct winner/loser and a reason.");
    }

    this.gameState.gameResult.finished = true;
    this.gameState.gameResult.winner = winner;
    this.gameState.gameResult.loser = loser;
    this.gameState.gameResult.reason = reason;
    this.gameState.ruleState.pendingInterrupts.splice(
      0,
      this.gameState.ruleState.pendingInterrupts.length,
    );
    this.gameState.messageOverlay.visible = true;
    this.gameState.messageOverlay.title = "GAME OVER";
    this.gameState.messageOverlay.message = winner === "self"
      ? "勝者はあなたです"
      : "勝者は相手です";
    this.addLog(loser, `ゲームが終了しました（${reason}）。`);
    this.render();
  }

  /**
   * 対戦ログを追加し、最新20件だけを保持する。
   *
   * @param {'self'|'opponent'|null} player
   * @param {string} message
   * @returns {import("../models/gameState.js").GameLogEntry}
   */
  addLog(player, message) {
    const entry = this.gameState.addLog(message, player);
    const excessEntryCount = this.gameState.log.length - MAX_LOG_ENTRIES;

    if (excessEntryCount > 0) {
      this.gameState.log.splice(0, excessEntryCount);
    }

    return entry;
  }

  /**
   * 山札の一番上から手札へ1枚移動する。
   * リフレッシュおよびリフレッシュダメージはまだ処理しない。
   *
   * @private
   * @param {'self'|'opponent'} playerId
   * @returns {import("../models/card.js").Card|null}
   */
  drawCard(playerId) {
    this.#assertPlayerId(playerId);
    const player = this.gameState.players[playerId];
    const card = player.deck.draw();

    if (!card) {
      this.addLog(playerId, "山札が空のためカードを引けませんでした。");
      return null;
    }

    card.owner = playerId;
    card.moveTo({
      zone: ZONE.HAND,
      row: null,
      index: player.hand.length + 1,
    });
    player.hand.push(card);
    return card;
  }

  /**
   * 現在のターンを終了し、次のプレイヤーのSTANDフェイズへ移る。
   * 後攻プレイヤーのターン終了時だけターン番号を増やす。
   *
   * @private
   * @returns {void}
   */
  endTurn() {
    const { first, second } = this.gameState.turnOrder;
    const currentPlayer = this.gameState.turn.player;

    if (currentPlayer === first) {
      this.gameState.turn.player = second;
    } else if (currentPlayer === second) {
      this.gameState.turn.player = first;
      this.gameState.turn.number += 1;
    } else {
      throw new RangeError(`Unknown current player: ${currentPlayer}.`);
    }

    this.addLog(
      this.gameState.turn.player,
      `Turn ${this.gameState.turn.number}を開始しました。`,
    );
    this.enterPhase(PHASE.STAND, { turnTransitionHandled: true });
  }

  /**
   * 現在のGameStateをRendererへ渡して再描画する。
   *
   * @private
   * @returns {void}
   */
  render() {
    this.renderer.render(this.gameState);
    this.renderListeners.forEach((listener) => listener(this.gameState));
  }

  /**
   * 描画完了後のUI同期処理を購読する。
   *
   * @param {(gameState: GameState) => void} listener
   * @returns {() => boolean} 購読解除関数
   */
  onRender(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("listener must be a function.");
    }

    this.renderListeners.add(listener);
    return () => this.renderListeners.delete(listener);
  }

  /**
   * マリガン状態に対応する表示状態をGameStateへ反映する。
   *
   * @private
   * @returns {void}
   */
  #updateMulliganOverlay() {
    const { active, currentPlayer } = this.gameState.mulliganState;

    if (!active || !currentPlayer) {
      this.gameState.messageOverlay.visible = false;
      this.gameState.messageOverlay.title = "";
      this.gameState.messageOverlay.message = "";
      return;
    }

    this.gameState.messageOverlay.visible = true;
    this.gameState.messageOverlay.title = "手札交換";
    this.gameState.messageOverlay.message =
      MULLIGAN_MESSAGES[currentPlayer] ?? "";
  }

  /**
   * 通常フェイズに対応する表示状態をmessageOverlayへ反映する。
   * 独立表示を持たないフェイズでは現在の表示を維持する。
   *
   * @private
   * @param {string} phase
   * @returns {void}
   */
  #updatePhaseMessageOverlay(phase) {
    const title = PHASE_LABELS[phase];
    if (!title) {
      return;
    }

    this.gameState.messageOverlay.visible = true;
    this.gameState.messageOverlay.title = title;
    this.gameState.messageOverlay.message = phase === PHASE.CLOCK
      ? "クロックに置く手札を選択してください。"
      : "";
  }

  /** @returns {void} */
  #showLevelUpOverlay() {
    this.gameState.messageOverlay.visible = true;
    this.gameState.messageOverlay.title = "レベルアップ";
    this.gameState.messageOverlay.message =
      "レベルに置くカードを選択してください。";
  }

  /** @returns {void} */
  #restorePhaseMessageOverlay() {
    this.gameState.messageOverlay.visible = false;
    this.gameState.messageOverlay.title = "";
    this.gameState.messageOverlay.message = "";
    this.#updatePhaseMessageOverlay(this.gameState.phase);
  }

  /**
   * @param {'self'|'opponent'} playerId
   * @returns {import("../models/card.js").Card[]}
   */
  #assertLevelUpCandidates(playerId) {
    this.#assertPlayerId(playerId);
    const clock = this.gameState.players[playerId]?.clock;

    if (!Array.isArray(clock) || clock.length < 7) {
      throw new Error("LEVEL_UP requires at least 7 CLOCK cards.");
    }

    const candidates = clock.slice(0, 7);
    if (candidates.length !== 7 || candidates.some((card) => !card)) {
      throw new Error("LEVEL_UP candidates clock[0] through clock[6] must exist.");
    }

    return candidates;
  }

  /**
   * @param {'self'|'opponent'} playerId
   * @param {number} selectedClockIndex
   * @returns {import("../models/card.js").Card[]}
   */
  #assertLevelUpSelection(playerId, selectedClockIndex) {
    if (!Number.isInteger(selectedClockIndex)) {
      throw new TypeError("selectedClockIndex must be an integer.");
    }
    if (selectedClockIndex < 0 || selectedClockIndex > 6) {
      throw new RangeError("selectedClockIndex must be between 0 and 6.");
    }

    const candidates = this.#assertLevelUpCandidates(playerId);
    if (!candidates[selectedClockIndex]) {
      throw new RangeError("The selected CLOCK card does not exist.");
    }
    return candidates;
  }

  /**
   * @param {import("./processManager.js").Process} process
   * @returns {import("../models/card.js").Card}
   */
  #resolveLevelUpSelection(process) {
    const { playerId } = process;
    const selectedClockIndex = process.context.selectedClockIndex;
    const candidates = this.#assertLevelUpSelection(
      playerId,
      selectedClockIndex,
    );
    const player = this.gameState.players[playerId];
    const selectedCard = candidates[selectedClockIndex];

    player.clock.splice(0, 7);
    candidates.forEach((card, candidateIndex) => {
      card.owner = playerId;
      card.setPosition(POSITION.STAND);

      if (candidateIndex === selectedClockIndex) {
        card.moveTo({
          zone: ZONE.LEVEL,
          row: null,
          index: player.level.length + 1,
        });
        player.level.push(card);
      } else {
        card.moveTo({
          zone: ZONE.WAITING_ROOM,
          row: null,
          index: player.waitingRoom.length + 1,
        });
        player.waitingRoom.push(card);
      }
    });

    this.#reindexCards(player.clock);
    this.#reindexCards(player.level);
    this.#reindexCards(player.waitingRoom);
    this.addLog(playerId, "クロック7枚をレベルアップ処理しました。");
    return selectedCard;
  }

  /** @returns {boolean} */
  #isWaitingForProcessInput() {
    return this.processManager.getCurrentProcess()?.status ===
      PROCESS_STATUS.WAITING_INPUT;
  }

  /** @returns {boolean} */
  #hasPendingInterruptSelection() {
    return this.gameState.ruleState.pendingInterrupts.length > 1;
  }

  /**
   * @param {object[]} interrupts
   * @returns {object[]}
   */
  #uniqueInterrupts(interrupts) {
    const seen = new Set();
    return interrupts.filter(({ type, playerId }) => {
      const key = `${type}:${playerId}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * 現在実行できるpendingChecksをRule Check候補へ変換する。
   * 1件ごとの配列位置を保持し、同種の複数ペナルティを区別する。
   *
   * @returns {Array<{type: string, playerId: 'self'|'opponent', pendingCheckIndex: number}>}
   */
  #getExecutablePendingChecks() {
    const pendingChecks = this.gameState.ruleState.pendingChecks;
    if (!Array.isArray(pendingChecks)) {
      return [];
    }

    return pendingChecks.flatMap((check, pendingCheckIndex) => {
      if (
        check?.type !== PROCESS_TYPE.REFRESH_PENALTY ||
        !PLAYER_IDS.includes(check.playerId)
      ) {
        return [];
      }

      return [{
        type: PROCESS_TYPE.REFRESH_PENALTY,
        playerId: check.playerId,
        pendingCheckIndex,
      }];
    });
  }

  /**
   * Process開始が決定したpendingCheckを一度だけ取り除く。
   *
   * @param {number} pendingCheckIndex
   * @returns {object}
   */
  #consumePendingCheck(pendingCheckIndex) {
    const pendingChecks = this.gameState.ruleState.pendingChecks;
    if (!Number.isInteger(pendingCheckIndex) || pendingCheckIndex < 0) {
      throw new TypeError("pendingCheckIndex must be a non-negative integer.");
    }

    const [check] = pendingChecks.splice(pendingCheckIndex, 1);
    if (!check || check.type !== PROCESS_TYPE.REFRESH_PENALTY) {
      throw new Error("The REFRESH_PENALTY pendingCheck does not exist.");
    }

    return check;
  }

  /**
   * @param {unknown} playerId
   * @returns {asserts playerId is 'self'|'opponent'}
   */
  #assertPlayerId(playerId) {
    if (
      playerId !== this.gameState.turnOrder.first &&
      playerId !== this.gameState.turnOrder.second
    ) {
      throw new RangeError(`Unknown player: ${playerId}.`);
    }
  }

  /**
   * @param {unknown} playerId
   * @returns {import("./processManager.js").Process}
   */
  #assertClockAction(playerId) {
    if (this.gameState.gameResult.finished) {
      throw new Error("CLOCK action is unavailable after game over.");
    }
    if (this.#hasPendingInterruptSelection()) {
      throw new Error("CLOCK action is blocked while interrupt order is pending.");
    }

    if (this.gameState.phase !== PHASE.CLOCK) {
      throw new Error("CLOCK action is only available during CLOCK phase.");
    }

    this.#assertPlayerId(playerId);
    if (this.gameState.turn.player !== playerId) {
      throw new Error(`It is not ${playerId}'s turn.`);
    }

    const process = this.processManager.getCurrentProcess();
    if (
      process?.type !== PROCESS_TYPE.CLOCK_PHASE ||
      process.playerId !== playerId ||
      process.step !== CLOCK_STEP.WAIT_FOR_SELECTION ||
      process.status !== PROCESS_STATUS.WAITING_INPUT
    ) {
      throw new Error("CLOCK action is unavailable outside its selection Process.");
    }

    return process;
  }

  /**
   * @param {'self'|'opponent'} playerId
   * @returns {import("./processManager.js").Process}
   */
  #assertMainPhaseAction(playerId) {
    if (this.gameState.gameResult.finished) {
      throw new Error("MAIN action is unavailable after game over.");
    }
    if (this.#hasPendingInterruptSelection()) {
      throw new Error("MAIN action is blocked while interrupt order is pending.");
    }
    if (this.gameState.phase !== PHASE.MAIN) {
      throw new Error("MAIN action is only available during MAIN phase.");
    }

    this.#assertPlayerId(playerId);
    if (this.gameState.turn.player !== playerId) {
      throw new Error(`It is not ${playerId}'s turn.`);
    }

    const process = this.processManager.getCurrentProcess();
    if (
      process?.type !== PROCESS_TYPE.MAIN_PHASE ||
      process.playerId !== playerId ||
      process.step !== MAIN_STEP.WAITING_INPUT ||
      process.status !== PROCESS_STATUS.WAITING_INPUT
    ) {
      throw new Error("MAIN action is unavailable outside its input Process.");
    }

    return process;
  }

  /** @returns {boolean} */
  #isMainStageDestination(destination, playerId) {
    return playerId === "self" && MAIN_STAGE_DESTINATIONS.some(
      (candidate) =>
        destination?.row === candidate.row &&
        destination?.index === candidate.index,
    );
  }

  /** Stage上の指定slotにいるカードを返す。 */
  #findStageCard(playerId, location) {
    return this.gameState.players[playerId]?.stage.find(
      (card) => card.row === location?.row && card.index === location?.index,
    ) ?? null;
  }

  /** Cardが保存済みStage位置にいるか返す。 */
  #matchesStageLocation(card, location) {
    return Boolean(
      card &&
      card.zone === ZONE.STAGE &&
      card.row === location?.row &&
      card.index === location?.index,
    );
  }

  /** Process状態に依存しないStage Characterの所有・所属条件。 */
  #isStageCardOwnedBy(card, playerId) {
    return Boolean(
      card &&
      this.gameState.players[playerId]?.stage.includes(card) &&
      card.owner === playerId &&
      card.zone === ZONE.STAGE &&
      isCharacter(card),
    );
  }

  /** Stage Actionの親MAINとターン状態を実行直前に再検証する。 */
  #isValidStageActionParent(process) {
    const parent = this.gameState.ruleState.processStack.at(-2);
    return Boolean(
      this.gameState.phase === PHASE.MAIN &&
      this.gameState.turn.player === process.playerId &&
      parent?.type === PROCESS_TYPE.MAIN_PHASE &&
      parent.playerId === process.playerId &&
      parent.step === MAIN_STEP.WAITING_INPUT &&
      parent.status === PROCESS_STATUS.WAITING_INPUT,
    );
  }

  /** UI状態に依存しないCharacter基本プレイ条件。 */
  #getCharacterPlayRuleDisabledReason(card, playerId) {
    const player = this.gameState.players[playerId];
    if (!card || !player?.hand.includes(card) || card.owner !== playerId || card.zone !== ZONE.HAND || !isCharacter(card)) {
      return "CHARACTERが手札にありません。";
    }
    if (card.level > player.level.length) return "レベル条件を満たしていません。";
    if (card.level >= 1 && ![...player.level, ...player.clock].some((zoneCard) => zoneCard.color === card.color)) {
      return "必要な色条件を満たしていません。";
    }
    if (player.stock.length < card.cost) return "ストックが不足しています。";
    return null;
  }

  /**
   * @param {import("../models/card.js").Card[]} cards
   * @returns {void}
   */
  #reindexCards(cards) {
    cards.forEach((card, arrayIndex) => {
      card.index = arrayIndex + 1;
    });
  }
}

/** 旧データのlowercaseと正式CardMaster値のuppercaseを移行中も同義に扱う。 */
function isCharacter(card) {
  return typeof card?.cardType === "string" && card.cardType.toUpperCase() === "CHARACTER";
}

function getZoneCollection(player, zone) {
  if (zone === ZONE.DECK) return player.deck.cards;
  if (zone === ZONE.WAITING_ROOM) return player.waitingRoom;
  const collection = player[zone];
  if (!Array.isArray(collection)) throw new RangeError(`Unsupported Card collection zone: ${zone}.`);
  return collection;
}
