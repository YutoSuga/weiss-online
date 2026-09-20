import { ABILITY_TYPE } from "../constants/ability.js";

const ABILITY_TYPE_VALUES = Object.freeze(Object.values(ABILITY_TYPE));

/** カードに記載された能力1つ分の、対戦中に変化しない固定情報。 */
export class CardAbility {
  constructor({
    id,
    type,
    keywords = [],
    text = "",
    activationTrigger = null,
    conditions = [],
    costs = [],
    effects = [],
  } = {}) {
    assertNonEmptyString("id", id);
    if (!ABILITY_TYPE_VALUES.includes(type)) {
      throw new RangeError(
        `type must be one of: ${ABILITY_TYPE_VALUES.join(", ")}. Received: ${String(type)}.`,
      );
    }
    assertStringArray("keywords", keywords);
    if (typeof text !== "string") throw new TypeError("text must be a string.");
    assertArray("conditions", conditions);
    assertArray("costs", costs);
    assertArray("effects", effects);

    this.id = id;
    this.type = type;
    this.keywords = cloneAndDeepFreeze(keywords, "keywords");
    this.text = text;
    this.activationTrigger = cloneAndDeepFreeze(
      activationTrigger,
      "activationTrigger",
    );
    this.conditions = cloneAndDeepFreeze(conditions, "conditions");
    this.costs = cloneAndDeepFreeze(costs, "costs");
    this.effects = cloneAndDeepFreeze(effects, "effects");
    Object.freeze(this);
  }
}

function cloneAndDeepFreeze(value, propertyName, ancestors = new Set()) {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
    return value;
  }
  if (typeof value !== "object") {
    throw new TypeError(`${propertyName} must contain only JSON-compatible values.`);
  }
  if (ancestors.has(value)) {
    throw new TypeError(`${propertyName} must not contain circular references.`);
  }

  ancestors.add(value);
  let copy;
  if (Array.isArray(value)) {
    copy = value.map((item) => cloneAndDeepFreeze(item, propertyName, ancestors));
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`${propertyName} must contain only plain objects and arrays.`);
    }
    copy = Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      cloneAndDeepFreeze(item, propertyName, ancestors),
    ]));
  }
  ancestors.delete(value);
  return Object.freeze(copy);
}

function assertNonEmptyString(propertyName, value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${propertyName} must be a non-empty string.`);
  }
}

function assertArray(propertyName, value) {
  if (!Array.isArray(value)) throw new TypeError(`${propertyName} must be an array.`);
}

function assertStringArray(propertyName, value) {
  assertArray(propertyName, value);
  if (value.some((item) => typeof item !== "string")) {
    throw new TypeError(`${propertyName} must be an array of strings.`);
  }
}

