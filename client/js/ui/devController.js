/**
 * 開発専用パネルの表示とデバッグ操作だけを管理する。
 * ゲームルールはGameEngineへ、通常描画はRendererへ委譲する。
 */
export class DevController {
  /**
   * @param {object} params
   * @param {{nextPhase?: Function, drawCards?: Function, render?: Function, onRender?: Function}} params.gameEngine
   * @param {import("../models/gameState.js").GameState} params.gameState
   * @param {{render?: Function}} params.renderer
   * @param {Document|Element|null} [params.rootElement=document]
   */
  constructor({ gameEngine, gameState, renderer, rootElement = document } = {}) {
    this.gameEngine = gameEngine ?? null;
    this.gameState = gameState ?? null;
    this.renderer = renderer ?? null;
    this.rootElement = rootElement ?? null;
    /** @type {HTMLElement|null} */
    this.panel = null;
    /** @type {null|(() => boolean)} */
    this.unsubscribeRender = null;
    this.initialized = false;
    this.boundHandleClick = this.handleClick.bind(this);
    this.boundSync = this.sync.bind(this);
  }

  /**
   * DEVパネルを表示し、イベントを一度だけ登録する。
   *
   * @returns {DevController}
   */
  init() {
    if (this.initialized) {
      this.sync();
      return this;
    }

    if (!this.rootElement?.querySelector) {
      console.warn("DevController: rootElement is not available.");
      return this;
    }

    const panel = this.rootElement.querySelector('[data-role="dev-panel"]');
    if (!(panel instanceof HTMLElement)) {
      console.warn("DevController: DEV panel was not found.");
      return this;
    }

    this.panel = panel;
    this.panel.hidden = false;
    this.panel.addEventListener("click", this.boundHandleClick);

    if (typeof this.gameEngine?.onRender === "function") {
      this.unsubscribeRender = this.gameEngine.onRender(this.boundSync);
    }

    this.initialized = true;
    this.sync();
    return this;
  }

  /**
   * 登録済みイベントと描画通知を解除し、パネルを非表示へ戻す。
   *
   * @returns {void}
   */
  destroy() {
    this.panel?.removeEventListener("click", this.boundHandleClick);
    this.unsubscribeRender?.();
    this.unsubscribeRender = null;

    if (this.panel) {
      this.panel.hidden = true;
    }

    this.panel = null;
    this.initialized = false;
  }

  /**
   * 現在のGameStateをDEVステータスへ安全に反映する。
   *
   * @returns {void}
   */
  sync() {
    if (!this.panel) {
      return;
    }

    this.#setStatus("started", this.#formatValue(this.gameState?.started));
    this.#setStatus("turn-player", this.#formatValue(this.gameState?.turn?.player));
    this.#setStatus("turn-number", this.#formatValue(this.gameState?.turn?.number));
    this.#setStatus("phase", this.#formatValue(this.gameState?.phase));
  }

  /**
   * @param {MouseEvent} event
   * @returns {void}
   */
  handleClick(event) {
    const button = event.target instanceof Element
      ? event.target.closest("[data-dev-action]")
      : null;

    if (!(button instanceof HTMLButtonElement) || !this.panel?.contains(button)) {
      return;
    }

    const action = button.dataset.devAction;

    try {
      switch (action) {
        case "next-phase":
          this.#requireMethod(this.gameEngine, "nextPhase").call(this.gameEngine);
          break;
        case "draw-self":
          this.#drawCard("self");
          break;
        case "draw-opponent":
          this.#drawCard("opponent");
          break;
        case "redraw":
          this.#requireMethod(this.renderer, "render").call(
            this.renderer,
            this.gameState,
          );
          break;
        default:
          return;
      }
    } catch (error) {
      console.error(`DevController action failed: ${action}`, error);
    } finally {
      this.sync();
    }
  }

  /**
   * GameEngineの公開ドローAPIを使用し、エンジン経由で再描画する。
   *
   * @private
   * @param {'self'|'opponent'} playerId
   * @returns {void}
   */
  #drawCard(playerId) {
    this.#requireMethod(this.gameEngine, "drawCards").call(
      this.gameEngine,
      playerId,
      1,
    );
    this.#requireMethod(this.gameEngine, "render").call(this.gameEngine);
  }

  /**
   * @private
   * @param {string} name
   * @param {string} value
   * @returns {void}
   */
  #setStatus(name, value) {
    const element = this.panel?.querySelector(`[data-dev-status="${name}"]`);
    if (element) {
      element.textContent = value;
    }
  }

  /**
   * @private
   * @param {unknown} value
   * @returns {string}
   */
  #formatValue(value) {
    return value == null || value === "" ? "-" : String(value);
  }

  /**
   * @private
   * @param {unknown} target
   * @param {string} methodName
   * @returns {Function}
   */
  #requireMethod(target, methodName) {
    const method = target?.[methodName];
    if (typeof method !== "function") {
      throw new TypeError(`DevController: ${methodName}() is not available.`);
    }
    return method;
  }
}
