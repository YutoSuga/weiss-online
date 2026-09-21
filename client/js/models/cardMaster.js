/**
 * カード種類ごとの、対戦中に変化しない固定情報を表す。
 */
import { CardAbility } from "./cardAbility.js";
import { TRIGGER_ICON_VALUES } from "../constants/triggerIcon.js";

export class CardMaster {
  /**
   * @param {object} params
   * @param {string} params.id weiss-online内部のMaster ID
   * @param {string|null} [params.cardNumber=null] 実カードに印刷されたカード番号
   * @param {string} params.name
   * @param {string} params.cardType
   * @param {string} params.color
   * @param {string|null} [params.imageUrl=null] カード画像URL
   * @param {number} params.level
   * @param {number} params.cost
   * @param {number|null} [params.basePower=null]
   * @param {number|null} [params.baseSoul=null]
   * @param {string[]} [params.triggerIcons=[]]
   * @param {CardAbility[]|object[]} [params.abilities=[]]
   * @param {string[]} [params.traits=[]]
   * @param {string} [params.text=""] legacy / transitionalなカードテキスト
   */
  constructor({
    id,
    cardNumber = null,
    name,
    cardType,
    color,
    imageUrl = null,
    level,
    cost,
    basePower = null,
    baseSoul = null,
    triggerIcons = undefined,
    triggers = undefined,
    traits = [],
    text = "",
    abilities = [],
  }) {
    assertNonEmptyString("id", id);
    assertNullableNonEmptyString("cardNumber", cardNumber);
    assertNonEmptyString("name", name);
    assertNonEmptyString("cardType", cardType);
    assertNonEmptyString("color", color);
    assertNullableUrl("imageUrl", imageUrl);
    assertNonNegativeNumber("level", level);
    assertNonNegativeNumber("cost", cost);
    assertNullableNonNegativeNumber("basePower", basePower);
    assertNullableNonNegativeNumber("baseSoul", baseSoul);
    if (triggerIcons !== undefined && triggers !== undefined) {
      throw new TypeError("Specify triggerIcons, not both triggerIcons and legacy triggers.");
    }
    const resolvedTriggerIcons = triggerIcons ?? triggers ?? [];
    assertStringArray("triggerIcons", resolvedTriggerIcons);
    resolvedTriggerIcons.forEach((icon, index) => {
      if (!TRIGGER_ICON_VALUES.includes(icon)) {
        throw new RangeError(
          `triggerIcons[${index}] must be one of: ${TRIGGER_ICON_VALUES.join(", ")}. Received: ${String(icon)}.`,
        );
      }
    });
    assertStringArray("traits", traits);
    if (!Array.isArray(abilities)) {
      throw new TypeError("abilities must be an array.");
    }
    if (typeof text !== "string") {
      throw new TypeError("text must be a string.");
    }

    this.id = id;
    this.cardNumber = cardNumber;
    this.name = name;
    this.cardType = cardType;
    this.color = color;
    this.imageUrl = imageUrl;
    this.level = level;
    this.cost = cost;
    this.basePower = basePower;
    this.baseSoul = baseSoul;
    this.triggerIcons = Object.freeze([...resolvedTriggerIcons]);
    this.traits = Object.freeze([...traits]);
    this.text = text;
    this.abilities = Object.freeze(abilities.map((ability, index) => {
      try {
        return ability instanceof CardAbility ? ability : new CardAbility(ability);
      } catch (error) {
        throw new TypeError(`abilities[${index}] is invalid: ${error.message}`, { cause: error });
      }
    }));
    const abilityIds = new Set();
    for (const ability of this.abilities) {
      if (abilityIds.has(ability.id)) {
        throw new Error(`Duplicate CardAbility id "${ability.id}" in CardMaster "${id}".`);
      }
      abilityIds.add(ability.id);
    }

    Object.freeze(this);
  }

  /** @deprecated Card側の互換APIのための別名。正式名称はtriggerIcons。 */
  get triggers() { return this.triggerIcons; }
}

function assertNonEmptyString(propertyName, value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${propertyName} must be a non-empty string.`);
  }
}

function assertNullableNonEmptyString(propertyName, value) {
  if (value !== null) assertNonEmptyString(propertyName, value);
}

function assertNullableUrl(propertyName, value) {
  if (value === null) return;
  assertNonEmptyString(propertyName, value);
  try {
    new URL(value);
  } catch {
    throw new TypeError(`${propertyName} must be an absolute URL or null.`);
  }
}

function assertNonNegativeNumber(propertyName, value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${propertyName} must be a finite number.`);
  }
  if (value < 0) {
    throw new RangeError(`${propertyName} must be at least 0.`);
  }
}

function assertNullableNonNegativeNumber(propertyName, value) {
  if (value !== null) assertNonNegativeNumber(propertyName, value);
}

function assertStringArray(propertyName, value) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new TypeError(`${propertyName} must be an array of strings.`);
  }
}
