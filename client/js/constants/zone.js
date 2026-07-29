/**
 * カードを配置できるゾーン。
 * 値はHTMLの `data-zone` と共通で使用する。
 */
export const ZONE = Object.freeze({
  DECK: "deck",
  HAND: "hand",
  STAGE: "stage",
  CLOCK: "clock",
  LEVEL: "level",
  STOCK: "stock",
  CLIMAX: "climax",
  WAITING_ROOM: "waiting-room",
  MEMORY: "memory",
});

/** @type {readonly string[]} */
export const ZONE_VALUES = Object.freeze(Object.values(ZONE));
