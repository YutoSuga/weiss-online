import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createCardMasterRegistry } from "../js/data/cardMasterLoader.js";
import { createDeckFromDefinition } from "../js/data/deckDefinitionLoader.js";
import { DeckDefinition } from "../js/models/deckDefinition.js";
import { summarizeDeckCards } from "../js/ui/devController.js";

const readJson = async (relativeUrl) => JSON.parse(await readFile(
  new URL(relativeUrl, import.meta.url), "utf8",
));

const expectedCards = [
  ["cha-w40-001sp", "CHA/W40-001SP", "“大切な何か”西森 柚咲", "CHARACTER", "YELLOW", 3, 2, ["SOUL", "SOUL"], ["能力者", "生徒会"], 3],
  ["kch-w78-048", "Kch/W78-048", "約束 乙坂 有宇&友利 奈緒", "CHARACTER", "GREEN", 3, 2, ["SOUL", "SOUL"], ["Anniversary", "能力者", "生徒会"], 1],
  ["cha-w40-052sp", "CHA/W40-052SP", "“大切な何か”美砂", "CHARACTER", "RED", 3, 2, ["SOUL", "SOUL"], ["能力者", "死"], 4],
  ["cha-w40-077sp", "CHA/W40-077SP", "“大切な何か”友利 奈緒", "CHARACTER", "BLUE", 3, 2, ["SOUL", "SOUL"], ["能力者", "生徒会"], 3],
  ["kch-w78-115", "Kch/W78-115", "幸せな日常 乙坂 有宇", "CHARACTER", "BLUE", 2, 1, ["SOUL"], ["Anniversary", "能力者", "生徒会"], 4],
  ["kch-w78-095sp", "Kch/W78-095SP", "撮りたかった景色 友利 奈緒", "CHARACTER", "BLUE", 1, 0, [], ["Anniversary", "能力者", "生徒会"], 4],
  ["kch-we50-52sp", "Kch/WE50-52SP", "これからの記録 友利 奈緒", "CHARACTER", "BLUE", 1, 0, [], ["Anniversary", "能力者", "生徒会"], 3],
  ["kch-we50-06prr", "Kch/WE50-06PRR", "最高のクリスマス 西森 柚咲", "CHARACTER", "YELLOW", 0, 0, [], ["Anniversary", "能力者", "生徒会"], 2],
  ["kch-w78-001s", "Kch/W78-001S", "人気アイドル 西森 柚咲", "CHARACTER", "YELLOW", 0, 0, [], ["Anniversary", "能力者", "生徒会"], 1],
  ["kch-w78-006", "Kch/W78-006", "浜辺の姉妹 西森 柚咲&美砂", "CHARACTER", "YELLOW", 0, 0, [], ["Anniversary", "能力者", "生徒会"], 2],
  ["cha-w40-026sp", "CHA/W40-026SP", "“大切な何か”乙坂 歩未", "CHARACTER", "GREEN", 0, 0, [], ["能力者", "ピザソース"], 4],
  ["cha-w40-054s", "CHA/W40-054S", "“とぼけた表情”西森 柚咲", "CHARACTER", "RED", 0, 0, [], ["能力者", "生徒会"], 1],
  ["kch-w78-069s", "Kch/W78-069S", "もう1人の少女 美砂", "CHARACTER", "RED", 0, 0, [], ["Anniversary", "能力者", "死"], 4],
  ["cha-w40-078", "CHA/W40-078", "“いまに挑む”乙坂 有宇", "CHARACTER", "BLUE", 0, 0, [], ["能力者", "生徒会"], 4],
  ["cha-w40-047", "CHA/W40-047", "金さんラーメン", "EVENT", "GREEN", 2, 1, [], [], 2],
  ["cha-w40-098r", "CHA/W40-098R", "逃避行の果てに", "CLIMAX", "BLUE", 0, 0, ["SOUL", "GATE"], [], 4],
  ["kch-w78-119r", "Kch/W78-119R", "奇跡の歌", "CLIMAX", "BLUE", 0, 0, ["SOUL", "GATE"], [], 4],
];

test("ブラウザ確認用Deckは指定された実在17種・50枚のCardMasterデータを保持する", async () => {
  const masters = await readJson("../data/card-masters.json");
  const decks = await readJson("../data/test-decks.json");
  const registry = createCardMasterRegistry(masters);
  const definition = new DeckDefinition(decks[0]);

  assert.equal(definition.cards.length, 17);
  assert.deepEqual(definition.cards, expectedCards.map(([masterId,,,,,,,,, count]) => ({ masterId, count })));

  for (const [id, cardNumber, name, cardType, color, level, cost, triggerIcons, traits] of expectedCards) {
    const master = registry.get(id);
    assert.deepEqual(
      { cardNumber: master.cardNumber, name: master.name, cardType: master.cardType, color: master.color,
        level: master.level, cost: master.cost, triggerIcons: master.triggerIcons, traits: master.traits },
      { cardNumber, name, cardType, color, level, cost, triggerIcons, traits },
    );
    if (!["kch-w78-001s", "cha-w40-026sp"].includes(id)) assert.deepEqual(master.abilities, []);
  }

  const deck = createDeckFromDefinition("self", definition, registry);
  const counts = deck.cards.reduce((result, card) => {
    result[card.cardType] = (result[card.cardType] ?? 0) + 1;
    return result;
  }, {});
  assert.deepEqual(counts, { CHARACTER: 40, EVENT: 2, CLIMAX: 8 });
  assert.equal(deck.cards.length, 50);
  assert.equal(deck.cards.filter((card) => card.cardType === "CLIMAX").length, 8);
});

test("既存の西森柚咲ACT集中とowner別instance、およびDEV選択用集約を維持する", async () => {
  const registry = createCardMasterRegistry(await readJson("../data/card-masters.json"));
  const definition = new DeckDefinition((await readJson("../data/test-decks.json"))[0]);
  const self = createDeckFromDefinition("self", definition, registry);
  const opponent = createDeckFromDefinition("opponent", definition, registry);
  const yuzusa = registry.get("kch-w78-001s");

  assert.equal(yuzusa.abilities.length, 1);
  assert.equal(yuzusa.abilities[0].id, "ACT_BRAINSTORM");
  assert.deepEqual(yuzusa.abilities[0].keywords, ["BRAINSTORM"]);
  assert.equal(new Set([...self.cards, ...opponent.cards].map((card) => card.instanceId)).size, 100);
  assert.ok(self.cards.every((card, index) => card !== opponent.cards[index]));
  assert.deepEqual(
    summarizeDeckCards(self.cards).find(({ masterId }) => masterId === "kch-w78-001s"),
    { masterId: "kch-w78-001s", name: "人気アイドル 西森 柚咲", count: 1 },
  );
});
