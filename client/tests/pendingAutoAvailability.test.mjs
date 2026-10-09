import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { GameEngine } from "../js/core/gameEngine.js";
import { Renderer } from "../js/core/renderer.js";
import { Card } from "../js/models/card.js";
import { CardMaster } from "../js/models/cardMaster.js";
import { CardMasterRegistry } from "../js/models/cardMasterRegistry.js";
import { Player } from "../js/models/player.js";
import { GameState } from "../js/models/gameState.js";
import { createCardMasterRegistry } from "../js/data/cardMasterLoader.js";
import { ZONE } from "../js/constants/zone.js";
import { AUTO_ABILITY_STEP, PENDING_AUTO_STEP, PROCESS_STATUS, PROCESS_TYPE } from "../js/constants/process.js";

const auto = (costs = [], effects = [], conditions = []) => ({
  id: "AUTO", type: "AUTO", text: "テストAUTO", conditions, costs, effects,
  activationTrigger: { event: "ATTACK_DECLARED", subject: "SELF" }, activeZones: [ZONE.STAGE],
});

function fixture(ability = auto(), stockCount = 1) {
  const registry = new CardMasterRegistry();
  for (const [id, abilities] of [["source", [ability]], ["plain", []]]) {
    registry.register(new CardMaster({ id, name: id, cardType: "CHARACTER", color: "GREEN",
      level: 0, cost: 0, basePower: 1000, baseSoul: 1, abilities }));
  }
  let sequence = 0;
  const make = (owner, zone, masterId = "plain") => new Card({
    instanceId: `availability-${++sequence}`, masterId, masterRegistry: registry, owner, zone,
    row: zone === ZONE.STAGE ? "back" : null, index: zone === ZONE.STAGE ? 2 : 1,
  });
  const self = new Player({ id: "self", name: "self" });
  const opponent = new Player({ id: "opponent", name: "opponent" });
  const source = make("self", ZONE.STAGE, "source"); self.stage.push(source);
  for (const player of [self, opponent]) player.deck.cards.push(make(player.id, ZONE.DECK));
  for (let i = 0; i < stockCount; i += 1) self.stock.push(make("self", ZONE.STOCK));
  const state = new GameState({ self, opponent, started: true });
  const renders = [];
  const engine = new GameEngine({ gameState: state, renderer: { render(...args) { renders.push(args); } } });
  const trigger = () => { engine.declareAttackEvent(source, "FRONT"); engine.resolveCheckPoint(); };
  return { state, self, opponent, source, engine, make, renders, trigger };
}

test("Engineの描画は単一Queryのusableと理由を渡し、使用不可Pendingも残す", () => {
  const f = fixture(auto([{ type: "PAY_STOCK", amount: 1 }]), 0); f.trigger();
  const before = JSON.stringify(f.state);
  const [option] = f.engine.getPendingAutoOptions();
  assert.equal(option.usable, false); assert.match(option.disabledReason, /ストック/);
  assert.equal(JSON.stringify(f.state), before, "QueryはStateを変更しない");
  assert.equal(f.state.ruleState.pendingAutos.length, 1);
  f.engine.render();
  assert.deepEqual(f.renders.at(-1)[1].pendingAutoOptions, [option]);
  f.self.stock.push(f.make("self", ZONE.STOCK)); f.engine.render();
  assert.equal(f.renders.at(-1)[1].pendingAutoOptions[0].usable, true);
  assert.equal(option.usable, false, "前の表示snapshotを書き換えない");
  assert.equal(f.engine.getPendingAutoOptions()[0].disabledReason, null);
});

test("PRINTED Effect対象不足でも誘発し、現在Stateで使用可否が変わり不使用にできる", () => {
  const f = fixture(auto([], [{ id: "replace", type: "REPLACE_OPPONENT_STOCK_TOP" }])); f.trigger();
  const [option] = f.engine.getPendingAutoOptions();
  assert.equal(option.usable, false); assert.match(option.disabledReason, /相手のストック/);
  f.opponent.stock.push(f.make("opponent", ZONE.STOCK));
  assert.equal(f.engine.getPendingAutoOptions()[0].usable, true);
  f.opponent.stock.length = 0;
  assert.throws(() => f.engine.selectPendingAuto(option.pending.id), /相手のストック/);
  f.engine.declinePendingAuto(option.pending.id);
  assert.equal(f.state.ruleState.pendingAutos.length, 0);
});

