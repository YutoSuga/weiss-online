import {
  PHASE,
  PHASE_LABELS,
  PHASE_VALUES,
} from "../constants/phase.js";
import { ZONE } from "../constants/zone.js";
import {
  CLOCK_STEP,
  DRAW_STEP,
  PROCESS_STATUS,
  PROCESS_TYPE,
  LEVEL_UP_STEP,
  REFRESH_PENALTY_STEP,
  REFRESH_STEP,
} from "../constants/process.js";
import {
  DEFEAT_REASON,
  RULE_CHECK_RESULT,
} from "../constants/ruleCheck.js";
import { POSITION } from "../models/card.js";
import { GameState } from "../models/gameState.js";
import { ProcessManager } from "./processManager.js";

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

    this.gameState.phase = phase;
    this.#updatePhaseMessageOverlay(phase);

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
      card.setPosition(POSITION.STAND);
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
          const result = this.resolveRuleCheck();
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
          const result = this.resolveRuleCheck();
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
          const result = this.resolveRuleCheck();
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
          const result = this.resolveRuleCheck();
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
          const result = this.resolveRuleCheck();
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

    const result = this.resolveRuleCheck();
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
   * @param {import("../models/card.js").Card[]} cards
   * @returns {void}
   */
  #reindexCards(cards) {
    cards.forEach((card, arrayIndex) => {
      card.index = arrayIndex + 1;
    });
  }
}
