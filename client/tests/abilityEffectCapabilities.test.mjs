import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateEffects, resolveEffect } from "../js/abilities/effectResolver.js";
import * as resolver from "../js/abilities/effectResolver.js";
import { createCardMasterRegistry } from "../js/data/cardMasterLoader.js";
import { GameEngine } from "../js/core/gameEngine.js";
import { Card } from "../js/models/card.js";
import { CardMaster } from "../js/models/cardMaster.js";
import { CardMasterRegistry } from "../js/models/cardMasterRegistry.js";
import { Player } from "../js/models/player.js";
import { GameState } from "../js/models/gameState.js";
import { PHASE } from "../js/constants/phase.js";
import { ZONE } from "../js/constants/zone.js";
import { AUTO_ABILITY_STEP, ACT_ABILITY_STEP, PENDING_AUTO_STEP, PROCESS_STATUS, PROCESS_TYPE } from "../js/constants/process.js";
import { getRuleAutoAbility } from "../js/abilities/ruleAbilityProvider.js";

const reveal = () => ({ id: "reveal", type: "BRAINSTORM_REVEAL", count: 1 });
const shuffle = () => ({ id: "shuffle", type: "SHUFFLE_DECK" });
const replace = () => ({ id: "replace", type: "REPLACE_OPPONENT_STOCK_TOP" });
const encore = () => ({ type: "ENCORE_RETURN" });
const search = () => ({ id: "search", type: "SEARCH_DECK", minSelect: 0, maxSelect: 1, filter: { cardType: "CHARACTER" } });
const reference = (effectId, field) => ({ source: "EFFECT_RESULT", effectId, field });
const add = () => ({ id: "add", type: "ADD_TO_HAND", cards: reference("search", "selectedCardInstanceIds") });
const group = (effects, id = "group") => ({ id, type: "EFFECT_GROUP", condition: { ...reference("reveal", "climaxCount"), min: 1 }, effects });
const ability = (type, effects, overrides = {}) => ({ id: "capability-test", type, text: "fixture", keywords: [],
  activationTrigger: type === "AUTO" ? { event: "ATTACK_DECLARED", subject: "SELF" } : null,
  activeZones: [ZONE.STAGE], conditions: [], costs: [], effects, ...overrides });
const definition = (ability) => ({ id: "fixture", cardNumber: null, name: "fixture", cardType: "CHARACTER", color: "GREEN",
  imageUrl: null, level: 0, cost: 0, basePower: 1000, baseSoul: 1, triggerIcons: [], traits: [], abilities: [ability] });
const load = (type, effects, overrides = {}) => createCardMasterRegistry([definition(ability(type, effects, overrides))]);

