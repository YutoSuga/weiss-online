import { PHASE } from "../constants/phase.js";
import {
  MAIN_STEP,
  PROCESS_STATUS,
  PROCESS_TYPE,
} from "../constants/process.js";

const SELECTED_CLASS = "is-selected";
const SELECTABLE_CLASS = "is-selectable";
const UNSELECTABLE_CLASS = "is-unselectable";
const DESTINATION_CLASS = "is-main-destination";
const SELECTION_CLASSES = Object.freeze([
  SELECTED_CLASS,
  SELECTABLE_CLASS,
  UNSELECTABLE_CLASS,
]);

/**
 * MAINフェイズの終了操作とF-2Aの一時的なカード選択UIを管理する。
 * カード移動やPlay条件の完全判定は行わない。
 */
export class MainPhaseController {
  /**
   * @param {object} [params]
   * @param {{endMainPhase: Function, canSelectCardForMain?: Function, getMainDestinationCandidates?: Function, onRender?: Function}} params.gameEngine
   * @param {import("../models/gameState.js").GameState} params.gameState
   * @param {{renderCardDetail?: Function}} params.renderer
   * @param {Document|Element|null} [params.rootElement=document]
   */
  constructor({ gameEngine, gameState, renderer, rootElement = document } = {}) {
    this.gameEngine = gameEngine ?? null;
    this.gameState = gameState ?? null;
    this.renderer = renderer ?? null;
    this.rootElement = rootElement ?? null;
    /** @type {import("../models/card.js").Card|null} */
    this.selectedCard = null;
    /** @type {number|null} */
    this.selectedHandIndex = null;
    /** @type {HTMLButtonElement|null} */
    this.button = null;
    /** @type {HTMLButtonElement|null} */
    this.clearSelectionButton = null;
    /** @type {null|(() => boolean)} */
    this.unsubscribeRender = null;
    this.initialized = false;
    this.submitting = false;
    this.selectionUiActive = false;
    this.boundHandleRootClick = this.handleRootClick.bind(this);
    this.boundHandleButtonClick = this.handleButtonClick.bind(this);
    this.boundHandleClearSelectionClick = this.handleClearSelectionClick.bind(this);
    this.boundSync = this.sync.bind(this);
  }

