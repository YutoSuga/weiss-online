import { COST_TYPE } from "../constants/ability.js";
import { POSITION } from "../models/card.js";
import { ZONE } from "../constants/zone.js";

const payStockCostHandler = Object.freeze({
  validate(cost) {
    if (!Number.isInteger(cost.amount) || cost.amount <= 0) {
      throw new TypeError("PAY_STOCK amount must be a positive integer.");
    }
  },
  getDisabledReason(cost, { player }) {
    return player.stock.length < cost.amount ? "ストックが足りません。" : null;
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
  getDisabledReason(_cost, { sourceCard }) {
    return sourceCard?.position !== POSITION.STAND
      ? "このカードはスタンドしていません。"
      : null;
  },
  pay(_cost, { sourceCard }) {
    sourceCard.setPosition(POSITION.REST);
  },
});

const COST_HANDLERS = Object.freeze({
  [COST_TYPE.PAY_STOCK]: payStockCostHandler,
  [COST_TYPE.REST_SELF]: restSelfCostHandler,
});

export function getCostHandler(cost) {
  const handler = COST_HANDLERS[cost?.type];
  if (!handler) throw new RangeError(`Unsupported Ability Cost type: ${String(cost?.type)}.`);
  handler.validate(cost);
  return handler;
}

export function getCostsDisabledReason(costs, context) {
  for (const cost of costs) {
    const reason = getCostHandler(cost).getDisabledReason(cost, context);
    if (reason) return reason;
  }
  return null;
}

/**
 * mutationせずにCost対象選択を準備する共通境界。
 * 現在のPAY_STOCK / REST_SELFは対象が一意なので選択要求は空になる。
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

/** 呼出側が全Costを先に検証した後だけ使用する。記載順に支払う。 */
export function payCosts(costs, context, onPaid = undefined) {
  const reason = getCostsDisabledReason(costs, context);
  if (reason) throw new Error(reason);
  costs.forEach((cost, index) => {
    getCostHandler(cost).pay(cost, context);
    onPaid?.(cost, index);
  });
}
