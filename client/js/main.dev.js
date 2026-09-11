/**
 * Renderer / GameEngine v2の開発確認用エントリーポイント。
 * 通信は使用せず、各プレイヤーにテスト用山札を用意する。
 */

import { Renderer } from "./core/renderer.js";
import { GameEngine } from "./core/gameEngine.js";
import { ProcessManager } from "./core/processManager.js";
import { GameStartController } from "./ui/gameStartController.js";
import { MulliganController } from "./ui/mulliganController.js";
import { ClockController } from "./ui/clockController.js";
import { MainPhaseController } from "./ui/mainPhaseController.js";
import { LevelUpController } from "./ui/levelUpController.js";
import { DevController } from "./ui/devController.js";
import { GameState } from "./models/gameState.js";
import { Player } from "./models/player.js";
import { Card } from "./models/card.js";
import { Deck } from "./models/deck.js";
import { ZONE } from "./constants/zone.js";
import { PROCESS_STATUS, PROCESS_TYPE } from "./constants/process.js";
import { DEFEAT_REASON, RULE_CHECK_RESULT } from "./constants/ruleCheck.js";

const TEST_DECK_SIZE = 50;
const AUTOMATIC_OPPONENT_MULLIGAN_DELAY_MS = 3000;

/**
 * 手札からランダムな枚数の重複しないインデックスを選ぶ。
 * GameEngine.mulligan() の契約に合わせ、インデックスは1始まりとする。
 *
 * @param {number} handSize
 * @returns {number[]}
 */
function createRandomMulliganIndexes(handSize) {
  if (!Number.isInteger(handSize) || handSize < 0) {
    throw new TypeError("handSize must be a non-negative integer.");
  }

  const exchangeCount = Math.floor(Math.random() * (handSize + 1));
  const indexes = Array.from({ length: handSize }, (_unused, index) => index + 1);

  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [indexes[index], indexes[randomIndex]] = [
      indexes[randomIndex],
      indexes[index],
    ];
  }

  return indexes
    .slice(0, exchangeCount)
    .sort((left, right) => left - right);
}

/**
 * @param {'self'|'opponent'} owner
 * @param {number} sequence
 * @returns {Card}
 */
function createTestCard(owner, sequence) {
  return new Card({
    id: `${owner}-test-card-${String(sequence).padStart(3, "0")}`,
    name: `${owner === "self" ? "自分" : "相手"}テストカード ${sequence}`,
    cardType: "character",
    level: 0,
    cost: 0,
    color: "yellow",
    basePower: 1000,
    baseSoul: 1,
    trigger: [],
    traits: ["テスト"],
    text: "",
    owner,
    zone: ZONE.DECK,
    row: null,
    index: null,
    position: "stand",
  });
}

/**
 * 開発確認用の独立したCardインスタンスで山札を作成する。
 *
 * @param {'self'|'opponent'} owner
 * @param {number} [count=TEST_DECK_SIZE]
 * @returns {Deck}
 */
function createTestDeck(owner, count = TEST_DECK_SIZE) {
  if (!Number.isInteger(count) || count < 0) {
    throw new TypeError("count must be a non-negative integer.");
  }

  const cards = Array.from({ length: count }, (_unused, index) =>
    createTestCard(owner, index + 1),
  );

  return new Deck(cards);
}

const selfDeck = createTestDeck("self");
const opponentDeck = createTestDeck("opponent");

const self = new Player({
  id: "self",
  name: "あなた",
  deck: selfDeck,
});

const opponent = new Player({
  id: "opponent",
  name: "相手",
  deck: opponentDeck,
});

const gameState = new GameState({
  self,
  opponent,
});

const renderer = new Renderer(document);
const card1 = selfDeck.cards[0];

const processManager = new ProcessManager(gameState);

const gameEngine = new GameEngine({
  gameState,
  renderer,
  processManager,
});

const gameStartController = new GameStartController({
  gameEngine,
  gameState,
  rootElement: document,
});

gameStartController.init();

const mulliganController = new MulliganController({
  gameEngine,
  gameState,
  rootElement: document,
});

mulliganController.init();

const clockController = new ClockController({
  gameEngine,
  gameState,
  rootElement: document,
});

clockController.init();

const mainPhaseController = new MainPhaseController({
  gameEngine,
  gameState,
  renderer,
  rootElement: document,
});
mainPhaseController.init();

const levelUpController = new LevelUpController({
  gameEngine,
  gameState,
  processManager,
  rootElement: document,
});

levelUpController.init();

const devController = new DevController({
  gameEngine,
  gameState,
  renderer,
  rootElement: document,
});

devController.init();

let automaticOpponentMulliganCompleted = false;

/**
 * 開発環境で後攻プレイヤーのマリガンを一度だけ自動実行する。
 * GameEngineには判断ロジックを持たせず、公開APIだけを利用する。
 *
 * @returns {Promise<void>}
 */
async function syncAutomaticOpponentMulligan() {
  const { active, currentPlayer } = gameState.mulliganState;

  if (active && currentPlayer === "self") {
    automaticOpponentMulliganCompleted = false;
    return;
  }

  if (
    !active ||
    currentPlayer !== "opponent" ||
    automaticOpponentMulliganCompleted
  ) {
    return;
  }

  automaticOpponentMulliganCompleted = true;
  await new Promise((resolve) =>
    setTimeout(resolve, AUTOMATIC_OPPONENT_MULLIGAN_DELAY_MS),
  );

  if (
    gameState.mulliganState.active !== true ||
    gameState.mulliganState.currentPlayer !== "opponent"
  ) {
    return;
  }

  const handSize = gameState.players.opponent.hand.length;
  const selectedIndexes = createRandomMulliganIndexes(handSize);

  console.info(
    `Opponent automatically Mulliganed ${selectedIndexes.length} card(s).`,
    { selectedIndexes },
  );

  try {
    gameEngine.mulligan("opponent", selectedIndexes);
  } catch (error) {
    automaticOpponentMulliganCompleted = false;
    console.error("Automatic opponent Mulligan failed.", error);
  }
}

gameEngine.onRender(syncAutomaticOpponentMulligan);

renderer.render(gameState);

window.card1 = card1;
window.renderer = renderer;
window.gameState = gameState;
window.Card = Card;
window.gameEngine = gameEngine;
window.processManager = processManager;
window.PROCESS_TYPE = PROCESS_TYPE;
window.PROCESS_STATUS = PROCESS_STATUS;
window.RULE_CHECK_RESULT = RULE_CHECK_RESULT;
window.DEFEAT_REASON = DEFEAT_REASON;
window.gameStartController = gameStartController;
window.mulliganController = mulliganController;
window.clockController = clockController;
window.mainPhaseController = mainPhaseController;
window.levelUpController = levelUpController;
window.devController = devController;
