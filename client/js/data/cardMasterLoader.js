import { CardMaster } from "../models/cardMaster.js";
import { CardMasterRegistry } from "../models/cardMasterRegistry.js";
import { ABILITY_TYPE } from "../constants/ability.js";
import { getCostHandler } from "../abilities/costResolver.js";
import { validateEffects } from "../abilities/effectResolver.js";

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
      if (ability?.type !== ABILITY_TYPE.ACT) return;
      try {
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