function fixture(effects, { stockCount = 1, deckCount = 3, type = "AUTO" } = {}) {
  const registry = new CardMasterRegistry();
  registry.register(new CardMaster({ id: "source", name: "source", cardType: "CHARACTER", color: "GREEN",
    level: 0, cost: 0, basePower: 1000, baseSoul: 1, abilities: [{ id: "ability", type, text: "fixture",
      activationTrigger: type === "AUTO" ? { event: "ATTACK_DECLARED", subject: "SELF" } : null,
      activeZones: [ZONE.STAGE], conditions: [], costs: [{ type: "PAY_STOCK", amount: 1 }], effects }] }));
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


for (const trigger of [undefined, null]) {
  test(`LoaderはAUTO + ACT専用Revealをtrigger=${String(trigger)}でも拒否する`, () => {
    const overrides = trigger === null ? { activationTrigger: null } : {};
    assert.doesNotThrow(() => validateEffects([reveal()]), "Effect自体のschemaは正しい");
    assert.throws(() => load("AUTO", [reveal()], overrides), /capability-test.*AUTO.*BRAINSTORM_REVEAL/s);
  });
}

for (const effect of [replace(), encore()]) {
  test(`LoaderはACT + ${effect.type}を拒否する`, () => {
    assert.throws(() => load("ACT", [effect]), new RegExp(`ACT.*${effect.type}`, "s"));
  });
}

test("共通EffectはACT / AUTO双方のLoaderとruntimeで検索・Hand追加・shuffleまで完走する", () => {
  for (const type of ["ACT", "AUTO"]) {
    const effects = [search(), add(), shuffle()]; assert.doesNotThrow(() => load(type, effects));
    const f = fixture(effects, { type }); let shuffled = 0;
    const originalShuffle = f.self.deck.shuffle.bind(f.self.deck);
    f.self.deck.shuffle = (...args) => { shuffled += 1; return originalShuffle(...args); };
    if (type === "ACT") { f.engine.startMainPhase(); f.engine.useActAbility(f.source, f.source.abilities[0], "self"); }
    else { f.trigger(); f.engine.selectPendingAuto(f.engine.getPendingAutoOptions()[0].pending.id); }
    const target = f.engine.getSearchDeckState().cards[0];
    f.engine.toggleSearchDeckSelection(target.instanceId); f.engine.confirmSearchDeckSelection();
    assert.deepEqual(f.self.hand, [target]); assert.equal(shuffled, 1); assert.equal(f.self.stock.length, 0);
    assert.equal(f.engine.processManager.getCurrentProcess()?.type ?? null, type === "ACT" ? PROCESS_TYPE.MAIN_PHASE : null);
  }
});

test("正式CardMaster全件を引き続きロードする", async () => {
  const definitions = JSON.parse(await readFile(new URL("../data/card-masters.json", import.meta.url), "utf8"));
  const registry = createCardMasterRegistry(definitions); assert.equal(registry.getAll().length, definitions.length);
});

test("AUTO direct modelはEFFECT理由で使用不可、select拒否でCost/Pending/Effectを変更しない", () => {
  const f = fixture([reveal()]); f.trigger(); const before = JSON.stringify(f.state);
  const [option] = f.engine.getPendingAutoOptions();
  assert.equal(option.usable, false); assert.equal(option.reasonCategory, "EFFECT");
  assert.match(option.disabledReason, /効果/);
  f.engine.render();
  assert.equal(f.renders.at(-1)[1].pendingAutoOptions[0].usable, false);
  assert.throws(() => f.engine.selectPendingAuto(option.pending.id), /効果/);
  assert.equal(JSON.stringify(f.state), before);
  f.engine.declinePendingAuto(option.pending.id);
  assert.equal(f.state.ruleState.pendingAutos.length, 0);
  assert.equal(f.self.stock.length, 1); assert.equal(f.self.waitingRoom.length, 0); assert.equal(f.self.resolution.length, 0);
});

for (const effect of [replace(), encore()]) {
  test(`ACT direct model ${effect.type}はCost前に拒否する`, () => {
    const f = fixture([effect], { type: "ACT" }); f.engine.startMainPhase(); const before = JSON.stringify(f.state);
    assert.equal(f.engine.canUseActAbility(f.source, f.source.abilities[0], "self"), false);
    assert.throws(() => f.engine.useActAbility(f.source, f.source.abilities[0], "self"), /効果/);
    assert.equal(JSON.stringify(f.state), before);
  });
}

test("Prepared commitは不正EffectでもPendingをconsumeせず拒否する", () => {
  const f = fixture([reveal()]); f.trigger(); const pending = f.state.ruleState.pendingAutos[0];
  const process = f.engine.processManager.getCurrentProcess();
  process.step = PENDING_AUTO_STEP.SELECT_COST; process.context.selectedPendingAutoId = pending.id;
  const before = JSON.stringify(f.state);
  assert.throws(() => f.engine.confirmPreparedCosts([]), /効果/); assert.equal(JSON.stringify(f.state), before);
});

test("直接用意したACT / AUTO PAY_COST stepも支払い開始前にcapabilityを検証する", () => {
  for (const type of ["ACT", "AUTO"]) {
    const f = fixture(type === "ACT" ? [replace()] : [reveal()], { type });
    let context;
    if (type === "AUTO") {
      f.trigger(); const pendingAuto = f.state.ruleState.pendingAutos[0]; f.engine.processManager.popProcess();
      context = { pendingAuto, preparedCosts: [], payCost: true, costIndex: 0, costPaymentInProgress: false };
    } else context = { sourceCardInstanceId: f.source.instanceId, abilityId: "ability", costIndex: 0 };
    f.engine.processManager.pushProcess({ type: type === "ACT" ? PROCESS_TYPE.ACT_ABILITY : PROCESS_TYPE.AUTO_ABILITY,
      playerId: "self", step: type === "ACT" ? ACT_ABILITY_STEP.PAY_COST : AUTO_ABILITY_STEP.PAY_COST,
      status: PROCESS_STATUS.RUNNING, context });
    const before = JSON.stringify(f.state);
    assert.throws(() => type === "ACT" ? f.engine.executeActAbilityProcess() : f.engine.executeAutoAbilityProcess(), /効果/);
    assert.equal(JSON.stringify(f.state), before);
  }
});

test("Resolverの直接実行でもACT / AUTO非対応とAbility Type省略を拒否する", () => {
  for (const [effect, abilityType] of [[reveal(), "AUTO"], [replace(), "ACT"], [encore(), "ACT"]]) {
    let mutations = 0;
    assert.throws(() => resolveEffect(effect, { abilityType, gameEngine: { returnEncoreCardToStage() { mutations += 1; } } }), /not executable|not supported/);
    assert.equal(mutations, 0);
  }
  assert.throws(() => resolveEffect({ type: "TEST_LOG", message: "bad" }, { gameEngine: { addLog() { throw Error("must not run"); } } }), /Ability Type/);
});

test("schema不正とcapability不正を区別する", () => {
  assert.throws(() => load("AUTO", [{ ...reveal(), count: 0 }]), /positive integer/);
  assert.throws(() => load("AUTO", [reveal()]), /not executable|not supported/);
  assert.throws(() => load("AUTO", [{ type: "UNKNOWN" }]), /Unsupported Ability Effect/);
});

test("ACT Group内のAUTO専用Effect、二重Group、AUTO Groupを拒否する", () => {
  assert.throws(() => load("ACT", [reveal(), group([replace()])]), /REPLACE_OPPONENT_STOCK_TOP/);
  assert.throws(() => load("ACT", [reveal(), group([group([shuffle()], "inner")])]), /nested|top-level/);
  assert.throws(() => load("AUTO", [group([reveal()])]), /EFFECT_GROUP/);
  for (const [type, effects] of [["ACT", [reveal(), group([replace()])]], ["ACT", [reveal(), group([group([shuffle()], "inner")])]], ["AUTO", [group([reveal()])]]]) {
    const f = fixture(effects, { type }); const beforeStock = [...f.self.stock];
    if (type === "ACT") { f.engine.startMainPhase(); assert.equal(f.engine.canUseActAbility(f.source, f.source.abilities[0], "self"), false); }
    else { f.trigger(); assert.equal(f.engine.getPendingAutoOptions()[0].usable, false); }
    assert.deepEqual(f.self.stock, beforeStock);
  }
});

test("AUTO検索の結果参照maxSelectをLoaderで拒否し、ACTの対応済み形式は許可する", () => {
  const dynamicSearch = { ...search(), maxSelect: reference("reveal", "climaxCount") };
  assert.throws(() => load("AUTO", [dynamicSearch]), /maxSelect/);
  assert.doesNotThrow(() => load("ACT", [reveal(), dynamicSearch]));
});

test("ENCORE_RETURNは元slotを必要とするRULE文脈だけ許可する", () => {
  assert.throws(() => load("AUTO", [encore()]), /RULE/);
  const rule = getRuleAutoAbility("STANDARD_ENCORE_3");
  assert.doesNotThrow(() => resolver.validateAbilityEffects(rule.effects, rule.type, { sourceKind: "RULE" }));
  const f = fixture([],{stockCount:3}); f.engine.moveCard(f.source,{zone:ZONE.WAITING_ROOM}); f.engine.resolveCheckPoint();
  const [option] = f.engine.getPendingAutoOptions(); assert.equal(option.usable,true);
  const pending = f.state.ruleState.pendingAutos[0]; f.state.ruleState.pendingAutos[0] = { ...pending, triggerContext: { ...pending.triggerContext, originalStagePosition: null } };
  assert.equal(f.engine.getPendingAutoOptions()[0].usable,false);
  assert.throws(()=>f.engine.selectPendingAuto(pending.id),/効果|舞台/); assert.equal(f.self.stock.length,3);
});

test("CONTINUOUSは空effectsのみLoaderで保持し、非空は未実装として拒否する", () => {
  assert.doesNotThrow(() => load("CONTINUOUS", []));
  assert.throws(() => load("CONTINUOUS", [shuffle()]), /CONTINUOUS.*SHUFFLE_DECK/s);
});

test("全EffectのHandler capabilityと共通validatorの対応関係を確認する", () => {
  const examples = [
    [ { type: "TEST_LOG", message: "test" }, ["ACT", "AUTO"] ],
    [ reveal(), ["ACT"] ], [ group([shuffle()]), ["ACT"] ],
    [ search(), ["ACT", "AUTO"] ], [ add(), ["ACT", "AUTO"] ],
    [ shuffle(), ["ACT", "AUTO"] ], [ encore(), ["AUTO"] ], [ replace(), ["AUTO"] ],
  ];
  for (const [effect, supported] of examples) {
    const handler = resolver.getEffectHandler(effect);
    assert.deepEqual(handler.supportedAbilityTypes, supported);
    assert.equal(Object.isFrozen(handler), true);
    for (const type of ["ACT", "AUTO", "CONTINUOUS"]) {
      const validate = () => resolver.validateAbilityEffects([effect], type, { sourceKind: "RULE" });
      if (supported.includes(type)) assert.doesNotThrow(validate);
      else assert.throws(validate, /not executable/);
    }
  }
});

test("ACT VALIDATEを直接開始してもcapability NGでCostを払わず親MAINへ戻す", () => {
  const f = fixture([replace()], { type: "ACT" }); f.engine.startMainPhase();
  const parent = f.engine.processManager.getCurrentProcess();
  f.engine.processManager.pushProcess({ type: PROCESS_TYPE.ACT_ABILITY, playerId: "self",
    step: ACT_ABILITY_STEP.VALIDATE, status: PROCESS_STATUS.RUNNING,
    context: { sourceCardInstanceId: f.source.instanceId, abilityId: "ability", costIndex: 0 } });
  assert.throws(() => f.engine.executeActAbilityProcess(), /効果/);
  assert.equal(f.engine.processManager.getCurrentProcess(), parent);
  assert.equal(f.self.stock.length, 1); assert.equal(f.self.waitingRoom.length, 0);
});

test("直接Resolverの正常TEST_LOGと不正Encore contextはmutation前に区別する", () => {
  let logs = 0, moves = 0;
  for (const abilityType of ["ACT", "AUTO"]) {
    resolveEffect({ type: "TEST_LOG", message: "test" }, { abilityType, gameEngine: { addLog() { logs += 1; } } });
  }
  assert.equal(logs, 2);
  assert.throws(() => resolveEffect(encore(), { abilityType: "AUTO", sourceKind: "RULE",
    gameEngine: { returnEncoreCardToStage() { moves += 1; } } }), /舞台/);
  assert.equal(moves, 0);
});
