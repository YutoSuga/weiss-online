import { CardMaster } from "../models/cardMaster.js";
import { CardMasterRegistry } from "../models/cardMasterRegistry.js";
import { ABILITY_KEYWORD, ABILITY_TYPE } from "../constants/ability.js";
import { getCostHandler } from "../abilities/costResolver.js";
import { validateEffects } from "../abilities/effectResolver.js";
import { AUTO_TRIGGER_SUBJECT, GAME_EVENT_TYPE } from "../constants/gameEvent.js";
import { PHASE_VALUES } from "../constants/phase.js";
import { ZONE_VALUES } from "../constants/zone.js";
import { POSITION } from "../models/card.js";

export const DEFAULT_CARD_MASTER_URL = new URL("../../data/card-masters.json", import.meta.url);

const REQUIRED_FIELDS = Object.freeze([
  "id", "cardNumber", "name", "cardType", "color", "imageUrl", "level", "cost",
  "basePower", "baseSoul", "triggerIcons", "traits", "abilities",
]);

/** 保存元に依存しないCardMaster plain object群の基本形式を検証する。 */
export function validateCardMasterDefinitions(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError("CardMaster data must be a non-empty array.");
  }
  const ids = new Set();
  value.forEach((definition, index) => {
    if (definition === null || typeof definition !== "object" || Array.isArray(definition)) {
      throw new TypeError(`CardMaster data[${index}] must be an object.`);
    }
    for (const field of REQUIRED_FIELDS) {
      if (!Object.hasOwn(definition, field)) {
        throw new TypeError(`CardMaster data[${index}] is missing required field "${field}".`);
      }
    }
    if (ids.has(definition.id)) {
      throw new Error(`CardMaster data contains duplicate id "${definition.id}".`);
    }
    ids.add(definition.id);
    if (!Array.isArray(definition.abilities)) {
      throw new TypeError(`CardMaster data[${index}].abilities must be an array.`);
    }
    definition.abilities.forEach((ability, abilityIndex) => {
      if (ability?.type === ABILITY_TYPE.AUTO && ability.activationTrigger !== null) {
        try {
          validateAutoAbility(ability);
        } catch (error) {
          throw new TypeError(
            `CardMaster data[${index}].abilities[${abilityIndex}] has an invalid AUTO trigger: ${error.message}`,
            { cause: error },
          );
        }
      }
      if (ability?.type !== ABILITY_TYPE.ACT) return;
      try {
        const keywords = ability.keywords ?? [];
        if (!Array.isArray(keywords) || keywords.some((keyword) => !Object.values(ABILITY_KEYWORD).includes(keyword))) {
          throw new RangeError("ACT keywords contain an unsupported value.");
        }
        if (!Array.isArray(ability.conditions) || ability.conditions.length > 0) {
          throw new RangeError("ACT conditions must be an empty array in F-4A.");
        }
        if (!Array.isArray(ability.costs) || !Array.isArray(ability.effects)) {
          throw new TypeError("ACT costs and effects must be arrays.");
        }
        ability.costs.forEach(getCostHandler);
        validateEffects(ability.effects);
      } catch (error) {
        throw new TypeError(
          `CardMaster data[${index}].abilities[${abilityIndex}] is not executable: ${error.message}`,
          { cause: error },
        );
      }
    });
  });
  return value;
}

function validateAutoAbility(ability) {
  const trigger = ability.activationTrigger;
  if (!trigger || typeof trigger !== "object" || Array.isArray(trigger)) {
    throw new TypeError("activationTrigger must be an object or null.");
  }
  if (!Object.values(GAME_EVENT_TYPE).includes(trigger.event)) {
    throw new RangeError("event is not supported in F-5B.");
  }
  const allowed = {
    [GAME_EVENT_TYPE.CARD_MOVED]: ["event", "subject", "fromZone", "toZone"],
    [GAME_EVENT_TYPE.CARD_POSITION_CHANGED]: ["event", "subject", "fromPosition", "toPosition"],
    [GAME_EVENT_TYPE.ATTACK_DECLARED]: ["event", "subject", "attackType"],
    [GAME_EVENT_TYPE.PHASE_STARTED]: ["event", "phase"],
    [GAME_EVENT_TYPE.PHASE_ENDED]: ["event", "phase"],
  }[trigger.event];
  const unknown = Object.keys(trigger).filter((field) => !allowed.includes(field));
  if (unknown.length > 0) throw new RangeError(`unsupported field: ${unknown.join(", ")}.`);
  if ([GAME_EVENT_TYPE.CARD_MOVED, GAME_EVENT_TYPE.CARD_POSITION_CHANGED,
    GAME_EVENT_TYPE.ATTACK_DECLARED].includes(trigger.event) &&
    !Object.values(AUTO_TRIGGER_SUBJECT).includes(trigger.subject)) {
    throw new RangeError("subject is required for this event.");
  }
  for (const field of ["fromZone", "toZone"]) {
    if (trigger[field] != null && !ZONE_VALUES.includes(trigger[field])) throw new RangeError(`${field} is invalid.`);
  }
  for (const field of ["fromPosition", "toPosition"]) {
    if (trigger[field] != null && !Object.values(POSITION).includes(trigger[field])) throw new RangeError(`${field} is invalid.`);
  }
  if (trigger.phase != null && !PHASE_VALUES.includes(trigger.phase)) throw new RangeError("phase is invalid.");
  if (!Array.isArray(ability.activeZones) || ability.activeZones.some((zone) => !ZONE_VALUES.includes(zone))) {
    throw new RangeError("activeZones must contain supported zones.");
  }
  if (trigger.subject !== AUTO_TRIGGER_SUBJECT.SELF && ability.activeZones.length === 0) {
    throw new RangeError("non-SELF AUTO requires activeZones.");
  }
}

/** データソースからCardMaster用plain object群を取得する。 */
export async function loadCardMasterDefinitions(url = DEFAULT_CARD_MASTER_URL) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load CardMaster data: HTTP ${response.status} ${response.statusText}`);
  return validateCardMasterDefinitions(await response.json());
}

/** plain object群をドメインモデルへ変換しRegistryを構築する。 */
export function createCardMasterRegistry(definitions) {
  validateCardMasterDefinitions(definitions);
  const registry = new CardMasterRegistry();
  definitions.forEach((definition) => registry.register(new CardMaster(definition)));
  return registry;
}
