import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CONDITION_TYPE, AVAILABILITY_REASON_CATEGORY } from "../js/constants/ability.js";
import { ZONE } from "../js/constants/zone.js";
import { PHASE } from "../js/constants/phase.js";
import { AUTO_ABILITY_STEP, PENDING_AUTO_STEP, PROCESS_STATUS, PROCESS_TYPE } from "../js/constants/process.js";
import { getConditionsDisabledReason, validateConditions } from "../js/abilities/conditionResolver.js";
import { Card } from "../js/models/card.js";
import { CardMaster } from "../js/models/cardMaster.js";
import { CardMasterRegistry } from "../js/models/cardMasterRegistry.js";
import { Player } from "../js/models/player.js";
import { GameState } from "../js/models/gameState.js";
import { GameEngine } from "../js/core/gameEngine.js";
import { createCardMasterRegistry } from "../js/data/cardMasterLoader.js";

const frontCondition = { type: CONDITION_TYPE.SOURCE_IS_FRONT_ROW };
function fixture({ row = "front", conditions = [frontCondition], costs = [], effects = [] } = {}) {
  const registry = new CardMasterRegistry();
  registry.register(new CardMaster({ id: "condition-source", name: "Condition fixture", cardType: "CHARACTER",
    color: "GREEN", level: 0, cost: 0, basePower: 1000, baseSoul: 1,
    abilities: [{ id: "front-auto", type: "AUTO", text: "このカードが前列にいるなら", conditions, costs, effects,
      activationTrigger: { event: "ATTACK_DECLARED", subject: "SELF" }, activeZones: [ZONE.STAGE] }] }));
  registry.register(new CardMaster({ id: "plain", name: "plain", cardType: "CHARACTER", color: "GREEN",
    level: 0, cost: 0, basePower: 1000, baseSoul: 1 }));
  let sequence = 0;
  const make = (owner, zone, masterId = "plain", slot = {}) => new Card({ instanceId: `condition-${++sequence}`,
    masterId, masterRegistry: registry, owner, zone, row: null, index: 1, ...slot });
  const self = new Player({ id: "self", name: "self" });
  const opponent = new Player({ id: "opponent", name: "opponent" });
  const source = make("self", ZONE.STAGE, "condition-source", { row, index: 2 }); self.stage.push(source);
  for (const player of [self, opponent]) player.deck.cards.push(make(player.id, ZONE.DECK));
  const state = new GameState({ self, opponent, started: true, phase: PHASE.MAIN });
  const renders = [];
  const engine = new GameEngine({ gameState: state, renderer: { render(...args) { renders.push(args); } } });
  engine.startMainPhase();
  const trigger = (card = source) => { engine.declareAttackEvent(card, "FRONT"); engine.resolveCheckPoint(); };
  const context = () => ({ sourceCard: source, locateCard: (id) => engine.locateCard(id) });
  return { engine, state, self, opponent, source, make, trigger, context, renders };
}

test("前列ConditionはStage前列の全slotを評価し、QueryはStateを変更しない", () => {
  const f = fixture();
  for (const index of [1, 2, 3]) {
    f.source.index = index;
    assert.equal(getConditionsDisabledReason([frontCondition], f.context()), null);
  }
  const before = JSON.stringify(f.state);
  assert.equal(getConditionsDisabledReason([frontCondition], f.context()), null);
  assert.equal(JSON.stringify(f.state), before);
  f.source.index = 4;
  assert.match(getConditionsDisabledReason([frontCondition], f.context()), /前列/);
});

test("後列Condition NGでもTriggerがPendingを生成し、表示理由と不使用を維持する", () => {
  const f = fixture({ row: "back", costs: [{ type: "PAY_STOCK", amount: 1 }],
    effects: [{ type: "TEST_LOG", message: "must not run" }] }); f.trigger();
  const before = JSON.stringify(f.state);
  const [option] = f.engine.getPendingAutoOptions();
  assert.equal(JSON.stringify(f.state), before);
  assert.equal(option.usable, false); assert.equal(option.reasonCategory, AVAILABILITY_REASON_CATEGORY.CONDITION);
  assert.match(option.disabledReason, /前列/); assert.equal(f.state.ruleState.pendingAutos.length, 1);
  f.engine.render(); assert.deepEqual(f.renders.at(-1)[1].pendingAutoOptions, [option]);
  assert.throws(() => f.engine.selectPendingAuto(option.pending.id), /前列/);
  f.engine.declinePendingAuto(option.pending.id);
  assert.equal(f.state.ruleState.pendingAutos.length, 0); assert.equal(f.self.stock.length, 0);
  assert.equal(f.engine.processManager.getCurrentProcess().type, PROCESS_TYPE.MAIN_PHASE);
  assert.equal(f.state.log.some(({ message }) => message === "must not run"), false);
});

