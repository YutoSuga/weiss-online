import { ZONE } from "../constants/zone.js";
import { Card, POSITION } from "../models/card.js";
import { CardMasterRegistry } from "../models/cardMasterRegistry.js";
import { Deck } from "../models/deck.js";
import { DeckDefinition } from "../models/deckDefinition.js";

export const DEFAULT_DECK_DEFINITION_URL = new URL("../../data/test-decks.json", import.meta.url);

export function validateDeckDefinitions(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError("DeckDefinition data must be a non-empty array.");
  }
  const ids = new Set();
  value.forEach((definition, index) => {
    if (definition === null || typeof definition !== "object" || Array.isArray(definition)) {
      throw new TypeError(`DeckDefinition data[${index}] must be an object.`);
    }
    for (const field of ["id", "name", "cards"]) {
      if (!Object.hasOwn(definition, field)) throw new TypeError(`DeckDefinition data[${index}] is missing "${field}".`);
    }
    if (ids.has(definition.id)) throw new Error(`Duplicate DeckDefinition id "${definition.id}".`);
    ids.add(definition.id);
  });
  return value;
}

export async function loadDeckDefinitions(url = DEFAULT_DECK_DEFINITION_URL) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load DeckDefinition data: HTTP ${response.status} ${response.statusText}`);
  return validateDeckDefinitions(await response.json()).map((value) => new DeckDefinition(value));
}

/** masterId + countを、対戦中の独立したCard instance群へ展開する。 */
export function createDeckFromDefinition(owner, definition, masterRegistry) {
  if (!["self", "opponent"].includes(owner)) throw new TypeError("owner must be self or opponent.");
  if (!(definition instanceof DeckDefinition)) throw new TypeError("definition must be a DeckDefinition.");
  if (!(masterRegistry instanceof CardMasterRegistry)) throw new TypeError("masterRegistry must be a CardMasterRegistry.");

  const cards = [];
  const copyCounts = new Map();
  definition.cards.forEach(({ masterId, count }) => {
    masterRegistry.get(masterId);
    for (let copy = 0; copy < count; copy += 1) {
      const copyIndex = (copyCounts.get(masterId) ?? 0) + 1;
      copyCounts.set(masterId, copyIndex);
      cards.push(new Card({
        instanceId: `${owner}-${definition.id}-${masterId}-${String(copyIndex).padStart(3, "0")}`,
        masterId,
        masterRegistry,
        owner,
        zone: ZONE.DECK,
        index: cards.length,
        position: POSITION.STAND,
      }));
    }
  });
  return new Deck(cards);
}
