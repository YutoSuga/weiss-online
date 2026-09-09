import { PHASE } from "../constants/phase.js";
import {
  MAIN_STEP,
  PROCESS_STATUS,
  PROCESS_TYPE,
} from "../constants/process.js";

/**
 * MAINフェイズのゲーム操作だけをDOMイベントへ接続する。
 * カード選択やAction実行は扱わず、GameStateの更新とフェイズ進行はGameEngineへ委譲する。
 */
export class MainPhaseController {
  /**
   * @param {object} [params]
   * @param {{endMainPhase: Function, onRender?: Function}} params.gameEngine
   * @param {import("../models/gameState.js").GameState} params.gameState
   * @param {Document|Element|null} [params.rootElement=document]
   */
  constructor({ gameEngine, gameState, rootElement = document } = {}) {
    this.gameEngine = gameEngine ?? null;
    this.gameState = gameState ?? null;
    this.rootElement = rootElement ?? null;
    /** @type {HTMLButtonElement|null} */
    this.button = null;
    /** @type {null|(() => boolean)} */
    this.unsubscribeRender = null;
    this.initialized = false;
    this.submitting = false;
    this.boundHandleButtonClick = this.handleButtonClick.bind(this);
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
    if (!(button instanceof HTMLButtonElement)) {
      console.warn("MainPhaseController: MAIN end button was not found.");
      return this;
    }

    this.button = button;
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
      this.button?.removeEventListener("click", this.boundHandleButtonClick);
    }
    this.unsubscribeRender?.();
    this.unsubscribeRender = null;
    this.button = null;
    this.initialized = false;
    this.submitting = false;
  }

  /**
   * GameState上のMAIN Processをもとに、ゲーム操作ボタンだけを同期する。
   * @returns {void}
   */
  sync() {
    if (!this.button) {
      return;
    }

    const active = this.getActiveProcess() !== null;
    const isSelfTurn = active && this.gameState?.turn?.player === "self";
    this.button.hidden = !active;
    this.button.disabled = !isSelfTurn || this.submitting;
    this.button.textContent = active && !isSelfTurn
      ? "相手操作中"
      : "メインフェイズ終了";
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
      typeof this.gameEngine?.endMainPhase === "function",
    );
  }

  /**
   * @returns {object|null}
   */
  getActiveProcess() {
    const stack = this.gameState?.ruleState?.processStack;
    const process = Array.isArray(stack) ? stack.at(-1) : null;

    return process?.type === PROCESS_TYPE.MAIN_PHASE &&
      process.step === MAIN_STEP.WAITING_INPUT &&
      process.status === PROCESS_STATUS.WAITING_INPUT
      ? process
      : null;
  }
}
