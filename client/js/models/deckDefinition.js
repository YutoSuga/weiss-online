/** 対戦開始前のデッキ内容（CardMaster IDと枚数）を表すimmutableな定義。 */
export class DeckDefinition {
  constructor({ id, name, cards } = {}) {
    assertNonEmptyString("id", id);
    assertNonEmptyString("name", name);
    if (!Array.isArray(cards)) throw new TypeError("cards must be an array.");

    this.id = id;
    this.name = name;
    this.cards = Object.freeze(cards.map((entry, index) => {
      if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
        throw new TypeError(`cards[${index}] must be an object.`);
      }
      assertNonEmptyString(`cards[${index}].masterId`, entry.masterId);
      if (!Number.isInteger(entry.count) || entry.count < 0) {
        throw new TypeError(`cards[${index}].count must be a non-negative integer.`);
      }
      return Object.freeze({ masterId: entry.masterId, count: entry.count });
    }));
    Object.freeze(this);
  }
}

function assertNonEmptyString(name, value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string.`);
  }
}
