import { PHASE, PHASE_VALUES } from "../constants/phase.js";
import { Player } from "./player.js";

const PLAYER_SIDE_VALUES = Object.freeze(["self", "opponent"]);

/**
 * @typedef {object} RoomState
 * @property {string|null} id
 * @property {string|null} name
 * @property {string|null} host
 * @property {string|null} guest
 * @property {string} status
 */

/**
 * @typedef {object} GameLogEntry
 * @property {string} time ISO 8601形式の日時
 * @property {'self'|'opponent'|null} player
 * @property {string} message
 */

/**
 * @typedef {object} MulliganState
 * @property {boolean} active
 * @property {'self'|'opponent'|null} currentPlayer
 */

/**
 * 対戦全体の状態を管理する。
 * 描画やルール実行は、将来追加するRenderer/GameEngineの責務とする。
 */
export class GameState {
  /**
   * @param {object} params
   * @param {Player} params.self
   * @param {Player} params.opponent
   * @param {Partial<RoomState>} [params.room={}]
   * @param {{first: 'self'|'opponent', second: 'self'|'opponent'}} [params.turnOrder]
   * @param {'self'|'opponent'} [params.turnPlayer=params.turnOrder.first]
   * @param {number} [params.turnNumber=1]
   * @param {string} [params.phase=PHASE.STAND]
   * @param {Partial<MulliganState>} [params.mulliganState={}]
   * @param {GameLogEntry[]} [params.log=[]]
   */
  constructor({
    self,
    opponent,
    room = {},
    turnOrder = {
      first: "self",
      second: "opponent",
    },
    turnPlayer = turnOrder.first,
    turnNumber = 1,
    phase = PHASE.STAND,
    mulliganState = {},
    log = [],
  }) {
    if (!(self instanceof Player) || !(opponent instanceof Player)) {
      throw new TypeError("self and opponent must be Player instances.");
    }

    if (
      !turnOrder ||
      typeof turnOrder !== "object" ||
      !PLAYER_SIDE_VALUES.includes(turnOrder.first) ||
      !PLAYER_SIDE_VALUES.includes(turnOrder.second) ||
      turnOrder.first === turnOrder.second
    ) {
      throw new TypeError(
        "turnOrder must contain different first and second players.",
      );
    }

    if (!PLAYER_SIDE_VALUES.includes(turnPlayer)) {
      throw new RangeError("turnPlayer must be self or opponent.");
    }

    if (!Number.isInteger(turnNumber) || turnNumber < 1) {
      throw new TypeError("turnNumber must be a positive integer.");
    }

    if (!PHASE_VALUES.includes(phase)) {
      throw new RangeError(`phase must be one of: ${PHASE_VALUES.join(", ")}.`);
    }

    if (
      mulliganState === null ||
      typeof mulliganState !== "object" ||
      (mulliganState.active != null &&
        typeof mulliganState.active !== "boolean") ||
      (mulliganState.currentPlayer != null &&
        !PLAYER_SIDE_VALUES.includes(mulliganState.currentPlayer))
    ) {
      throw new TypeError("mulliganState is invalid.");
    }

    if (!Array.isArray(log)) {
      throw new TypeError("log must be an array.");
    }

    /** @type {{self: Player, opponent: Player}} */
    this.players = { self, opponent };

    /** @type {{first: 'self'|'opponent', second: 'self'|'opponent'}} */
    this.turnOrder = {
      first: turnOrder.first,
      second: turnOrder.second,
    };

    /** @type {RoomState} */
    this.room = {
      id: room.id ?? null,
      name: room.name ?? null,
      host: room.host ?? null,
      guest: room.guest ?? null,
      status: room.status ?? "waiting",
    };

    /** @type {{player: 'self'|'opponent'|null, number: number}} */
    this.turn = {
      player: turnPlayer,
      number: turnNumber,
    };

    /** @type {string} */
    this.phase = phase;

    /** @type {MulliganState} */
    this.mulliganState = {
      active: mulliganState.active ?? false,
      currentPlayer: mulliganState.currentPlayer ?? null,
    };

    /** @type {GameLogEntry[]} */
    this.log = log.map((entry) => ({ ...entry }));

    /**
     * TODO: 自動能力など、解決待ち効果の投入順・選択順・解決順が
     * 確定した段階で専用のEffectモデルと操作メソッドを追加する。
     *
     * @type {unknown[]}
     */
    this.effectQueue = [];
  }

  /**
   * 対戦ログを追加する。
   *
   * @param {string} message
   * @param {'self'|'opponent'|null} [player=null]
   * @param {Date|string} [time=new Date()]
   * @returns {GameLogEntry}
   */
  addLog(message, player = null, time = new Date()) {
    if (typeof message !== "string" || message.trim().length === 0) {
      throw new TypeError("message must be a non-empty string.");
    }

    if (player !== null && !PLAYER_SIDE_VALUES.includes(player)) {
      throw new RangeError("player must be self, opponent, or null.");
    }

    const parsedTime = time instanceof Date ? time : new Date(time);
    if (Number.isNaN(parsedTime.getTime())) {
      throw new TypeError("time must be a valid Date or date string.");
    }

    const entry = {
      time: parsedTime.toISOString(),
      player,
      message,
    };

    this.log.push(entry);
    return entry;
  }
}
