/** カードに印刷されるトリガーアイコンの種類。アイコンなしは空配列で表す。 */
export const TRIGGER_ICON = Object.freeze({
  SOUL: "SOUL",
  RETURN: "RETURN",
  POOL: "POOL",
  COMEBACK: "COMEBACK",
  DRAW: "DRAW",
  SHOT: "SHOT",
  TREASURE: "TREASURE",
  GATE: "GATE",
  STANDBY: "STANDBY",
  CHOICE: "CHOICE",
  CHANCE: "CHANCE",
  DISCOVERY: "DISCOVERY",
  FOCUS: "FOCUS",
});

/** @type {readonly string[]} */
export const TRIGGER_ICON_VALUES = Object.freeze(Object.values(TRIGGER_ICON));
