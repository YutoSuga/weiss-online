import test from "node:test";
import assert from "node:assert/strict";
import { GameEngine } from "../js/core/gameEngine.js";
import { Card } from "../js/models/card.js";
import { CardMaster } from "../js/models/cardMaster.js";
import { CardMasterRegistry } from "../js/models/cardMasterRegistry.js";
import { GameState } from "../js/models/gameState.js";
import { Player } from "../js/models/player.js";
import { POSITION } from "../js/models/card.js";
import { ZONE } from "../js/constants/zone.js";
import { PROCESS_TYPE } from "../js/constants/process.js";

function fixture(stockCount = 3) {
  const registry = new CardMasterRegistry();
  for (const [id, cardType] of [["character", "CHARACTER"], ["event", "EVENT"]]) {
    registry.register(new CardMaster({ id, name: id, cardType, color: "RED", level: 0, cost: 0,
      basePower: cardType === "CHARACTER" ? 1000 : null, baseSoul: cardType === "CHARACTER" ? 1 : null,
      traits: [], triggerIcons: [], abilities: [] }));
  }
  let sequence = 0;
  const make = (owner = "self", zone = ZONE.WAITING_ROOM, masterId = "character", row = null, index = 1) =>
    new Card({ instanceId: `card-${++sequence}`, masterId, masterRegistry: registry, owner, zone, row, index });
  const self = new Player({ id: "self", name: "self" });
  const opponent = new Player({ id: "opponent", name: "opponent" });
  const a = make("self", ZONE.STAGE, "character", "back", 2);
  self.stage.push(a);
  for (let i = 0; i < stockCount; i += 1) self.stock.push(make("self", ZONE.STOCK));
  self.deck.cards.push(make("self", ZONE.DECK)); opponent.deck.cards.push(make("opponent", ZONE.DECK));
  const gameState = new GameState({ self, opponent, turnPlayer: "self", started: true });
  const engine = new GameEngine({ gameState, renderer: { render() {} } });
  return { engine, gameState, self, opponent, a, make };
}

const encore = (state, card) => state.ruleState.pendingAutos.find(
  (pending) => pending.source.abilityId === "STANDARD_ENCORE_3" && pending.source.cardInstanceId === card.instanceId,
);

test("RULE EncoreはCharacterだけを誘発し元Stage slotを独立snapshotする", () => {
  const f = fixture();
  f.engine.moveCard(f.a, { zone: ZONE.WAITING_ROOM });
  const pending = encore(f.gameState, f.a);
  assert.deepEqual(pending.triggerContext.originalStagePosition, { row: "back", index: 2 });
  const event = f.make("self", ZONE.STAGE, "event", "front", 1); f.self.stage.push(event);
  assert.equal(f.engine.moveCard(event, { zone: ZONE.WAITING_ROOM }).pendingAutos.length, 0);
});

test("Encore使用可否は現在のStockと対象所在から再評価し、使用不能Pendingを閉じられる", () => {
  const f = fixture(2);
  f.engine.moveCard(f.a, { zone: ZONE.WAITING_ROOM });
  f.engine.resolveCheckPoint();
  assert.match(f.engine.getPendingAutoOptions()[0].disabledReason, /ストック/);
  assert.throws(() => f.engine.selectPendingAuto(encore(f.gameState, f.a).id), /ストック/);
  assert.doesNotThrow(() => f.engine.closeUnavailablePendingAutos());
  assert.equal(f.gameState.ruleState.pendingAutos.length, 0);

  const moved = fixture(3);
  moved.engine.moveCard(moved.a, { zone: ZONE.WAITING_ROOM });
  moved.engine.moveCard(moved.a, { zone: ZONE.HAND });
  moved.engine.resolveCheckPoint();
  assert.match(moved.engine.getPendingAutoOptions()[0].disabledReason, /控室/);
});

test("Encoreは3 Stockを払い、空の元slotへRESTで戻してCARD_MOVEDを発行する", () => {
  const f = fixture();
  f.engine.moveCard(f.a, { zone: ZONE.WAITING_ROOM });
  const id = encore(f.gameState, f.a).id;
  f.engine.resolveCheckPoint();
  f.engine.selectPendingAuto(id);
  assert.equal(f.self.stock.length, 0);
  assert.equal(f.a.zone, ZONE.STAGE);
  assert.deepEqual({ row: f.a.row, index: f.a.index, position: f.a.position }, { row: "back", index: 2, position: POSITION.REST });
  assert.ok(f.gameState.ruleState.pendingAutos.every((pending) => pending.source.cardInstanceId !== f.a.instanceId));
});

test("圧殺はBのCARD_MOVEDとEncore Pendingを先に作り、A配置後・A AUTO完了後に提示する", () => {
  const f = fixture(6);
  f.engine.moveCard(f.a, { zone: ZONE.WAITING_ROOM });
  const aPending = encore(f.gameState, f.a);
  const b = f.make("self", ZONE.STAGE, "character", "back", 2); f.self.stage.push(b);
  f.engine.resolveCheckPoint();
  f.engine.selectPendingAuto(aPending.id);
  const bPending = encore(f.gameState, b);
  assert.ok(bPending);
  assert.equal(bPending.trigger.payload.from.zone, ZONE.STAGE);
  assert.equal(b.zone, ZONE.WAITING_ROOM);
  assert.equal(f.a.zone, ZONE.STAGE);
  assert.equal(f.a.position, POSITION.REST);
  assert.equal(f.engine.processManager.getCurrentProcess().type, PROCESS_TYPE.PENDING_AUTO);
  assert.equal(f.engine.getPendingAutoOptions()[0].pending.id, bPending.id);

  f.engine.selectPendingAuto(bPending.id);
  assert.equal(b.zone, ZONE.STAGE);
  assert.equal(b.position, POSITION.REST);
  assert.equal(f.a.zone, ZONE.WAITING_ROOM);
  assert.ok(encore(f.gameState, f.a), "同一instanceの再誘発を抑止しない");
});

test("Pending UIは使用不能理由・disabled使用ボタン・全件不能時の閉じる操作を備える", async () => {
  const { readFile } = await import("node:fs/promises");
  const renderer = await readFile(new URL("../js/core/renderer.js", import.meta.url), "utf8");
  const controller = await readFile(new URL("../js/ui/pendingAutoController.js", import.meta.url), "utf8");
  assert.match(renderer, /disabled-reason/);
  assert.match(renderer, /disabledReason \? " disabled"/);
  assert.match(renderer, /close-unavailable-pending-autos/);
  assert.match(controller, /closeUnavailablePendingAutos/);
});
