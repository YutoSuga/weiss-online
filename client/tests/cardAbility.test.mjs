import test from "node:test";
import assert from "node:assert/strict";

import { ABILITY_TYPE } from "../js/constants/ability.js";
import { CardAbility } from "../js/models/cardAbility.js";
import { CardMaster } from "../js/models/cardMaster.js";
import { CardMasterRegistry } from "../js/models/cardMasterRegistry.js";
import { Card } from "../js/models/card.js";

function ability(overrides = {}) {
  return new CardAbility({
    id: "ABILITY_1",
    type: ABILITY_TYPE.ACT,
    keywords: ["BRAINSTORM"],
    text: "【起】テスト能力",
    activationTrigger: null,
    conditions: [{ type: "HAS_CHARACTER", filter: { traitsAny: ["テスト"] } }],
    costs: [{ type: "PAY_STOCK", amount: 1 }],
    effects: [{ type: "DRAW", amount: 1 }],
    ...overrides,
  });
}

function master(overrides = {}) {
  return new CardMaster({
    id: "master-1", name: "テスト", cardType: "character", color: "red",
    level: 0, cost: 0, basePower: 1000, baseSoul: 1,
    triggerIcons: ["SOUL"], traits: [], text: "legacy text", ...overrides,
  });
}

test("CardAbilityは3種のtypeと各固定情報を保持しunknown typeを拒否する", () => {
  for (const type of Object.values(ABILITY_TYPE)) assert.equal(ability({ type }).type, type);
  const value = ability();
  assert.equal(value.id, "ABILITY_1");
  assert.deepEqual(value.keywords, ["BRAINSTORM"]);
  assert.equal(value.text, "【起】テスト能力");
  assert.equal(value.activationTrigger, null);
  assert.equal(value.conditions[0].type, "HAS_CHARACTER");
  assert.equal(value.costs[0].amount, 1);
  assert.equal(value.effects[0].type, "DRAW");
  assert.throws(() => ability({ type: "UNKNOWN" }), /type must be one of/);
});

test("CardAbilityは入力をdeep copyしてnested structureまでimmutableにする", () => {
  const keywords = ["CHANGE"];
  const conditions = [{ filter: { colors: ["red"] } }];
  const costs = [{ type: "PAY_STOCK", amount: 1 }];
  const effects = [{ type: "SEQUENCE", effects: [{ type: "DRAW" }] }];
  const activationTrigger = { type: "ON_PLAY", from: ["hand"] };
  const value = ability({ keywords, conditions, costs, effects, activationTrigger });

  keywords.push("EXTERNAL");
  conditions[0].filter.colors.push("blue");
  costs[0].amount = 999;
  effects[0].effects[0].type = "DAMAGE";
  activationTrigger.from.push("deck");
  assert.deepEqual(value.keywords, ["CHANGE"]);
  assert.deepEqual(value.conditions[0].filter.colors, ["red"]);
  assert.equal(value.costs[0].amount, 1);
  assert.equal(value.effects[0].effects[0].type, "DRAW");
  assert.deepEqual(value.activationTrigger.from, ["hand"]);
  assert.ok(Object.isFrozen(value));
  assert.throws(() => { value.text = "changed"; }, TypeError);
  for (const array of [value.keywords, value.conditions, value.costs, value.effects]) {
    assert.ok(Object.isFrozen(array));
    assert.throws(() => array.push({}), TypeError);
  }
  assert.throws(() => { value.costs[0].amount = 2; }, TypeError);
  assert.throws(() => { value.effects[0].effects[0].type = "DAMAGE"; }, TypeError);
});

test("CardMasterはCardAbilityを直接包含し、defaultとID一意性を保証する", () => {
  assert.deepEqual(master().abilities, []);
  const instance = ability();
  const withInstances = master({ abilities: [instance] });
  assert.equal(withInstances.abilities[0], instance);
  assert.ok(Object.isFrozen(withInstances.abilities));
  assert.throws(() => withInstances.abilities.push(instance), TypeError);
  const fromPlainObject = master({ id: "plain", abilities: [{
    id: "ABILITY_2", type: ABILITY_TYPE.AUTO, activationTrigger: { type: "ON_PLAY" },
  }] });
  assert.ok(fromPlainObject.abilities[0] instanceof CardAbility);
  assert.throws(() => master({ abilities: [instance, ability()] }), /Duplicate CardAbility id/);
  assert.doesNotThrow(() => master({ id: "other", abilities: [ability()] }));
  assert.deepEqual(withInstances.triggerIcons, ["SOUL"]);
});

test("Cardはtrigger互換とabilities参照を保ちserializationには固定情報を含めない", () => {
  const cardMaster = master({ abilities: [ability()] });
  const registry = new CardMasterRegistry();
  registry.register(cardMaster);
  const card = new Card({
    instanceId: "instance-1", masterId: cardMaster.id, masterRegistry: registry, owner: "self",
  });
  assert.equal(card.triggerIcons, cardMaster.triggerIcons);
  assert.equal(card.trigger, cardMaster.triggerIcons);
  assert.equal(card.triggers, cardMaster.triggerIcons);
  assert.equal(card.abilities, cardMaster.abilities);
  assert.equal("abilities" in card.toJSON(), false);
  const restored = Card.fromJSON(card.toJSON(), registry);
  assert.equal(restored.abilities, cardMaster.abilities);
});
