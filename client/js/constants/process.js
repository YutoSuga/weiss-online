/**
 * 共通プロセス基盤で扱うプロセス種別。
 * 各プロセスの具体的なルール処理はGameEngine側で実装する。
 */
export const PROCESS_TYPE = Object.freeze({
  CLOCK_ACTION: "clock_action",
  CLOCK_PHASE: "clock_phase",
  DRAW_PHASE: "draw_phase",
  REFRESH: "refresh",
  REFRESH_PENALTY: "refresh_penalty",
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

/** DRAW_PHASE Processで次に実行する処理。 */
export const DRAW_STEP = Object.freeze({
  DRAW_CARD: "draw_card",
  CHECK_POINT: "check_point",
  COMPLETE: "complete",
});

/** CLOCK_PHASE Processで次に実行する処理。 */
export const CLOCK_STEP = Object.freeze({
  WAIT_FOR_SELECTION: "wait_for_selection",
  MOVE_TO_CLOCK: "move_to_clock",
  CHECK_POINT_AFTER_CLOCK: "check_point_after_clock",
  DRAW_1: "draw_1",
  CHECK_POINT_AFTER_DRAW_1: "check_point_after_draw_1",
  DRAW_2: "draw_2",
  CHECK_POINT_AFTER_DRAW_2: "check_point_after_draw_2",
  COMPLETE: "complete",
});

/**
 * REFRESH Processで次に実行する処理。
 */
export const REFRESH_STEP = Object.freeze({
  MOVE_WAITING_ROOM_TO_DECK: "move_waiting_room_to_deck",
  SHUFFLE_DECK: "shuffle_deck",
  COMPLETE: "complete",
});

/** REFRESH_PENALTY Processで次に実行する処理。 */
export const REFRESH_PENALTY_STEP = Object.freeze({
  MOVE_TOP_CARD: "move_top_card",
  CHECK_POINT: "check_point",
  COMPLETE: "complete",
});

/** LEVEL_UP Processで次に実行する処理。 */
export const LEVEL_UP_STEP = Object.freeze({
  PREPARE_SELECTION: "prepare_selection",
  WAIT_FOR_SELECTION: "wait_for_selection",
  RESOLVE_SELECTION: "resolve_selection",
  COMPLETE: "complete",
});
