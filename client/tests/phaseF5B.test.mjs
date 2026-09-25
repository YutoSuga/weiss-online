import test from "node:test";
import assert from "node:assert/strict";

import { ABILITY_SOURCE, ABILITY_TYPE } from "../js/constants/ability.js";
import { AUTO_TRIGGER_SUBJECT, GAME_EVENT_TYPE } from "../js/constants/gameEvent.js";
import { PHASE } from "../js/constants/phase.js";
import { ZONE } from "../js/constants/zone.js";
import { GameEngine } from "../js/core/gameEngine.js";
import { Card, POSITION } from "../js/models/card.js";
import { CardMaster } from "../js/models/cardMaster.js";
import { CardMasterRegistry } from "../js/models/cardMasterRegistry.js";
import { GameState } from "../js/models/gameState.js";
import { Player } from "../js/models/player.js";
import { validateCardMasterDefinitions } from "../js/data/cardMasterLoader.js";

const auto = (id, activationTrigger, activeZones = [ZONE.STAGE]) => ({
  id, type: ABILITY_TYPE.AUTO, text: id, activationTrigger, activeZones,
  keywords: [], conditions: [], costs: [], effects: [],
});

function fixture() {
  const registry = new CardMasterRegistry();
  registry.register(new CardMaster({
    id: "watcher", name: "watcher", cardType: "CHARACTER", color: "YELLOW",
    level: 0, cost: 0, basePower: 0, baseSoul: 1, traits: [], triggerIcons: [],
    abilities: [
      auto("OTHER_REVERSE", { event: GAME_EVENT_TYPE.CARD_POSITION_CHANGED,
        subject: AUTO_TRIGGER_SUBJECT.OTHER_YOUR_CHARACTER, toPosition: POSITION.REVERSE }),
      auto("MAIN_START", { event: GAME_EVENT_TYPE.PHASE_STARTED, phase: PHASE.MAIN }),
      auto("CLOCK_END", { event: GAME_EVENT_TYPE.PHASE_ENDED, phase: PHASE.CLOCK }),
      auto("SELF_ATTACK", { event: GAME_EVENT_TYPE.ATTACK_DECLARED,
        subject: AUTO_TRIGGER_SUBJECT.SELF }),
    ],
  }));
  registry.register(new CardMaster({
    id: "mover", name: "mover", cardType: "CHARACTER", color: "GREEN",
    level: 0, cost: 0, basePower: 0, baseSoul: 1, traits: [], triggerIcons: [],
    abilities: [auto("HAND_TO_STAGE", { event: GAME_EVENT_TYPE.CARD_MOVED,
      subject: AUTO_TRIGGER_SUBJECT.SELF, fromZone: ZONE.HAND, toZone: ZONE.STAGE },
    [ZONE.HAND])],
  }));
  registry.register(new CardMaster({ id: "plain", name: "plain", cardType: "CHARACTER",
    color: "RED", level: 0, cost: 0, basePower: 0, baseSoul: 1,
    traits: [], triggerIcons: [], abilities: [] }));
  let serial = 0;
  const make = (masterId, owner, zone, row = null, index = null) => new Card({
    instanceId: `${owner}-${++serial}`, masterId, masterRegistry: registry,
    owner, zone, row, index,
  });
  const self = new Player({ id: "self", name: "self" });
  const opponent = new Player({ id: "opponent", name: "opponent" });
  const watcher = make("watcher", "self", ZONE.STAGE, "front", 1);
  const target = make("plain", "self", ZONE.STAGE, "front", 2);
  const mover = make("mover", "self", ZONE.HAND, null, 1);
  self.stage.push(watcher, target);
  self.hand.push(mover);
  self.deck.cards.push(make("plain", "self", ZONE.DECK, null, 1));
  opponent.deck.cards.push(make("plain", "opponent", ZONE.DECK, null, 1));
  const gameState = new GameState({ self, opponent, phase: PHASE.CLOCK,
    turnPlayer: "self", started: true });
  const engine = new GameEngine({ gameState, renderer: { render() {} } });
  return { engine, gameState, self, watcher, target, mover, make };
}

test("CARD_MOVED / SELFはmutation完了後のLKI snapshotからPRINTED Pendingを生成する", () => {
  const { engine, gameState, self, mover } = fixture();
  const result = engine.moveCard(mover, { zone: ZONE.STAGE, row: "back", index: 1 });
  const pending = result.pendingAutos.find(({ source }) => source.abilityId === "HAND_TO_STAGE");
  assert.ok(pending);
  assert.equal(pending.source.kind, ABILITY_SOURCE.PRINTED);
  assert.deepEqual(pending.trigger.payload.from, {
    ownerId: "self", zone: ZONE.HAND, row: null, index: 1,
  });
  assert.deepEqual(pending.trigger.payload.to, {
    ownerId: "self", zone: ZONE.STAGE, row: "back", index: 1,
  });
  assert.equal(self.stage.includes(mover), true);
  assert.equal(self.hand.includes(mover), false);
  assert.equal(engine.locateCard(mover.instanceId).location.zone, ZONE.STAGE);
  assert.equal(gameState.ruleState.pendingAutos.filter(
    ({ source }) => source.abilityId === "HAND_TO_STAGE").length, 1);
});

