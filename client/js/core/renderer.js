import { ZONE } from "../constants/zone.js";

const OWNERS = Object.freeze(["self", "opponent"]);
const DEFAULT_FACE = Object.freeze({
  [ZONE.DECK]: "down",
  [ZONE.HAND]: "up",
  [ZONE.STAGE]: "up",
  [ZONE.CLOCK]: "up",
  [ZONE.LEVEL]: "up",
  [ZONE.STOCK]: "down",
  [ZONE.CLIMAX]: "up",
  [ZONE.WAITING_ROOM]: "up",
  [ZONE.MEMORY]: "up",
});

/**
 * GameStateの現在状態を、board v6.0の固定カード枠へ反映する。
 * ゲーム状態の変更やルール判定、入力イベントの処理は行わない。
 */
export class Renderer {
  /**
   * @param {ParentNode|null} rootElement 描画対象を含むルート要素
   */
  constructor(rootElement) {
    this.rootElement = rootElement ?? null;
  }

  /**
   * 両プレイヤーの現在状態を描画する。
   *
   * @param {import("../models/gameState.js").GameState|null|undefined} gameState
   * @returns {void}
   */
  render(gameState) {
    if (!this.rootElement) {
      return;
    }

    this.clear();
    this.renderLog(gameState);
    this.updateMessageOverlay(gameState);
    this.updateTurnEndButton(gameState);

    if (!gameState || typeof gameState !== "object") {
      return;
    }

    this.renderPlayer(gameState.players?.self, "self");
    this.renderPlayer(gameState.players?.opponent, "opponent");
  }

  /**
   * GameStateの値だけを使用してメッセージオーバーレイを描画する。
   *
   * @param {import("../models/gameState.js").GameState|null|undefined} gameState
   * @returns {void}
   */
  updateMessageOverlay(gameState) {
    const overlay = this.rootElement?.querySelector("[data-message-overlay]");
    if (!(overlay instanceof HTMLElement)) {
      return;
    }

    const state = gameState?.messageOverlay;
    const visible = state?.visible === true;
    const title = state?.title == null ? "" : String(state.title);
    const message = state?.message == null ? "" : String(state.message);
    const titleElement = overlay.querySelector("[data-message-overlay-title]");
    const messageElement = overlay.querySelector("[data-message-overlay-message]");

    overlay.hidden = !visible;
    overlay.setAttribute("aria-hidden", String(!visible));

    if (titleElement) {
      titleElement.textContent = title;
      titleElement.hidden = title.length === 0;
    }

    if (messageElement) {
      messageElement.textContent = message;
      messageElement.hidden = message.length === 0;
    }
  }

  /**
   * 通常ターン開始状態に基づいて、既存のターン終了ボタンを表示する。
   *
   * @param {import("../models/gameState.js").GameState|null|undefined} gameState
   * @returns {void}
   */
  updateTurnEndButton(gameState) {
    const button = this.rootElement?.querySelector('[data-action="end-turn"]');
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const normalPlayActive =
      gameState?.started === true &&
      gameState?.mulliganState?.active !== true;

    button.hidden = !normalPlayActive;
  }

  /**
   * GameStateのログを既存のログ領域へ時系列順に描画する。
   * 描画前にログ項目だけを消去するため、再描画しても重複しない。
   *
   * @param {import("../models/gameState.js").GameState|null|undefined} gameState
   * @returns {void}
   */
  renderLog(gameState) {
    const logList = this.rootElement?.querySelector(".game-log");

    if (!logList) {
      return;
    }

    logList.replaceChildren();

    const log = Array.isArray(gameState?.log) ? gameState.log : [];

    if (log.length === 0) {
      this.appendLogItem(logList, "ゲーム開始待機中");
      return;
    }

    log.forEach((entry) => {
      if (!entry || typeof entry !== "object") {
        return;
      }

      const parts = [];
      const time = this.formatLogTime(entry.time);
      const playerName = this.resolveLogPlayerName(entry.player, gameState);
      const message = entry.message == null ? "" : String(entry.message);

      if (time) {
        parts.push(`[${time}]`);
      }

      if (playerName) {
        parts.push(playerName);
      }

      if (message) {
        parts.push(message);
      }

      this.appendLogItem(logList, parts.join(" "));
    });

    if (!logList.firstElementChild) {
      this.appendLogItem(logList, "ゲーム開始待機中");
    }
  }

  /**
   * @param {Element} logList
   * @param {string} text
   * @returns {void}
   */
  appendLogItem(logList, text) {
    const listItem = logList.ownerDocument?.createElement("li");

    if (!listItem) {
      return;
    }

    listItem.textContent = text;
    logList.appendChild(listItem);
  }

  /**
   * @param {unknown} value
   * @returns {string}
   */
  formatLogTime(value) {
    if (value == null) {
      return "";
    }

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }

