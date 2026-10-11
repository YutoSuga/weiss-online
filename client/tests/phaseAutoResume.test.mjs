import test from "node:test";
import assert from "node:assert/strict";
import { GameEngine } from "../js/core/gameEngine.js";
import { GameState } from "../js/models/gameState.js";
import { Player } from "../js/models/player.js";
import { Card, POSITION } from "../js/models/card.js";
import { createCardMasterRegistry } from "../js/data/cardMasterLoader.js";
import { PHASE } from "../js/constants/phase.js";
import { ZONE } from "../js/constants/zone.js";
import { PROCESS_TYPE } from "../js/constants/process.js";

const phaseAuto = (id, event = "PHASE_STARTED", phase = PHASE.CLIMAX, extra = {}) => ({
  id, type: "AUTO", text: `fixture ${id}`, activationTrigger: { event, phase },
  activeZones: [ZONE.STAGE], conditions: [], costs: [], effects: [], ...extra,
});
const logEffect = (message = "resolved") => ({ type: "TEST_LOG", message });
const searchEffects = [
  { id: "search", type: "SEARCH_DECK", minSelect: 0, maxSelect: 1, filter: { cardType: "CHARACTER" } },
  { id: "add", type: "ADD_TO_HAND", cards: { source: "EFFECT_RESULT", effectId: "search", field: "selectedCardInstanceIds" } },
  { id: "shuffle", type: "SHUFFLE_DECK" },
];
function fixture(abilities, { phase = PHASE.MAIN, opponentAbilities = [], stock = 0, deck = 5, clock = 0, waiting = 0 } = {}) {
  const definition = (id, abilities) => ({ id, cardNumber: null, imageUrl: null, triggerIcons: [], traits: [], name: id, cardType: "CHARACTER", color: "GREEN",
    level: 0, cost: 0, basePower: 1000, baseSoul: 1, abilities });
  const registry = createCardMasterRegistry([definition("source", abilities), definition("other", opponentAbilities), definition("plain", [])]);
  const self = new Player({ id: "self", name: "self" });
  const opponent = new Player({ id: "opponent", name: "opponent" });
  let serial = 0;
  const make = (zone, owner = "self", masterId = "plain") => new Card({ instanceId: `phase-${++serial}`, masterId,
    masterRegistry: registry, owner, zone, row: zone === ZONE.STAGE ? "front" : null, index: 1 });
  const source = make(ZONE.STAGE, "self", "source"); self.stage.push(source);
  const other = make(ZONE.STAGE, "opponent", "other"); opponent.stage.push(other);
  for (let i = 0; i < deck; i++) self.deck.cards.push(make(ZONE.DECK));
  for (let i = 0; i < stock; i++) self.stock.push(make(ZONE.STOCK));
  for (let i = 0; i < clock; i++) self.clock.push(make(ZONE.CLOCK));
  for (let i = 0; i < waiting; i++) self.waitingRoom.push(make(ZONE.WAITING_ROOM));
  opponent.deck.cards.push(make(ZONE.DECK, "opponent"));
  const state = new GameState({ self, opponent, turnPlayer: "self", phase, started: true });
  const renders = [];
  const engine = new GameEngine({ gameState: state, renderer: { render(...args) { renders.push(args); } } });
  const events = [];
  const emit = engine.emitGameEvent.bind(engine);
  engine.emitGameEvent = (...args) => { const result = emit(...args); events.push({ event: result.event, phase: state.phase }); return result; };
  if (phase === PHASE.MAIN) engine.startMainPhase();
  return { engine, state, self, opponent, source, other, registry, make, events, renders };
}
const top = (f) => f.engine.processManager.getCurrentProcess();
const options = (f) => f.engine.getPendingAutoOptions();
const decline = (f, id) => f.engine.declinePendingAuto(options(f).find(x => !id || x.ability.id === id).pending.id);
const use = (f, id) => f.engine.selectPendingAuto(options(f).find(x => !id || x.ability.id === id).pending.id);
const stack = (f) => f.state.ruleState.processStack.map(p => p.type);

test("CLIMAX開始Pendingを提示し、不使用後もCLIMAXに留まり、未処理のまま次Phaseへ進めない", () => {
  const f = fixture([phaseAuto("start")]);
  f.engine.endMainPhase("self");
  assert.equal(f.state.phase, PHASE.CLIMAX);
  assert.equal(f.state.ruleState.pendingAutos.length, 1);
  assert.equal(options(f).length, 1);
  assert.throws(() => f.engine.nextPhase(), /waiting|Process|transition/);
  decline(f);
  assert.equal(f.state.phase, PHASE.CLIMAX);
  assert.equal(f.state.ruleState.pendingAutos.length, 0);
  assert.deepEqual(stack(f), []);
});

