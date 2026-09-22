/** MulliganとDeck Searchが共有する、DOM上の選択状態表現。 */
export class CardSelectionView {
  constructor({ container, confirmButton = null } = {}) {
    this.container = container ?? null;
    this.confirmButton = confirmButton;
  }

  setState(slot, { selectable, selected }) {
    slot.classList.remove("is-selectable", "is-unselectable", "is-selected");
    slot.classList.add(selected ? "is-selected" : selectable ? "is-selectable" : "is-unselectable");
    slot.setAttribute("aria-selected", String(selected));
    slot.dataset.selectable = String(selectable);
  }

  clear() {
    this.container?.querySelectorAll(".card-slot").forEach((slot) => {
      slot.classList.remove("is-selectable", "is-unselectable", "is-selected");
    });
  }
}
