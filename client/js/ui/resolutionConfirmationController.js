import { CardSelectionView } from "./cardSelectionView.js";

/** BRAINSTORM_REVEALの公開結果を確認し、控え室への移動をEngineへ要求する。 */
export class ResolutionConfirmationController {
  constructor({ gameEngine, renderer, rootElement = document } = {}) {
    this.gameEngine = gameEngine;
    this.renderer = renderer;
    this.rootElement = rootElement;
    this.dialog = rootElement?.querySelector?.("[data-resolution-confirmation]") ?? null;
    this.list = rootElement?.querySelector?.("[data-resolution-list]") ?? null;
    this.description = rootElement?.querySelector?.("[data-resolution-description]") ?? null;
    this.count = rootElement?.querySelector?.("[data-resolution-count]") ?? null;
    this.button = rootElement?.querySelector?.('[data-action="confirm-brainstorm-reveal"]') ?? null;
    this.view = new CardSelectionView({ container: this.list, confirmButton: this.button });
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
    const slot = event.target instanceof Element ? event.target.closest(".card-slot") : null;
    if (slot) {
      const card = this.gameEngine.getBrainstormConfirmationState("self")?.cards
        .find(({ instanceId }) => instanceId === slot.dataset.cardId);
      if (card) this.renderer?.renderCardDetail?.(card);
      return;
    }
    if (event.target === this.button) this.gameEngine.confirmBrainstormReveal("self");
  }

  sync() {
    const state = this.gameEngine?.getBrainstormConfirmationState?.("self");
    if (!(this.dialog instanceof HTMLElement) || !(this.list instanceof HTMLElement)) return;
    this.dialog.hidden = !state;
    if (!state) {
      this.list.replaceChildren();
      return;
    }
    this.list.replaceChildren(...state.cards.map((card, index) => {
      const slot = this.list.ownerDocument.createElement("article");
      slot.className = "card-slot";
      slot.dataset.cardId = card.instanceId;
      slot.dataset.index = String(index + 1);
      slot.dataset.zone = "resolution-confirmation";
      slot.title = card.name;
      slot.textContent = card.name;
      if (card.imageUrl) slot.style.backgroundImage = `url("${card.imageUrl}")`;
      this.view.setState(slot, { selectable: false, selected: false });
      return slot;
    }));
    if (this.description) this.description.textContent = `山札の上から${state.count}枚をめくりました`;
    if (this.count) this.count.textContent = `クライマックス：${state.climaxCount}枚`;
  }
}