test("MAIN終了時の既存Pendingを不使用後、元の終了操作からCLIMAXへresumeする", () => {
  const f = fixture([phaseAuto("end", "PHASE_ENDED", PHASE.MAIN), {
    ...phaseAuto("existing"), activationTrigger: { event: "ATTACK_DECLARED", subject: "SELF" },
  }]);
  // MAIN COMPLETE直前に残る既存PendingもPhase終了継続を失ってはいけない。
  f.engine.declareAttackEvent(f.source, "FRONT");
  f.engine.endMainPhase("self");
  assert.equal(options(f).length >= 1, true);
  while (options(f).length) decline(f);
  assert.equal(f.state.phase, PHASE.CLIMAX);
  assert.deepEqual(stack(f), []);
});

test("MAIN終了Eventを確定後に提示し、不使用でCLIMAXへ一度だけ進む", () => {
  const f = fixture([phaseAuto("end", "PHASE_ENDED", PHASE.MAIN)]);
  f.engine.endMainPhase("self");
  assert.equal(f.state.phase, PHASE.MAIN);
  assert.deepEqual(stack(f), [PROCESS_TYPE.PHASE_TRANSITION, PROCESS_TYPE.PENDING_AUTO]);
  assert.equal(options(f)[0].pending.trigger.type, "PHASE_ENDED");
  assert.equal(f.events.length, 1);
  decline(f);
  assert.equal(f.state.phase, PHASE.CLIMAX);
  assert.deepEqual(f.events.map(x => [x.event.type, x.event.payload.phase]), [["PHASE_ENDED", PHASE.MAIN], ["PHASE_STARTED", PHASE.CLIMAX]]);
  assert.equal(f.events[1].phase, PHASE.CLIMAX, "開始EventはPhase state確定後");
  assert.deepEqual(stack(f), []);
  assert.throws(() => f.engine.endMainPhase("self"));
  f.engine.executeCurrentProcess();
  assert.equal(f.events.length, 2);
});

for (const event of ["PHASE_STARTED", "PHASE_ENDED"]) {
  test(`${event} AUTO使用でchild Process完了後にのみPhase通常処理へresume`, () => {
    const phase = event === "PHASE_STARTED" ? PHASE.DRAW : PHASE.MAIN;
    const f = fixture([phaseAuto("search", event, phase, { costs: [{ type: "PAY_STOCK", amount: 1 }], effects: searchEffects })],
      { phase: event === "PHASE_STARTED" ? PHASE.STAND : PHASE.MAIN, stock: 1 });
    if (event === "PHASE_STARTED") f.engine.nextPhase(); else f.engine.endMainPhase("self");
    assert.equal(options(f).length, 1);
    use(f);
    assert.deepEqual(stack(f), [PROCESS_TYPE.PHASE_TRANSITION, PROCESS_TYPE.AUTO_ABILITY, PROCESS_TYPE.SEARCH_DECK]);
    assert.equal(f.self.stock.length, 0);
    assert.equal(f.self.hand.length, 0, "DRAW固有処理 / 検索結果追加を先に実行しない");
    assert.equal(f.events.filter(x => x.event.type === "PHASE_STARTED").length, event === "PHASE_STARTED" ? 1 : 0);
    f.engine.confirmSearchDeckSelection();
    assert.equal(f.state.phase, event === "PHASE_STARTED" ? PHASE.DRAW : PHASE.CLIMAX);
    assert.equal(f.self.hand.length, event === "PHASE_STARTED" ? 1 : 0);
    assert.equal(f.self.waitingRoom.length, 1, "Costを一度だけ支払う");
    assert.deepEqual(stack(f), []);
    f.engine.executeCurrentProcess();
    assert.equal(f.self.hand.length, event === "PHASE_STARTED" ? 1 : 0);
    assert.equal(f.events.filter(x => x.event.type === "PHASE_ENDED").length, 1);
    assert.equal(f.events.filter(x => x.event.type === "PHASE_STARTED").length, 1);
  });
}

