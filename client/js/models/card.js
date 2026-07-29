import { ZONE, ZONE_VALUES } from "../constants/zone.js";

/**
 * カードの表裏。
 */
export const FACE = Object.freeze({
  UP: "up",
  DOWN: "down",
});

/**
 * 舞台上のカードの向き。
 */
export const POSITION = Object.freeze({
  STAND: "stand",
  REST: "rest",
  REVERSE: "reverse",
});

const OWNER_VALUES = Object.freeze(["self", "opponent"]);
const FACE_VALUES = Object.freeze(Object.values(FACE));
const POSITION_VALUES = Object.freeze(Object.values(POSITION));

/**
 * 値が許可された文字列か検証する。
 *
 * @param {string} propertyName
 * @param {unknown} value
 * @param {readonly string[]} allowedValues
 * @throws {TypeError|RangeError}
 */
function assertEnumValue(propertyName, value, allowedValues) {
  if (typeof value !== "string") {
    throw new TypeError(`${propertyName} must be a string.`);
  }

  if (!allowedValues.includes(value)) {
    throw new RangeError(
      `${propertyName} must be one of: ${allowedValues.join(", ")}.`,
    );
  }
}

/**
 * @param {string} propertyName
 * @param {unknown} value
 * @param {{nullable?: boolean}} [options]
 * @throws {TypeError}
 */
function assertString(propertyName, value, { nullable = false } = {}) {
  if (nullable && value === null) {
    return;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${propertyName} must be a non-empty string.`);
  }
}

/**
 * @param {string} propertyName
 * @param {unknown} value
 * @param {{nullable?: boolean, min?: number}} [options]
 * @throws {TypeError|RangeError}
 */
function assertNumber(
  propertyName,
  value,
  { nullable = false, min = 0 } = {},
) {
  if (nullable && value === null) {
    return;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${propertyName} must be a finite number.`);
  }

  if (value < min) {
    throw new RangeError(`${propertyName} must be at least ${min}.`);
  }
}

/**
 * @param {string} propertyName
 * @param {unknown} value
 * @throws {TypeError}
 */
function assertStringArray(propertyName, value) {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string")
  ) {
    throw new TypeError(`${propertyName} must be an array of strings.`);
  }
}

/**
 * @param {unknown} index
 * @throws {TypeError}
 */
function assertIndex(index) {
  if (index !== null && (!Number.isInteger(index) || index < 0)) {
    throw new TypeError("index must be null or a non-negative integer.");
  }
}

/**
 * カード1枚の固定情報と、対戦中に変化する現在状態を表す。
 * DOM操作やゲームルール判定はこのクラスの責務に含めない。
 */
export class Card {
  /**
   * @param {object} params
   * @param {string} params.id カードインスタンスを一意に識別するID
   * @param {string} params.name カード名
   * @param {string} params.cardType カード種別
   * @param {number} params.level 印刷されたレベル
   * @param {number} params.cost 印刷されたコスト
   * @param {string} params.color カード色
   * @param {number|null} [params.basePower=null] 基本パワー
   * @param {number|null} [params.baseSoul=null] 基本ソウル
   * @param {string[]} [params.trigger=[]] トリガーアイコン
   * @param {string[]} [params.traits=[]] 特徴
   * @param {string} [params.text=""] 能力テキスト
   * @param {'self'|'opponent'} params.owner 所有者
   * @param {string} [params.zone=ZONE.DECK] 現在のゾーン
   * @param {string|null} [params.row=null] 舞台等の行
   * @param {number|null} [params.index=null] ゾーン内の位置
   * @param {'up'|'down'} [params.face=FACE.DOWN] 表裏
   * @param {'stand'|'rest'|'reverse'} [params.position=POSITION.STAND] 向き
   * @param {number|null} [params.currentPower=params.basePower] 現在パワー
   * @param {number|null} [params.currentSoul=params.baseSoul] 現在ソウル
   */
  constructor({
    id,
    name,
    cardType,
    level,
    cost,
    color,
    basePower = null,
    baseSoul = null,
    trigger = [],
    traits = [],
    text = "",
    owner,
    zone = ZONE.DECK,
    row = null,
    index = null,
    face = FACE.DOWN,
    position = POSITION.STAND,
    currentPower = basePower,
    currentSoul = baseSoul,
  }) {
    assertString("id", id);
    assertString("name", name);
    assertString("cardType", cardType);
    assertNumber("level", level);
    assertNumber("cost", cost);
    assertString("color", color);
    assertNumber("basePower", basePower, { nullable: true });
    assertNumber("baseSoul", baseSoul, { nullable: true });
    assertStringArray("trigger", trigger);
    assertStringArray("traits", traits);

    if (typeof text !== "string") {
      throw new TypeError("text must be a string.");
    }

    assertEnumValue("owner", owner, OWNER_VALUES);
    assertEnumValue("zone", zone, ZONE_VALUES);
    assertString("row", row, { nullable: true });
    assertIndex(index);
    assertEnumValue("face", face, FACE_VALUES);
    assertEnumValue("position", position, POSITION_VALUES);
    assertNumber("currentPower", currentPower, { nullable: true });
    assertNumber("currentSoul", currentSoul, { nullable: true });

    this.id = id;
    this.name = name;
    this.cardType = cardType;
    this.level = level;
    this.cost = cost;
    this.color = color;
    this.basePower = basePower;
    this.baseSoul = baseSoul;
    this.trigger = [...trigger];
    this.traits = [...traits];
    this.text = text;

    this.owner = owner;
    this.zone = zone;
    this.row = row;
    this.index = index;
    this.face = face;
    this.position = position;
    this.currentPower = currentPower;
    this.currentSoul = currentSoul;
  }

  /**
   * カードを別のゾーンまたは位置へ移動する。
   *
   * @param {object} destination
   * @param {string} destination.zone
   * @param {string|null} [destination.row=null]
   * @param {number|null} [destination.index=null]
   * @returns {Card}
   */
  moveTo({ zone, row = null, index = null }) {
    assertEnumValue("zone", zone, ZONE_VALUES);
    assertString("row", row, { nullable: true });
    assertIndex(index);

    this.zone = zone;
    this.row = row;
    this.index = index;
    return this;
  }

  /**
   * カードの表裏を変更する。
   *
   * @param {'up'|'down'} face
   * @returns {Card}
   */
  setFace(face) {
    assertEnumValue("face", face, FACE_VALUES);
    this.face = face;
    return this;
  }

  /**
   * カードの向きを変更する。
   *
   * @param {'stand'|'rest'|'reverse'} position
   * @returns {Card}
   */
  setPosition(position) {
    assertEnumValue("position", position, POSITION_VALUES);
    this.position = position;
    return this;
  }

  /**
   * 保存・通信に使用できるプレーンオブジェクトへ変換する。
   *
   * @returns {object}
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      cardType: this.cardType,
      level: this.level,
      cost: this.cost,
      color: this.color,
      basePower: this.basePower,
      baseSoul: this.baseSoul,
      trigger: [...this.trigger],
      traits: [...this.traits],
      text: this.text,
      owner: this.owner,
      zone: this.zone,
      row: this.row,
      index: this.index,
      face: this.face,
      position: this.position,
      currentPower: this.currentPower,
      currentSoul: this.currentSoul,
    };
  }

  /**
   * プレーンオブジェクトからCardを復元する。
   *
   * @param {object} data
   * @returns {Card}
   */
  static fromJSON(data) {
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      throw new TypeError("Card JSON data must be an object.");
    }

    return new Card(data);
  }
}

export { ZONE };
