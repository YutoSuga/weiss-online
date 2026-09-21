import { CardMaster } from "../models/cardMaster.js";
import { CardMasterRegistry } from "../models/cardMasterRegistry.js";

export const DEFAULT_CARD_MASTER_URL = new URL("../../data/card-masters.json", import.meta.url);

const REQUIRED_FIELDS = Object.freeze([
  "id", "cardNumber", "name", "cardType", "color", "level", "cost",
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