test("Encoreはcollection所在とmaster playerを正としCard.zoneに依存しない", () => {
  const f = fixture(auto(), 3);
  f.engine.moveCard(f.source, { zone: ZONE.WAITING_ROOM }); f.engine.resolveCheckPoint();
  const [option] = f.engine.getPendingAutoOptions();
  f.source.zone = ZONE.HAND; // metadataだけずれた際にも所在の正本はcollection
  assert.equal(f.engine.getPendingAutoOptions()[0].usable, true);
  f.source.zone = ZONE.WAITING_ROOM;
  f.self.waitingRoom.splice(f.self.waitingRoom.indexOf(f.source), 1);
  f.opponent.waitingRoom.push(f.source);
  assert.equal(f.engine.getPendingAutoOptions()[0].usable, false);
  assert.match(f.engine.getPendingAutoOptions()[0].disabledReason, /控室/);
  assert.throws(() => f.engine.selectPendingAuto(option.pending.id), /控室/);
  f.engine.declinePendingAuto(option.pending.id);
  assert.equal(f.state.ruleState.pendingAutos.length, 0);
});

test("表示後のCost不足をselectで再検証し、古いusableでcommitしない", () => {
  const f = fixture(auto([{ type: "PAY_STOCK", amount: 1 }])); f.trigger();
  const [shown] = f.engine.getPendingAutoOptions(); assert.equal(shown.usable, true);
  const stock = f.self.stock.pop(); f.self.waitingRoom.push(stock);
  assert.throws(() => f.engine.selectPendingAuto(shown.pending.id), /ストック/);
  assert.equal(f.state.ruleState.pendingAutos.length, 1);
  assert.equal(f.engine.processManager.getCurrentProcess().type, PROCESS_TYPE.PENDING_AUTO);
});

test("Prepared Cost確定でもEffectとEncore所在を再検証しPendingをconsumeしない", () => {
  for (const kind of ["effect", "encore"]) {
    const f = fixture(kind === "effect" ? auto([], [{ id: "replace", type: "REPLACE_OPPONENT_STOCK_TOP" }]) : auto(), 3);
    if (kind === "effect") {
      f.opponent.stock.push(f.make("opponent", ZONE.STOCK)); f.trigger();
    } else {
      f.engine.moveCard(f.source, { zone: ZONE.WAITING_ROOM }); f.engine.resolveCheckPoint();
    }
    const [shown] = f.engine.getPendingAutoOptions(); assert.equal(shown.usable, true);
    // 現行handlerは選択不要。既存のSELECT_COST入力境界を直接用意してcommitを検証する。
    const process = f.engine.processManager.getCurrentProcess();
    process.step = PENDING_AUTO_STEP.SELECT_COST; process.context.selectedPendingAutoId = shown.pending.id;
    if (kind === "effect") f.opponent.stock.length = 0;
    else f.engine.moveCard(f.source, { zone: ZONE.HAND });
    const stockCount = f.self.stock.length;
    assert.throws(() => f.engine.confirmPreparedCosts([]), kind === "effect" ? /相手のストック/ : /控室/);
    assert.equal(f.state.ruleState.pendingAutos.length, 1); assert.equal(f.self.stock.length, stockCount);
    assert.equal(f.engine.processManager.getCurrentProcess(), process);
  }
});

test("支払い直前に全Costを再検証し、後続Cost不可でも部分支払いしない", () => {
  const f = fixture(auto([{ type: "PAY_STOCK", amount: 1 }, { type: "MOVE_DECK_TOP_TO_CLOCK", amount: 1 }])); f.trigger();
  const [option] = f.engine.getPendingAutoOptions(); assert.equal(option.usable, true);
  f.engine.processManager.popProcess();
  f.engine.processManager.pushProcess({ type: PROCESS_TYPE.AUTO_ABILITY, playerId: "self",
    step: AUTO_ABILITY_STEP.PAY_COST, status: PROCESS_STATUS.RUNNING,
    context: { pendingAuto: option.pending, preparedCosts: [], payCost: true, costIndex: 0 } });
  f.self.deck.cards.length = 0;
  assert.throws(() => f.engine.executeAutoAbilityProcess(), /山札/);
  assert.equal(f.self.stock.length, 1); assert.equal(f.self.clock.length, 0);
  assert.equal(f.engine.processManager.getCurrentProcess().context.costIndex, 0);
});

