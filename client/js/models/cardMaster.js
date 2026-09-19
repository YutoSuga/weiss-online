/**
 * カード種類ごとの、対戦中に変化しない固定情報を表す。
 */
export class CardMaster {
  /**
   * @param {object} params
   * @param {string} params.id weiss-online内部のMaster ID
   * @param {string|null} [params.cardNumber=null] 実カードに印刷されたカード番号
   * @param {string} params.name
   * @param {string} params.cardType
   * @param {string} params.color
   * @param {number} params.level
   * @param {number} params.cost
   * @param {number|null} [params.basePower=null]
   * @param {number|null} [params.baseSoul=null]
   * @param {string[]} [params.triggers=[]]
   * @param {string[]} [params.traits=[]]
   * @param {string} [params.text=""] legacy / transitionalなカードテキスト
   */
  constructor({
    id,
    cardNumber = null,
    name,
    cardType,
    color,
    level,
    cost,
    basePower = null,
    baseSoul = null,
    triggers = [],
    traits = [],
    text = "",
  }) {
    assertNonEmptyString("id", id);
    assertNullableNonEmptyString("cardNumber", cardNumber);
    assertNonEmptyString("name", name);
    assertNonEmptyString("cardType", cardType);
    assertNonEmptyString("color", color);
    assertNonNegativeNumber("level", level);
    assertNonNegativeNumber("cost", cost);
    assertNullableNonNegativeNumber("basePower", basePower);
    assertNullableNonNegativeNumber("baseSoul", baseSoul);
    assertStringArray("triggers", triggers);
    assertStringArray("traits", traits);
    if (typeof text !== "string") {
      throw new TypeError("text must be a string.");
    }

    this.id = id;
    this.cardNumber = cardNumber;
    this.name = name;
    this.cardType = cardType;
    this.color = color;
    this.level = level;
    this.cost = cost;
    this.basePower = basePower;
    this.baseSoul = baseSoul;
    this.triggers = Object.freeze([...triggers]);
    this.traits = Object.freeze([...traits]);
    this.text = text;

    Object.freeze(this);
  }
}

function assertNonEmptyString(propertyName, value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${propertyName} must be a non-empty string.`);
  }
}

function assertNullableNonEmptyString(propertyName, value) {
  if (value !== null) assertNonEmptyString(propertyName, value);
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
