/**
 * 共通プロセス基盤で扱うプロセス種別。
 * 各プロセスの具体的なルール処理はGameEngine側で実装する。
 */
export const PROCESS_TYPE = Object.freeze({
  CLOCK_ACTION: "clock_action",
  DRAW_PHASE: "draw_phase",
  REFRESH: "refresh",
  LEVEL_UP: "level_up",
});

/** @type {readonly string[]} */
export const PROCESS_TYPE_VALUES = Object.freeze(Object.values(PROCESS_TYPE));

/**
 * Processの実行状態。
 * スタック最上段より下のProcessは、状態値を追加せず暗黙的に中断中と扱う。
 */
export const PROCESS_STATUS = Object.freeze({
  RUNNING: "running",
  WAITING_INPUT: "waiting_input",
});

/** @type {readonly string[]} */
export const PROCESS_STATUS_VALUES = Object.freeze(
  Object.values(PROCESS_STATUS),
);

/**
 * REFRESH Processで次に実行する処理。
 */
export const REFRESH_STEP = Object.freeze({
  MOVE_WAITING_ROOM_TO_DECK: "move_waiting_room_to_deck",
  SHUFFLE_DECK: "shuffle_deck",
  COMPLETE: "complete",
});
