import { ABILITY_SOURCE, ABILITY_TYPE, EFFECT_TYPE, EFFECT_VALUE_SOURCE } from "../constants/ability.js";

const ACT_AND_AUTO = Object.freeze([ABILITY_TYPE.ACT, ABILITY_TYPE.AUTO]);
const ACT_ONLY = Object.freeze([ABILITY_TYPE.ACT]);
const AUTO_ONLY = Object.freeze([ABILITY_TYPE.AUTO]);

function capabilityError(effect, abilityType, detail = "") {
  const error = new RangeError(`${effect.type} is not executable for Ability Type ${abilityType}${detail ? `: ${detail}` : "."}`);
  error.code = "UNSUPPORTED_EFFECT_CAPABILITY";
  return error;
}

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
  assertKeys(filter, ["cardType", "traits", "maxLevel"], "SEARCH_DECK filter");
  if (filter.cardType !== "CHARACTER") throw new RangeError("SEARCH_DECK filter.cardType must be CHARACTER.");
  if (filter.traits !== undefined) {
    if (!isObject(filter.traits)) throw new TypeError("SEARCH_DECK filter.traits must be an object.");
    assertKeys(filter.traits, ["anyOf"], "SEARCH_DECK filter.traits");
    if (!Array.isArray(filter.traits.anyOf) || filter.traits.anyOf.length === 0 ||
        filter.traits.anyOf.some((trait) => typeof trait !== "string" || trait.trim() === "")) {
      throw new TypeError("SEARCH_DECK filter.traits.anyOf must be a non-empty string array.");
    }
  }
  if (filter.maxLevel !== undefined && (!Number.isInteger(filter.maxLevel) || filter.maxLevel < 0))
    throw new TypeError("SEARCH_DECK filter.maxLevel must be a non-negative integer.");
}

const handlers = {
  [EFFECT_TYPE.TEST_LOG]: {
    supportedAbilityTypes: ACT_AND_AUTO,
    validate(effect) {
      if (typeof effect.message !== "string" || effect.message.length === 0) throw new TypeError("TEST_LOG message must be a non-empty string.");
    },
    resolve(effect, { gameEngine, playerId }) { gameEngine.addLog(playerId, effect.message); },
  },
  [EFFECT_TYPE.BRAINSTORM_REVEAL]: {
    supportedAbilityTypes: ACT_ONLY,
    validate(effect) {
      assertId(effect);
      if (!Number.isInteger(effect.count) || effect.count <= 0) throw new TypeError("BRAINSTORM_REVEAL count must be a positive integer.");
    },
  },
  [EFFECT_TYPE.EFFECT_GROUP]: {
    supportedAbilityTypes: ACT_ONLY,
    validateCapability(effect, { abilityType, groupDepth }) {
      if (groupDepth > 0) throw capabilityError(effect, abilityType, "only top-level EFFECT_GROUP is supported; nested groups are not supported.");
    },
    validate(effect) {
      assertId(effect);
      validateCondition(effect.condition);
      if (!Array.isArray(effect.effects) || effect.effects.length === 0) throw new TypeError("EFFECT_GROUP effects must be a non-empty array.");
      effect.effects.forEach(getEffectHandler);
    },
  },
  [EFFECT_TYPE.SEARCH_DECK]: {
    supportedAbilityTypes: ACT_AND_AUTO,
    validateCapability(effect, { abilityType }) {
      if (abilityType === ABILITY_TYPE.AUTO && typeof effect.maxSelect !== "number") {
        throw capabilityError(effect, abilityType, "maxSelect must be numeric for AUTO.");
      }
    },
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
    supportedAbilityTypes: ACT_AND_AUTO,
    validate(effect) { assertId(effect); validateEffectResultReference(effect.cards, "ADD_TO_HAND cards"); },
  },
  [EFFECT_TYPE.SHUFFLE_DECK]: { supportedAbilityTypes: ACT_AND_AUTO, validate(effect) { assertId(effect); } },
  [EFFECT_TYPE.ENCORE_RETURN]: {
    supportedAbilityTypes: AUTO_ONLY,
    validateCapability(effect, { abilityType, sourceKind }) {
      if (sourceKind !== ABILITY_SOURCE.RULE) throw capabilityError(effect, abilityType, "RULE source with original Stage position is required.");
    },
    validate(effect) { assertKeys(effect, ["type"], "ENCORE_RETURN"); },
    getDisabledReason(_effect, { pendingAuto }) {
      const slot = pendingAuto?.triggerContext?.originalStagePosition;
      const valid = slot && Number.isInteger(slot.index) && slot.index >= 1 &&
        ((slot.row === "front" && slot.index <= 3) || (slot.row === "back" && slot.index <= 2));
      return valid ? null : "効果の復帰先の舞台位置が不正です。";
    },
    resolve(_effect, { gameEngine, sourceCard, pendingAuto, playerId }) {
      gameEngine.returnEncoreCardToStage(sourceCard, pendingAuto.triggerContext.originalStagePosition, playerId);
    },
  },
  [EFFECT_TYPE.REPLACE_OPPONENT_STOCK_TOP]: {
    supportedAbilityTypes: AUTO_ONLY,
    validate(effect) { assertKeys(effect, ["type", "id"], "REPLACE_OPPONENT_STOCK_TOP"); assertId(effect); },
    getDisabledReason(_effect, { gameState, playerId }) {
      const opponentId = playerId === "self" ? "opponent" : "self";
      return gameState.players[opponentId].stock.length === 0 ? "相手のストックがありません。" : null;
    },
  },
};
Object.values(handlers).forEach(Object.freeze);
Object.freeze(handlers);

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

