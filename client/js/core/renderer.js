import { VISIBILITY, ZONE, ZONE_VISIBILITY } from "../constants/zone.js";
import { PHASE } from "../constants/phase.js";
import { FACE } from "../models/card.js";

const OWNERS = Object.freeze(["self", "opponent"]);
const TURN_PLAYER_LABELS = Object.freeze({
  self: "あなた",
  opponent: "相手",
});
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
 * GameStateの現在状態を、board v6.0のカード枠へ反映する。
 * ゲーム状態の変更やルール判定、入力イベントの処理は行わない。
 */
export class Renderer {
  /**
   * @param {ParentNode|null} rootElement 描画対象を含むルート要素
   * @param {{viewerId?: 'self'|'opponent'}} [options] 描画視点
   */
  constructor(rootElement, { viewerId = "self" } = {}) {
    this.rootElement = rootElement ?? null;
    this.viewerId = OWNERS.includes(viewerId) ? viewerId : "self";
    /** @type {WeakMap<HTMLElement, () => void>} */
    this.handScrollHandlers = new WeakMap();
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
    this.updatePhaseBar(gameState);
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
   * 現在ターンと通常フェイズを固定フェイズバーへ反映する。
   * DOM構造は生成せず、既存要素の表示状態だけを更新する。
   *
   * @param {import("../models/gameState.js").GameState|null|undefined} gameState
   * @returns {void}
   */
  updatePhaseBar(gameState) {
    const phaseBar = this.rootElement?.querySelector('[data-role="phase-bar"]');
    if (!(phaseBar instanceof HTMLElement)) {
      return;
    }

    const started = gameState?.started === true;
    const turnNumber = Number.isInteger(gameState?.turn?.number)
      ? gameState.turn.number
      : null;
    const playerLabel = TURN_PLAYER_LABELS[gameState?.turn?.player] ?? "-";
    const turnElement = phaseBar.querySelector("[data-phase-bar-turn]");

    if (turnElement) {
      turnElement.textContent = started
        ? `Turn ${turnNumber ?? "-"}　${playerLabel}`
        : "Turn -";
    }

    const currentPhase = started
      ? gameState?.phase === PHASE.ENCORE
        ? PHASE.ATTACK
        : gameState?.phase
      : null;

    phaseBar.querySelectorAll("[data-phase]").forEach((phaseElement) => {
      const isCurrent =
        currentPhase != null && phaseElement.dataset.phase === currentPhase;
      phaseElement.classList.toggle("is-current", isCurrent);

      if (isCurrent) {
        phaseElement.setAttribute("aria-current", "step");
      } else {
        phaseElement.removeAttribute("aria-current");
      }
    });
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
   * Rendererが利用する現在のカード枠を空表示へ戻す。
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
    const cards = this.asArray(player.hand);
    this.syncHandSlots(owner, cards.length);
    this.renderFixedSlots(cards, owner, ZONE.HAND);
  }

  /**
   * GameStateの手札枚数と同数になるよう表示スロットを同期する。
   * 手札のdata-indexは既存仕様どおり1始まりとする。
   *
   * @param {'self'|'opponent'} owner
   * @param {number} cardCount
   * @returns {void}
   */
  syncHandSlots(owner, cardCount) {
    const container = this.rootElement?.querySelector(
      `.${owner}-hand .hand-slots`,
    );
    if (!(container instanceof HTMLElement)) {
      return;
    }

    const handArea = container.closest(".hand-area");
    if (handArea instanceof HTMLElement) {
      this.updateHandAreaWidth(handArea, cardCount);
    }

    const existingSlots = [...container.querySelectorAll(
      `.card-slot[data-owner="${owner}"][data-zone="${ZONE.HAND}"]`,
    )];

    existingSlots.slice(cardCount).forEach((slot) => slot.remove());

    for (let index = existingSlots.length + 1; index <= cardCount; index += 1) {
      const slot = container.ownerDocument.createElement("article");
      slot.className = "card-slot";
      slot.dataset.owner = owner;
      slot.dataset.zone = ZONE.HAND;
      slot.dataset.index = String(index);
      slot.dataset.face = owner === "opponent" ? "down" : "up";
      slot.dataset.position = "stand";
      slot.dataset.cardId = "";
      container.append(slot);
    }

    if (handArea instanceof HTMLElement) {
      this.bindHandScroll(container, handArea);
      this.updateHandScrollIndicators(container, handArea);
    }
  }

  /**
   * 手札スクロール位置の監視を一度だけ登録する。
   * グラデーション表示だけを更新し、GameStateは変更しない。
   *
   * @param {HTMLElement} container
   * @param {HTMLElement} handArea
   * @returns {void}
   */
  bindHandScroll(container, handArea) {
    if (this.handScrollHandlers.has(container)) {
      return;
    }

    const handleScroll = () => {
      this.updateHandScrollIndicators(container, handArea);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    this.handScrollHandlers.set(container, handleScroll);
  }

  /**
   * 手札スクロール領域の左右に未表示カードがあるかを属性へ反映する。
   * 端判定の丸め誤差は1pxまで許容する。
   *
   * @param {HTMLElement} container
   * @param {HTMLElement} handArea
   * @returns {void}
   */
  updateHandScrollIndicators(container, handArea) {
    const maximumScrollLeft = Math.max(
      0,
      container.scrollWidth - container.clientWidth,
    );
    const isScrollable =
      handArea.dataset.handScrollable === "true" && maximumScrollLeft > 1;
    const canScrollLeft = isScrollable && container.scrollLeft > 1;
    const canScrollRight =
      isScrollable && container.scrollLeft < maximumScrollLeft - 1;

    handArea.dataset.handCanScrollLeft = String(canScrollLeft);
    handArea.dataset.handCanScrollRight = String(canScrollRight);
  }

  /**
   * CSS変数の実寸値から手札枠の幅を確定する。
   * unitlessカスタムプロパティのCSS乗算に依存せず、ブラウザ間で同じ幅にする。
   *
   * @param {HTMLElement} handArea
   * @param {number} cardCount
   * @returns {void}
   */
  updateHandAreaWidth(handArea, cardCount) {
    const view = handArea.ownerDocument?.defaultView;
    if (!view || typeof view.getComputedStyle !== "function") {
      return;
    }

    const styles = view.getComputedStyle(handArea);
    const cardWidth = Number.parseFloat(
      styles.getPropertyValue("--hand-card-w"),
    );
    const gap = Number.parseFloat(styles.getPropertyValue("--hand-gap"));
    const inlineSpace = Number.parseFloat(
      styles.getPropertyValue("--hand-inline-space"),
    );
    const minimumCount = Number.parseInt(
      styles.getPropertyValue("--hand-visible-min"),
      10,
    );
    const targetMaximumCount = Number.parseInt(
      styles.getPropertyValue("--hand-visible-target"),
      10,
    );
    const safeMaximumWidth = Number.parseFloat(styles.maxWidth);

    if (
      ![
        cardWidth,
        gap,
        inlineSpace,
        minimumCount,
        targetMaximumCount,
        safeMaximumWidth,
      ].every(Number.isFinite)
    ) {
      return;
    }

    const safeMaximumCount = Math.max(
      1,
      Math.floor(
        (safeMaximumWidth - inlineSpace + gap) / (cardWidth + gap),
      ),
    );
    const maximumCount = Math.min(targetMaximumCount, safeMaximumCount);
    const visibleCount = Math.min(
      maximumCount,
      Math.max(minimumCount, cardCount),
    );
    const requiredWidth = cardWidth * visibleCount +
      gap * Math.max(visibleCount - 1, 0) +
      inlineSpace;
    const width = Math.min(requiredWidth, safeMaximumWidth);

    handArea.style.setProperty("--hand-current-w", `${width}px`);
    handArea.dataset.handCardCount = String(cardCount);
    handArea.dataset.handVisibleCount = String(visibleCount);
    handArea.dataset.handScrollable = String(cardCount > visibleCount);
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
    this.syncClockSlots(owner, this.asArray(player.clock).length);
    this.renderFixedSlots(player.clock, owner, ZONE.CLOCK);
  }

  /**
   * 7枚を超えるクロックも表示できるよう、超過分の表示スロットを同期する。
   * 固定の1～7番スロットはHTML側に保持する。
   *
   * @param {'self'|'opponent'} owner
   * @param {number} cardCount
   * @returns {void}
   */
  syncClockSlots(owner, cardCount) {
    const container = this.rootElement?.querySelector(
      `.${owner}-clock .clock-slots`,
    );
    if (!(container instanceof HTMLElement)) {
      return;
    }

    container
      .querySelectorAll('[data-dynamic-clock-slot="true"]')
      .forEach((slot) => slot.remove());

    for (let index = 8; index <= cardCount; index += 1) {
      const slot = container.ownerDocument.createElement("article");
      slot.className = "card-slot";
      slot.dataset.owner = owner;
      slot.dataset.zone = ZONE.CLOCK;
      slot.dataset.index = String(index);
      slot.dataset.face = "up";
      slot.dataset.position = "stand";
      slot.dataset.cardId = "";
      slot.dataset.dynamicClockSlot = "true";
      slot.textContent = String(index);

      if (owner === "opponent") {
        container.prepend(slot);
      } else {
        container.append(slot);
      }
    }
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
    slot.dataset.face = this.resolveRenderedFace(card, owner, zone);
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
   * Cardの個別overrideを優先し、未設定時はzone標準visibilityを導出する。
   * Card以外の防御的な描画入力にも対応する。
   *
   * @param {object} card
   * @param {string} zone
   * @returns {string}
   */
  resolveEffectiveVisibility(card, zone) {
    if (typeof card?.getEffectiveVisibility === "function") {
      return card.getEffectiveVisibility();
    }

    if (typeof card?.visibilityOverride === "string") {
      return card.visibilityOverride;
    }

    return ZONE_VISIBILITY[card?.zone] ?? ZONE_VISIBILITY[zone] ?? VISIBILITY.HIDDEN;
  }

  /**
   * 現在のviewerがカード内容を見る権限を持つか判定する。
   *
   * @param {object} card
   * @param {'self'|'opponent'} owner
   * @param {string} visibility
   * @returns {boolean}
   */
  canViewerSeeCard(card, owner, visibility) {
    const cardOwner = OWNERS.includes(card?.owner) ? card.owner : owner;

    switch (visibility) {
      case VISIBILITY.PUBLIC:
        return true;
      case VISIBILITY.OWNER_ONLY:
        return this.viewerId === cardOwner;
      case VISIBILITY.OPPONENT_ONLY:
        return this.viewerId !== cardOwner;
      case VISIBILITY.HIDDEN:
      default:
        return false;
    }
  }

  /**
   * visibilityを先に判定し、閲覧できる場合だけ物理的なfaceを反映する。
   *
   * @param {object} card
   * @param {'self'|'opponent'} owner
   * @param {string} zone
   * @returns {'up'|'down'}
   */
  resolveRenderedFace(card, owner, zone) {
    const visibility = this.resolveEffectiveVisibility(card, zone);
    const canView = this.canViewerSeeCard(card, owner, visibility);
    return canView && card?.face !== FACE.DOWN ? "up" : "down";
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
    const values = {
      name: player.name ?? "",
      hand: `${this.asArray(player.hand).length}枚`,
      deck: `${this.asArray(player.deck?.cards).length}枚`,
      "waiting-room": `${this.asArray(player.waitingRoom).length}枚`,
      memory: `${this.asArray(player.memory).length}枚`,
      clock: `${this.asArray(player.clock).length}枚`,
      level: `${this.asArray(player.level).length}枚`,
      stock: `${this.asArray(player.stock).length}枚`,
    };

    Object.entries(values).forEach(([name, value]) => {
      const element = this.rootElement.querySelector(
        `${panelSelector} [data-player-stat="${name}"]`,
      );
      if (element) {
        element.textContent = value;
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
