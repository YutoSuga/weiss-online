import test from "node:test";
import assert from "node:assert/strict";
import { ABILITY_TYPE } from "../js/constants/ability.js";
import { AUTO_TRIGGER_SUBJECT, GAME_EVENT_TYPE } from "../js/constants/gameEvent.js";
import { PROCESS_STATUS, PROCESS_TYPE, PENDING_AUTO_STEP } from "../js/constants/process.js";
import { ZONE } from "../js/constants/zone.js";
import { GameEngine } from "../js/core/gameEngine.js";
import { Card } from "../js/models/card.js";
import { CardMaster } from "../js/models/cardMaster.js";
import { CardMasterRegistry } from "../js/models/cardMasterRegistry.js";
import { GameState } from "../js/models/gameState.js";
import { Player } from "../js/models/player.js";

const auto = (id, costs = []) => ({ id, type: ABILITY_TYPE.AUTO, text: `能力 ${id}`,
  activationTrigger: { event: GAME_EVENT_TYPE.ATTACK_DECLARED, subject: AUTO_TRIGGER_SUBJECT.SELF },
  activeZones: [ZONE.STAGE], keywords: [], conditions: [], costs, effects: [] });

function fixture() {
  const registry = new CardMasterRegistry();
  for (const [id, abilities] of [["a", [auto("A"), auto("B"), auto("C")]], ["d", [auto("D")]], ["cost", [auto("COST", [{ type: "PAY_STOCK", amount: 1 }])]], ["plain", []]]) {
    registry.register(new CardMaster({ id, name: `card-${id}`, cardType: "CHARACTER", color: "RED",
      level: 0, cost: 0, basePower: 0, baseSoul: 1, traits: [], triggerIcons: [], abilities }));
  }
  let n = 0;
  const make = (id, owner, zone = ZONE.STAGE) => new Card({ instanceId: `${owner}-${++n}`, masterId: id, masterRegistry: registry, owner, zone, row: zone === ZONE.STAGE ? "front" : null, index: 1 });
  const self = new Player({ id: "self", name: "self" });
  const opponent = new Player({ id: "opponent", name: "opponent" });
  const a = make("a", "self"); const d = make("d", "self"); const cost = make("cost", "self"); const other = make("d", "opponent");
  self.stage.push(a, d, cost); opponent.stage.push(other);
  self.deck.cards.push(make("plain", "self", ZONE.DECK)); opponent.deck.cards.push(make("plain", "opponent", ZONE.DECK));
  const gameState = new GameState({ self, opponent, turnPlayer: "self", started: true });
  const engine = new GameEngine({ gameState, renderer: { render() {} } });
  return { engine, gameState, self, opponent, a, d, cost, other, make };
}

function current(engine) { return engine.processManager.getCurrentProcess(); }

test("単一Collectionは双方の誘発回数分を保持し、Turn Playerを先に提示する", () => {
  const f = fixture();
  f.engine.declareAttackEvent(f.a, "FRONT");
  f.engine.declareAttackEvent(f.a, "SIDE");
  f.engine.declareAttackEvent(f.other, "FRONT");
  assert.equal(f.gameState.ruleState.pendingAutos.length, 7);
  assert.equal(f.gameState.ruleState.pendingAutos.filter((p) => p.masterPlayerId === "self").length, 6);
  f.engine.resolveCheckPoint();
  assert.equal(current(f.engine).type, PROCESS_TYPE.PENDING_AUTO);
  assert.equal(current(f.engine).playerId, "self");
  assert.equal(f.engine.getPendingAutoOptions().length, 6);
});

test("1件でもAUTO選択を経由し、選択した1件だけをAUTO Processへ移管・消費する", () => {
  const f = fixture();
  f.engine.declareAttackEvent(f.d, "FRONT");
  f.engine.resolveCheckPoint();
  const [option] = f.engine.getPendingAutoOptions();
  assert.equal(option.ability.text, "能力 D");
  f.engine.selectPendingAuto(option.pending.id);
  assert.equal(f.gameState.ruleState.pendingAutos.length, 0);
  assert.notEqual(current(f.engine)?.type, PROCESS_TYPE.AUTO_ABILITY);
});

