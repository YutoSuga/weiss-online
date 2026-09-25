import { ABILITY_SOURCE, ABILITY_TYPE, COST_TYPE } from "../constants/ability.js";
import { AUTO_TRIGGER_SUBJECT, GAME_EVENT_TYPE } from "../constants/gameEvent.js";
import { ZONE } from "../constants/zone.js";

export const RULE_ABILITY_ID = Object.freeze({
  STANDARD_ENCORE_3: "STANDARD_ENCORE_3",
});

const STANDARD_ENCORE_3 = Object.freeze({
  id: RULE_ABILITY_ID.STANDARD_ENCORE_3,
  type: ABILITY_TYPE.AUTO,
  text: "【自】アンコール［③］",
  activationTrigger: Object.freeze({
    event: GAME_EVENT_TYPE.CARD_MOVED,
    subject: AUTO_TRIGGER_SUBJECT.SELF,
    fromZone: ZONE.STAGE,
    toZone: ZONE.WAITING_ROOM,
  }),
  activeZones: Object.freeze([ZONE.STAGE]),
  costs: Object.freeze([{ type: COST_TYPE.PAY_STOCK, amount: 3 }]),
  effects: Object.freeze([]),
});

/** Eventからルール由来AUTO候補を供給する。Effect解決は行わない。 */
export function getRuleAutoAbilityCandidates(event, locateCard) {
  if (event.type !== GAME_EVENT_TYPE.CARD_MOVED ||
      event.payload.from.zone !== ZONE.STAGE ||
      event.payload.to.zone !== ZONE.WAITING_ROOM) return [];
  const located = locateCard(event.payload.cardInstanceId);
  if (typeof located.card.cardType !== "string" ||
      located.card.cardType.toUpperCase() !== "CHARACTER") return [];
  return [{
    ability: STANDARD_ENCORE_3,
    sourceKind: ABILITY_SOURCE.RULE,
    sourceCard: located.card,
    masterPlayerId: event.payload.ownerId,
  }];
}
