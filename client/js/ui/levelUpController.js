import {
  LEVEL_UP_STEP,
  PROCESS_STATUS,
  PROCESS_TYPE,
} from "../constants/process.js";

const SELECTED_CLASS = "is-selected";
const SELECTABLE_CLASS = "is-selectable";
const UNSELECTABLE_CLASS = "is-unselectable";
const SELECTION_CLASSES = Object.freeze([
  SELECTABLE_CLASS,
  UNSELECTABLE_CLASS,
  SELECTED_CLASS,
]);

/**
 * LEVEL_UPのクロックカード単一選択と確定操作だけを管理する。
 * ゲーム状態の変更、カード移動、Process操作、描画はGameEngineへ委譲する。
 */
export class LevelUpController {
  /**
   * @param {object} [params]
   * @param {{submitLevelUpSelection?: Function, onRender?: Function}} params.gameEngine
   * @param {import("../models/gameState.js").GameState} params.gameState
   * @param {{getCurrentProcess?: Function}} params.processManager
   * @param {Document|Element|null} [params.rootElement=document]
   */
  constructor({
    gameEngine,
    gameState,
    processManager,
    rootElement = document,
  } = {}) {
    this.gameEngine = gameEngine ?? null;
    this.gameState = gameState ?? null;
    this.processManager = processManager ?? null;
    this.rootElement = rootElement ?? null;
    /** @type {number|null} */
    this.selectedClockIndex = null;
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

  /** @returns {LevelUpController} */
  init() {
    if (this.initialized) {
      this.sync();
      return this;
    }
    if (!this.rootElement?.querySelector) {
      console.warn("LevelUpController: rootElement is not available.");
      return this;
    }

    const button = this.rootElement.querySelector(
      '[data-action="confirm-level-up"]',
    );
    if (!(button instanceof HTMLButtonElement)) {
      console.warn("LevelUpController: confirmation button was not found.");
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
    this.clearCandidateStates();
    this.button = null;
    this.initialized = false;
    this.submitting = false;
  }

  /** @returns {void} */
  sync() {
    if (!this.button) {
      return;
    }

    const active = this.getActiveProcess();
    if (!active || this.submitting) {
      this.clearSelection();
    } else if (
      this.selectedClockIndex !== null &&
      !this.gameState?.players?.[active.playerId]?.clock?.[this.selectedClockIndex]
    ) {
      this.clearSelection();
    }

    this.button.hidden = !active;
    this.button.disabled = !active || this.selectedClockIndex === null ||
      this.submitting;
    this.updateCandidateStates(active);
  }

  /** @param {MouseEvent} event @returns {void} */
  handleRootClick(event) {
    const process = this.getActiveProcess();
    if (!process || event.target === this.button || this.submitting) {
      return;
    }

    const slot = event.target instanceof Element
      ? event.target.closest(
          `.card-slot[data-owner="${process.playerId}"]` +
          '[data-zone="clock"][data-index]',
        )
      : null;
    if (!slot || !this.rootElement.contains(slot) || !slot.dataset.cardId) {
      return;
    }

    const slotIndex = Number(slot.dataset.index);
    const clockIndex = slotIndex - 1;
    if (!Number.isInteger(clockIndex) || clockIndex < 0 || clockIndex > 6) {
      return;
    }
    if (!this.gameState?.players?.[process.playerId]?.clock?.[clockIndex]) {
      return;
    }

    if (this.selectedClockIndex === clockIndex) {
      this.clearSelection();
    } else {
      this.clearSelection();
      this.selectedClockIndex = clockIndex;
      this.selectedElement = slot;
    }
    this.updateCandidateStates(process);
    this.button.disabled = this.selectedClockIndex === null;
  }

  /** @param {MouseEvent} event @returns {void} */
  handleButtonClick(event) {
    event.preventDefault();
    event.stopPropagation();
    const process = this.getActiveProcess();
    if (!process || this.selectedClockIndex === null || this.submitting) {
      return;
    }

    this.submitting = true;
    this.button.disabled = true;
    try {
      this.gameEngine.submitLevelUpSelection(
        process.playerId,
        this.selectedClockIndex,
      );
    } catch (error) {
      console.error("LevelUpController: LEVEL_UP selection failed.", error);
    } finally {
      this.submitting = false;
      this.sync();
    }
  }

  /** @returns {import("../core/processManager.js").Process|null} */
  getActiveProcess() {
    const process = typeof this.processManager?.getCurrentProcess === "function"
      ? this.processManager.getCurrentProcess()
      : null;

    return process?.type === PROCESS_TYPE.LEVEL_UP &&
      process.step === LEVEL_UP_STEP.WAIT_FOR_SELECTION &&
      process.status === PROCESS_STATUS.WAITING_INPUT
      ? process
      : null;
  }

  /** @returns {void} */
  clearSelection() {
    this.selectedElement?.classList.remove(SELECTED_CLASS);
    this.selectedElement = null;
    this.selectedClockIndex = null;
  }

  /** @returns {void} */
  clearCandidateStates() {
    this.rootElement
      ?.querySelectorAll('.card-slot[data-zone="clock"]')
      .forEach((slot) => slot.classList.remove(...SELECTION_CLASSES));
  }

  /**
   * clock配列の0始まり位置に基づいて候補表示を反映する。
   * clock[0..6]だけを候補とし、clock[7]以降は選択不可にする。
   *
   * @param {import("../core/processManager.js").Process|null} process
   * @returns {void}
   */
  updateCandidateStates(process) {
    this.clearCandidateStates();
    if (!process) {
      return;
    }

    const clock = this.gameState?.players?.[process.playerId]?.clock;
    if (!Array.isArray(clock)) {
      return;
    }

    this.rootElement
      ?.querySelectorAll(
        `.card-slot[data-owner="${process.playerId}"]` +
        '[data-zone="clock"][data-index]',
      )
      .forEach((slot) => {
        const clockIndex = Number(slot.dataset.index) - 1;
        if (!Number.isInteger(clockIndex) || !clock[clockIndex] ||
          !slot.dataset.cardId) {
          return;
        }

        if (clockIndex > 6) {
          slot.classList.add(UNSELECTABLE_CLASS);
        } else if (clockIndex === this.selectedClockIndex) {
          slot.classList.add(SELECTED_CLASS);
        } else {
          slot.classList.add(SELECTABLE_CLASS);
        }
      });
  }
}
