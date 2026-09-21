import test from "node:test";
import assert from "node:assert/strict";

import { Card, FACE, POSITION } from "../js/models/card.js";
import { CardMaster } from "../js/models/cardMaster.js";
import { CardMasterRegistry } from "../js/models/cardMasterRegistry.js";

function createMaster(overrides = {}) {
  return new CardMaster({
    id: "master-1",
    cardNumber: null,
    name: "テストカード",
    cardType: "character",
    color: "red",
    level: 1,
    cost: 1,
    basePower: 5000,
    baseSoul: 1,
    triggerIcons: ["SOUL"],
    traits: ["テスト"],
    text: "legacy text",
    ...overrides,
  });
}

function createRegistry(master = createMaster()) {
  const registry = new CardMasterRegistry();
  registry.register(master);
  return registry;
}

test("CardMasterは固定情報と配列をimmutableに保持する", () => {
  const triggers = ["SOUL"];
  const traits = ["テスト"];
  const master = createMaster({ triggerIcons: triggers, traits });
  triggers.push("external");
  traits.push("external");

  assert.equal(master.name, "テストカード");
  assert.deepEqual(master.triggerIcons, ["SOUL"]);
  assert.deepEqual(master.triggers, ["SOUL"]);
  assert.deepEqual(master.traits, ["テスト"]);
  assert.ok(Object.isFrozen(master));
  assert.ok(Object.isFrozen(master.triggerIcons));
  assert.ok(Object.isFrozen(master.traits));
  assert.throws(() => { master.level = 2; }, TypeError);
  assert.throws(() => { master.triggerIcons.push("x"); }, TypeError);
});

test("CardMasterRegistryは登録・検索・一覧を提供し内部配列を公開しない", () => {
  const master = createMaster();
  const registry = createRegistry(master);
  assert.equal(registry.has(master.id), true);
  assert.equal(registry.get(master.id), master);
  const all = registry.getAll();
  assert.deepEqual(all, [master]);
  assert.ok(Object.isFrozen(all));
  assert.throws(() => all.push(createMaster({ id: "master-2" })), TypeError);
  assert.deepEqual(registry.getAll(), [master]);
  assert.throws(() => registry.register(master), /already registered/);
  assert.throws(() => registry.get("unknown"), /not registered/);
});

test("Cardはmasterの固定情報をgetterで公開しruntime値を初期化する", () => {
  const master = createMaster();
  const registry = createRegistry(master);
  const card = new Card({
    instanceId: "instance-1",
    masterId: master.id,
    masterRegistry: registry,
    owner: "self",
  });

  assert.equal(card.instanceId, "instance-1");
  assert.equal(card.id, "instance-1");
  assert.equal(card.masterId, master.id);
  assert.equal(card.master, master);
  assert.equal(card.cardNumber, null);
  assert.equal(card.name, master.name);
  assert.equal(card.cardType, master.cardType);
  assert.equal(card.color, master.color);
  assert.equal(card.level, master.level);
  assert.equal(card.cost, master.cost);
  assert.equal(card.basePower, master.basePower);
  assert.equal(card.baseSoul, master.baseSoul);
  assert.equal(card.trigger, master.triggers);
  assert.equal(card.triggers, master.triggers);
  assert.equal(card.traits, master.traits);
  assert.equal(card.text, master.text);
  assert.equal(card.currentPower, master.basePower);
  assert.equal(card.currentSoul, master.baseSoul);
  assert.equal(card.face, null);
  assert.equal(card.visibilityOverride, null);
});

test("Cardは0を含む明示runtime値を優先しunknown masterを拒否する", () => {
  const registry = createRegistry();
  const card = new Card({
    instanceId: "instance-zero",
    masterId: "master-1",
    masterRegistry: registry,
    owner: "opponent",
    currentPower: 0,
    currentSoul: 0,
  });
  assert.equal(card.currentPower, 0);
  assert.equal(card.currentSoul, 0);
  assert.throws(() => new Card({
    instanceId: "bad",
    masterId: "unknown",
    masterRegistry: registry,
    owner: "self",
  }), /not registered/);
});

test("Card serializationはruntime stateだけを往復する", () => {
  const registry = createRegistry();
  const card = new Card({
    instanceId: "serialized-1",
    masterId: "master-1",
    masterRegistry: registry,
    owner: "self",
    zone: "stage",
    row: "front",
    index: 2,
    face: FACE.DOWN,
    position: POSITION.REST,
    currentPower: 0,
    currentSoul: 0,
    visibilityOverride: "hidden",
  });
  const json = card.toJSON();
  assert.deepEqual(Object.keys(json), [
    "instanceId", "masterId", "owner", "zone", "row", "index", "face",
    "position", "currentPower", "currentSoul", "visibilityOverride",
  ]);
  assert.equal("master" in json, false);
  assert.equal("name" in json, false);
  const restored = Card.fromJSON(json, registry);
  assert.deepEqual(restored.toJSON(), json);
  assert.equal(restored.master, registry.get("master-1"));
  assert.throws(
    () => Card.fromJSON({ ...json, masterId: "unknown" }, registry),
    /not registered/,
  );
});
