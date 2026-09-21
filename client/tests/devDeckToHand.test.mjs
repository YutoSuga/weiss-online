import test from "node:test";
import assert from "node:assert/strict";

import { Card } from "../js/models/card.js";
import { CardMaster } from "../js/models/cardMaster.js";
import { CardMasterRegistry } from "../js/models/cardMasterRegistry.js";
import { Deck } from "../js/models/deck.js";
import { Player } from "../js/models/player.js";
import { moveDeckCardToHandByMasterId, summarizeDeckCards } from "../js/ui/devController.js";

function fixture(masterIds = ["a", "b", "a", "c"]) {
  const registry = new CardMasterRegistry();
  for (const id of new Set(masterIds)) registry.register(new CardMaster({
    id, name: `card-${id}`, cardType: "CHARACTER", color: "RED", level: 0,
    cost: 0, basePower: 1000, baseSoul: 1, triggerIcons: [], traits: [],
  }));
  const cards = masterIds.map((masterId, index) => new Card({
    instanceId: `${masterId}-${index}`, masterId, masterRegistry: registry, owner: "self",
  }));
  return { cards, player: new Player({ id: "self", name: "self", deck: new Deck(cards) }) };
}

test("指定masterIdのTOP側の1枚だけを同じinstanceのまま手札へ移す", () => {
  const { cards, player } = fixture();
  const totalBefore = player.deck.cards.length + player.hand.length;
  const moved = moveDeckCardToHandByMasterId(player, "a");

  assert.equal(moved, cards[0]);
  assert.equal(player.hand.at(-1), cards[0]);
  assert.equal(moved.zone, "hand");
  assert.deepEqual(player.deck.cards, [cards[1], cards[2], cards[3]]);
  assert.equal(player.deck.cards.length + player.hand.length, totalBefore);
  assert.equal(player.deck.cards.filter((card) => card.masterId === "a").length, 1);
});

test("不存在masterIdと空山札では状態を変更しない", () => {
  const { cards, player } = fixture(["a", "b"]);
  assert.equal(moveDeckCardToHandByMasterId(player, "missing"), null);
  assert.deepEqual(player.deck.cards, cards);
  assert.deepEqual(player.hand, []);

  const empty = fixture([]).player;
  assert.equal(moveDeckCardToHandByMasterId(empty, "a"), null);
  assert.deepEqual(empty.hand, []);
});

test("一覧は現在の山札順でmasterIdごとに集約する", () => {
  const { player } = fixture();
  assert.deepEqual(summarizeDeckCards(player.deck.cards), [
    { masterId: "a", name: "card-a", count: 2 },
    { masterId: "b", name: "card-b", count: 1 },
    { masterId: "c", name: "card-c", count: 1 },
  ]);
  assert.deepEqual(summarizeDeckCards([]), []);
});

test("DEV直接移動はprocess・rule state・phaseを変更しない", () => {
  const { player } = fixture(["a"]);
  const state = {
    phase: "main",
    ruleState: { processStack: [{ type: "main_phase" }], pendingInterrupts: ["refresh"] },
  };
  const before = structuredClone(state);
  moveDeckCardToHandByMasterId(player, "a");
  assert.deepEqual(state, before);
});
