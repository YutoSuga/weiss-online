import test from "node:test";
import assert from "node:assert/strict";
import { getCostsDisabledReason, getPreparedCostsDisabledReason, prepareCostSelections, payCosts } from "../js/abilities/costResolver.js";
import { GameEngine } from "../js/core/gameEngine.js";
import { Card, POSITION } from "../js/models/card.js";
import { CardMaster } from "../js/models/cardMaster.js";
import { CardMasterRegistry } from "../js/models/cardMasterRegistry.js";
import { Player } from "../js/models/player.js";
import { GameState } from "../js/models/gameState.js";
import { PHASE } from "../js/constants/phase.js";
import { ZONE } from "../js/constants/zone.js";
import { PENDING_AUTO_STEP, PROCESS_TYPE } from "../js/constants/process.js";

const stock = (amount = 1) => ({ type: "PAY_STOCK", amount });
const deck = () => ({ type: "MOVE_DECK_TOP_TO_CLOCK", amount: 1 });
const rest = () => ({ type: "REST_SELF" });

function fixture(costs, { stockCount = 1, deckCount = 3, type = "AUTO" } = {}) {
  const registry = new CardMasterRegistry();
  registry.register(new CardMaster({ id: "source", name: "source", cardType: "CHARACTER", color: "GREEN",
    level: 0, cost: 0, basePower: 1000, baseSoul: 1, abilities: [{ id: "ability", type, text: "fixture",
      activationTrigger: type === "AUTO" ? { event: "ATTACK_DECLARED", subject: "SELF" } : null,
      activeZones: [ZONE.STAGE], conditions: [], costs, effects: [] }] }));
  registry.register(new CardMaster({ id: "plain", name: "plain", cardType: "CHARACTER", color: "GREEN",
    level: 0, cost: 0, basePower: 1000, baseSoul: 1 }));
  let serial = 0;
  const make = (owner, zone, masterId = "plain") => new Card({ instanceId: `cost-${++serial}`,
    masterId, masterRegistry: registry, owner, zone, row: zone === ZONE.STAGE ? "front" : null, index: 1 });
  const self = new Player({ id: "self", name: "self" });
  const opponent = new Player({ id: "opponent", name: "opponent" });
  const source = make("self", ZONE.STAGE, "source"); self.stage.push(source);
  for (let i = 0; i < stockCount; i += 1) self.stock.push(make("self", ZONE.STOCK));
  for (let i = 0; i < deckCount; i += 1) self.deck.cards.push(make("self", ZONE.DECK));
  opponent.deck.cards.push(make("opponent", ZONE.DECK));
  const state = new GameState({ self, opponent, phase: PHASE.MAIN, turnPlayer: "self", started: true });
  const renders = [];
  const engine = new GameEngine({ gameState: state, renderer: { render(...args) { renders.push(args); } } });
  const trigger = () => { engine.declareAttackEvent(source, "FRONT"); engine.resolveCheckPoint(); };
  return { self, source, state, engine, renders, trigger, make, context: { player: self, sourceCard: source } };
}

function assertRejectedWithoutMutation(f, costs, pattern) {
  const snapshot = JSON.stringify(f.state);
  assert.match(getCostsDisabledReason(costs, f.context), pattern);
  assert.deepEqual(prepareCostSelections(costs, f.context), []);
  assert.match(getPreparedCostsDisabledReason(costs, [], f.context), pattern);
  let paid = 0;
  assert.throws(() => payCosts(costs, f.context, () => { paid += 1; }), pattern);
  assert.equal(paid, 0);
  assert.equal(JSON.stringify(f.state), snapshot, "Card metadata / collections / Pendingも変更しない");
}

