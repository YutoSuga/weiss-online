/** Phase F-5Bで正式対応するGame Event。 */
export const GAME_EVENT_TYPE = Object.freeze({
  CARD_MOVED: "CARD_MOVED",
  CARD_POSITION_CHANGED: "CARD_POSITION_CHANGED",
  ATTACK_DECLARED: "ATTACK_DECLARED",
  PHASE_STARTED: "PHASE_STARTED",
  PHASE_ENDED: "PHASE_ENDED",
});

export const GAME_EVENT_TYPE_VALUES = Object.freeze(Object.values(GAME_EVENT_TYPE));

/** Event対象とAUTO sourceとの関係。 */
export const AUTO_TRIGGER_SUBJECT = Object.freeze({
  SELF: "SELF",
  OTHER_YOUR_CHARACTER: "OTHER_YOUR_CHARACTER",
});

export const AUTO_TRIGGER_SUBJECT_VALUES = Object.freeze(
  Object.values(AUTO_TRIGGER_SUBJECT),
);