  /**
   * @param {unknown} player
   * @param {import("../models/gameState.js").GameState|null|undefined} gameState
   * @returns {string}
   */
  resolveLogPlayerName(player, gameState) {
    if (player === "self" || player === "opponent") {
      const playerName = gameState?.players?.[player]?.name;
      if (typeof playerName === "string" && playerName.trim()) {
        return playerName;
      }

      return player;
    }

    if (typeof player === "string" && player.trim() && player !== "system") {
      return player;
    }

    return "システム";
  }

  /**
   * Rendererが利用する固定カード枠を空表示へ戻す。
   *
   * @returns {void}
   */
  clear() {
    for (const owner of OWNERS) {
      const slots = this.querySlots(owner);

      slots.forEach((slot) => {
        slot.dataset.cardId = "";
        slot.dataset.face =
          slot.dataset.zone === ZONE.HAND && owner === "opponent"
            ? "down"
            : DEFAULT_FACE[slot.dataset.zone] ?? "up";
        slot.dataset.position = "stand";
        slot.style.removeProperty("z-index");
        slot.removeAttribute("title");
        slot.textContent = "";
      });
    }
  }

  /**
   * 1人分の全ゾーンを描画する。
   *
   * @param {import("../models/player.js").Player|null|undefined} player
   * @param {'self'|'opponent'} owner
   * @returns {void}
   */
  renderPlayer(player, owner) {
    if (!player || !OWNERS.includes(owner)) {
      return;
    }

    this.renderHand(player, owner);
    this.renderStage(player, owner);
    this.renderClock(player, owner);
    this.renderLevel(player, owner);
    this.renderStock(player, owner);
    this.renderDeck(player, owner);
    this.renderWaitingRoom(player, owner);
    this.renderMemory(player, owner);
    this.renderClimax(player, owner);
    this.renderPlayerInfo(player, owner);
  }

  /**
   * @param {import("../models/player.js").Player} player
   * @param {'self'|'opponent'} owner
   * @returns {void}
   */
  renderHand(player, owner) {
    this.renderFixedSlots(player.hand, owner, ZONE.HAND, 7);
  }

  /**
   * @param {import("../models/player.js").Player} player
   * @param {'self'|'opponent'} owner
   * @returns {void}
   */
  renderStage(player, owner) {
    const cards = this.asArray(player.stage);

    cards.forEach((card) => {
      if (!card || card.row == null || card.index == null) {
        return;
      }

      const slot = this.querySlot(owner, ZONE.STAGE, card.index, card.row);
      if (slot) {
        this.renderCard(slot, card, owner, ZONE.STAGE, card.index, card.row);
      }
    });
  }

  /**
   * @param {import("../models/player.js").Player} player
   * @param {'self'|'opponent'} owner
   * @returns {void}
   */
  renderClock(player, owner) {
    this.renderFixedSlots(player.clock, owner, ZONE.CLOCK);
  }

  /**
   * @param {import("../models/player.js").Player} player
   * @param {'self'|'opponent'} owner
   * @returns {void}
   */
  renderLevel(player, owner) {
    this.renderFixedSlots(player.level, owner, ZONE.LEVEL);
  }

  /**
   * @param {import("../models/player.js").Player} player
   * @param {'self'|'opponent'} owner
   * @returns {void}
   */
  renderStock(player, owner) {
    this.renderFixedSlots(player.stock, owner, ZONE.STOCK);
  }

  /**
   * 山札の先頭カードを代表表示し、枚数表示を更新する。
   *
   * @param {import("../models/player.js").Player} player
   * @param {'self'|'opponent'} owner
   * @returns {void}
   */
  renderDeck(player, owner) {
    const cards = this.asArray(player.deck?.cards);
    this.renderRepresentative(cards, owner, ZONE.DECK, "first");
  }

  /**
   * 控え室の最後のカードを代表表示し、枚数表示を更新する。
   *
   * @param {import("../models/player.js").Player} player
   * @param {'self'|'opponent'} owner
   * @returns {void}
   */
  renderWaitingRoom(player, owner) {
    this.renderRepresentative(
      this.asArray(player.waitingRoom),
      owner,
      ZONE.WAITING_ROOM,
      "last",
    );
  }

  /**
   * 思い出の最後のカードを代表表示し、枚数表示を更新する。
   *
   * @param {import("../models/player.js").Player} player
   * @param {'self'|'opponent'} owner
   * @returns {void}
   */
  renderMemory(player, owner) {
    this.renderRepresentative(
      this.asArray(player.memory),
      owner,
      ZONE.MEMORY,
      "last",
    );
  }

  /**
   * @param {import("../models/player.js").Player} player
   * @param {'self'|'opponent'} owner
   * @returns {void}
   */
  renderClimax(player, owner) {
    this.renderFixedSlots(player.climax, owner, ZONE.CLIMAX, 1);
  }

