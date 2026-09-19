import { CardMaster } from "./cardMaster.js";

/** 読み込み済みCardMasterをMaster IDで引くためのメモリ上のRegistry。 */
export class CardMasterRegistry {
  #masters = new Map();

  /** @param {CardMaster} master */
  register(master) {
    if (!(master instanceof CardMaster)) {
      throw new TypeError("master must be a CardMaster instance.");
    }
    if (this.#masters.has(master.id)) {
      throw new Error(`CardMaster "${master.id}" is already registered.`);
    }
    this.#masters.set(master.id, master);
    return master;
  }

  /** @param {string} masterId @returns {CardMaster} */
  get(masterId) {
    const master = this.#masters.get(masterId);
    if (!master) {
      throw new Error(`CardMaster "${String(masterId)}" is not registered.`);
    }
    return master;
  }

  /** @param {string} masterId @returns {boolean} */
  has(masterId) {
    return this.#masters.has(masterId);
  }

  /** @returns {readonly CardMaster[]} */
  getAll() {
    return Object.freeze([...this.#masters.values()]);
  }
}
