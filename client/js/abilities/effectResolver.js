import { EFFECT_TYPE, EFFECT_VALUE_SOURCE } from "../constants/ability.js";

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const assertKeys = (value, allowed, label) => {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new TypeError(`${label} contains unsupported field "${key}".`);
  }
};
const assertId = (effect) => {
  if (typeof effect.id !== "string" || effect.id.trim() === "") {
    throw new TypeError(`${effect.type} id must be a non-empty string.`);
  }
};

export function validateEffectResultReference(reference, label = "EFFECT_RESULT reference") {
  if (!isObject(reference)) throw new TypeError(`${label} must be an object.`);
  assertKeys(reference, ["source", "effectId", "field"], label);
  if (reference.source !== EFFECT_VALUE_SOURCE.EFFECT_RESULT) {
    throw new RangeError(`${label}.source must be EFFECT_RESULT.`);
  }
  if (typeof reference.effectId !== "string" || reference.effectId.trim() === "" ||
      typeof reference.field !== "string" || reference.field.trim() === "") {
    throw new TypeError(`${label} requires non-empty effectId and field.`);
  }
}

function validateCondition(condition) {
  if (!isObject(condition)) throw new TypeError("EFFECT_GROUP condition must be an object.");
  assertKeys(condition, ["source", "effectId", "field", "min"], "EFFECT_GROUP condition");
  validateEffectResultReference({ source: condition.source, effectId: condition.effectId, field: condition.field });
  if (!Number.isInteger(condition.min) || condition.min < 0) {
    throw new TypeError("EFFECT_GROUP condition.min must be a non-negative integer.");
  }
}

function validateFilter(filter) {
  if (!isObject(filter)) throw new TypeError("SEARCH_DECK filter must be an object.");
  assertKeys(filter, ["cardType", "traits"], "SEARCH_DECK filter");
  if (filter.cardType !== "CHARACTER") throw new RangeError("SEARCH_DECK filter.cardType must be CHARACTER.");
  if (!isObject(filter.traits)) throw new TypeError("SEARCH_DECK filter.traits must be an object.");
  assertKeys(filter.traits, ["anyOf"], "SEARCH_DECK filter.traits");
  if (!Array.isArray(filter.traits.anyOf) || filter.traits.anyOf.length === 0 ||
      filter.traits.anyOf.some((trait) => typeof trait !== "string" || trait.trim() === "")) {
    throw new TypeError("SEARCH_DECK filter.traits.anyOf must be a non-empty string array.");
  }
}

const handlers = {
  [EFFECT_TYPE.TEST_LOG]: {
    validate(effect) {
      if (typeof effect.message !== "string" || effect.message.length === 0) throw new TypeError("TEST_LOG message must be a non-empty string.");
    },
    resolve(effect, { gameEngine, playerId }) { gameEngine.addLog(playerId, effect.message); },
  },
  [EFFECT_TYPE.BRAINSTORM_REVEAL]: {
    validate(effect) {
      assertId(effect);
      if (!Number.isInteger(effect.count) || effect.count <= 0) throw new TypeError("BRAINSTORM_REVEAL count must be a positive integer.");
    },
  },
  [EFFECT_TYPE.EFFECT_GROUP]: {
    validate(effect) {
      assertId(effect);
      validateCondition(effect.condition);
      if (!Array.isArray(effect.effects) || effect.effects.length === 0) throw new TypeError("EFFECT_GROUP effects must be a non-empty array.");
      effect.effects.forEach(getEffectHandler);
    },
  },
  [EFFECT_TYPE.SEARCH_DECK]: {
    validate(effect) {
      assertId(effect);
      if (!Number.isInteger(effect.minSelect) || effect.minSelect < 0) throw new TypeError("SEARCH_DECK minSelect must be a non-negative integer.");
      if (typeof effect.maxSelect === "number") {
        if (!Number.isInteger(effect.maxSelect) || effect.maxSelect < effect.minSelect) throw new TypeError("SEARCH_DECK maxSelect must be an integer >= minSelect.");
      } else validateEffectResultReference(effect.maxSelect, "SEARCH_DECK maxSelect");
      validateFilter(effect.filter);
    },
  },
  [EFFECT_TYPE.ADD_TO_HAND]: {
    validate(effect) { assertId(effect); validateEffectResultReference(effect.cards, "ADD_TO_HAND cards"); },
  },
  [EFFECT_TYPE.SHUFFLE_DECK]: { validate(effect) { assertId(effect); } },
};

export function getEffectHandler(effect) {
  const handler = handlers[effect?.type];
  if (!handler) throw new RangeError(`Unsupported Ability Effect type: ${String(effect?.type)}.`);
  handler.validate(effect);
  return handler;
}

export function validateEffects(effects) {
  if (!Array.isArray(effects)) throw new TypeError("effects must be an array.");
  const ids = new Set();
  const visit = (effect) => {
    getEffectHandler(effect);
    if (effect.type !== EFFECT_TYPE.TEST_LOG) {
      if (ids.has(effect.id)) throw new Error(`Duplicate Effect id "${effect.id}".`);
      ids.add(effect.id);
    }
    if (effect.type === EFFECT_TYPE.EFFECT_GROUP) effect.effects.forEach(visit);
  };
  effects.forEach(visit);
}

export function resolveEffect(effect, context) {
  const handler = getEffectHandler(effect);
  if (typeof handler.resolve !== "function") throw new Error(`${effect.type} requires ACT process resolution.`);
  handler.resolve(effect, context);
}

export function resolveEffectResult(reference, effectResults, expectedType) {
  validateEffectResultReference(reference);
  if (!Object.hasOwn(effectResults, reference.effectId)) throw new Error(`Effect result "${reference.effectId}" does not exist.`);
  const result = effectResults[reference.effectId];
  if (!isObject(result) || !Object.hasOwn(result, reference.field)) throw new Error(`Effect result field "${reference.effectId}.${reference.field}" does not exist.`);
  const value = result[reference.field];
  if (expectedType === "integer" && (!Number.isInteger(value) || value < 0)) throw new TypeError(`Effect result "${reference.effectId}.${reference.field}" must be a non-negative integer.`);
  if (expectedType === "instanceIds" && (!Array.isArray(value) || value.some((id) => typeof id !== "string"))) throw new TypeError(`Effect result "${reference.effectId}.${reference.field}" must be an instanceId array.`);
  return value;
}

export function cardMatchesSearchFilter(card, filter) {
  validateFilter(filter);
  return card.cardType === filter.cardType && filter.traits.anyOf.some((trait) => card.traits.includes(trait));
}
