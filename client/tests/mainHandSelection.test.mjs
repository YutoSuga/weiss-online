import test from "node:test";
import assert from "node:assert/strict";

import { PHASE } from "../js/constants/phase.js";
import { PROCESS_STATUS, PROCESS_TYPE } from "../js/constants/process.js";
import { ZONE } from "../js/constants/zone.js";
import { GameEngine } from "../js/core/gameEngine.js";
import { Card } from "../js/models/card.js";
import { CardMaster } from "../js/models/cardMaster.js";
import { CardMasterRegistry } from "../js/models/cardMasterRegistry.js";
import { GameState } from "../js/models/gameState.js";
import { Player } from "../js/models/player.js";

function createFixture() {
  const registry = new CardMasterRegistry();
  const definitions = [
    { id: "playable", cardType: "CHARACTER", color: "BLUE", level: 0, cost: 0 },
    { id: "level-ng", cardType: "CHARACTER", color: "BLUE", level: 2, cost: 0 },
    { id: "color-ng", cardType: "CHARACTER", color: "RED", level: 1, cost: 0 },
    { id: "cost-ng", cardType: "CHARACTER", color: "BLUE", level: 1, cost: 2 },
    { id: "climax", cardType: "CLIMAX", color: "RED", level: 0, cost: 0 },
    { id: "level-card", cardType: "CHARACTER", color: "BLUE", level: 0, cost: 0 },
  ];
  for (const definition of definitions) {
    registry.register(new CardMaster({
      ...definition,
      cardNumber: null,
      name: definition.id,
      imageUrl: null,
      basePower: definition.cardType === "CHARACTER" ? 1000 : null,
      baseSoul: definition.cardType === "CHARACTER" ? 1 : null,
      triggerIcons: [], traits: [], abilities: [],
    }));
  }
  let serial = 0;
  const card = (masterId, owner = "self", zone = ZONE.HAND) => new Card({
    instanceId: `${owner}-${masterId}-${++serial}`,
    masterId, masterRegistry: registry, owner, zone,
  });
  const self = new Player({ id: "self", name: "self" });
  const opponent = new Player({ id: "opponent", name: "opponent" });
  const cards = Object.fromEntries(
    ["playable", "level-ng", "color-ng", "cost-ng", "climax"]
      .map((id) => [id, card(id)]),
  );
  self.hand.push(...Object.values(cards));
  self.level.push(card("level-card", "self", ZONE.LEVEL));
  const gameState = new GameState({
    self, opponent, phase: PHASE.MAIN, turnPlayer: "self", started: true,
  });
  const engine = new GameEngine({ gameState, renderer: { render() {} } });
  engine.startMainPhase();
  return { engine, gameState, cards, card };
}

test("MAIN WAITING_INPUTの自分の手札は種類やCharacterプレイ可否と独立して選択できる", () => {
  const { engine, cards } = createFixture();
  for (const card of Object.values(cards)) {
    assert.equal(engine.canSelectCardForMain(card, "self"), true, card.masterId);
  }
  assert.equal(engine.getCharacterPlayDisabledReason(cards["level-ng"], "self"), "レベル条件を満たしていません。");
  assert.equal(engine.getCharacterPlayDisabledReason(cards["color-ng"], "self"), "必要な色条件を満たしていません。");
  assert.equal(engine.getCharacterPlayDisabledReason(cards["cost-ng"], "self"), "ストックが不足しています。");
  assert.equal(engine.canPlayCharacterToStage(cards.playable, "self"), true);
  assert.equal(engine.canPlayCharacterToStage(cards.climax, "self"), false);
});

test("CLIMAXのMAIN選択はDestinationやPLAY_CHARACTER Processを作らない", () => {
  const { engine, gameState, cards } = createFixture();
  assert.deepEqual(engine.getMainDestinationCandidates(cards.climax, "self"), []);
  assert.equal(gameState.ruleState.processStack.at(-1).type, PROCESS_TYPE.MAIN_PHASE);
  assert.throws(
    () => engine.playCharacterToStage(cards.climax, "self", { row: "front", index: 1 }),
    /CHARACTER/,
  );
  assert.equal(gameState.ruleState.processStack.length, 1);
  assert.equal(gameState.ruleState.processStack.at(-1).type, PROCESS_TYPE.MAIN_PHASE);
});

test("MAIN手札選択はタイミング・ターン・所属zoneの制約を維持する", () => {
  const { engine, gameState, cards, card } = createFixture();
  const outsideHand = card("playable", "self", ZONE.STAGE);
  assert.equal(engine.canSelectCardForMain(outsideHand, "self"), false);
  assert.equal(engine.canSelectCardForMain(cards.playable, "opponent"), false);
  gameState.turn.player = "opponent";
  assert.equal(engine.canSelectCardForMain(cards.playable, "self"), false);
  gameState.turn.player = "self";
  gameState.ruleState.processStack.at(-1).status = PROCESS_STATUS.RUNNING;
  assert.equal(engine.canSelectCardForMain(cards.playable, "self"), false);
  gameState.ruleState.processStack.at(-1).status = PROCESS_STATUS.WAITING_INPUT;
  gameState.phase = PHASE.CLIMAX;
  assert.equal(engine.canSelectCardForMain(cards.playable, "self"), false);
});
