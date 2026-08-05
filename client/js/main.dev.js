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

const self = new Player({
  id: "self",
  name: "あなた",
});

const opponent = new Player({
  id: "opponent",
  name: "相手",
});

const gameState = new GameState({
  self,
  opponent,
});

const renderer = new Renderer(document);

/**
 * @param {'self'|'opponent'} owner
 * @param {number} sequence
 * @returns {Card}
 */
function createTestCard(owner, sequence) {
  return new Card({
    id: `${owner}-test-${String(sequence).padStart(3, "0")}`,
    name: `${owner === "self" ? "自分" : "相手"}テストカード${sequence}`,
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
    zone: "deck",
    row: null,
    index: null,
    face: "down",
    position: "stand",
  });
}

const card1 = createTestCard("self", 1);
self.deck.addBottom(card1);

for (let sequence = 2; sequence <= 10; sequence += 1) {
  self.deck.addBottom(createTestCard("self", sequence));
}

for (let sequence = 1; sequence <= 10; sequence += 1) {
  opponent.deck.addBottom(createTestCard("opponent", sequence));
}

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
