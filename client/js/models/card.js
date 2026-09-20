import {
  VISIBILITY,
  ZONE,
  ZONE_VALUES,
  ZONE_VISIBILITY,
} from "../constants/zone.js";
import { CardMasterRegistry } from "./cardMasterRegistry.js";

export const FACE = Object.freeze({ UP: "up", DOWN: "down" });
export const POSITION = Object.freeze({
  STAND: "stand",
  REST: "rest",
  REVERSE: "reverse",
});

const OWNER_VALUES = Object.freeze(["self", "opponent"]);
const FACE_VALUES = Object.freeze(Object.values(FACE));
const POSITION_VALUES = Object.freeze(Object.values(POSITION));
const VISIBILITY_VALUES = Object.freeze(Object.values(VISIBILITY));

/** 対戦中の物理的なカード1枚と、その可変状態を表す。 */
export class Card {
  /**
   * @param {object} params
   * @param {string} params.instanceId 対戦中の一意なCard instance ID
   * @param {string} params.masterId
   * @param {CardMasterRegistry} params.masterRegistry
   * @param {'self'|'opponent'} params.owner
   * @param {string} [params.zone=ZONE.DECK]
   * @param {string|null} [params.row=null]
   * @param {number|null} [params.index=null]
   * @param {'up'|'down'|null} [params.face=null]
   * @param {'public'|'owner_only'|'opponent_only'|'hidden'|null} [params.visibilityOverride=null]
   * @param {'stand'|'rest'|'reverse'} [params.position=POSITION.STAND]
   * @param {number|null} [params.currentPower]
   * @param {number|null} [params.currentSoul]
   */
  constructor(params) {
    if (params === null || typeof params !== "object" || Array.isArray(params)) {
      throw new TypeError("Card params must be an object.");
    }
    const {
      instanceId,
      masterId,
      masterRegistry,
      owner,
      zone = ZONE.DECK,
      row = null,
      index = null,
      face = null,
      visibilityOverride = null,
      position = POSITION.STAND,
      currentPower,
      currentSoul,
    } = params;

    assertString("instanceId", instanceId);
    assertString("masterId", masterId);
    if (!(masterRegistry instanceof CardMasterRegistry)) {
      throw new TypeError("masterRegistry must be a CardMasterRegistry instance.");
    }
    const master = masterRegistry.get(masterId);
    assertEnumValue("owner", owner, OWNER_VALUES);
    assertEnumValue("zone", zone, ZONE_VALUES);
    assertString("row", row, { nullable: true });
    assertIndex(index);
    if (face !== null) assertEnumValue("face", face, FACE_VALUES);
    if (visibilityOverride !== null) {
      assertEnumValue("visibilityOverride", visibilityOverride, VISIBILITY_VALUES);
    }
    assertEnumValue("position", position, POSITION_VALUES);

    const resolvedPower = currentPower === undefined ? master.basePower : currentPower;
    const resolvedSoul = currentSoul === undefined ? master.baseSoul : currentSoul;
    assertNumber("currentPower", resolvedPower, { nullable: true });
    assertNumber("currentSoul", resolvedSoul, { nullable: true });

    Object.defineProperties(this, {
      instanceId: { value: instanceId, enumerable: true },
      masterId: { value: masterId, enumerable: true },
      master: { value: master, enumerable: false },
    });
    this.owner = owner;
    this.zone = zone;
    this.row = row;
    this.index = index;
    this.face = face;
    this.visibilityOverride = visibilityOverride;
    this.position = position;
    this.currentPower = resolvedPower;
    this.currentSoul = resolvedSoul;
  }

  get id() { return this.instanceId; }
  get cardNumber() { return this.master.cardNumber; }
  get name() { return this.master.name; }
  get cardType() { return this.master.cardType; }
  get color() { return this.master.color; }
  get level() { return this.master.level; }
  get cost() { return this.master.cost; }
  get basePower() { return this.master.basePower; }
  get baseSoul() { return this.master.baseSoul; }
  get triggerIcons() { return this.master.triggerIcons; }
  get triggers() { return this.master.triggerIcons; }
  get trigger() { return this.master.triggerIcons; }
  get traits() { return this.master.traits; }
  get text() { return this.master.text; }
  get abilities() { return this.master.abilities; }

  moveTo({ zone, row = null, index = null }) {
    assertEnumValue("zone", zone, ZONE_VALUES);
    assertString("row", row, { nullable: true });
    assertIndex(index);
    this.zone = zone;
    this.row = row;
    this.index = index;
    return this;
  }

  setFace(face) {
    if (face !== null) assertEnumValue("face", face, FACE_VALUES);
    this.face = face;
    return this;
  }

  getEffectiveVisibility() {
    return this.visibilityOverride ?? ZONE_VISIBILITY[this.zone];
  }

  setVisibilityOverride(visibilityOverride) {
    if (visibilityOverride !== null) {
      assertEnumValue("visibilityOverride", visibilityOverride, VISIBILITY_VALUES);
    }
    this.visibilityOverride = visibilityOverride;
    return this;
  }

  setPosition(position) {
    assertEnumValue("position", position, POSITION_VALUES);
    this.position = position;
    return this;
  }

  /** CardMaster固定情報を含まないruntime stateを返す。 */
  toJSON() {
    return {
      instanceId: this.instanceId,
      masterId: this.masterId,
      owner: this.owner,
      zone: this.zone,
      row: this.row,
      index: this.index,
      face: this.face,
      position: this.position,
      currentPower: this.currentPower,
      currentSoul: this.currentSoul,
      visibilityOverride: this.visibilityOverride,
    };
  }

  /** @param {object} data @param {CardMasterRegistry} masterRegistry */
  static fromJSON(data, masterRegistry) {
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      throw new TypeError("Card JSON data must be an object.");
    }
    return new Card({ ...data, masterRegistry });
  }
}

function assertEnumValue(propertyName, value, allowedValues) {
  if (typeof value !== "string") throw new TypeError(`${propertyName} must be a string.`);
  if (!allowedValues.includes(value)) {
    throw new RangeError(`${propertyName} must be one of: ${allowedValues.join(", ")}.`);
  }
}

function assertString(propertyName, value, { nullable = false } = {}) {
  if (nullable && value === null) return;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${propertyName} must be a non-empty string.`);
  }
}

function assertNumber(propertyName, value, { nullable = false, min = 0 } = {}) {
  if (nullable && value === null) return;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${propertyName} must be a finite number.`);
  }
  if (value < min) throw new RangeError(`${propertyName} must be at least ${min}.`);
}

function assertIndex(index) {
  if (index !== null && (!Number.isInteger(index) || index < 0)) {
    throw new TypeError("index must be null or a non-negative integer.");
  }
}

export { ZONE };
