/**
 * ゲームの進行フェイズ。
 */
export const PHASE = Object.freeze({
  STAND: "stand",
  DRAW: "draw",
  CLOCK: "clock",
  MAIN: "main",
  CLIMAX: "climax",
  ATTACK: "attack",
  ENCORE: "encore",
  END: "end",
});

/** @type {readonly string[]} */
export const PHASE_VALUES = Object.freeze(Object.values(PHASE));
