import { EFFECT_TYPE } from "../constants/ability.js";

const testLogEffectHandler = Object.freeze({
  validate(effect) {
    if (typeof effect.message !== "string" || effect.message.length === 0) {
      throw new TypeError("TEST_LOG message must be a non-empty string.");
    }
  },
  resolve(effect, { gameEngine, playerId }) {
    gameEngine.addLog(playerId, effect.message);
  },
});

const EFFECT_HANDLERS = Object.freeze({
  [EFFECT_TYPE.TEST_LOG]: testLogEffectHandler,
});

export function getEffectHandler(effect) {
  const handler = EFFECT_HANDLERS[effect?.type];
  if (!handler) throw new RangeError(`Unsupported Ability Effect type: ${String(effect?.type)}.`);
  handler.validate(effect);
  return handler;
}

export function validateEffects(effects) {
  effects.forEach(getEffectHandler);
}

export function resolveEffect(effect, context) {
  getEffectHandler(effect).resolve(effect, context);
}
