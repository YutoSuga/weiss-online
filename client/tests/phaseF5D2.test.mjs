import test from "node:test";
import assert from "node:assert/strict";
import { GameEngine } from "../js/core/gameEngine.js";
import { Card } from "../js/models/card.js";
import { CardMaster } from "../js/models/cardMaster.js";
import { CardMasterRegistry } from "../js/models/cardMasterRegistry.js";
import { GameState } from "../js/models/gameState.js";
import { Player } from "../js/models/player.js";
import { ZONE } from "../js/constants/zone.js";
import { PROCESS_TYPE } from "../js/constants/process.js";
import { readFile } from "node:fs/promises";

const abilities = [
  { id: "cha-w40-026sp-auto-1", type: "AUTO", text: "stock replace", activationTrigger: { event: "CARD_MOVED", subject: "SELF", fromZone: "hand", toZone: "stage" }, costs: [], effects: [{ id: "replace", type: "REPLACE_OPPONENT_STOCK_TOP" }] },
  { id: "cha-w40-026sp-auto-2", type: "AUTO", text: "search", activationTrigger: { event: "CARD_MOVED", subject: "SELF", fromZone: "hand", toZone: "stage" }, costs: [{ type: "PAY_STOCK", amount: 1 }], effects: [] },
];
function fixture({ selfStock = 0, opponentStock = 0, waiting = 0 } = {}) {
  const registry = new CardMasterRegistry();
  registry.register(new CardMaster({ id: "ayumi", cardNumber: "CHA/W40-026SP", name: "“大切な何か”乙坂 歩未", cardType: "CHARACTER", color: "GREEN", level: 0, cost: 0, basePower: 1500, baseSoul: 1, abilities }));
  registry.register(new CardMaster({ id: "other", name: "other", cardType: "CHARACTER", color: "RED", level: 0, cost: 0, basePower: 1000, baseSoul: 1 }));
  let n = 0;
  const make = (owner, zone, masterId = "other") => new Card({ instanceId: `c${++n}`, masterId, masterRegistry: registry, owner, zone, index: 1 });
  const self = new Player({ id: "self", name: "self" }); const opponent = new Player({ id: "opponent", name: "opponent" });
  const ayumi = make("self", ZONE.HAND, "ayumi"); self.hand.push(ayumi);
  self.deck.cards.push(make("self", ZONE.DECK)); opponent.deck.cards.push(make("opponent", ZONE.DECK));
  for (let i=0;i<selfStock;i++) self.stock.push(make("self", ZONE.STOCK));
  for (let i=0;i<opponentStock;i++) opponent.stock.push(make("opponent", ZONE.STOCK));
  for (let i=0;i<waiting;i++) opponent.waitingRoom.push(make("opponent", ZONE.WAITING_ROOM));
  const state = new GameState({ self, opponent, turnPlayer: "self", started: true });
  const engine = new GameEngine({ gameState: state, renderer: { render() {} } });
  return { engine, state, self, opponent, ayumi };
}
const find = (state, id) => state.ruleState.pendingAutos.find((p) => p.source.abilityId === id);
function trigger(f) { f.engine.placeCardOnStage(f.ayumi, "self", { owner: "self", zone: ZONE.STAGE, row: "front", index: 1 }); }

test("実在CardMasterの同じHAND→STAGE Eventから2つのPRINTED AUTOを別Pendingにする", () => {
  const f=fixture(); trigger(f);
  assert.deepEqual(f.state.ruleState.pendingAutos.map((p)=>p.source.abilityId), abilities.map((a)=>a.id));
  assert.ok(f.state.ruleState.pendingAutos.every((p)=>p.source.kind === "PRINTED" && p.trigger.id === "event-1"));
  assert.deepEqual(find(f.state, abilities[0].id).triggerContext.from.zone, ZONE.HAND);
});

