import { Deck } from "./deck.js";

/**
 * プレイヤー情報と、そのプレイヤーが所有する各ゾーンを管理する。
 * ゾーン配列は、実際にカードが置かれた順を保持する。
 */
export class Player {
  /**
   * @param {object} params
   * @param {string} params.id
   * @param {string} params.name
   * @param {Deck} [params.deck=new Deck()]
   */
  constructor({ id, name, deck = new Deck() }) {
    if (typeof id !== "string" || id.trim().length === 0) {
      throw new TypeError("id must be a non-empty string.");
    }

    if (typeof name !== "string" || name.trim().length === 0) {
      throw new TypeError("name must be a non-empty string.");
    }

    if (!(deck instanceof Deck)) {
      throw new TypeError("deck must be a Deck instance.");
    }

    /** @type {string} */
    this.id = id;
    /** @type {string} */
    this.name = name;
    /** @type {Deck} */
    this.deck = deck;

    /** @type {import("./card.js").Card[]} */
    this.hand = [];
    /** @type {import("./card.js").Card[]} */
    this.stage = [];
    /** @type {import("./card.js").Card[]} */
    this.clock = [];
    /** @type {import("./card.js").Card[]} */
    this.level = [];
    /** @type {import("./card.js").Card[]} */
    this.stock = [];
    /** @type {import("./card.js").Card[]} */
    this.waitingRoom = [];
    /** @type {import("./card.js").Card[]} */
    this.memory = [];
    /** @type {import("./card.js").Card[]} */
    this.climax = [];
  }
}
