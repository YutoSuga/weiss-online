import { CardSelectionView } from "./cardSelectionView.js";

/** SEARCH_DECK Processの入力を表示し、instanceIdだけをGameEngineへ渡す。 */
export class DeckSearchController {
  constructor({ gameEngine, renderer, rootElement = document } = {}) {
    this.gameEngine = gameEngine;
    this.renderer = renderer;
    this.rootElement = rootElement;
    this.dialog = rootElement?.querySelector?.("[data-deck-search]") ?? null;
    this.list = rootElement?.querySelector?.("[data-deck-search-list]") ?? null;
    this.count = rootElement?.querySelector?.("[data-deck-search-count]") ?? null;
    this.description = rootElement?.querySelector?.("[data-deck-search-description]") ?? null;
    this.button = rootElement?.querySelector?.('[data-action="confirm-deck-search"]') ?? null;
    this.detail = rootElement?.querySelector?.("[data-deck-search-detail]") ?? null;
    this.detailCardId = null;
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
      const state = this.gameEngine.getSearchDeckState("self");
      const card = state?.cards.find(({ instanceId }) => instanceId === slot.dataset.cardId);
      if (card) this.detailCardId = card.instanceId;
      if (slot.dataset.selectable === "true") this.gameEngine.toggleSearchDeckSelection(slot.dataset.cardId, "self");
      // toggle時の再描画後も、Modal内の確認対象を保持する。
      if (card) this.renderer?.renderCardDetail?.(card, { container: this.detail, allowPrivate: true });
      return;
    }
    if (event.target === this.button) this.gameEngine.confirmSearchDeckSelection("self");
  }

  sync() {
    const state = this.gameEngine?.getSearchDeckState?.("self");
    if (!(this.dialog instanceof HTMLElement) || !(this.list instanceof HTMLElement)) return;
    this.dialog.hidden = !state;
    if (!state) {
      this.list.replaceChildren();
      this.detailCardId = null;
      this.renderer?.renderCardDetail?.(null, { container: this.detail });
      return;
    }
    const eligible = new Set(state.eligibleCardInstanceIds);
    const selected = new Set(state.selectedCardInstanceIds);
    this.list.replaceChildren(...state.cards.map((card, index) => {
      const slot = this.list.ownerDocument.createElement("article");
      slot.className = "card-slot";
      slot.dataset.cardId = card.instanceId;
      slot.dataset.index = String(index + 1);
      slot.dataset.zone = "deck-search";
      slot.title = card.name;
      slot.textContent = card.name;
      if (card.imageUrl) slot.style.backgroundImage = `url("${card.imageUrl}")`;
      this.view.setState(slot, { selectable: eligible.has(card.instanceId), selected: selected.has(card.instanceId) });
      return slot;
    }));
    if (this.description) this.description.textContent = `手札に加えるカードを0〜${state.maxSelect}枚選択してください`;
    if (this.count) this.count.textContent = `選択枚数 ${selected.size} / ${state.maxSelect}`;
    if (this.button) this.button.disabled = selected.size < state.minSelect || selected.size > state.maxSelect;
    const detailCard = state.cards.find(({ instanceId }) => instanceId === this.detailCardId) ?? null;
    this.renderer?.renderCardDetail?.(detailCard, { container: this.detail, allowPrivate: true });
  }
}