test("CARD_POSITION_CHANGED / OTHERは他の自分のCharacterのREVERSEだけを検出する", () => {
  const { engine, gameState, watcher, target } = fixture();
  engine.changeCardPosition(target, POSITION.REVERSE);
  assert.equal(gameState.ruleState.pendingAutos.some(
    ({ source }) => source.cardInstanceId === watcher.instanceId &&
      source.abilityId === "OTHER_REVERSE"), true);
  const before = gameState.ruleState.pendingAutos.length;
  assert.equal(engine.changeCardPosition(target, POSITION.REVERSE), null);
  assert.equal(gameState.ruleState.pendingAutos.length, before);
});

test("PHASE_STARTED / PHASE_ENDEDはPhase境界でPendingを生成する", () => {
  const { engine, gameState } = fixture();
  engine.enterPhase(PHASE.MAIN);
  const ids = gameState.ruleState.pendingAutos.map(({ source }) => source.abilityId);
  assert.ok(ids.includes("CLOCK_END"));
  assert.ok(ids.includes("MAIN_START"));
  assert.equal(gameState.phase, PHASE.MAIN);
});

test("ATTACK_DECLAREDはattacker自身のAUTOを検出し、異なるEventは別Pendingになる", () => {
  const { engine, gameState, watcher } = fixture();
  const first = engine.declareAttackEvent(watcher, "FRONT");
  const second = engine.declareAttackEvent(watcher, "SIDE");
  assert.notEqual(first.event.id, second.event.id);
  const pending = gameState.ruleState.pendingAutos.filter(
    ({ source }) => source.abilityId === "SELF_ATTACK");
  assert.equal(pending.length, 2);
  assert.notEqual(pending[0].id, pending[1].id);
});

test("標準アンコールはStageからWaiting RoomへのCharacter移動だけでRULE Pendingになる", () => {
  const positive = fixture();
  const result = positive.engine.moveCard(positive.target, { zone: ZONE.WAITING_ROOM });
  const encore = result.pendingAutos.find(({ source }) => source.abilityId === "STANDARD_ENCORE_3");
  assert.ok(encore);
  assert.equal(encore.source.kind, ABILITY_SOURCE.RULE);
  assert.equal(encore.trigger.payload.from.row, "front");

  for (const zone of [ZONE.HAND, ZONE.DECK, ZONE.CLOCK]) {
    const value = fixture();
    const card = value.make("plain", "self", zone, null, 1);
    const collection = zone === ZONE.DECK ? value.self.deck.cards : value.self[zone];
    collection.push(card);
    const moved = value.engine.moveCard(card, { zone: ZONE.WAITING_ROOM });
    assert.equal(moved.pendingAutos.some(
      ({ source }) => source.abilityId === "STANDARD_ENCORE_3"), false, zone);
  }
});

test("Pendingはsourceが後から移動しても残り、Event/Pending snapshotはimmutableである", () => {
  const { engine, gameState, target } = fixture();
  engine.moveCard(target, { zone: ZONE.WAITING_ROOM });
  const pending = gameState.ruleState.pendingAutos.find(
    ({ source }) => source.abilityId === "STANDARD_ENCORE_3");
  engine.moveCard(target, { zone: ZONE.HAND });
  assert.ok(gameState.ruleState.pendingAutos.includes(pending));
  assert.equal(pending.trigger.payload.to.zone, ZONE.WAITING_ROOM);
  assert.equal(Object.isFrozen(pending.trigger.payload), true);
});

test("LoaderはF-5B限定activationTrigger schemaをfail-fast検証する", () => {
  const base = { id: "loader", cardNumber: null, name: "loader", cardType: "CHARACTER",
    color: "RED", imageUrl: null, level: 0, cost: 0, basePower: 0, baseSoul: 1,
    triggerIcons: [], traits: [], abilities: [] };
  assert.doesNotThrow(() => validateCardMasterDefinitions([{ ...base, abilities: [
    auto("valid", { event: GAME_EVENT_TYPE.PHASE_STARTED, phase: PHASE.MAIN }),
  ] }]));
  assert.throws(() => validateCardMasterDefinitions([{ ...base, abilities: [
    auto("invalid", { event: "DAMAGE_DEALT" }),
  ] }]), /not supported/);
  assert.throws(() => validateCardMasterDefinitions([{ ...base, abilities: [
    auto("unknown-field", { event: GAME_EVENT_TYPE.PHASE_STARTED, phase: PHASE.MAIN, code: "x" }),
  ] }]), /unsupported field/);
});