test("終了AUTOを全件処理してから開始AUTOを全件処理し、生成順に固定しない", () => {
  const f = fixture([phaseAuto("A", "PHASE_ENDED", PHASE.MAIN, { effects: [logEffect("A")] }),
    phaseAuto("B", "PHASE_ENDED", PHASE.MAIN), phaseAuto("S")]);
  f.engine.endMainPhase("self");
  assert.deepEqual(options(f).map(x => x.ability.id), ["A", "B"]);
  decline(f, "B"); assert.equal(f.state.phase, PHASE.MAIN);
  use(f, "A");
  assert.equal(f.state.phase, PHASE.CLIMAX);
  assert.deepEqual(options(f).map(x => x.ability.id), ["S"]);
  decline(f, "S"); assert.deepEqual(stack(f), []);
  assert.equal(f.state.log.filter(x => x.message === "A").length, 1);
});

test("A解決中の新規Cは生成するが提示せず、A完了後B/Cを再評価する", () => {
  const c = { ...phaseAuto("C"), activationTrigger: { event: "CARD_MOVED", subject: "OTHER_YOUR_CHARACTER", fromZone: ZONE.STOCK, toZone: ZONE.WAITING_ROOM } };
  const f = fixture([phaseAuto("A", "PHASE_ENDED", PHASE.MAIN, { effects: [{ id: "replace", type: "REPLACE_OPPONENT_STOCK_TOP" }] }),
    phaseAuto("B", "PHASE_ENDED", PHASE.MAIN)], { opponentAbilities: [c] });
  f.opponent.stock.push(f.make(ZONE.STOCK, "opponent"));
  f.engine.endMainPhase("self"); use(f, "A");
  assert.equal(top(f).type, PROCESS_TYPE.SELECT_ZONE_CARD);
  assert.deepEqual(new Set(f.state.ruleState.pendingAutos.map(x => x.source.abilityId)), new Set(["B", "C"]));
  assert.deepEqual(options(f), []);
  f.engine.resolveCheckPoint(); assert.equal(top(f).type, PROCESS_TYPE.SELECT_ZONE_CARD);
  assert.equal(f.state.phase, PHASE.MAIN);
  const card = f.engine.getZoneCardSelectionState().cards[0];
  f.engine.toggleZoneCardSelection(card.instanceId); f.engine.confirmZoneCardSelection();
  assert.deepEqual(options(f).map(x => x.ability.id), ["B"]);
  decline(f, "B"); assert.equal(f.state.phase, PHASE.MAIN);
  assert.deepEqual(options(f).map(x => x.ability.id), ["C"]);
  decline(f, "C"); assert.equal(f.state.phase, PHASE.CLIMAX); assert.deepEqual(stack(f), []);
});

for (const event of ["PHASE_STARTED", "PHASE_ENDED"]) {
  test(`${event}もTurn Player優先で全件後にNon-Turnへ進む`, () => {
    const phase = event === "PHASE_STARTED" ? PHASE.CLIMAX : PHASE.MAIN;
    const f = fixture([phaseAuto("self", event, phase)], { opponentAbilities: [phaseAuto("other", event, phase)] });
    f.engine.endMainPhase("self");
    assert.equal(top(f).playerId, "self"); decline(f);
    assert.equal(top(f).playerId, "opponent");
    assert.equal(f.state.phase, event === "PHASE_STARTED" ? PHASE.CLIMAX : PHASE.MAIN);
    decline(f); assert.equal(f.state.phase, PHASE.CLIMAX); assert.deepEqual(stack(f), []);
  });
}

for (const [category, extra] of [
  ["CONDITION", { conditions: [{ type: "SOURCE_IS_FRONT_ROW" }] }],
  ["COST", { costs: [{ type: "PAY_STOCK", amount: 1 }] }],
  ["EFFECT", { effects: [{ id: "replace", type: "REPLACE_OPPONENT_STOCK_TOP" }] }],
]) {
  test(`${category} NGのPhase AUTOも表示・拒否・不使用後resume`, () => {
    const f = fixture([phaseAuto("unusable", "PHASE_ENDED", PHASE.MAIN, extra)]);
    if (category === "CONDITION") f.source.moveTo({ zone: ZONE.STAGE, row: "back", index: 1 });
    f.engine.endMainPhase("self");
    const [option] = options(f); assert.equal(option.usable, false); assert.equal(option.reasonCategory, category);
    assert.ok(option.disabledReason); assert.equal(f.renders.at(-1)[1].pendingAutoOptions[0].usable, false);
    const before = JSON.stringify(f.state); assert.throws(() => use(f)); assert.equal(JSON.stringify(f.state), before);
    decline(f); assert.equal(f.state.phase, PHASE.CLIMAX); assert.deepEqual(stack(f), []);
  });
}

