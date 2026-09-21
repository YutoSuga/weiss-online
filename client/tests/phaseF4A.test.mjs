import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { ABILITY_TYPE, COST_TYPE, EFFECT_TYPE } from "../js/constants/ability.js";
import { ACT_ABILITY_STEP, MAIN_STEP, PROCESS_STATUS, PROCESS_TYPE } from "../js/constants/process.js";
import { PHASE } from "../js/constants/phase.js";
import { ZONE } from "../js/constants/zone.js";
import { payCosts } from "../js/abilities/costResolver.js";
import { GameEngine } from "../js/core/gameEngine.js";
import { Card } from "../js/models/card.js";
import { CardMaster } from "../js/models/cardMaster.js";
import { CardMasterRegistry } from "../js/models/cardMasterRegistry.js";
import { GameState } from "../js/models/gameState.js";
import { Player } from "../js/models/player.js";
import { validateCardMasterDefinitions } from "../js/data/cardMasterLoader.js";

const abilities = [
  { id: "AUTO", type: ABILITY_TYPE.AUTO, conditions: [], costs: [], effects: [], text: "auto" },
  { id: "CONT", type: ABILITY_TYPE.CONTINUOUS, conditions: [], costs: [], effects: [], text: "continuous" },
  { id: "STOCK", type: ABILITY_TYPE.ACT, conditions: [], costs: [{ type: COST_TYPE.PAY_STOCK, amount: 2 }], effects: [{ type: EFFECT_TYPE.TEST_LOG, message: "stock effect" }], text: "stock" },
  { id: "REST", type: ABILITY_TYPE.ACT, conditions: [], costs: [{ type: COST_TYPE.REST_SELF }], effects: [{ type: EFFECT_TYPE.TEST_LOG, message: "rest effect" }], text: "rest" },
  { id: "BOTH", type: ABILITY_TYPE.ACT, conditions: [], costs: [{ type: COST_TYPE.PAY_STOCK, amount: 1 }, { type: COST_TYPE.REST_SELF }], effects: [{ type: EFFECT_TYPE.TEST_LOG, message: "both effect" }], text: "both" },
];

function fixture(stockCount = 3) {
  const registry = new CardMasterRegistry();
  registry.register(new CardMaster({ id: "source", cardNumber: null, name: "ACT test", cardType: "CHARACTER", color: "YELLOW", imageUrl: null, level: 0, cost: 0, basePower: 1000, baseSoul: 1, triggerIcons: [], traits: [], abilities }));
  registry.register(new CardMaster({ id: "dummy", cardNumber: null, name: "dummy", cardType: "CHARACTER", color: "YELLOW", imageUrl: null, level: 0, cost: 0, basePower: 0, baseSoul: 0, triggerIcons: [], traits: [], abilities: [] }));
  let serial = 0;
  const make = (masterId, owner, zone) => new Card({ instanceId: `${owner}-${++serial}`, masterId, masterRegistry: registry, owner, zone });
  const self = new Player({ id: "self", name: "self" });
  const opponent = new Player({ id: "opponent", name: "opponent" });
  const source = make("source", "self", ZONE.STAGE);
  source.moveTo({ zone: ZONE.STAGE, row: "front", index: 1 });
  self.stage.push(source);
  for (let i = 0; i < stockCount; i += 1) self.stock.push(make("dummy", "self", ZONE.STOCK));
  // Rule Checkの敗北条件を発生させない。
  self.deck.cards.push(make("dummy", "self", ZONE.DECK));
  opponent.deck.cards.push(make("dummy", "opponent", ZONE.DECK));
  const gameState = new GameState({ self, opponent, phase: PHASE.MAIN, turnPlayer: "self", started: true });
  const engine = new GameEngine({ gameState, renderer: { render() {} } });
  engine.startMainPhase();
  return { engine, gameState, source, self, opponent, ability: (id) => source.abilities.find((item) => item.id === id) };
}

test("ACT detectionはAUTO/CONTINUOUSを除外し複数ACTを返す", () => {
  const { engine, source } = fixture();
  assert.deepEqual(engine.getActAbilities(source).map(({ id }) => id), ["STOCK", "REST", "BOTH"]);
});

test("ACT timingは自分のMAIN WAITING_INPUTかつ自分のStageだけを許可する", () => {
  const { engine, gameState, source, ability } = fixture();
  assert.equal(engine.canUseActAbility(source, ability("REST"), "self"), true);
  gameState.turn.player = "opponent";
  assert.match(engine.getActAbilityDisabledReason(source, ability("REST"), "self"), /自分のターン/);
  gameState.turn.player = "self";
  gameState.phase = PHASE.CLOCK;
  assert.match(engine.getActAbilityDisabledReason(source, ability("REST"), "self"), /メインフェイズ/);
  gameState.phase = PHASE.MAIN;
  gameState.ruleState.processStack.at(-1).status = PROCESS_STATUS.RUNNING;
  assert.match(engine.getActAbilityDisabledReason(source, ability("REST"), "self"), /操作待ち/);
  gameState.ruleState.processStack.at(-1).status = PROCESS_STATUS.WAITING_INPUT;
  source.moveTo({ zone: ZONE.HAND });
  assert.match(engine.getActAbilityDisabledReason(source, ability("REST"), "self"), /舞台/);
});

