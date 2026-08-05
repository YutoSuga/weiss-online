/**
 * Renderer / GameEngine v2の開発確認用エントリーポイント。
 * 通信は使用せず、各プレイヤーにテスト用山札を用意する。
 */

import { Renderer } from "./core/renderer.js";
import { GameEngine } from "./core/gameEngine.js";
import { GameStartController } from "./ui/gameStartController.js";
import { GameState } from "./models/gameState.js";
import { Player } from "./models/player.js";
import { Card } from "./models/card.js";
import { Deck } from "./models/deck.js";
import { ZONE } from "./constants/zone.js";

const TEST_DECK_SIZE = 50;

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
    face: "down",
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

const gameEngine = new GameEngine({
  gameState,
  renderer,
});

const gameStartController = new GameStartController({
  gameEngine,
  gameState,
  rootElement: document,
});

gameStartController.init();

renderer.render(gameState);

window.card1 = card1;
window.renderer = renderer;
window.gameState = gameState;
window.Card = Card;
window.gameEngine = gameEngine;
window.gameStartController = gameStartController;