for (const [count, amounts, payable] of [[1, [1, 1], false], [2, [1, 1], true], [2, [1, 2], false], [3, [1, 2], true]]) {
  test(`Stock=${count}, PAY_STOCK ${amounts.join("+")}：全体判定とpaymentが一致する`, () => {
    const costs = amounts.map(stock); const f = fixture(costs, { stockCount: count });
    if (!payable) { assertRejectedWithoutMutation(f, costs, /ストック/); return; }
    const original = [...f.self.stock]; const before = JSON.stringify(f.state);
    assert.equal(getCostsDisabledReason(costs, f.context), null);
    assert.equal(getPreparedCostsDisabledReason(costs, [], f.context), null);
    assert.equal(JSON.stringify(f.state), before);
    const order = [];
    payCosts(costs, f.context, (cost, index) => order.push([index, cost.amount, f.self.stock.length]));
    assert.deepEqual(order, amounts.map((amount, index) => [index, amount, count - amounts.slice(0, index + 1).reduce((a, b) => a + b, 0)]));
    assert.equal(f.self.stock.length, 0);
    assert.deepEqual(f.self.waitingRoom, original.reverse(), "Stock TOPから記載順に同一instanceを移動");
    assert.ok(f.self.waitingRoom.every((card) => card.zone === ZONE.WAITING_ROOM));
  });
}

for (const count of [1, 2]) {
  test(`Deck=${count}, Deck top Clock×2：全体判定と順序を維持する`, () => {
    const costs = [deck(), deck()]; const f = fixture(costs, { deckCount: count });
    if (count === 1) { assertRejectedWithoutMutation(f, costs, /山札/); return; }
    const original = [...f.self.deck.cards];
    assert.equal(getCostsDisabledReason(costs, f.context), null);
    assert.equal(getPreparedCostsDisabledReason(costs, [], f.context), null);
    const order = [];
    payCosts(costs, f.context, (_cost, index) => order.push(index));
    assert.deepEqual(order, [0, 1]); assert.deepEqual(f.self.clock, original);
    assert.equal(f.self.deck.cards.length, 0);
    assert.ok(original.every((card, index) => card.zone === ZONE.CLOCK && card.index === index + 1));
  });
}

test("REST_SELF×2は仮想REST後の2件目で拒否し、sourceをSTANDのまま保つ", () => {
  const costs = [rest(), rest()]; const f = fixture(costs);
  assertRejectedWithoutMutation(f, costs, /スタンド/);
  assert.equal(f.source.position, POSITION.STAND);
});

test("異種資源を使うCostを記載順に一度ずつ払い、独立資源を干渉させない", () => {
  for (const costs of [[stock(), deck(), rest()], [rest(), deck(), stock()]]) {
    const f = fixture(costs, { deckCount: 1 });
    const paidStock = f.self.stock[0], paidDeck = f.self.deck.cards[0];
    const before = JSON.stringify(f.state);
    assert.equal(getCostsDisabledReason(costs, f.context), null);
    assert.equal(getPreparedCostsDisabledReason(costs, [], f.context), null);
    assert.equal(JSON.stringify(f.state), before);
    const order = [];
    payCosts(costs, f.context, (cost, index) => order.push([index, cost.type]));
    assert.deepEqual(order, costs.map((cost, index) => [index, cost.type]));
    assert.deepEqual(f.self.waitingRoom, [paidStock]); assert.deepEqual(f.self.clock, [paidDeck]);
    assert.equal(f.source.position, POSITION.REST);
  }
});

for (const resource of ["stock", "deck", "source"]) {
  test(`異種Costの${resource}不足でも先行Costを1件も払わない`, () => {
    const costs = [stock(), deck(), rest()];
    const f = fixture(costs, { stockCount: resource === "stock" ? 0 : 1, deckCount: resource === "deck" ? 0 : 1 });
    if (resource === "source") f.source.setPosition(POSITION.REST);
    assertRejectedWithoutMutation(f, costs, resource === "stock" ? /ストック/ : resource === "deck" ? /山札/ : /スタンド/);
  });
}

test("Prepared Costは準備後の資源減少をcurrent Stateで再評価する", () => {
  const costs = [stock(), stock()]; const f = fixture(costs, { stockCount: 2 });
  const prepared = prepareCostSelections(costs, f.context);
  assert.equal(getPreparedCostsDisabledReason(costs, prepared, f.context), null);
  f.self.stock.pop();
  assertRejectedWithoutMutation(f, costs, /ストック/);
  assert.match(getPreparedCostsDisabledReason(costs, [{ costIndex: 0 }], f.context), /選択が完了/);
});