test("Loaderを通さない未対応AUTO ConditionもQuery/selectで使用不可になる", () => {
  const f = fixture(auto([], [], [{ type: "UNSUPPORTED" }])); f.trigger();
  const [option] = f.engine.getPendingAutoOptions();
  assert.equal(option.usable, false); assert.match(option.disabledReason, /使用条件の定義が不正/);
  assert.throws(() => f.engine.selectPendingAuto(option.pending.id), /使用条件の定義が不正/);
  f.engine.declinePendingAuto(option.pending.id);
  assert.equal(f.state.ruleState.pendingAutos.length, 0);
});

test("AUTO Loaderは未対応・不正Conditionをtrigger有無によらず拒否し正式データを読み込む", async () => {
  const definitions = JSON.parse(await readFile(new URL("../data/card-masters.json", import.meta.url), "utf8"));
  assert.doesNotThrow(() => createCardMasterRegistry(definitions));
  const source = definitions.find(({ cardNumber }) => cardNumber === "CHA/W40-026SP");
  for (const trigger of [source.abilities[0].activationTrigger, null]) {
    for (const conditions of [[{ type: "UNSUPPORTED" }], [{ type: "SELF_IS_FRONT" }], null, {}]) {
      const definition = structuredClone(source); definition.abilities = [definition.abilities[0]];
      Object.assign(definition.abilities[0], { activationTrigger: trigger, conditions });
      assert.throws(() => createCardMasterRegistry([definition]), /invalid AUTO conditions/);
    }
    for (const omitted of [false, true]) {
      const definition = structuredClone(source); definition.abilities = [definition.abilities[0]];
      definition.abilities[0].activationTrigger = trigger;
      if (omitted) delete definition.abilities[0].conditions;
      assert.doesNotThrow(() => createCardMasterRegistry([definition]));
    }
  }
});

test("Rendererは評価済みusable/理由だけを描画し、Zoneや能力ルールを読まない", () => {
  const original = { HTMLElement: globalThis.HTMLElement, document: globalThis.document };
  class Element {
    constructor() { this.children = []; this.nodes = new Map(); }
    querySelector(key) { if (!this.nodes.has(key)) this.nodes.set(key, new Element()); return this.nodes.get(key); }
    replaceChildren() { this.children = []; }
    append(child) { this.children.push(child); }
  }
  try {
    globalThis.HTMLElement = Element; globalThis.document = { createElement: () => new Element() };
    const dialog = new Element(); const renderer = new Renderer({ querySelector: () => dialog });
    renderer.renderImageWithFallback = () => {};
    const state = { ruleState: { processStack: [{ type: PROCESS_TYPE.PENDING_AUTO, step: PENDING_AUTO_STEP.SELECT_AUTO }] },
      get players() { throw new Error("Renderer must not inspect collections"); } };
    const option = { pending: { id: "domain-1", source: { kind: "RULE", cardMasterId: "missing", abilityId: "unknown" } },
      card: null, ability: { text: "Domainで解決した本文", costs: [{ type: "NOT_AN_EXECUTABLE_COST" }] }, usable: false, disabledReason: "Domainからの理由" };
    renderer.renderPendingAutoSelection(state, [option]);
    let html = dialog.querySelector("[data-pending-auto-list]").children[0].innerHTML;
    assert.match(html, /Domainで解決した本文/); assert.match(html, /Domainからの理由/);
    assert.match(html, /data-action="resolve-pending-auto"[^>]* disabled/);
    assert.doesNotMatch(html, /data-action="decline-pending-auto"[^>]* disabled/);
    renderer.renderPendingAutoSelection(state, [{ ...option, usable: true, disabledReason: null }]);
    html = dialog.querySelector("[data-pending-auto-list]").children[0].innerHTML;
    assert.doesNotMatch(html, /data-action="resolve-pending-auto"[^>]* disabled/);
    assert.doesNotMatch(html, /disabled-reason/);
  } finally { Object.assign(globalThis, original); }
});