  /** @returns {MainPhaseController} */
  init() {
    if (this.initialized) {
      this.sync();
      return this;
    }
    if (!this.rootElement?.querySelector) {
      console.warn("MainPhaseController: rootElement is not available.");
      return this;
    }

    const button = this.rootElement.querySelector('[data-action="end-main-phase"]');
    const clearSelectionButton = this.rootElement.querySelector(
      '[data-action="clear-main-selection"]',
    );
    if (!(button instanceof HTMLButtonElement)) {
      console.warn("MainPhaseController: MAIN end button was not found.");
      return this;
    }
    if (!(clearSelectionButton instanceof HTMLButtonElement)) {
      console.warn("MainPhaseController: clear selection button was not found.");
      return this;
    }

    this.button = button;
    this.clearSelectionButton = clearSelectionButton;
    this.rootElement.addEventListener("click", this.boundHandleRootClick);
    this.button.addEventListener("click", this.boundHandleButtonClick);
    this.clearSelectionButton.addEventListener(
      "click",
      this.boundHandleClearSelectionClick,
    );
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
      this.clearSelectionButton?.removeEventListener(
        "click",
        this.boundHandleClearSelectionClick,
      );
    }
    this.unsubscribeRender?.();
    this.unsubscribeRender = null;
    this.clearSelection();
    this.clearCandidateStates();
    this.button = null;
    this.clearSelectionButton = null;
    this.initialized = false;
    this.submitting = false;
  }

  /** @returns {void} */
  sync() {
    if (!this.button) {
      return;
    }

    const active = this.getActiveProcess() !== null;
    const isSelfTurn = active && this.gameState?.turn?.player === "self";
    const canUseSelection = isSelfTurn && !this.submitting;

    if (
      this.selectedCard &&
      !this.gameEngine?.canSelectCardForMain?.(this.selectedCard, "self")
    ) {
      this.clearSelection();
    }

    if (canUseSelection) {
      this.updateCandidateStates();
      this.updateSelectionView();
      this.selectionUiActive = true;
    } else if (this.selectionUiActive || this.selectedCard) {
      this.clearSelection();
      this.clearCandidateStates();
      this.selectionUiActive = false;
    }

    this.button.hidden = !active;
    this.button.disabled = !isSelfTurn || this.submitting;
    this.button.textContent = active && !isSelfTurn
      ? "相手操作中"
      : "メインフェイズ終了";
  }

  /** @param {MouseEvent} event @returns {void} */
  handleRootClick(event) {
    if (!this.canInteract() || !(event.target instanceof Element)) {
      return;
    }
    if (event.target.closest("button, .dev-panel, .card-detail-panel")) {
      return;
    }

    const destination = event.target.closest(
      '.stage-slot[data-owner="self"][data-zone="stage"]',
    );
    if (destination && this.rootElement.contains(destination)) {
      return;
    }

    const handSlot = event.target.closest(
      '.card-slot[data-owner="self"][data-zone="hand"][data-index]',
    );
    if (handSlot && this.rootElement.contains(handSlot)) {
      this.handleHandCardClick(handSlot);
      return;
    }
    if (event.target.closest(".card-slot")) {
      return;
    }
    if (event.target.closest(".game-board")) {
      this.clearSelection();
      this.updateCandidateStates();
    }
  }

  /** @param {HTMLElement} slot @returns {void} */
  handleHandCardClick(slot) {
    const handIndex = Number(slot.dataset.index);
    const card = Number.isInteger(handIndex) && handIndex > 0
      ? this.gameState?.players?.self?.hand?.[handIndex - 1]
      : null;

    if (!this.gameEngine?.canSelectCardForMain?.(card, "self")) {
      return;
    }

    if (this.selectedCard === card) {
      this.clearSelection();
    } else {
      this.selectedCard = card;
      this.selectedHandIndex = handIndex;
    }
    this.updateCandidateStates();
    this.updateSelectionView();
  }

  /** @param {MouseEvent} event @returns {void} */
  handleClearSelectionClick(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.canInteract()) {
      return;
    }
    this.clearSelection();
    this.updateCandidateStates();
  }

  /** @param {MouseEvent} event @returns {void} */
  handleButtonClick(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.canInteract() || this.submitting) {
      return;
    }

    this.submitting = true;
    this.button.disabled = true;
    this.clearSelection();
    this.clearCandidateStates();
    try {
      this.gameEngine.endMainPhase(this.gameState.turn.player);
    } catch (error) {
      console.error("MainPhaseController: MAIN end action failed.", error);
    } finally {
      this.submitting = false;
      this.sync();
    }
  }

  /** @returns {boolean} */
  canInteract() {
    return Boolean(
      this.gameState?.phase === PHASE.MAIN &&
      this.getActiveProcess() !== null &&
      this.gameState?.turn?.player === "self" &&
      typeof this.gameEngine?.endMainPhase === "function" &&
      typeof this.gameEngine?.canSelectCardForMain === "function" &&
      typeof this.gameEngine?.getMainDestinationCandidates === "function",
    );
  }

  /** @returns {object|null} */
  getActiveProcess() {
    const stack = this.gameState?.ruleState?.processStack;
    const process = Array.isArray(stack) ? stack.at(-1) : null;
    return process?.type === PROCESS_TYPE.MAIN_PHASE &&
      process.step === MAIN_STEP.WAITING_INPUT &&
      process.status === PROCESS_STATUS.WAITING_INPUT
      ? process
      : null;
  }

  /** @returns {void} */
  clearSelection() {
    this.selectedCard = null;
    this.selectedHandIndex = null;
    this.clearDestinationStates();
    this.renderer?.renderCardDetail?.(null);
  }

  /** @returns {void} */
  clearCandidateStates() {
    this.rootElement
      ?.querySelectorAll('.card-slot[data-owner="self"][data-zone="hand"]')
      .forEach((slot) => slot.classList.remove(...SELECTION_CLASSES));
    this.clearDestinationStates();
  }

  /** @returns {void} */
  updateCandidateStates() {
    this.rootElement
      ?.querySelectorAll(
        '.card-slot[data-owner="self"][data-zone="hand"][data-index]',
      )
      .forEach((slot) => {
        slot.classList.remove(...SELECTION_CLASSES);
        const handIndex = Number(slot.dataset.index);
        const card = Number.isInteger(handIndex) && handIndex > 0
          ? this.gameState?.players?.self?.hand?.[handIndex - 1]
          : null;

        if (!slot.dataset.cardId || !card) {
          return;
        }
        if (this.gameEngine.canSelectCardForMain(card, "self")) {
          slot.classList.add(
            card === this.selectedCard ? SELECTED_CLASS : SELECTABLE_CLASS,
          );
        } else {
          slot.classList.add(UNSELECTABLE_CLASS);
        }
      });
  }

  /** @returns {void} */
  updateSelectionView() {
    this.clearDestinationStates();
    if (!this.selectedCard) {
      this.renderer?.renderCardDetail?.(null);
      return;
    }

    this.renderer?.renderCardDetail?.(this.selectedCard, {
      showClearSelection: true,
    });
    const destinations = this.gameEngine.getMainDestinationCandidates(
      this.selectedCard,
      "self",
    );
    destinations.forEach(({ owner, zone, row, index }) => {
      const selector = `.stage-slot[data-owner="${owner}"]` +
        `[data-zone="${zone}"][data-row="${row}"]` +
        `[data-index="${index}"]`;
      const slot = this.rootElement?.querySelector(selector);
      if (slot instanceof HTMLElement) {
        slot.classList.add(DESTINATION_CLASS);
        slot.dataset.mainDestination = "true";
      }
    });
  }

  /** @returns {void} */
  clearDestinationStates() {
    this.rootElement
      ?.querySelectorAll(`.${DESTINATION_CLASS}, [data-main-destination]`)
      .forEach((slot) => {
        slot.classList.remove(DESTINATION_CLASS);
        delete slot.dataset.mainDestination;
      });
  }
}
