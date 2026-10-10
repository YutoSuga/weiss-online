import { COST_TYPE } from "../constants/ability.js";
import { POSITION } from "../models/card.js";
import { ZONE } from "../constants/zone.js";

const payStockCostHandler = Object.freeze({
  validate(cost) {
    if (!Number.isInteger(cost.amount) || cost.amount <= 0) {
      throw new TypeError("PAY_STOCK amount must be a positive integer.");
    }
  },
  getDisabledReason(cost, { player }, resources) {
    const count = resources?.stockCount ?? player.stock.length;
    return count < cost.amount ? "ストックが足りません。" : null;
  },
  consumeAvailability(cost, resources) {
    resources.stockCount -= cost.amount;
  },
  pay(cost, { player }) {
    for (let index = 0; index < cost.amount; index += 1) {
      const card = player.stock.pop();
      card.moveTo({ zone: ZONE.WAITING_ROOM, index: player.waitingRoom.length + 1 });
      card.setPosition(POSITION.STAND);
      card.setFace(null);
      player.waitingRoom.push(card);
    }
  },
});

const restSelfCostHandler = Object.freeze({
  validate() {},
  getDisabledReason(_cost, { sourceCard }, resources) {
    const position = resources ? resources.sourcePosition : sourceCard?.position;
    return position !== POSITION.STAND
      ? "このカードはスタンドしていません。"
      : null;
  },
  consumeAvailability(_cost, resources) {
    resources.sourcePosition = POSITION.REST;
  },
  pay(_cost, { sourceCard }) {
    sourceCard.setPosition(POSITION.REST);
  },
});

const moveDeckTopToClockCostHandler = Object.freeze({
  validate(cost) {
    if (Object.keys(cost).some((key) => !["type", "amount"].includes(key)) || cost.amount !== 1) {
      throw new TypeError("MOVE_DECK_TOP_TO_CLOCK amount must be 1.");
    }
  },
  getDisabledReason(_cost, { player }, resources) {
    const count = resources?.deckCount ?? player.deck.cards.length;
    return count === 0 ? "山札にカードがありません。" : null;
  },
  consumeAvailability(_cost, resources) {
    resources.deckCount -= 1;
  },
  pay(_cost, { player }) {
    const card = player.deck.draw();
    if (!card) throw new Error("山札の上のカードをクロックへ置けません。");
    card.moveTo({ zone: ZONE.CLOCK, index: player.clock.length + 1 });
    card.setPosition(POSITION.STAND);
    card.setFace(null);
    player.clock.push(card);
  },
});

const COST_HANDLERS = Object.freeze({
  [COST_TYPE.PAY_STOCK]: payStockCostHandler,
  [COST_TYPE.MOVE_DECK_TOP_TO_CLOCK]: moveDeckTopToClockCostHandler,
  [COST_TYPE.REST_SELF]: restSelfCostHandler,
});

export function getCostHandler(cost) {
  const handler = COST_HANDLERS[cost?.type];
  if (!handler) throw new RangeError(`Unsupported Ability Cost type: ${String(cost?.type)}.`);
  handler.validate(cost);
  return handler;
}

export function getCostsDisabledReason(costs, context) {
  // 全schemaを先に検証し、先行Cost不足で後続の不正定義を隠さない。
  const handlers = costs.map(getCostHandler);
  // 判定に必要な値だけを持つローカル状態。実Card / collectionには触れない。
  const resources = {
    stockCount: context.player?.stock?.length,
    deckCount: context.player?.deck?.cards?.length,
    sourcePosition: context.sourceCard?.position,
  };
  for (const [index, cost] of costs.entries()) {
    const handler = handlers[index];
    const reason = handler.getDisabledReason(cost, context, resources);
    if (reason) return reason;
    handler.consumeAvailability(cost, resources);
  }
  return null;
}

/**
 * mutationせずにCost対象選択を準備する共通境界。
 * 現在の3Typeは対象が一意なので選択要求は空になる。
 * 将来のACT/AUTO選択Cost handlerはprepareSelectionを実装してここへ合流する。
 */
export function prepareCostSelections(costs, context) {
  return costs.flatMap((cost, costIndex) => {
    const handler = getCostHandler(cost);
    const selection = handler.prepareSelection?.(cost, context);
    return selection ? [{ costIndex, costType: cost.type, ...selection }] : [];
  });
}

/** Prepared Costをmutation直前に再検証する。 */
export function getPreparedCostsDisabledReason(costs, preparedCosts, context) {
  const required = prepareCostSelections(costs, context);
  if (required.length !== preparedCosts.length) return "コストの選択が完了していません。";
  for (const request of required) {
    const prepared = preparedCosts.find(({ costIndex }) => costIndex === request.costIndex);
    if (!prepared) return "コストの選択が完了していません。";
    const cost = costs[request.costIndex];
    const reason = getCostHandler(cost).validateSelection?.(cost, prepared, context);
    if (reason) return reason;
  }
  return getCostsDisabledReason(costs, context);
}

/** 全体をnon-mutatingで再検証してから、Query / Rule Checkを挟まず記載順に支払う。 */
export function payCosts(costs, context, onPaid = undefined) {
  const reason = getCostsDisabledReason(costs, context);
  if (reason) throw new Error(reason);
  costs.forEach((cost, index) => {
    getCostHandler(cost).pay(cost, context);
    onPaid?.(cost, index);
  });
}
