import { ZONE } from "../constants/zone.js";
import { Card, POSITION } from "../models/card.js";
import { CardMaster } from "../models/cardMaster.js";
import { CardMasterRegistry } from "../models/cardMasterRegistry.js";
import { Deck } from "../models/deck.js";

const DEFAULT_TEST_CARD_URL = new URL(
  "../../data/test-cards.json",
  import.meta.url,
);
const REQUIRED_FIELDS = Object.freeze([
  "id",
  "name",
  "cardType",
  "level",
  "cost",
  "color",
  "basePower",
  "baseSoul",
  "trigger",
  "traits",
  "text",
]);

/**
 * F-2Bから継続利用する暫定カード定義を検証する。
 * 正式なCardMaster JSON schemaへの移行はPhase F-3Cで行う。
 *
 * @param {unknown} value
 * @returns {object[]}
 */
export function validateTestCardDefinitions(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError("test-cards.json must be a non-empty array.");
  }

  const definitionIds = new Set();
  value.forEach((definition, index) => {
    if (
      definition === null ||
      typeof definition !== "object" ||
      Array.isArray(definition)
    ) {
      throw new TypeError(`test-cards.json[${index}] must be an object.`);
    }

    for (const field of REQUIRED_FIELDS) {
      if (!Object.hasOwn(definition, field)) {
        throw new TypeError(
          `test-cards.json[${index}] is missing required field "${field}".`,
        );
      }
    }

    if (definitionIds.has(definition.id)) {
      throw new TypeError(
        `test-cards.json contains duplicate definition id "${definition.id}".`,
      );
    }
    definitionIds.add(definition.id);
  });

  return value;
}

/**
 * @param {URL|string} [url=DEFAULT_TEST_CARD_URL]
 * @returns {Promise<object[]>}
 */
export async function loadTestCardDefinitions(url = DEFAULT_TEST_CARD_URL) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    return validateTestCardDefinitions(await response.json());
  } catch (error) {
    console.error("F-3A test card definitions could not be loaded.", {
      url: String(url),
      error,
    });
    throw new Error(
      `Failed to load F-3A test cards from ${String(url)}: ${error.message}`,
      { cause: error },
    );
  }
}

/** 暫定JSONのtrigger名をCardMasterのtriggersへ変換する。 */
export function createTestCardMaster(definition) {
  return new CardMaster({
    id: definition.id,
    cardNumber: definition.cardNumber ?? null,
    name: definition.name,
    cardType: definition.cardType,
    color: definition.color,
    level: definition.level,
    cost: definition.cost,
    basePower: definition.basePower,
    baseSoul: definition.baseSoul,
    triggers: definition.trigger,
    traits: definition.traits,
    text: definition.text,
  });
}

/** 検証済みの暫定定義をCardMasterとして登録したRegistryを作る。 */
export function createTestCardMasterRegistry(definitions) {
  validateTestCardDefinitions(definitions);
  const registry = new CardMasterRegistry();
  definitions.forEach((definition) => {
    registry.register(createTestCardMaster(definition));
  });
  return registry;
}

/**
 * 1つの暫定定義から、ownerごとに一意なCard instanceを生成する。
 * JSONのidは定義識別子であり、Card.idにはcopyIndexを付与する。
 *
 * @param {object} definition
 * @param {'self'|'opponent'} owner
 * @param {number} copyIndex 1始まり
 * @param {number} deckIndex 0始まり
 * @param {CardMasterRegistry} masterRegistry
 * @returns {Card}
 */
export function createTestCardInstance(
  definition,
  owner,
  copyIndex,
  deckIndex,
  masterRegistry,
) {
  return new Card({
    instanceId: `${owner}-${definition.id}-${String(copyIndex).padStart(3, "0")}`,
    masterId: definition.id,
    masterRegistry,
    owner,
    zone: ZONE.DECK,
    row: null,
    index: deckIndex,
    face: null,
    position: POSITION.STAND,
  });
}

/**
 * 定義を順番に繰り返し、独立したCard instanceから開発用Deckを作る。
 *
 * @param {'self'|'opponent'} owner
 * @param {object[]} definitions
 * @param {CardMasterRegistry} masterRegistry
 * @param {number} count
 * @returns {Deck}
 */
export function createTestDeck(owner, definitions, masterRegistry, count = 50) {
  if (!Number.isInteger(count) || count < 0) {
    throw new TypeError("count must be a non-negative integer.");
  }
  validateTestCardDefinitions(definitions);
  if (!(masterRegistry instanceof CardMasterRegistry)) {
    throw new TypeError("masterRegistry must be a CardMasterRegistry instance.");
  }

  const copyCounts = new Map();
  const cards = Array.from({ length: count }, (_unused, deckIndex) => {
    const definition = definitions[deckIndex % definitions.length];
    const copyIndex = (copyCounts.get(definition.id) ?? 0) + 1;
    copyCounts.set(definition.id, copyIndex);
    return createTestCardInstance(
      definition,
      owner,
      copyIndex,
      deckIndex,
      masterRegistry,
    );
  });

  return new Deck(cards);
}