test("終了AUTOのRefresh / Penalty / Level Up後、親AUTOを先にresumeしてからPhaseを進める", () => {
  const f = fixture([phaseAuto("rule", "PHASE_ENDED", PHASE.MAIN, {
    costs: [{ type: "PAY_STOCK", amount: 1 }, { type: "MOVE_DECK_TOP_TO_CLOCK", amount: 1 }], effects: searchEffects,
  }), phaseAuto("B", "PHASE_ENDED", PHASE.MAIN)], { stock: 1, deck: 1, clock: 6, waiting: 3 });
  f.engine.endMainPhase("self"); use(f, "rule");
  assert.equal(top(f).type, PROCESS_TYPE.AUTO_ABILITY);
  assert.equal(f.state.ruleState.pendingInterrupts.length, 2);
  f.engine.selectPendingInterrupt(f.state.ruleState.pendingInterrupts.findIndex(x => x.type === PROCESS_TYPE.LEVEL_UP));
  assert.deepEqual(stack(f), [PROCESS_TYPE.PHASE_TRANSITION, PROCESS_TYPE.AUTO_ABILITY, PROCESS_TYPE.LEVEL_UP]);
  assert.deepEqual(options(f), []);
  assert.equal(f.state.phase, PHASE.MAIN);
  f.engine.submitLevelUpSelection("self", 0);
  assert.equal(top(f).type, PROCESS_TYPE.SEARCH_DECK);
  assert.equal(f.self.level.length, 1); assert.equal(f.self.clock.length, 1);
  assert.equal(f.self.stock.length, 0);
  assert.equal(f.state.ruleState.pendingChecks.length, 0);
  assert.equal(f.state.ruleState.pendingInterrupts.length, 0);
  assert.ok(f.state.log.some(x => x.message.includes("リフレッシュ")));
  assert.deepEqual(options(f), []);
  f.engine.confirmSearchDeckSelection();
  assert.deepEqual(options(f).map(x => x.ability.id), ["B"]);
  assert.equal(f.state.phase, PHASE.MAIN); decline(f);
  assert.equal(f.state.phase, PHASE.CLIMAX); assert.deepEqual(stack(f), []);
});

for (const phase of [PHASE.STAND, PHASE.DRAW, PHASE.CLOCK, PHASE.MAIN]) {
  test(`${phase}の開始AUTO後にだけ固有処理を一度開始する`, () => {
    const f = fixture([phaseAuto("start", "PHASE_STARTED", phase)], { phase: PHASE.CLIMAX });
    f.source.setPosition(POSITION.REST);
    f.engine.enterPhase(phase);
    assert.equal(options(f).length, 1);
    assert.deepEqual(stack(f), [PROCESS_TYPE.PHASE_TRANSITION, PROCESS_TYPE.PENDING_AUTO]);
    assert.equal(f.self.hand.length, 0); assert.equal(f.source.position, POSITION.REST);
    assert.throws(() => f.engine.enterPhase(PHASE.ATTACK));
    assert.throws(() => f.engine.endTurn());
    decline(f);
    if (phase === PHASE.STAND) { assert.equal(f.source.position, POSITION.STAND); assert.deepEqual(stack(f), []); }
    if (phase === PHASE.DRAW) { assert.equal(f.self.hand.length, 1); assert.deepEqual(stack(f), []); }
    if (phase === PHASE.CLOCK) assert.deepEqual(stack(f), [PROCESS_TYPE.CLOCK_PHASE]);
    if (phase === PHASE.MAIN) assert.deepEqual(stack(f), [PROCESS_TYPE.MAIN_PHASE]);
    f.engine.executeCurrentProcess();
    assert.equal(f.events.filter(x => x.event.type === "PHASE_STARTED").length, 1);
    assert.equal(f.self.hand.length, phase === PHASE.DRAW ? 1 : 0);
  });
}

