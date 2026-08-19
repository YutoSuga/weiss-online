/** Rule Check Resolutionが呼び出し元へ返す制御結果。 */
export const RULE_CHECK_RESULT = Object.freeze({
  CONTINUE: "continue",
  INTERRUPTED: "interrupted",
  GAME_OVER: "game_over",
  WAITING_INTERRUPT_SELECTION: "waiting_interrupt_selection",
});

/** 敗北が確定した理由。 */
export const DEFEAT_REASON = Object.freeze({
  LEVEL_AND_CLOCK: "level_and_clock",
  LEVEL_LIMIT: "level_limit",
  EMPTY_DECK_AND_WAITING_ROOM: "empty_deck_and_waiting_room",
});