test("PAY_STOCK amount=2はStock TOPからWaiting Room TOPへ順番に支払う", () => {
  const { engine, source, self, ability } = fixture();
  const original = [...self.stock];
  engine.useActAbility(source, ability("STOCK"), "self");
  assert.deepEqual(self.stock, [original[0]]);
  assert.deepEqual(self.waitingRoom, [original[2], original[1]]);
  assert.equal(self.waitingRoom.at(-1).zone, ZONE.WAITING_ROOM);
  assert.ok(engine.gameState.log.some(({ message }) => message === "stock effect"));
  const main = engine.processManager.getCurrentProcess();
  assert.equal(main.type, PROCESS_TYPE.MAIN_PHASE);
  assert.equal(main.step, MAIN_STEP.WAITING_INPUT);
  assert.equal(main.status, PROCESS_STATUS.WAITING_INPUT);
});

test("REST_SELFはSTAND時だけ支払い、他Cardを変更しない", () => {
  const { engine, source, self, ability } = fixture();
  const other = self.stock[0];
  engine.useActAbility(source, ability("REST"), "self");
  assert.equal(source.position, "rest");
  assert.equal(other.position, "stand");
  assert.match(engine.getActAbilityDisabledReason(source, ability("REST"), "self"), /スタンド/);
});

test("複数Costは全件事前検証し、支払不能なら部分mutationしない", () => {
  const noStock = fixture(0);
  assert.equal(noStock.engine.canUseActAbility(noStock.source, noStock.ability("BOTH"), "self"), false);
  assert.throws(() => noStock.engine.useActAbility(noStock.source, noStock.ability("BOTH"), "self"), /ストック/);
  assert.equal(noStock.source.position, "stand");
  assert.equal(noStock.self.waitingRoom.length, 0);

  const rested = fixture(1);
  rested.source.setPosition("rest");
  const stock = [...rested.self.stock];
  assert.throws(() => rested.engine.useActAbility(rested.source, rested.ability("BOTH"), "self"), /スタンド/);
  assert.deepEqual(rested.self.stock, stock);
  assert.equal(rested.self.waitingRoom.length, 0);
});

test("複数Costを記載順に払いCost間ではRule Checkしない", () => {
  const { engine, source, self, ability } = fixture(1);
  const order = [];
  payCosts(ability("BOTH").costs, { player: self, sourceCard: source }, (cost) => order.push(cost.type));
  assert.deepEqual(order, [COST_TYPE.PAY_STOCK, COST_TYPE.REST_SELF]);

  const second = fixture(1);
  let checks = 0;
  const originalCheck = second.engine.resolveRuleCheck.bind(second.engine);
  second.engine.resolveRuleCheck = () => { checks += 1; return originalCheck(); };
  const steps = [];
  const originalUpdate = second.engine.processManager.updateStep.bind(second.engine.processManager);
  second.engine.processManager.updateStep = (step) => { steps.push(step); return originalUpdate(step); };
  const process = second.engine.useActAbility(second.source, second.ability("BOTH"), "self");
  assert.equal(process.context.costIndex, 2);
  assert.equal(process.context.effectIndex, 1);
  assert.ok(steps.includes(ACT_ABILITY_STEP.VALIDATE) === false);
  assert.deepEqual(steps.filter((step) => step === ACT_ABILITY_STEP.CHECK_POINT_AFTER_COST), [ACT_ABILITY_STEP.CHECK_POINT_AFTER_COST]);
  // Cost完了後、Effect 1件後、Process完了出口の3境界。Cost間には呼ばれない。
  assert.equal(checks, 3);
});

test("未知Cost/Effectと不正PAY_STOCKはLoader境界でfail-fastする", () => {
  const definition = { id: "bad", cardNumber: null, name: "bad", cardType: "CHARACTER", color: "RED", imageUrl: null, level: 0, cost: 0, basePower: 0, baseSoul: 0, triggerIcons: [], traits: [], abilities: [] };
  const ability = { id: "bad", type: ABILITY_TYPE.ACT, conditions: [], costs: [], effects: [], text: "bad" };
  assert.throws(() => validateCardMasterDefinitions([{ ...definition, abilities: [{ ...ability, costs: [{ type: "UNKNOWN_COST" }] }] }]), /Unsupported Ability Cost/);
  assert.throws(() => validateCardMasterDefinitions([{ ...definition, abilities: [{ ...ability, effects: [{ type: "UNKNOWN_EFFECT" }] }] }]), /Unsupported Ability Effect/);
  assert.throws(() => payCosts([{ type: COST_TYPE.PAY_STOCK, amount: 0 }], { player: {}, sourceCard: {} }), /positive integer/);
});

test("右上詳細はACTごとの使用ボタン・disabled理由を描画しControllerがEngineへ委譲する", async () => {
  const renderer = await readFile(new URL("../js/core/renderer.js", import.meta.url), "utf8");
  const controller = await readFile(new URL("../js/ui/mainPhaseController.js", import.meta.url), "utf8");
  assert.match(renderer, /dataset\.action = "use-act-ability"/);
  assert.match(renderer, /button\.disabled = actState\.disabledReason !== null/);
  assert.match(renderer, /`理由：\$\{actState\.disabledReason\}`/);
  assert.match(controller, /getActAbilities\(this\.selectedCard/);
  assert.match(controller, /useActAbility\(this\.selectedCard, ability, "self"\)/);
  assert.doesNotMatch(controller, /stock\.pop\(|setPosition\(POSITION\.REST/);
});