test("前列Condition成立AUTOを使用するとEffectを実行してMAINへ復帰する", () => {
  const f = fixture({ effects: [{ type: "TEST_LOG", message: "condition resolved" }] }); f.trigger();
  const [option] = f.engine.getPendingAutoOptions();
  assert.equal(option.usable, true); assert.equal(option.disabledReason, null); assert.equal(option.reasonCategory, null);
  f.engine.selectPendingAuto(option.pending.id);
  assert.equal(f.state.ruleState.pendingAutos.length, 0);
  assert.equal(f.engine.processManager.getCurrentProcess().type, PROCESS_TYPE.MAIN_PHASE);
  assert.ok(f.state.log.some(({ message }) => message === "condition resolved"));
});

test("Trigger後にStage外へ移動したsourceはcollection所在でCondition NGになる", () => {
  for (const zone of [ZONE.HAND, ZONE.WAITING_ROOM, ZONE.MEMORY, ZONE.STOCK, ZONE.DECK]) {
    const f = fixture(); f.trigger(); const [shown] = f.engine.getPendingAutoOptions();
    f.engine.moveCard(f.source, { zone });
    // 表示metadataがStage / frontに残っていてもcollection所属を優先する。
    f.source.zone = ZONE.STAGE; f.source.row = "front"; f.source.index = 2;
    const option = f.engine.getPendingAutoOptions().find(({ pending }) => pending.id === shown.pending.id);
    assert.equal(option.usable, false, zone); assert.equal(option.reasonCategory, "CONDITION");
    assert.match(option.disabledReason, /前列/);
  }
});

test("Stage所属ならzone metadataのずれを条件判断に使わず、同master別instanceも代用しない", () => {
  const f = fixture({ row: "back" });
  f.self.stage.push(f.make("self", ZONE.STAGE, f.source.masterId, { row: "front", index: 1 }));
  f.opponent.stage.push(f.make("opponent", ZONE.STAGE, f.source.masterId, { row: "front", index: 1 }));
  f.trigger(); const [option] = f.engine.getPendingAutoOptions();
  assert.equal(option.card.instanceId, f.source.instanceId); assert.equal(option.usable, false);
  f.engine.moveCard(f.source, { zone: ZONE.STAGE, row: "front", index: 3 });
  f.source.zone = ZONE.HAND;
  assert.equal(f.engine.getPendingAutoOptions()[0].usable, true);
});

test("後列で誘発したPendingも、使用時の前列への移動で使用可能になる", () => {
  const f = fixture({ row: "back" }); f.trigger();
  const [shown] = f.engine.getPendingAutoOptions(); assert.equal(shown.usable, false);
  f.engine.moveCard(f.source, { zone: ZONE.STAGE, row: "front", index: 1 });
  assert.equal(f.engine.getPendingAutoOptions()[0].usable, true);
  f.engine.selectPendingAuto(shown.pending.id);
  assert.equal(f.state.ruleState.pendingAutos.length, 0);
});

test("表示後の前列→後列をselectで再検証し、古いusableでcommitしない", () => {
  const f = fixture({ costs: [{ type: "PAY_STOCK", amount: 1 }] });
  f.self.stock.push(f.make("self", ZONE.STOCK)); f.trigger();
  const [shown] = f.engine.getPendingAutoOptions(); assert.equal(shown.usable, true);
  f.engine.moveCard(f.source, { zone: ZONE.STAGE, row: "back", index: 2 });
  assert.throws(() => f.engine.selectPendingAuto(shown.pending.id), /前列/);
  assert.equal(f.self.stock.length, 1); assert.equal(f.state.ruleState.pendingAutos.length, 1);
  assert.equal(f.engine.processManager.getCurrentProcess().type, PROCESS_TYPE.PENDING_AUTO);
  assert.equal(shown.usable, true, "古い表示結果は再評価結果の代わりにならない");
});