test("A完了後に追加されたDをB/Cと同列の候補としてID指定選択できる", () => {
  const f = fixture();
  f.engine.declareAttackEvent(f.a, "FRONT");
  f.engine.resolveCheckPoint();
  const a = f.engine.getPendingAutoOptions().find((x) => x.ability.id === "A");
  f.engine.selectPendingAuto(a.pending.id);
  f.engine.declareAttackEvent(f.d, "FRONT");
  const options = f.engine.getPendingAutoOptions();
  assert.deepEqual(new Set(options.map((x) => x.ability.id)), new Set(["B", "C", "D"]));
  const d = options.find((x) => x.ability.id === "D");
  assert.doesNotThrow(() => f.engine.selectPendingAuto(d.pending.id));
});

test("Turn Playerを使い切った後の再Check TimingでNon-Turn Playerへ進む", () => {
  const f = fixture();
  f.engine.declareAttackEvent(f.d, "FRONT");
  f.engine.declareAttackEvent(f.other, "FRONT");
  f.engine.resolveCheckPoint();
  f.engine.selectPendingAuto(f.engine.getPendingAutoOptions()[0].pending.id);
  assert.equal(current(f.engine).type, PROCESS_TYPE.PENDING_AUTO);
  assert.equal(current(f.engine).playerId, "opponent");
});

test("Cost可否はPending時に固定せず選択時とmutation直前に再評価し、部分支払いしない", () => {
  const f = fixture();
  f.engine.declareAttackEvent(f.cost, "FRONT");
  const pending = f.gameState.ruleState.pendingAutos[0];
  assert.equal(Object.hasOwn(pending, "costPlayable"), false);
  const stock = f.make("plain", "self", ZONE.STOCK); f.self.stock.push(stock);
  f.engine.resolveCheckPoint();
  f.engine.selectPendingAuto(pending.id);
  assert.equal(f.self.stock.length, 0);
  assert.equal(f.self.waitingRoom.includes(stock), true);
});

test("共通Prepared Costは選択だけでmutationせず、戻ると破棄しPendingを維持する", () => {
  const f = fixture();
  f.engine.declareAttackEvent(f.d, "FRONT");
  f.engine.resolveCheckPoint();
  const process = current(f.engine);
  const pendingId = f.engine.getPendingAutoOptions()[0].pending.id;
  process.step = PENDING_AUTO_STEP.SELECT_COST;
  process.status = PROCESS_STATUS.WAITING_INPUT;
  process.context.selectedPendingAutoId = pendingId;
  process.context.preparedCosts = [{ costIndex: 0, costType: "TEST", selectedCardInstanceIds: [f.a.instanceId] }];
  const before = f.self.stage.length;
  f.engine.backToPendingAutoSelection();
  assert.deepEqual(process.context.preparedCosts, []);
  assert.equal(f.self.stage.length, before);
  assert.equal(f.gameState.ruleState.pendingAutos.some(({ id }) => id === pendingId), true);
});

test("UI実装は1件でも一覧を表示し本文/Cost/解決操作とCostから戻る操作を持つ", async () => {
  const { readFile } = await import("node:fs/promises");
  const renderer = await readFile(new URL("../js/core/renderer.js", import.meta.url), "utf8");
  const controller = await readFile(new URL("../js/ui/pendingAutoController.js", import.meta.url), "utf8");
  assert.match(renderer, /待機中の自動能力を選択してください/);
  assert.match(renderer, /ability\?\.text/);
  assert.match(renderer, /Cost:/);
  assert.match(renderer, /resolve-pending-auto/);
  assert.match(renderer, /効果選択に戻る/);
  assert.doesNotMatch(renderer, /自動効果を使用しない/);
  assert.match(controller, /backToPendingAutoSelection/);
});
