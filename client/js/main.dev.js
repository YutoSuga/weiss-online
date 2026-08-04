/**
 * 開発用エントリーポイント
 *
 * Renderer / GameEngine の開発確認用。
 * 通信は使用しない。
 *
 * 確認項目：
 * - 手札
 * - 舞台
 * - クロック
 * - レベル
 * - ストック
 * - 山札
 * - 控え室
 * - 思い出
 * - クライマックス
 * - render() の再実行
 * - render(null)
 */

import { Renderer } from "./core/renderer.js";
import { GameEngine } from "./core/gameEngine.js";

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

const card1 = new Card({
  id: "test-card-001",
  name: "テストカード1",
  cardType: "character",
  level: 0,
  cost: 0,
  color: "yellow",
  basePower: 1000,
  baseSoul: 1,
  trigger: [],
  traits: ["テスト"],
  text: "",
  owner: "self",
  zone: "deck",
  row: null,
  index: 1,
  face: "down",
  position: "stand",
});

self.deck.addTop(card1);

const opponentCard1 = new Card({
  id: "opponent-test-001",
  name: "相手テストカード1",
  cardType: "character",
  level: 0,
  cost: 0,
  color: "yellow",
  basePower: 1000,
  baseSoul: 1,
  trigger: [],
  traits: ["テスト"],
  text: "",
  owner: "opponent",
  zone: "deck",
  row: null,
  index: null,
  face: "down",
  position: "stand",
});

gameState.players.opponent.deck.addTop(opponentCard1);

const gameEngine = new GameEngine({
  gameState,
  renderer,
});

renderer.render(gameState);

window.card1 = card1;

// ===== 開発確認用 =====
window.renderer = renderer;
window.gameState = gameState;
window.Card = Card;
window.gameEngine = gameEngine;
