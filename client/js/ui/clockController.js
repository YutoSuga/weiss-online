import { PHASE } from "../constants/phase.js";
import { PROCESS_STATUS } from "../constants/process.js";

const SELECTED_CLASS = "is-selected";

/**
 * CLOCKフェイズ中の一時的な手札選択と確定操作だけを管理する。
 * ゲーム状態の変更、描画、フェイズ進行はGameEngineへ委譲する。
 */
export class ClockController {
  /**
   * @param {object} [params]
   * @param {{clockCard: Function, skipClockPhase: Function, onRender?: Function}} params.gameEngine
   * @param {import("../models/gameState.js").GameState} params.gameState
   * @param {Document|Element|null} [params.rootElement=document]
   */
  constructor({ gameEngine, gameState, rootElement = document } = {}) {
    this.gameEngine = gameEngine ?? null;
    this.gameState = gameState ?? null;
    this.rootElement = rootElement ?? null;
    /** @type {number|null} */
    this.selectedHandIndex = null;
    /** @type {HTMLElement|null} */
    this.selectedElement = null;
    /** @type {HTMLButtonElement|null} */
    this.button = null;
    /** @type {null|(() => boolean)} */
    this.unsubscribeRender = null;
    this.initialized = false;
    this.submitting = false;
    this.boundHandleRootClick = this.handleRootClick.bind(this);
    this.boundHandleButtonClick = this.handleButtonClick.bind(this);
    this.boundSync = this.sync.bind(this);
  }

  /** @returns {ClockController} */
  init() {
    if (this.initialized) {
      this.sync();
      return this;
    }

    if (!this.rootElement?.querySelector) {
      console.warn("ClockController: rootElement is not available.");
      return this;
    }

    const button = this.rootElement.querySelector('[data-action="confirm-clock"]');
    if (!(button instanceof HTMLButtonElement)) {
      console.warn("ClockController: CLOCK action button was not found.");
      return this;
    }

    this.button = button;
    this.rootElement.addEventListener("click", this.boundHandleRootClick);
    this.button.addEventListener("click", this.boundHandleButtonClick);
    if (typeof this.gameEngine?.onRender === "function") {
      this.unsubscribeRender = this.gameEngine.onRender(this.boundSync);
    }
    this.initialized = true;
    this.sync();
    return this;
  }

  /** @returns {void} */
  destroy() {
    if (this.initialized) {
      this.rootElement?.removeEventListener("click", this.boundHandleRootClick);
      this.button?.removeEventListener("click", this.boundHandleButtonClick);
    }
    this.unsubscribeRender?.();
    this.unsubscribeRender = null;
    this.clearSelection();
    this.button = null;
    this.initialized = false;
    this.submitting = false;
  }

  /**
   * GameStateに基づいてCLOCKボタンと一時選択を同期する。
   * GameStateの変更やRendererの呼び出しは行わない。
   *
   * @returns {void}
   */
  sync() {
    if (!this.button) {
      return;
    }

    const active = this.gameState?.phase === PHASE.CLOCK &&
      !this.isProcessInputBlocked();
    const isSelfTurn = active && this.gameState?.turn?.player === "self";

    if (!active || !isSelfTurn || this.submitting) {
      this.clearSelection();
    } else if (
      this.selectedHandIndex !== null &&
      this.selectedHandIndex > (this.gameState?.players?.self?.hand?.length ?? 0)
    ) {
      this.clearSelection();
    }

    this.button.hidden = !active;
    this.button.disabled = !isSelfTurn || this.submitting;
    this.updateButtonLabel();
  }

  /** @param {MouseEvent} event @returns {void} */
  handleRootClick(event) {
    if (event.target === this.button || !this.canInteract()) {
      return;
    }

    const slot = event.target instanceof Element
      ? event.target.closest(
          '.card-slot[data-owner="self"][data-zone="hand"][data-index]',
        )
      : null;
    if (!slot || !this.rootElement.contains(slot) || !slot.dataset.cardId) {
      return;
    }

    const handIndex = Number(slot.dataset.index);
    if (!Number.isInteger(handIndex) || handIndex < 1) {
      return;
    }

    if (this.selectedHandIndex === handIndex) {
      this.clearSelection();
    } else {
      this.clearSelection();
      this.selectedHandIndex = handIndex;
      this.selectedElement = slot;
      slot.classList.add(SELECTED_CLASS);
    }
    this.updateButtonLabel();
  }

  /** @param {MouseEvent} event @returns {void} */
  handleButtonClick(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.canInteract() || this.submitting) {
      return;
    }

    const playerId = this.gameState.turn.player;
    this.submitting = true;
    this.button.disabled = true;

    try {
      if (this.selectedHandIndex === null) {
        this.gameEngine.skipClockPhase(playerId);
      } else {
        this.gameEngine.clockCard(playerId, this.selectedHandIndex);
      }
    } catch (error) {
      console.error("ClockController: CLOCK action failed.", error);
    } finally {
      this.submitting = false;
      this.sync();
    }
  }

  /** @returns {boolean} */
  canInteract() {
    return Boolean(
      this.gameState?.phase === PHASE.CLOCK &&
      !this.isProcessInputBlocked() &&
      this.gameState?.turn?.player === "self" &&
      typeof this.gameEngine?.clockCard === "function" &&
      typeof this.gameEngine?.skipClockPhase === "function",
    );
  }

  /** @returns {void} */
  clearSelection() {
    this.selectedElement?.classList.remove(SELECTED_CLASS);
    this.selectedElement = null;
    this.selectedHandIndex = null;
  }

  /** @returns {boolean} */
  isProcessInputBlocked() {
    const stack = this.gameState?.ruleState?.processStack;
    const current = Array.isArray(stack) ? stack[stack.length - 1] : null;
    return current?.status === PROCESS_STATUS.WAITING_INPUT;
  }

  /** @returns {void} */
  updateButtonLabel() {
    if (!this.button) {
      return;
    }

    if (
      this.gameState?.phase === PHASE.CLOCK &&
      this.gameState?.turn?.player !== "self"
    ) {
      this.button.textContent = "相手操作中";
      return;
    }

    this.button.textContent = this.selectedHandIndex === null
      ? "クロックに置かず次へ"
      : "クロックに置く";
  }
}
