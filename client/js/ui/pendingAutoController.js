/** Pending AUTO / Prepared Cost UIは入力をEngineへ中継するだけとする。 */
export class PendingAutoController {
  constructor({ gameEngine, rootElement }) {
    this.gameEngine = gameEngine;
    this.rootElement = rootElement;
    this.onClick = this.onClick.bind(this);
  }
  init() { this.rootElement?.addEventListener("click", this.onClick); }
  onClick(event) {
    const button = event.target.closest?.("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "resolve-pending-auto") {
      this.gameEngine.selectPendingAuto(button.dataset.pendingAutoId);
    } else if (button.dataset.action === "back-pending-auto") {
      this.gameEngine.backToPendingAutoSelection();
    } else if (button.dataset.action === "confirm-prepared-costs") {
      const process = this.gameEngine.processManager.getCurrentProcess();
      this.gameEngine.confirmPreparedCosts(process.context.preparedCosts);
    }
  }
}