test("AUTO①は相手Stockを現在Stateから再評価し、0枚でも誘発して不使用にできる", () => {
  const f=fixture(); trigger(f); f.engine.resolveCheckPoint();
  const id=find(f.state, abilities[0].id).id;
  assert.match(f.engine.getPendingAutoOptions().find((o)=>o.pending.id===id).disabledReason, /相手のストック/);
  assert.throws(()=>f.engine.selectPendingAuto(id), /相手のストック/);
  assert.doesNotThrow(()=>f.engine.declinePendingAuto(id));
});

test("AUTO①はStock topを通常移動し、そのカードを含む控え室からexactly 1枚をStockへ戻す", () => {
  const f=fixture({ opponentStock: 2, waiting: 1 }); trigger(f);
  const originalTop=f.opponent.stock.at(-1); const bottom=f.opponent.stock[0];
  const id=find(f.state, abilities[0].id).id; f.engine.resolveCheckPoint(); f.engine.selectPendingAuto(id);
  assert.equal(f.engine.processManager.getCurrentProcess().type, PROCESS_TYPE.SELECT_ZONE_CARD);
  const selection=f.engine.getZoneCardSelectionState();
  assert.ok(selection.eligibleCardInstanceIds.includes(originalTop.instanceId));
  assert.deepEqual(f.opponent.stock, [bottom]);
  f.engine.toggleZoneCardSelection(originalTop.instanceId); f.engine.confirmZoneCardSelection();
  assert.equal(f.opponent.stock.at(-1), originalTop);
  assert.ok(find(f.state, abilities[1].id), "残Pendingを再提示・再評価する");
  assert.equal(f.engine.processManager.getCurrentProcess().type, PROCESS_TYPE.PENDING_AUTO);
});

test("AUTO②の使用可否は自分Stock 0/1枚で再評価し、RULEと同じPending collectionを使う", () => {
  for (const count of [0,1]) { const f=fixture({ selfStock: count }); trigger(f); f.engine.resolveCheckPoint(); const option=f.engine.getPendingAutoOptions().find((o)=>o.pending.source.abilityId===abilities[1].id); assert.equal(Boolean(option.disabledReason), count===0); }
});

test("歩未のCardMasterは確認済み画像URLを持つ", async () => {
  const masters = JSON.parse(await readFile(new URL("../data/card-masters.json", import.meta.url), "utf8"));
  const ayumi = masters.find(({ cardNumber }) => cardNumber === "CHA/W40-026SP");
  assert.equal(ayumi.imageUrl, "https://ws-tcg.com/wordpress/wp-content/images/cardlist/c/cha_w40/cha_w40_026sp.png");
});

test("Pending AUTO UIはsource Card画像、画像なしfallback、全件描画と従来の選択操作を備える", async () => {
  const renderer = await readFile(new URL("../js/core/renderer.js", import.meta.url), "utf8");
  const controller = await readFile(new URL("../js/ui/pendingAutoController.js", import.meta.url), "utf8");
  const pendingRenderer = renderer.slice(
    renderer.indexOf("  renderPendingAutoSelection("),
    renderer.indexOf("  updateMessageOverlay("),
  );
  assert.match(renderer, /pending\.forEach/);
  assert.match(renderer, /data-pending-auto-image/);
  assert.match(renderer, /data-pending-auto-image-placeholder>画像なし/);
  assert.match(renderer, /card\?\.imageUrl/);
  assert.match(renderer, /disabledReason \? " disabled"/);
  assert.match(renderer, /decline-pending-auto/);
  assert.match(pendingRenderer, /ability\?\.text \?\? item\.source\.abilityId/);
  assert.doesNotMatch(pendingRenderer, /formatAbility/);
  assert.match(controller, /selectPendingAuto/);
  assert.match(controller, /declinePendingAuto/);
});

test("Pending AUTOはPC 2列Gridと一覧内部スクロールを使用する", async () => {
  const css = await readFile(new URL("../css/board.css", import.meta.url), "utf8");
  assert.match(css, /\.pending-auto-list\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s);
  assert.match(css, /\.pending-auto-list\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(css, /\.pending-auto-panel\s*\{[^}]*max-height:\s*92vh/s);
});