test("Prepared Cost commit前にもConditionを再検証し、mutationもPending消費もしない", () => {
  for (const destination of [{ zone: ZONE.STAGE, row: "back", index: 1 }, { zone: ZONE.HAND }]) {
    const f = fixture({ costs: [{ type: "PAY_STOCK", amount: 1 }] });
    f.self.stock.push(f.make("self", ZONE.STOCK)); f.trigger();
    const [shown] = f.engine.getPendingAutoOptions(); assert.equal(shown.usable, true);
    // 選択対象Costは未実装。既存SELECT_COST境界を用意して公開confirm経路を検証する。
    const process = f.engine.processManager.getCurrentProcess();
    process.step = PENDING_AUTO_STEP.SELECT_COST; process.context.selectedPendingAutoId = shown.pending.id;
    f.engine.moveCard(f.source, destination);
    assert.throws(() => f.engine.confirmPreparedCosts([]), /前列/);
    assert.equal(f.self.stock.length, 1); assert.equal(f.state.ruleState.pendingAutos.length, 1);
    assert.equal(f.engine.processManager.getCurrentProcess(), process);
    f.engine.backToPendingAutoSelection();
    assert.equal(f.engine.getPendingAutoOptions()[0].usable, false);
    f.engine.declinePendingAuto(shown.pending.id);
    assert.equal(f.engine.processManager.getCurrentProcess().type, PROCESS_TYPE.MAIN_PHASE);
  }
});

test("Condition→Cost→Effectの順で最初の理由とcategoryを返す", () => {
  const f = fixture({ row: "back", costs: [{ type: "PAY_STOCK", amount: 1 }],
    effects: [{ id: "replace", type: "REPLACE_OPPONENT_STOCK_TOP" }] }); f.trigger();
  let option = f.engine.getPendingAutoOptions()[0];
  assert.equal(option.reasonCategory, "CONDITION"); assert.match(option.disabledReason, /前列/);
  f.engine.moveCard(f.source, { zone: ZONE.STAGE, row: "front", index: 2 });
  option = f.engine.getPendingAutoOptions()[0]; assert.equal(option.reasonCategory, "COST"); assert.match(option.disabledReason, /ストックが足り/);
  f.self.stock.push(f.make("self", ZONE.STOCK));
  option = f.engine.getPendingAutoOptions()[0]; assert.equal(option.reasonCategory, "EFFECT"); assert.match(option.disabledReason, /相手のストック/);
  f.opponent.stock.push(f.make("opponent", ZONE.STOCK));
  option = f.engine.getPendingAutoOptions()[0]; assert.equal(option.usable, true); assert.equal(option.reasonCategory, null);
});

test("unknown・malformed Conditionは直接モデル生成でも使用不可、不使用は可能", () => {
  for (const condition of [null, 1, [], {}, { type: "UNKNOWN" }, { type: "toString" }, { ...frontCondition, row: "back" }]) {
    const f = fixture({ conditions: [condition] }); f.trigger();
    const [option] = f.engine.getPendingAutoOptions();
    assert.equal(option.usable, false); assert.equal(option.reasonCategory, "CONDITION");
    assert.match(option.disabledReason, /使用条件の定義が不正/);
    assert.throws(() => f.engine.selectPendingAuto(option.pending.id), /使用条件の定義が不正/);
    f.engine.declinePendingAuto(option.pending.id); assert.equal(f.state.ruleState.pendingAutos.length, 0);
  }
});

test("通常のCondition NGより先に全itemの定義を検証し、未知Typeを隠さない", () => {
  const f = fixture({ row: "back" });
  assert.match(getConditionsDisabledReason([frontCondition, { type: "UNKNOWN" }], f.context()), /Unsupported Ability Condition type/);
  assert.match(getConditionsDisabledReason(null, f.context()), /conditions must be an array/);
  assert.match(getConditionsDisabledReason([frontCondition], { ...f.context(), sourceCard: null }), /前列/);
  assert.equal(getConditionsDisabledReason([], {}), null);
});

