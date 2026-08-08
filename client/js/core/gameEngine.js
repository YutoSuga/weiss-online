import { PHASE } from "../constants/phase.js";
import { ZONE } from "../constants/zone.js";
import { GameState } from "../models/gameState.js";

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

/**
 * ゲームルールの進行とGameStateの更新を担当する。
 * DOM操作とUIロジックは持たず、画面更新はRendererへ委譲する。
 */
export class GameEngine {
  /**
   * @param {object} params
   * @param {GameState} params.gameState
   * @param {{render: (gameState: GameState) => void}} params.renderer
   */
  constructor({ gameState, renderer }) {
    if (!(gameState instanceof GameState)) {
      throw new TypeError("gameState must be a GameState instance.");
    }

    if (!renderer || typeof renderer.render !== "function") {
      throw new TypeError("renderer must provide a render() method.");
    }

    this.gameState = gameState;
    this.renderer = renderer;
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
    this.addLog(first, "マリガンを開始しました。");
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
      `${discardedCards.length}枚をマリガンしました。`,
    );

    const { first, second } = this.gameState.turnOrder;
    if (playerId === first) {
      this.gameState.mulliganState.currentPlayer = second;
      this.#updateMulliganOverlay();
      this.addLog(second, "マリガンを開始しました。");
    } else {
      this.gameState.mulliganState.active = false;
      this.gameState.mulliganState.currentPlayer = null;
      this.gameState.turn.player = first;
      this.gameState.turn.number = 1;
      this.gameState.phase = PHASE.STAND;
      this.gameState.started = true;
      this.#updateMulliganOverlay();
      this.addLog(first, "Turn 1を開始しました。");
    }

    this.render();
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
    if (this.gameState.mulliganState.active) {
      throw new Error("Cannot advance phases during mulligan.");
    }

    const currentIndex = PHASE_ORDER.indexOf(this.gameState.phase);

    if (currentIndex === -1) {
      throw new RangeError(`Unknown phase: ${this.gameState.phase}.`);
    }

    if (this.gameState.phase === PHASE.END) {
      this.endTurn();
      return;
    }

    const nextPhase = PHASE_ORDER[currentIndex + 1];
    this.gameState.phase = nextPhase;

    if (nextPhase === PHASE.DRAW) {
      this.drawCards(this.gameState.turn.player, 1);
    }

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

    this.gameState.phase = PHASE.STAND;
    this.addLog(
      this.gameState.turn.player,
      `Turn ${this.gameState.turn.number}を開始しました。`,
    );
    this.render();
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
   * @param {import("../models/card.js").Card[]} cards
   * @returns {void}
   */
  #reindexCards(cards) {
    cards.forEach((card, arrayIndex) => {
      card.index = arrayIndex + 1;
    });
  }
}
