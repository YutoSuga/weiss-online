/**
 * 共通プロセス基盤で扱うプロセス種別。
 * 各プロセスの具体的なルール処理はGameEngine側で実装する。
 */
export const PROCESS_TYPE = Object.freeze({
  CLOCK_ACTION: "clock_action",
  CLOCK_PHASE: "clock_phase",
  DRAW_PHASE: "draw_phase",
  MAIN_PHASE: "main_phase",
  PLAY_CHARACTER: "play_character",
  MOVE_STAGE: "move_stage",
  SWAP_STAGE: "swap_stage",
  ACT_ABILITY: "act_ability",
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

/** MAIN_PHASE Processで次に実行する処理。 */
export const MAIN_STEP = Object.freeze({
  START: "start",
  WAITING_INPUT: "waiting_input",
  END_MAIN: "end_main",
  COMPLETE: "complete",
});

/** HandのCHARACTERをStageへプレイするAction Process。 */
export const PLAY_CHARACTER_STEP = Object.freeze({
  VALIDATE: "validate",
  PAY_COST: "pay_cost",
  REMOVE_EXISTING: "remove_existing",
  MOVE_TO_STAGE: "move_to_stage",
  CHECK_POINT: "check_point",
  COMPLETE: "complete",
});

/** Stage Characterを空きStage slotへ移動するAction Process。 */
export const MOVE_STAGE_STEP = Object.freeze({
  VALIDATE: "validate",
  MOVE: "move",
  CHECK_POINT: "check_point",
  COMPLETE: "complete",
});

/** 2枚のStage Characterの位置を交換するAction Process。 */
export const SWAP_STAGE_STEP = Object.freeze({
  VALIDATE: "validate",
  SWAP: "swap",
  CHECK_POINT: "check_point",
  COMPLETE: "complete",
});

/** Stage上の起動能力をプレイ・解決するAction Process。 */
export const ACT_ABILITY_STEP = Object.freeze({
  VALIDATE: "validate",
  PREPARE: "prepare",
  PAY_COST: "pay_cost",
  CHECK_POINT_AFTER_COST: "check_point_after_cost",
  RESOLVE_EFFECT: "resolve_effect",
  CHECK_POINT_AFTER_EFFECT: "check_point_after_effect",
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