/** schemaと実行capabilityは別検証。Loader / runtimeが同じHandlerの対応情報を使う。 */
export function validateAbilityEffects(effects, abilityType, { sourceKind = ABILITY_SOURCE.PRINTED } = {}) {
  if (!Object.values(ABILITY_TYPE).includes(abilityType)) {
    throw new RangeError(`Unsupported Ability Type: ${String(abilityType)}.`);
  }
  validateEffects(effects);
  const visit = (effect, groupDepth) => {
    const handler = getEffectHandler(effect);
    if (!handler.supportedAbilityTypes.includes(abilityType)) throw capabilityError(effect, abilityType);
    handler.validateCapability?.(effect, { abilityType, sourceKind, groupDepth });
    if (effect.type === EFFECT_TYPE.EFFECT_GROUP) effect.effects.forEach((child) => visit(child, groupDepth + 1));
  };
  effects.forEach((effect) => visit(effect, 0));
}

export function resolveEffect(effect, context) {
  validateAbilityEffects([effect], context.abilityType, {
    sourceKind: context.pendingAuto?.source.kind ?? context.sourceKind,
  });
  const handler = getEffectHandler(effect);
  if (typeof handler.resolve !== "function") throw new Error(`${effect.type} requires Ability Process resolution.`);
  const reason = handler.getDisabledReason?.(effect, context);
  if (reason) throw new Error(reason);
  handler.resolve(effect, context);
}

export function getEffectsDisabledReason(effects, context) {
  try {
    validateAbilityEffects(effects, context.abilityType, {
      sourceKind: context.pendingAuto?.source.kind ?? context.sourceKind,
    });
  } catch (error) {
    return error.code === "UNSUPPORTED_EFFECT_CAPABILITY"
      ? "この能力には実行できない効果が含まれています。"
      : "効果の定義が不正です。";
  }
  for (const effect of effects) {
    const reason = getEffectHandler(effect).getDisabledReason?.(effect, context);
    if (reason) return reason;
  }
  return null;
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
  return card.cardType === filter.cardType &&
    (filter.maxLevel === undefined || card.level <= filter.maxLevel) &&
    (filter.traits === undefined || filter.traits.anyOf.some((trait) => card.traits.includes(trait)));
}
