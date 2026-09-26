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
import { MAIN_STEP, PROCESS_STATUS, PROCESS_TYPE } from "../js/constants/process.js";
import { PHASE } from "../js/constants/phase.js";

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

test("Encore使用可否は現在のStockと対象所在から再評価し、使用不能でも1件ずつ使用しないを選べる", () => {
  const f = fixture(2);
  f.engine.moveCard(f.a, { zone: ZONE.WAITING_ROOM });
  f.engine.resolveCheckPoint();
  assert.match(f.engine.getPendingAutoOptions()[0].disabledReason, /ストック/);
  assert.throws(() => f.engine.selectPendingAuto(encore(f.gameState, f.a).id), /ストック/);
  assert.doesNotThrow(() => f.engine.declinePendingAuto(encore(f.gameState, f.a).id));
  assert.equal(f.gameState.ruleState.pendingAutos.length, 0);

  const moved = fixture(3);
  moved.engine.moveCard(moved.a, { zone: ZONE.WAITING_ROOM });
  moved.engine.moveCard(moved.a, { zone: ZONE.HAND });
  moved.engine.resolveCheckPoint();
  assert.match(moved.engine.getPendingAutoOptions()[0].disabledReason, /控室/);
});

test("使用しないはCost/Effectを実行せず対象Pendingだけを除き、残Pendingを再提示する", () => {
  const f = fixture(6);
  const b = f.make("self", ZONE.STAGE, "character", "front", 1);
  f.self.stage.push(b);
  f.engine.moveCard(f.a, { zone: ZONE.WAITING_ROOM });
  f.engine.moveCard(b, { zone: ZONE.WAITING_ROOM });
  const aPending = encore(f.gameState, f.a);
  const bPending = encore(f.gameState, b);
  f.engine.resolveCheckPoint();

  f.engine.declinePendingAuto(aPending.id);

  assert.equal(f.self.stock.length, 6, "Costを支払わない");
  assert.equal(f.a.zone, ZONE.WAITING_ROOM, "Effectを実行しない");
  assert.equal(encore(f.gameState, f.a), undefined, "対象Pendingだけを取り除く");
  assert.equal(encore(f.gameState, b)?.id, bPending.id, "他Pendingは残す");
  assert.equal(f.engine.processManager.getCurrentProcess().type, PROCESS_TYPE.PENDING_AUTO);
});

test("AUTOの使用・不使用完了後はCheck Timingを終え、中断していたMAIN入力へ共通復帰する", () => {
  for (const action of ["use", "decline"]) {
    const f = fixture(3);
    f.gameState.phase = PHASE.MAIN;
    f.engine.processManager.pushProcess({
      type: PROCESS_TYPE.MAIN_PHASE,
      playerId: "self",
      step: MAIN_STEP.WAITING_INPUT,
      status: PROCESS_STATUS.WAITING_INPUT,
      context: {},
    });
    const selectableHandCard = f.make("self", ZONE.HAND);
    f.self.hand.push(selectableHandCard);
    f.engine.moveCard(f.a, { zone: ZONE.WAITING_ROOM });
    const id = encore(f.gameState, f.a).id;
    f.engine.resolveCheckPoint();

    if (action === "use") f.engine.selectPendingAuto(id);
    else f.engine.declinePendingAuto(id);

    assert.equal(f.gameState.ruleState.pendingAutos.length, 0);
    assert.deepEqual(f.gameState.ruleState.processStack.map(({ type }) => type), [PROCESS_TYPE.MAIN_PHASE]);
    assert.equal(f.engine.canSelectCardForMain(selectableHandCard, "self"), true);
  }
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

test("Pending UIは新文言、項目ごとの使用しない、使用不能理由とdisabled使用を備え、閉じるを持たない", async () => {
  const { readFile } = await import("node:fs/promises");
  const renderer = await readFile(new URL("../js/core/renderer.js", import.meta.url), "utf8");
  const controller = await readFile(new URL("../js/ui/pendingAutoController.js", import.meta.url), "utf8");
  assert.match(renderer, /disabled-reason/);
  assert.match(renderer, /disabledReason \? " disabled"/);
  assert.match(renderer, /自動効果発動/);
  assert.match(renderer, /発動する自動効果を選択してください/);
  assert.match(renderer, /decline-pending-auto/);
  assert.match(renderer, /使用しない/);
  assert.doesNotMatch(renderer, /close-unavailable-pending-autos/);
  assert.match(controller, /declinePendingAuto/);
});

test("圧殺確認UIは置き換える（圧殺）と表示する", async () => {
  const { readFile } = await import("node:fs/promises");
  const controller = await readFile(new URL("../js/ui/mainPhaseController.js", import.meta.url), "utf8");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(controller, /置き換える（圧殺）/);
  assert.match(html, /置き換える（圧殺）/);
});
