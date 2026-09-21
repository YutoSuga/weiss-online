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
 * MAINフェイズの終了、カード選択、Character Play確認UIを管理する。
 */
export class MainPhaseController {
  /**
   * @param {object} [params]
   * @param {{endMainPhase: Function, canSelectCardForMain?: Function, getMainDestinationCandidates?: Function, getCharacterPlayDisabledReason?: Function, playCharacterToStage?: Function, onRender?: Function}} params.gameEngine
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
    /** @type {{row:string,index:number}|null} */
    this.pendingDestination = null;
    /** @type {'replacement'|'swap'|null} */
    this.pendingAction = null;
    /** @type {import("../models/card.js").Card|null} */
    this.pendingDestinationCard = null;
    /** @type {HTMLButtonElement|null} */
    this.button = null;
    /** @type {HTMLButtonElement|null} */
    this.clearSelectionButton = null;
    /** @type {HTMLElement|null} */
    this.replacementPanel = null;
    /** @type {null|(() => boolean)} */
    this.unsubscribeRender = null;
    this.initialized = false;
    this.submitting = false;
    this.selectionUiActive = false;
    this.boundHandleRootClick = this.handleRootClick.bind(this);
    this.boundHandleButtonClick = this.handleButtonClick.bind(this);
    this.boundHandleClearSelectionClick = this.handleClearSelectionClick.bind(this);
    this.boundSync = this.sync.bind(this);
    this.boundHandleReplacementClick = this.handleReplacementClick.bind(this);
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
    this.replacementPanel = this.rootElement.querySelector("[data-replacement-confirmation]");
    this.rootElement.addEventListener("click", this.boundHandleRootClick);
    this.button.addEventListener("click", this.boundHandleButtonClick);
    this.clearSelectionButton.addEventListener(
      "click",
      this.boundHandleClearSelectionClick,
    );
    this.replacementPanel?.addEventListener("click", this.boundHandleReplacementClick);
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
      this.replacementPanel?.removeEventListener("click", this.boundHandleReplacementClick);
    }
    this.unsubscribeRender?.();
    this.unsubscribeRender = null;
    this.clearSelection();
    this.clearCandidateStates();
    this.button = null;
    this.clearSelectionButton = null;
    this.replacementPanel = null;
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
      !(this.selectedCard.zone === "hand"
        ? this.gameEngine?.canSelectCardForMain?.(this.selectedCard, "self")
        : this.gameEngine?.canSelectStageCardForMain?.(this.selectedCard, "self"))
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
      if (destination.dataset.mainDestination === "true") {
        this.handleDestinationClick(destination);
      } else if (destination.dataset.cardId) {
        this.handleStageCardClick(destination);
      }
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

  /** @param {HTMLElement} slot */
  handleDestinationClick(slot) {
    if (!this.selectedCard) return;
    const destination = { row: slot.dataset.row, index: Number(slot.dataset.index) };
    const existing = this.gameState.players.self.stage.find(
      (card) => card.row === destination.row && card.index === destination.index,
    );
    if (existing) {
      this.pendingDestination = destination;
      this.pendingDestinationCard = existing;
      this.pendingAction = this.selectedCard.zone === "stage" ? "swap" : "replacement";
      this.updateConfirmationView();
      if (this.replacementPanel instanceof HTMLElement) this.replacementPanel.hidden = false;
      return;
    }
    if (this.selectedCard.zone === "stage") {
      this.submitStageMove(destination);
    } else {
      this.submitCharacterPlay(destination);
    }
  }

  /** @param {MouseEvent} event */
  handleReplacementClick(event) {
    const button = event.target instanceof Element
      ? event.target.closest("[data-replacement-action]")
      : null;
    if (!(button instanceof HTMLButtonElement)) return;
    event.preventDefault();
    event.stopPropagation();
    if (button.dataset.replacementAction === "back") {
      this.closeReplacementConfirmation();
    } else if (button.dataset.replacementAction === "select") {
      const destinationCard = this.pendingDestinationCard;
      this.closeReplacementConfirmation();
      if (destinationCard) this.selectStageCard(destinationCard);
    } else if (button.dataset.replacementAction === "replace" && this.pendingDestination) {
      if (this.pendingAction === "swap" && this.pendingDestinationCard) {
        this.submitStageSwap(this.pendingDestinationCard);
      } else {
        this.submitCharacterPlay(this.pendingDestination);
      }
    }
  }

  /** @param {{row:string,index:number}} destination */
  submitCharacterPlay(destination) {
    const card = this.selectedCard;
    if (!card || this.submitting) return;
    this.submitting = true;
    try {
      this.gameEngine.playCharacterToStage(card, "self", destination);
      this.clearSelection();
    } catch (error) {
      console.error("MainPhaseController: Character Play failed.", error);
      this.closeReplacementConfirmation();
      this.updateSelectionView();
    } finally {
      this.submitting = false;
      this.sync();
    }
  }

  closeReplacementConfirmation() {
    this.pendingDestination = null;
    this.pendingDestinationCard = null;
    this.pendingAction = null;
    if (this.replacementPanel instanceof HTMLElement) this.replacementPanel.hidden = true;
  }

  /** 確認パネルをReplacement/Swapの意味に合わせて更新する。 */
  updateConfirmationView() {
    const message = this.replacementPanel?.querySelector("[data-confirmation-message]");
    const primary = this.replacementPanel?.querySelector('[data-replacement-action="replace"]');
    if (message) message.textContent = "この場所にはカードがあります。";
    if (primary) primary.textContent = this.pendingAction === "swap" ? "入れ替える" : "置き換える";
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

    this.closeReplacementConfirmation();

    if (this.selectedCard === card) {
      this.clearSelection();
    } else {
      this.selectedCard = card;
      this.selectedHandIndex = handIndex;
    }
    this.updateCandidateStates();
    this.updateSelectionView();
  }

  /** @param {HTMLElement} slot */
  handleStageCardClick(slot) {
    const card = this.gameState?.players?.self?.stage?.find(
      (candidate) => candidate.id === slot.dataset.cardId,
    );
    if (!this.gameEngine?.canSelectStageCardForMain?.(card, "self")) return;
    this.closeReplacementConfirmation();
    if (this.selectedCard === card) {
      this.clearSelection();
    } else {
      this.selectStageCard(card);
    }
    this.updateCandidateStates();
    this.updateSelectionView();
  }

  /** @param {import("../models/card.js").Card} card */
  selectStageCard(card) {
    this.selectedCard = card;
    this.selectedHandIndex = null;
    this.updateCandidateStates();
    this.updateSelectionView();
  }

  /** @param {{row:string,index:number}} destination */
  submitStageMove(destination) {
    const card = this.selectedCard;
    if (!card || this.submitting) return;
    this.submitting = true;
    try {
      this.gameEngine.moveStageCard(card, "self", destination);
      this.clearSelection();
    } catch (error) {
      console.error("MainPhaseController: Stage Move failed.", error);
    } finally {
      this.submitting = false;
      this.sync();
    }
  }

  /** @param {import("../models/card.js").Card} destinationCard */
  submitStageSwap(destinationCard) {
    const card = this.selectedCard;
    if (!card || this.submitting) return;
    this.submitting = true;
    try {
      this.gameEngine.swapStageCards(card, destinationCard, "self");
      this.clearSelection();
    } catch (error) {
      console.error("MainPhaseController: Stage Swap failed.", error);
      this.closeReplacementConfirmation();
    } finally {
      this.submitting = false;
      this.sync();
    }
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
      typeof this.gameEngine?.getMainDestinationCandidates === "function" &&
      typeof this.gameEngine?.getCharacterPlayDisabledReason === "function" &&
      typeof this.gameEngine?.playCharacterToStage === "function" &&
      typeof this.gameEngine?.canSelectStageCardForMain === "function" &&
      typeof this.gameEngine?.getMainStageMoveDestinations === "function" &&
      typeof this.gameEngine?.moveStageCard === "function" &&
      typeof this.gameEngine?.swapStageCards === "function",
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
    this.closeReplacementConfirmation();
    this.clearDestinationStates();
    this.renderer?.renderCardDetail?.(null);
  }

  /** @returns {void} */
  clearCandidateStates() {
    this.rootElement
      ?.querySelectorAll('.card-slot[data-owner="self"][data-zone="hand"], .stage-slot[data-owner="self"]')
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
    this.rootElement
      ?.querySelectorAll('.stage-slot[data-owner="self"][data-zone="stage"]')
      .forEach((slot) => {
        slot.classList.remove(...SELECTION_CLASSES);
        const card = this.gameState?.players?.self?.stage?.find(
          (candidate) => candidate.id === slot.dataset.cardId,
        );
        if (!card) return;
        if (this.gameEngine.canSelectStageCardForMain(card, "self")) {
          slot.classList.add(card === this.selectedCard ? SELECTED_CLASS : SELECTABLE_CLASS);
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

    const isStageSelection = this.selectedCard.zone === "stage";
    const isHandCharacter = !isStageSelection &&
      typeof this.selectedCard.cardType === "string" &&
      this.selectedCard.cardType.toUpperCase() === "CHARACTER";
    const playDisabledReason = !isHandCharacter
      ? null
      : this.gameEngine.getCharacterPlayDisabledReason(this.selectedCard, "self");
    this.renderer?.renderCardDetail?.(this.selectedCard, {
      showClearSelection: true,
      playDisabledReason,
    });
    const destinations = isStageSelection
      ? this.gameEngine.getMainStageMoveDestinations(this.selectedCard, "self")
      : this.gameEngine.getMainDestinationCandidates(this.selectedCard, "self");
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
