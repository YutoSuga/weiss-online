/**
 * Weiss Onlineで使用するカードの配置ゾーン。
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
});

/**
 * カードの表裏。
 */
export const FACE = Object.freeze({
  UP: "up",
  DOWN: "down",
});

/**
 * カードの向き（状態）。
 */
export const POSITION = Object.freeze({
  STAND: "stand",
  REST: "rest",
  REVERSE: "reverse",
});

const OWNER_VALUES = Object.freeze(["self", "opponent"]);
const ZONE_VALUES = Object.freeze(Object.values(ZONE));
const FACE_VALUES = Object.freeze(Object.values(FACE));
const POSITION_VALUES = Object.freeze(Object.values(POSITION));

/**
 * 値が許可された文字列か検証する。
 *
 * @param {string} propertyName プロパティ名
 * @param {unknown} value 検証対象
 * @param {readonly string[]} allowedValues 許可値
 * @throws {TypeError} 値が文字列でない場合
 * @throws {RangeError} 許可されていない値の場合
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
 * 舞台上の行を表す値を検証する。
 * 舞台以外のゾーンでは `null` を使用できる。
 *
 * @param {unknown} row 検証対象
 * @throws {TypeError} nullまたは文字列でない場合
 */
function assertRow(row) {
  if (row !== null && (typeof row !== "string" || row.length === 0)) {
    throw new TypeError("row must be null or a non-empty string.");
  }
}

/**
 * ゾーン内の位置番号を検証する。
 *
 * @param {unknown} index 検証対象
 * @throws {TypeError} nullまたは0以上の整数でない場合
 */
function assertIndex(index) {
  if (
    index !== null &&
    (!Number.isInteger(index) || /** @type {number} */ (index) < 0)
  ) {
    throw new TypeError("index must be null or a non-negative integer.");
  }
}

/**
 * カード1枚のゲーム状態を表すモデル。
 *
 * DOM操作や描画処理は担当せず、シリアライズ可能な状態と、その状態を
 * 安全に変更する操作だけを提供する。
 */
export class Card {
  /**
   * @param {object} params
   * @param {string} params.id カードインスタンスを一意に識別するID
   * @param {'self'|'opponent'} params.owner カードの所有者
   * @param {string} [params.zone=ZONE.DECK] 現在のゾーン
   * @param {string|null} [params.row=null] ゾーン内の行（例: front / back）
   * @param {number|null} [params.index=null] ゾーン内の位置番号
   * @param {'up'|'down'} [params.face=FACE.DOWN] カードの表裏
   * @param {'stand'|'rest'|'reverse'} [params.position=POSITION.STAND]
   *   カードの向き
   */
  constructor({
    id,
    owner,
    zone = ZONE.DECK,
    row = null,
    index = null,
    face = FACE.DOWN,
    position = POSITION.STAND,
  }) {
    if (typeof id !== "string" || id.trim().length === 0) {
      throw new TypeError("id must be a non-empty string.");
    }

    assertEnumValue("owner", owner, OWNER_VALUES);
    assertEnumValue("zone", zone, ZONE_VALUES);
    assertRow(row);
    assertIndex(index);
    assertEnumValue("face", face, FACE_VALUES);
    assertEnumValue("position", position, POSITION_VALUES);

    /** @type {string} */
    this.id = id;
    /** @type {'self'|'opponent'} */
    this.owner = owner;
    /** @type {string} */
    this.zone = zone;
    /** @type {string|null} */
    this.row = row;
    /** @type {number|null} */
    this.index = index;
    /** @type {'up'|'down'} */
    this.face = face;
    /** @type {'stand'|'rest'|'reverse'} */
    this.position = position;
  }

  /**
   * カードを別のゾーンまたは位置へ移動する。
   * 省略した `row` と `index` は、以前の位置情報を残さないよう `null` にする。
   *
   * @param {object} destination
   * @param {string} destination.zone 移動先ゾーン
   * @param {string|null} [destination.row=null] 移動先の行
   * @param {number|null} [destination.index=null] 移動先の位置番号
   * @returns {Card} メソッドチェーン用に自身を返す
   */
  moveTo({ zone, row = null, index = null }) {
    assertEnumValue("zone", zone, ZONE_VALUES);
    assertRow(row);
    assertIndex(index);

    this.zone = zone;
    this.row = row;
    this.index = index;
    return this;
  }

  /**
   * カードの表裏を変更する。
   *
   * @param {'up'|'down'} face 新しい表裏
   * @returns {Card} メソッドチェーン用に自身を返す
   */
  setFace(face) {
    assertEnumValue("face", face, FACE_VALUES);
    this.face = face;
    return this;
  }

  /**
   * カードの向きを変更する。
   *
   * @param {'stand'|'rest'|'reverse'} position 新しい向き
   * @returns {Card} メソッドチェーン用に自身を返す
   */
  setPosition(position) {
    assertEnumValue("position", position, POSITION_VALUES);
    this.position = position;
    return this;
  }

  /**
   * 通信や保存に使用できるプレーンオブジェクトへ変換する。
   *
   * @returns {{
   *   id: string,
   *   owner: 'self'|'opponent',
   *   zone: string,
   *   row: string|null,
   *   index: number|null,
   *   face: 'up'|'down',
   *   position: 'stand'|'rest'|'reverse'
   * }}
   */
  toJSON() {
    return {
      id: this.id,
      owner: this.owner,
      zone: this.zone,
      row: this.row,
      index: this.index,
      face: this.face,
      position: this.position,
    };
  }

  /**
   * JSON.parse後のオブジェクトからCardを復元する。
   * コンストラクタを経由するため、受信データも同じ規則で検証される。
   *
   * @param {object} data 復元元データ
   * @returns {Card}
   */
  static fromJSON(data) {
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      throw new TypeError("Card JSON data must be an object.");
    }

    return new Card(data);
  }
}

/*
利用例:

const card = new Card({
  id: "self-card-001",
  owner: "self",
});

card
  .moveTo({ zone: ZONE.STAGE, row: "front", index: 1 })
  .setFace(FACE.UP)
  .setPosition(POSITION.REST);

const payload = card.toJSON();
const restoredCard = Card.fromJSON(payload);
*/