test("CLOCK完了にも同じ終了resume契約を適用し、MAIN Processを一度だけ作る", () => {
  const f = fixture([phaseAuto("end", "PHASE_ENDED", PHASE.CLOCK), phaseAuto("start", "PHASE_STARTED", PHASE.MAIN)], { phase: PHASE.CLOCK });
  f.engine.startClockPhase(); f.engine.skipClockPhase("self");
  assert.equal(f.state.phase, PHASE.CLOCK); assert.deepEqual(options(f).map(x => x.ability.id), ["end"]);
  decline(f); assert.equal(f.state.phase, PHASE.MAIN); assert.deepEqual(options(f).map(x => x.ability.id), ["start"]);
  decline(f); assert.deepEqual(stack(f), [PROCESS_TYPE.MAIN_PHASE]);
  f.engine.executeCurrentProcess(); assert.equal(stack(f).length, 1);
  assert.equal(f.events.length, 2);
});

test("Phase AUTO中のGame Overは継続を停止し、次Phase Event / Processを開始しない", () => {
  const f = fixture([phaseAuto("lose", "PHASE_ENDED", PHASE.MAIN, { costs: [{ type: "MOVE_DECK_TOP_TO_CLOCK", amount: 1 }], effects: [logEffect("must-not-run")] })], { clock: 6 });
  for (let i = 0; i < 3; i++) f.self.level.push(f.make(ZONE.LEVEL));
  f.engine.endMainPhase("self"); use(f);
  assert.equal(f.state.gameResult.finished, true);
  assert.equal(f.state.phase, PHASE.MAIN);
  assert.equal(f.events.length, 1); assert.equal(f.state.messageOverlay.title, "GAME OVER");
  assert.equal(f.state.log.some(x => x.message === "must-not-run"), false);
  const before = JSON.stringify(f.state); f.engine.executeCurrentProcess(); f.engine.executePhaseTransitionProcess();
  assert.equal(JSON.stringify(f.state), before);
  assert.throws(() => f.engine.nextPhase(), /finished/);
});

test("Pendingなしの初期準備・Mulligan・STAND/DRAW/CLOCK/MAINと既存ターン交代を維持", () => {
  const f = fixture([], { phase: PHASE.STAND, deck: 12 });
  for (let i = 0; i < 11; i++) f.opponent.deck.cards.push(f.make(ZONE.DECK, "opponent"));
  f.source.setPosition(POSITION.REST);
  f.engine.startGame(); assert.equal(f.self.hand.length, 5); assert.equal(f.opponent.hand.length, 5);
  f.engine.mulligan("self", [1]); f.engine.mulligan("opponent", []);
  assert.equal(f.state.phase, PHASE.STAND); assert.equal(f.source.position, POSITION.STAND);
  f.engine.nextPhase(); assert.equal(f.self.hand.length, 6); assert.deepEqual(stack(f), []);
  f.engine.nextPhase(); f.engine.clockCard("self", 1);
  assert.equal(f.self.hand.length, 7); assert.equal(f.self.clock.length, 1); assert.deepEqual(stack(f), [PROCESS_TYPE.MAIN_PHASE]);
  f.engine.endMainPhase("self");
  for (const phase of [PHASE.ATTACK, PHASE.ENCORE, PHASE.END, PHASE.STAND]) { f.engine.nextPhase(); assert.equal(f.state.phase, phase); }
  assert.equal(f.state.turn.player, "opponent"); assert.equal(f.state.turn.number, 1); assert.deepEqual(stack(f), []);
  // snapshotの手番順は今回変更していない。相手END後の番号増加も従来どおり。
  f.engine.enterPhase(PHASE.END); f.engine.nextPhase();
  assert.equal(f.state.turn.player, "self"); assert.equal(f.state.turn.number, 2);
});

test("END → STANDのAUTO待ちでもターン交代と番号増加を二重実行しない（snapshot順は従来維持）", () => {
  const f = fixture([phaseAuto("end", "PHASE_ENDED", PHASE.END), phaseAuto("start", "PHASE_STARTED", PHASE.STAND)], { phase: PHASE.END });
  f.state.turn.player = "opponent";
  f.engine.nextPhase();
  assert.equal(f.state.phase, PHASE.END);
  assert.equal(f.state.turn.player, "self"); assert.equal(f.state.turn.number, 2);
  assert.equal(options(f)[0].pending.trigger.payload.turnPlayerId, "self", "既知snapshot順は今回変えない");
  assert.throws(() => f.engine.endTurn());
  decline(f, "end"); assert.equal(f.state.phase, PHASE.STAND);
  decline(f, "start"); f.engine.executeCurrentProcess();
  assert.equal(f.state.turn.player, "self"); assert.equal(f.state.turn.number, 2);
  assert.deepEqual(stack(f), []); assert.equal(f.events.length, 2);
});
