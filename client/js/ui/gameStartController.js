/**
 * ゲーム開始ボタンの入力と表示状態だけを管理する。
 * ゲーム開始処理そのものは GameEngine に委譲する。
 */
export class GameStartController {
  /**
   * @param {object} params
   * @param {{startGame: () => void}} params.gameEngine
   * @param {import("../models/gameState.js").GameState} params.gameState
   * @param {Document|Element|null} [params.rootElement=document]
   */
  constructor({ gameEngine, gameState, rootElement = document } = {}) {
    this.gameEngine = gameEngine ?? null;
    this.gameState = gameState ?? null;
    this.rootElement = rootElement ?? null;

    /** @type {HTMLButtonElement|null} */
    this.button = null;
    this.initialized = false;
    this.starting = false;
    this.started = false;
    this.boundHandleClick = this.handleClick.bind(this);
  }

  /**
   * 開始ボタンを取得し、クリックリスナーを一度だけ登録する。
   *
   * @returns {GameStartController}
   */
  init() {
    if (this.initialized) {
      this.sync();
      return this;
    }

    if (!this.rootElement || typeof this.rootElement.querySelector !== "function") {
      console.warn("GameStartController: rootElement is not available.");
      return this;
    }

    const button = this.rootElement.querySelector('[data-action="start-game"]');
    if (!(button instanceof HTMLButtonElement)) {
      console.warn("GameStartController: start game button was not found.");
      return this;
    }

    this.button = button;
    this.button.addEventListener("click", this.boundHandleClick);
    this.initialized = true;
    this.sync();
    return this;
  }

  /**
   * 登録済みのイベントリスナーを解除する。
   *
   * @returns {void}
   */
  destroy() {
    if (this.button && this.initialized) {
      this.button.removeEventListener("click", this.boundHandleClick);
    }

    this.button = null;
    this.initialized = false;
  }

  /**
   * コントローラーの状態を開始ボタンへ反映する。
   *
   * @returns {void}
   */
  sync() {
    if (!this.button) {
      return;
    }

    if (this.started) {
      this.button.disabled = true;
      this.button.hidden = true;
      this.button.textContent = "ゲーム開始済み";
      return;
    }

    this.button.hidden = false;
    this.button.disabled = this.starting;
    this.button.textContent = this.starting ? "ゲーム開始中…" : "ゲーム開始";
  }

  /**
   * ゲーム開始要求を GameEngine に委譲する。
   *
   * @param {MouseEvent} event
   * @returns {void}
   */
  handleClick(event) {
    event.preventDefault();

    if (this.started || this.starting) {
      return;
    }

    if (!this.gameEngine || typeof this.gameEngine.startGame !== "function") {
      console.warn("GameStartController: gameEngine.startGame() is not available.");
      this.sync();
      return;
    }

    this.starting = true;
    this.sync();

    try {
      this.gameEngine.startGame();
      this.started = true;
    } catch (error) {
      console.error("GameStartController: failed to start the game.", error);
      throw error;
    } finally {
      this.starting = false;
      this.sync();
    }
  }
}
