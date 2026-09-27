const LABELS = Object.freeze({
  refresh: "リフレッシュ",
  level_up: "レベルアップ",
  refresh_penalty: "リフレッシュペナルティ",
});

/** 同時成立したRule処理の解決順を、通常画面から選択可能にする。 */
export class RuleInterruptController {
  constructor({ gameEngine, rootElement = document } = {}) {
    this.gameEngine = gameEngine;
    this.dialog = rootElement?.querySelector?.("[data-rule-interrupt]") ?? null;
    this.list = rootElement?.querySelector?.("[data-rule-interrupt-list]") ?? null;
    this.boundClick = this.handleClick.bind(this);
    this.boundSync = this.sync.bind(this);
  }

  init() {
    this.dialog?.addEventListener("click", this.boundClick);
    this.unsubscribe = this.gameEngine?.onRender?.(this.boundSync);
    this.sync();
    return this;
  }

  handleClick(event) {
    const button = event.target instanceof Element
      ? event.target.closest("[data-rule-interrupt-index]")
      : null;
    if (!button) return;
    this.gameEngine.selectPendingInterrupt(Number(button.dataset.ruleInterruptIndex));
  }

  sync() {
    if (!(this.dialog instanceof HTMLElement) || !(this.list instanceof HTMLElement)) return;
    const candidates = this.gameEngine?.gameState?.ruleState?.pendingInterrupts ?? [];
    this.dialog.hidden = candidates.length < 2;
    this.list.replaceChildren(...candidates.map((candidate, index) => {
      const button = this.list.ownerDocument.createElement("button");
      button.type = "button";
      button.className = "action-button";
      button.dataset.ruleInterruptIndex = String(index);
      button.textContent = `${LABELS[candidate.type] ?? candidate.type}を先に処理`;
      return button;
    }));
  }
}
