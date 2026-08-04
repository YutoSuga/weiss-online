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

const MAX_LOG_ENTRIES = 20;

/**
 * GameStateの更新、ターン進行、最小限のゲーム処理を担当する。
 * DOM操作は行わず、画面更新はRendererへ委譲する。
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
  }

  /**
   * 対戦を初期状態から開始する。
   *
   * @returns {void}
   */
  startGame() {
    const { first } = this.gameState.turnOrder;

    this.gameState.turn.player = first;
    this.gameState.turn.number = 1;
    this.gameState.phase = PHASE.STAND;
    this.addLog(first, `Game started. ${first} is the first player.`);
    this.render();
  }

  /**
   * 現在のフェイズを次へ進める。
   * DRAWフェイズへ入った際は、現在プレイヤーが1枚引く。
   *
   * @returns {void}
   */
  nextPhase() {
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
      this.drawCard(this.gameState.turn.player);
    }

    this.render();
  }

  /**
   * 現在のターンを終了し、次のプレイヤーのSTANDフェイズへ移る。
   * 後攻プレイヤーのターン終了時だけターン番号を増やす。
   *
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
      `Turn ${this.gameState.turn.number} started.`,
    );
    this.render();
  }

  /**
   * 指定プレイヤーの山札からカードを引き、手札の末尾へ加える。
   * リフレッシュおよびダメージ処理はまだ行わない。
   *
   * @param {'self'|'opponent'} owner
   * @param {number} [count=1]
   * @returns {import("../models/card.js").Card[]} 引けたカード
   */
  drawCard(owner, count = 1) {
    const player = this.gameState.players[owner];

    if (!player) {
      throw new RangeError(`Unknown player: ${owner}.`);
    }

    if (!Number.isInteger(count) || count < 1) {
      throw new TypeError("count must be a positive integer.");
    }

    /** @type {import("../models/card.js").Card[]} */
    const drawnCards = [];

    for (let drawIndex = 0; drawIndex < count; drawIndex += 1) {
      const card = player.deck.draw();

      if (!card) {
        this.addLog(owner, "Could not draw because the deck is empty.");
        break;
      }

      const handIndex = player.hand.length + 1;
      card.owner = owner;
      card.moveTo({
        zone: ZONE.HAND,
        row: null,
        index: handIndex,
      });
      player.hand.push(card);
      drawnCards.push(card);
    }

    if (drawnCards.length > 0) {
      this.addLog(owner, `Drew ${drawnCards.length} card(s).`);
    }

    return drawnCards;
  }

  /**
   * 対戦ログを追加する。
   *
   * @param {'self'|'opponent'|null} player
   * @param {string} message
   * @returns {import("../models/gameState.js").GameLogEntry}
   */
  addLog(player, message) {
    const entry = this.gameState.addLog(message, player);
    const excessEntryCount =
      this.gameState.log.length - MAX_LOG_ENTRIES;

    if (excessEntryCount > 0) {
      this.gameState.log.splice(0, excessEntryCount);
    }

    return entry;
  }

  /**
   * 現在のGameStateをRendererへ渡して再描画する。
   *
   * @returns {void}
   */
  render() {
    this.renderer.render(this.gameState);
  }
}
