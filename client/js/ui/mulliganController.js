const SELECTED_CLASS = "is-selected";

/**
 * マリガン中の一時的なカード選択と確定操作だけを管理する。
 * ゲーム状態の更新と描画はGameEngineへ委譲する。
 */
export class MulliganController {
  /**
   * @param {object} params
   * @param {{mulligan: Function, onRender?: Function}} params.gameEngine
   * @param {import("../models/gameState.js").GameState} params.gameState
   * @param {Document|Element|null} [params.rootElement=document]
   */
  constructor({ gameEngine, gameState, rootElement = document } = {}) {
    this.gameEngine = gameEngine ?? null;
    this.gameState = gameState ?? null;
    this.rootElement = rootElement ?? null;
    /** @type {Set<number>} */
    this.selectedIndexes = new Set();
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

  /** @returns {MulliganController} */
  init() {
    if (this.initialized) {
      this.sync();
      return this;
    }

    if (!this.rootElement?.querySelector) {
      console.warn("MulliganController: rootElement is not available.");
      return this;
    }

    const button = this.rootElement.querySelector(
      '[data-action="confirm-mulligan"]',
    );
    if (!(button instanceof HTMLButtonElement)) {
      console.warn("MulliganController: confirmation button was not found.");
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
  }

  /**
   * 一時選択とコントローラー所有のボタン状態を現在状態へ同期する。
   * GameStateの変更やRendererの呼び出しは行わない。
   *
   * @returns {void}
   */
  sync() {
    this.clearSelection();
    if (!this.button) {
      return;
    }

    const mulliganState = this.gameState?.mulliganState;
    const active = mulliganState?.active === true;
    const selectable = active && mulliganState.currentPlayer === "self";
    this.button.hidden = !active;
    this.button.disabled = !selectable || this.submitting;
    this.updateButtonLabel();
  }

  /** @param {MouseEvent} event @returns {void} */
  handleRootClick(event) {
    if (event.target === this.button || !this.canSelect()) {
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

    const index = Number(slot.dataset.index);
    if (!Number.isInteger(index) || index < 1) {
      return;
    }

    if (this.selectedIndexes.has(index)) {
      this.selectedIndexes.delete(index);
      slot.classList.remove(SELECTED_CLASS);
    } else {
      this.selectedIndexes.add(index);
      slot.classList.add(SELECTED_CLASS);
    }
    this.updateButtonLabel();
  }

  /** @param {MouseEvent} event @returns {void} */
  handleButtonClick(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.canSelect() || this.submitting) {
      return;
    }

    this.submitting = true;
    this.updateButtonState();
    try {
      this.gameEngine.mulligan(
        this.gameState.mulliganState.currentPlayer,
        [...this.selectedIndexes].sort((left, right) => left - right),
      );
    } finally {
      this.submitting = false;
      this.sync();
    }
  }

  /** @returns {boolean} */
  canSelect() {
    return Boolean(
      this.gameEngine &&
      typeof this.gameEngine.mulligan === "function" &&
      this.gameState?.mulliganState?.active === true &&
      this.gameState.mulliganState.currentPlayer === "self",
    );
  }

  /** @returns {void} */
  clearSelection() {
    this.selectedIndexes.clear();
    this.rootElement
      ?.querySelectorAll(
        `.card-slot[data-owner="self"][data-zone="hand"].${SELECTED_CLASS}`,
      )
      .forEach((slot) => slot.classList.remove(SELECTED_CLASS));
  }

  /** @returns {void} */
  updateButtonState() {
    if (this.button) {
      this.button.disabled = !this.canSelect() || this.submitting;
    }
  }

  /** @returns {void} */
  updateButtonLabel() {
    if (!this.button) {
      return;
    }

    if (this.gameState?.mulliganState?.currentPlayer === "opponent") {
      this.button.textContent = "相手操作中";
      return;
    }

    this.button.textContent = this.selectedIndexes.size > 0
      ? "選択したカードを交換"
      : "交換せず次へ";
  }
}