  /**
   * 固定スロットへ配列順、またはCard.indexに基づいて描画する。
   *
   * @param {unknown} value
   * @param {'self'|'opponent'} owner
   * @param {string} zone
   * @param {number} [limit=Infinity]
   * @returns {void}
   */
  renderFixedSlots(value, owner, zone, limit = Infinity) {
    const cards = this.asArray(value).slice(0, limit);
    const slots = this.querySlots(owner, zone).sort(
      (left, right) => Number(left.dataset.index) - Number(right.dataset.index),
    );
    const occupiedSlots = new Set();

    cards.forEach((card, arrayIndex) => {
      if (!card) {
        return;
      }

      const requestedIndex =
        Number.isInteger(card.index) && card.index > 0
          ? card.index
          : arrayIndex + 1;
      const slot =
        slots.find(
          (candidate) =>
            Number(candidate.dataset.index) === requestedIndex &&
            !occupiedSlots.has(candidate),
        ) ??
        slots.find((candidate) => !occupiedSlots.has(candidate));

      if (slot) {
        occupiedSlots.add(slot);
        this.renderCard(slot, card, owner, zone, slot.dataset.index);
        slot.style.zIndex = String(arrayIndex + 1);
      }
    });
  }

  /**
   * 1枚用の既存枠へゾーンの代表カードを描画する。
   *
   * @param {unknown[]} cards
   * @param {'self'|'opponent'} owner
   * @param {string} zone
   * @param {'first'|'last'} edge
   * @returns {void}
   */
  renderRepresentative(cards, owner, zone, edge) {
    if (cards.length === 0) {
      return;
    }

    const card = edge === "first" ? cards[0] : cards[cards.length - 1];
    const slot = this.querySlots(owner, zone)[0];

    if (card && slot) {
      this.renderCard(slot, card, owner, zone, 1);
    }
  }

  /**
   * カード情報を既存の固定枠へ反映する。
   *
   * @param {HTMLElement} slot
   * @param {object} card
   * @param {'self'|'opponent'} owner
   * @param {string} zone
   * @param {number|string} index
   * @param {string|null} [row=null]
   * @returns {void}
   */
  renderCard(slot, card, owner, zone, index, row = null) {
    slot.dataset.cardId = card.id == null ? "" : String(card.id);
    slot.dataset.owner = owner;
    slot.dataset.zone = zone;
    slot.dataset.index = String(index);
    slot.dataset.face =
      typeof card.face === "string" ? card.face : DEFAULT_FACE[zone] ?? "up";
    slot.dataset.position =
      typeof card.position === "string" ? card.position : "stand";

    if (zone === ZONE.STAGE && row != null) {
      slot.dataset.row = String(row);
    }

    const label =
      typeof card.name === "string" && card.name.trim()
        ? card.name
        : slot.dataset.cardId;
    slot.textContent = label;
    if (label) {
      slot.title = label;
    }
  }

  /**
   * サイドバーにある既存のプレイヤー情報欄を更新する。
   *
   * @param {import("../models/player.js").Player} player
   * @param {'self'|'opponent'} owner
   * @returns {void}
   */
  renderPlayerInfo(player, owner) {
    const panelSelector = owner === "self" ? ".self-info" : ".opponent-info";
    const values = this.rootElement.querySelectorAll(
      `${panelSelector} .player-status-item dd`,
    );

    const counts = [
      player.name ?? "",
      `${this.asArray(player.hand).length}枚`,
      `${this.asArray(player.deck?.cards).length}枚`,
      `${this.asArray(player.waitingRoom).length}枚`,
      `${this.asArray(player.memory).length}枚`,
      `${this.asArray(player.stock).length}枚`,
    ];

    counts.forEach((value, index) => {
      if (values[index]) {
        values[index].textContent = value;
      }
    });
  }

  /**
   * @param {'self'|'opponent'} owner
   * @param {string|null} [zone=null]
   * @returns {HTMLElement[]}
   */
  querySlots(owner, zone = null) {
    if (!this.rootElement || !OWNERS.includes(owner)) {
      return [];
    }

    const zoneSelector = zone == null ? "" : `[data-zone="${zone}"]`;
    return Array.from(
      this.rootElement.querySelectorAll(
        `[data-owner="${owner}"]${zoneSelector}.card-slot`,
      ),
    );
  }

  /**
   * @param {'self'|'opponent'} owner
   * @param {string} zone
   * @param {number|string} index
   * @param {string|null} [row=null]
   * @returns {HTMLElement|null}
   */
  querySlot(owner, zone, index, row = null) {
    const rowSelector = row == null ? "" : `[data-row="${row}"]`;
    return (
      this.rootElement?.querySelector(
        `[data-owner="${owner}"][data-zone="${zone}"]${rowSelector}` +
          `[data-index="${index}"].card-slot`,
      ) ?? null
    );
  }

  /**
   * @param {unknown} value
   * @returns {unknown[]}
   */
  asArray(value) {
    return Array.isArray(value) ? value : [];
  }
}
