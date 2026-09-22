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
  RESOLUTION: "resolution",
});

/**
 * カード内容を閲覧できるプレイヤーの範囲。
 */
export const VISIBILITY = Object.freeze({
  PUBLIC: "public",
  OWNER_ONLY: "owner_only",
  OPPONENT_ONLY: "opponent_only",
  HIDDEN: "hidden",
});

/**
 * 各ゾーンで通常適用するカード内容の公開範囲。
 */
export const ZONE_VISIBILITY = Object.freeze({
  [ZONE.DECK]: VISIBILITY.HIDDEN,
  [ZONE.HAND]: VISIBILITY.OWNER_ONLY,
  [ZONE.STAGE]: VISIBILITY.PUBLIC,
  [ZONE.CLOCK]: VISIBILITY.PUBLIC,
  [ZONE.LEVEL]: VISIBILITY.PUBLIC,
  [ZONE.STOCK]: VISIBILITY.HIDDEN,
  [ZONE.CLIMAX]: VISIBILITY.PUBLIC,
  [ZONE.WAITING_ROOM]: VISIBILITY.PUBLIC,
  [ZONE.MEMORY]: VISIBILITY.PUBLIC,
  [ZONE.RESOLUTION]: VISIBILITY.PUBLIC,
});

/** @type {readonly string[]} */
export const ZONE_VALUES = Object.freeze(Object.values(ZONE));