test("AUTO Loaderは前列Typeのみ許可し、不正schemaをtrigger有無にかかわらず拒否する", async () => {
  const definitions = JSON.parse(await readFile(new URL("../data/card-masters.json", import.meta.url), "utf8"));
  assert.doesNotThrow(() => createCardMasterRegistry(definitions));
  const source = definitions.find(({ cardNumber }) => cardNumber === "CHA/W40-026SP");
  for (const trigger of [source.abilities[0].activationTrigger, null]) {
    for (const conditions of [[], [frontCondition]]) {
      const definition = structuredClone(source); definition.abilities = [definition.abilities[0]];
      Object.assign(definition.abilities[0], { activationTrigger: trigger, conditions });
      const registry = createCardMasterRegistry([definition]);
      assert.deepEqual(registry.get(source.id).abilities[0].conditions, conditions);
    }
    for (const conditions of [null, {}, "bad", [null], [1], [[]], [{}], [{ type: null }],
      [{ type: "UNKNOWN" }], [{ type: "constructor" }], [{ ...frontCondition, value: false }]]) {
      const definition = structuredClone(source); definition.abilities = [definition.abilities[0]];
      Object.assign(definition.abilities[0], { activationTrigger: trigger, conditions });
      assert.throws(() => createCardMasterRegistry([definition]), /abilities\[0\].*invalid AUTO conditions/);
    }
  }
  assert.throws(() => validateConditions([frontCondition, undefined]), /Condition must be an object/);
});

test("ACTは今回もLoaderとruntimeで非空Conditionを拒否する", async () => {
  const definitions = JSON.parse(await readFile(new URL("../data/card-masters.json", import.meta.url), "utf8"));
  const definition = structuredClone(definitions.find(({ abilities }) => abilities.some(({ type }) => type === "ACT")));
  definition.abilities = [definition.abilities.find(({ type }) => type === "ACT")];
  definition.abilities[0].conditions = [frontCondition];
  assert.throws(() => createCardMasterRegistry([definition]), /ACT conditions must be an empty array/);
  const f = fixture();
  const master = new CardMaster(definition); const registry = new CardMasterRegistry(); registry.register(master);
  const card = new Card({ instanceId: "condition-act", masterId: master.id, masterRegistry: registry,
    owner: "self", zone: ZONE.STAGE, row: "front", index: 1 }); f.self.stage.push(card);
  assert.match(f.engine.getActAbilityDisabledReason(card, card.abilities[0], "self"), /未対応の使用条件/);
});

test("支払い境界へ移管したAUTOにCondition再評価を挟まない", () => {
  const f = fixture({ costs: [{ type: "PAY_STOCK", amount: 1 }, { type: "MOVE_DECK_TOP_TO_CLOCK", amount: 1 }],
    effects: [{ type: "TEST_LOG", message: "irreversible resolved" }] });
  f.self.stock.push(f.make("self", ZONE.STOCK)); f.self.deck.cards.push(f.make("self", ZONE.DECK)); f.trigger();
  const [option] = f.engine.getPendingAutoOptions(); assert.equal(option.usable, true);
  f.engine.processManager.popProcess(); f.state.ruleState.pendingAutos.length = 0;
  f.engine.processManager.pushProcess({ type: PROCESS_TYPE.AUTO_ABILITY, playerId: "self", step: AUTO_ABILITY_STEP.PAY_COST,
    status: PROCESS_STATUS.RUNNING, context: { pendingAuto: option.pending, preparedCosts: [], payCost: true,
      costIndex: 0, effectIndex: 0, effectResults: {} } });
  f.engine.moveCard(f.source, { zone: ZONE.STAGE, row: "back", index: 1 });
  f.engine.executeAutoAbilityProcess();
  assert.equal(f.self.stock.length, 0); assert.equal(f.self.clock.length, 1);
  assert.ok(f.state.log.some(({ message }) => message === "irreversible resolved"));
  assert.equal(f.engine.processManager.getCurrentProcess().type, PROCESS_TYPE.MAIN_PHASE);
});
