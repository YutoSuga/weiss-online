import { Card } from "./card.js";

/**
 * 山札と、その基本操作を管理する。
 */
export class Deck {
  /**
   * @param {Card[]} [cards=[]] 上から下の順に並んだカード
   */
  constructor(cards = []) {
    if (!Array.isArray(cards) || cards.some((card) => !(card instanceof Card))) {
      throw new TypeError("cards must be an array of Card instances.");
    }

    /** @type {Card[]} */
    this.cards = [...cards];
  }

  /**
   * 山札の一番上からカードを引く。
   *
   * @returns {Card|null} 山札が空の場合はnull
   */
  draw() {
    return this.cards.shift() ?? null;
  }

  /**
   * Fisher-Yates法で山札をシャッフルする。
   *
   * @param {() => number} [random=Math.random] テスト時に差し替え可能な乱数関数
   * @returns {Deck}
   */
  shuffle(random = Math.random) {
    if (typeof random !== "function") {
      throw new TypeError("random must be a function.");
    }

    for (let index = this.cards.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [this.cards[index], this.cards[swapIndex]] = [
        this.cards[swapIndex],
        this.cards[index],
      ];
    }

    return this;
  }

  /**
   * 山札の上から指定枚数を、取り除かずに確認する。
   *
   * @param {number} [count=1]
   * @returns {Card[]}
   */
  peek(count = 1) {
    if (!Number.isInteger(count) || count < 0) {
      throw new TypeError("count must be a non-negative integer.");
    }

    return this.cards.slice(0, count);
  }

  /**
   * カードを山札の一番上へ加える。
   *
   * @param {Card} card
   * @returns {Deck}
   */
  addTop(card) {
    this.#assertCard(card);
    this.cards.unshift(card);
    return this;
  }

  /**
   * カードを山札の一番下へ加える。
   *
   * @param {Card} card
   * @returns {Deck}
   */
  addBottom(card) {
    this.#assertCard(card);
    this.cards.push(card);
    return this;
  }

  /**
   * @param {unknown} card
   * @throws {TypeError}
   */
  #assertCard(card) {
    if (!(card instanceof Card)) {
      throw new TypeError("card must be a Card instance.");
    }
  }
}
