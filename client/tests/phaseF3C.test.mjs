import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { TRIGGER_ICON } from "../js/constants/triggerIcon.js";
import { CardAbility } from "../js/models/cardAbility.js";
import { CardMaster } from "../js/models/cardMaster.js";
import { DeckDefinition } from "../js/models/deckDefinition.js";
import {
  createCardMasterRegistry,
  validateCardMasterDefinitions,
} from "../js/data/cardMasterLoader.js";
import { createDeckFromDefinition } from "../js/data/deckDefinitionLoader.js";

const readJson = async (relativeUrl) => JSON.parse(await readFile(
  new URL(relativeUrl, import.meta.url), "utf8",
));

function masterData(overrides = {}) {
  return {
    id: "test-card", cardNumber: null, name: "テスト", cardType: "CHARACTER",
    color: "YELLOW", imageUrl: null, level: 0, cost: 0, basePower: 1500, baseSoul: 1,
    triggerIcons: [], traits: [], abilities: [], ...overrides,
  };
}

test("TRIGGER_ICONは正式値と空・重複配列を受け付け、未知値を拒否する", () => {
  for (const icon of Object.values(TRIGGER_ICON)) {
    assert.deepEqual(new CardMaster(masterData({ triggerIcons: [icon] })).triggerIcons, [icon]);
  }
  assert.deepEqual(new CardMaster(masterData()).triggerIcons, []);
  const duplicated = new CardMaster(masterData({ triggerIcons: ["SOUL", "SOUL"] }));
  assert.deepEqual(duplicated.triggerIcons, ["SOUL", "SOUL"]);
  assert.equal(duplicated.triggers, duplicated.triggerIcons);
  assert.throws(() => new CardMaster(masterData({ triggerIcons: ["UNKNOWN"] })), /triggerIcons\[0\]/);
  assert.equal("NONE" in TRIGGER_ICON, false);
});

test("正式plain objectをCardMaster/CardAbilityへ変換しRegistryへ登録する", () => {
  const ability = { id: "ABILITY_1", type: "ACT", keywords: [], text: "能力テキスト",
    activationTrigger: null, conditions: [], costs: [], effects: [] };
  const definitions = [masterData({ abilities: [ability] })];
  const registry = createCardMasterRegistry(definitions);
  assert.equal(registry.get("test-card").id, "test-card");
  assert.ok(registry.get("test-card").abilities[0] instanceof CardAbility);
  assert.deepEqual(createCardMasterRegistry([masterData()]).get("test-card").abilities, []);
  assert.throws(() => validateCardMasterDefinitions([...definitions, masterData()]), /duplicate/i);
});

test("DeckDefinitionは入力から独立したimmutableな内容だけを保持し枚数ルールを持たない", () => {
  const entry = { masterId: "test-card", count: 2 };
  const cards = [entry];
  const definition = new DeckDefinition({ id: "deck", name: "デッキ", cards });
  entry.count = 99;
  cards.push({ masterId: "other", count: 48 });
  assert.deepEqual(definition.cards, [{ masterId: "test-card", count: 2 }]);
  assert.ok(Object.isFrozen(definition));
  assert.ok(Object.isFrozen(definition.cards));
  assert.ok(Object.isFrozen(definition.cards[0]));
  assert.doesNotThrow(() => new DeckDefinition({ id: "short", name: "短いデッキ", cards: [] }));
});

test("DeckDefinitionをcount分の独立Cardへ展開しunknown masterをfail-fastする", () => {
  const registry = createCardMasterRegistry([masterData()]);
  const definition = new DeckDefinition({ id: "deck", name: "デッキ", cards: [
    { masterId: "test-card", count: 3 },
  ] });
  const self = createDeckFromDefinition("self", definition, registry);
  const opponent = createDeckFromDefinition("opponent", definition, registry);
  assert.equal(self.cards.length, 3);
  assert.equal(new Set([...self.cards, ...opponent.cards].map((card) => card.instanceId)).size, 6);
  assert.notEqual(self.cards[0], self.cards[1]);
  assert.notEqual(self.cards[0], opponent.cards[0]);
  assert.equal(self.cards[0].master, opponent.cards[0].master);
  const bad = new DeckDefinition({ id: "bad", name: "bad", cards: [{ masterId: "unknown", count: 1 }] });
  assert.throws(() => createDeckFromDefinition("self", bad, registry), /not registered/);
});

test("開発用CardMasterとDeckDefinitionを読み込むと50枚へ展開できる", async () => {
  const masters = await readJson("../data/card-masters.json");
  const decks = await readJson("../data/test-decks.json");
  const registry = createCardMasterRegistry(masters);
  const definition = new DeckDefinition(decks[0]);
  const deck = createDeckFromDefinition("self", definition, registry);
  assert.equal(masters.length, 13);
  assert.equal(deck.cards.length, 50);
  assert.equal(new Set(deck.cards.map((card) => card.instanceId)).size, 50);
  assert.ok(deck.cards.every((card) => registry.has(card.masterId)));
});
