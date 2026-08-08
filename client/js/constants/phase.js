/**
 * ゲームの進行フェイズ。
 */
export const PHASE = Object.freeze({
  MULLIGAN: "mulligan",
  STAND: "stand",
  DRAW: "draw",
  CLOCK: "clock",
  MAIN: "main",
  CLIMAX: "climax",
  ATTACK: "attack",
  ENCORE: "encore",
  END: "end",
});

/**
 * 通常ゲーム進行中に表示するフェイズ名。
 * ENCOREは将来ATTACK内部のステップとなるため、独立ラベルを持たない。
 */
export const PHASE_LABELS = Object.freeze({
  [PHASE.STAND]: "スタンドフェイズ",
  [PHASE.DRAW]: "ドローフェイズ",
  [PHASE.CLOCK]: "クロックフェイズ",
  [PHASE.MAIN]: "メインフェイズ",
  [PHASE.CLIMAX]: "クライマックスフェイズ",
  [PHASE.ATTACK]: "アタックフェイズ",
  [PHASE.END]: "エンドフェイズ",
});

/** @type {readonly string[]} */
export const PHASE_VALUES = Object.freeze(Object.values(PHASE));