test("後続の未知Type / 不正schemaもpayment前に拒否する", () => {
  for (const bad of [{ type: "UNKNOWN" }, stock(0), { ...deck(), amount: 2 }]) {
    const f = fixture([]); const before = JSON.stringify(f.state); let paid = 0;
    assert.throws(() => payCosts([stock(), bad], f.context, () => { paid += 1; }));
    assert.equal(paid, 0); assert.equal(JSON.stringify(f.state), before);
    assert.throws(() => getCostsDisabledReason([stock(2), bad], f.context), undefined, "先行不足で不正定義を隠さない");
  }
});

test("Pending AUTOは複合不足でも表示し、使用拒否でPending/Costを変更せず不使用にできる", () => {
  const f = fixture([stock(), stock()]); f.trigger();
  const before = JSON.stringify(f.state); const [option] = f.engine.getPendingAutoOptions();
  assert.equal(option.usable, false); assert.equal(option.reasonCategory, "COST");
  assert.match(option.disabledReason, /ストック/);
  f.engine.render(); assert.equal(f.renders.at(-1)[1].pendingAutoOptions[0].usable, false);
  assert.throws(() => f.engine.selectPendingAuto(option.pending.id), /ストック/);
  assert.equal(JSON.stringify(f.state), before);
  f.engine.declinePendingAuto(option.pending.id);
  assert.equal(f.state.ruleState.pendingAutos.length, 0);
  assert.equal(f.self.stock.length, 1); assert.equal(f.self.waitingRoom.length, 0);
});

for (const boundary of ["select", "prepared commit"]) {
  test(`Pending AUTO ${boundary}は表示後の複合資源不足を再検証してconsumeしない`, () => {
    const f = fixture([stock(), stock()], { stockCount: 2 }); f.trigger();
    const [option] = f.engine.getPendingAutoOptions(); assert.equal(option.usable, true);
    if (boundary === "prepared commit") {
      const process = f.engine.processManager.getCurrentProcess();
      process.step = PENDING_AUTO_STEP.SELECT_COST; process.context.selectedPendingAutoId = option.pending.id;
    }
    f.self.stock.pop(); const before = JSON.stringify(f.state);
    assert.throws(() => boundary === "select" ? f.engine.selectPendingAuto(option.pending.id) : f.engine.confirmPreparedCosts([]), /ストック/);
    assert.equal(JSON.stringify(f.state), before);
    assert.equal(f.state.ruleState.pendingAutos.length, 1); assert.equal(f.self.waitingRoom.length, 0);
  });
}

test("AUTOは十分な共有Stockを一度ずつ払い、全Cost後だけCheck Pointへ入る", () => {
  const f = fixture([stock(), stock()], { stockCount: 2 }); f.trigger();
  const original = [...f.self.stock]; const checkCounts = [];
  const resolve = f.engine.resolveCheckPoint.bind(f.engine);
  f.engine.resolveCheckPoint = () => { checkCounts.push(f.self.stock.length); return resolve(); };
  const process = f.engine.selectPendingAuto(f.engine.getPendingAutoOptions()[0].pending.id);
  assert.equal(process.context.costIndex, 2); assert.equal(process.context.costPaymentInProgress, false);
  assert.deepEqual(f.self.waitingRoom, original.reverse());
  assert.ok(checkCounts.length > 0); assert.ok(checkCounts.every((count) => count === 0));
  assert.equal(f.state.ruleState.pendingAutos.length, 0);
});

test("ACTも共通全体判定で不足時に拒否し、十分なら支払い後MAINへ戻る", () => {
  for (const count of [1, 2]) {
    const f = fixture([stock(), stock()], { stockCount: count, type: "ACT" }); f.engine.startMainPhase();
    const ability = f.source.abilities[0]; const before = JSON.stringify(f.state);
    if (count === 1) {
      assert.match(f.engine.getActAbilityDisabledReason(f.source, ability, "self"), /ストック/);
      assert.throws(() => f.engine.useActAbility(f.source, ability, "self"), /ストック/);
      assert.equal(JSON.stringify(f.state), before);
    } else {
      assert.equal(f.engine.canUseActAbility(f.source, ability, "self"), true);
      const process = f.engine.useActAbility(f.source, ability, "self");
      assert.equal(process.context.costIndex, 2); assert.equal(f.self.stock.length, 0);
      assert.equal(f.self.waitingRoom.length, 2);
      assert.equal(f.engine.processManager.getCurrentProcess().type, PROCESS_TYPE.MAIN_PHASE);
    }
  }
});
