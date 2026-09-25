import { ABILITY_SOURCE, ABILITY_TYPE } from "../constants/ability.js";
import { AUTO_TRIGGER_SUBJECT, GAME_EVENT_TYPE } from "../constants/gameEvent.js";
import { ZONE } from "../constants/zone.js";
import { getRuleAutoAbilityCandidates } from "./ruleAbilityProvider.js";

export const PRINTED_AUTO_SEARCH_ZONES = Object.freeze([
  ZONE.STAGE, ZONE.CLOCK, ZONE.LEVEL, ZONE.WAITING_ROOM, ZONE.HAND,
]);

/** Event確定後のcollection membershipからCard所在を一意に解決する。 */
export function locateCard(gameState, instanceId) {
  const found = [];
  for (const playerId of ["self", "opponent"]) {
    const player = gameState.players[playerId];
    const collections = [
      [ZONE.DECK, player.deck.cards], [ZONE.HAND, player.hand],
      [ZONE.STAGE, player.stage], [ZONE.CLOCK, player.clock],
      [ZONE.LEVEL, player.level], [ZONE.STOCK, player.stock],
      [ZONE.CLIMAX, player.climax], [ZONE.WAITING_ROOM, player.waitingRoom],
      [ZONE.MEMORY, player.memory], [ZONE.RESOLUTION, player.resolution],
    ];
    for (const [zone, cards] of collections) {
      const card = cards.find((candidate) => candidate.instanceId === instanceId);
      if (card) found.push({ card, playerId, location: { zone, row: card.row, index: card.index } });
    }
  }
  if (found.length !== 1) {
    throw new Error(`Card "${instanceId}" must exist in exactly one collection; found ${found.length}.`);
  }
  return found[0];
}

/** PRINTED / RULE候補を限定schemaで照合する。 */
export function detectAutoTriggers(gameState, event) {
  const locate = (id) => locateCard(gameState, id);
  const candidates = [];

  if ([GAME_EVENT_TYPE.CARD_MOVED, GAME_EVENT_TYPE.CARD_POSITION_CHANGED,
    GAME_EVENT_TYPE.ATTACK_DECLARED].includes(event.type)) {
    const targetId = event.payload.cardInstanceId ?? event.payload.attackerCardInstanceId;
    if (targetId) {
      const target = locate(targetId);
      for (const ability of target.card.abilities) {
        if (ability.type === ABILITY_TYPE.AUTO && ability.activationTrigger?.subject === AUTO_TRIGGER_SUBJECT.SELF) {
          candidates.push({ ability, sourceKind: ABILITY_SOURCE.PRINTED,
            sourceCard: target.card, masterPlayerId: target.card.owner });
        }
      }
    }
  }

  for (const playerId of ["self", "opponent"]) {
    const player = gameState.players[playerId];
    for (const zone of PRINTED_AUTO_SEARCH_ZONES) {
      const cards = getZoneCards(player, zone);
      for (const card of cards) {
        for (const ability of card.abilities) {
          if (ability.type !== ABILITY_TYPE.AUTO || !ability.activationTrigger) continue;
          if (ability.activationTrigger.subject === AUTO_TRIGGER_SUBJECT.SELF) continue;
          if (ability.activeZones.length === 0 || !ability.activeZones.includes(zone)) continue;
          candidates.push({ ability, sourceKind: ABILITY_SOURCE.PRINTED,
            sourceCard: card, masterPlayerId: card.owner });
        }
      }
    }
  }

  candidates.push(...getRuleAutoAbilityCandidates(event, locate));
  return candidates.filter((candidate) => triggerMatches(candidate, event));
}

function triggerMatches(candidate, event) {
  const trigger = candidate.ability.activationTrigger;
  if (trigger.event !== event.type) return false;
  const targetId = event.payload.cardInstanceId ?? event.payload.attackerCardInstanceId;
  if (trigger.subject === AUTO_TRIGGER_SUBJECT.SELF && targetId !== candidate.sourceCard.instanceId) return false;
  if (trigger.subject === AUTO_TRIGGER_SUBJECT.OTHER_YOUR_CHARACTER) {
    if (targetId === candidate.sourceCard.instanceId || event.payload.ownerId !== candidate.masterPlayerId ||
        typeof event.payload.cardType !== "string" ||
        event.payload.cardType.toUpperCase() !== "CHARACTER") return false;
  }
  if (trigger.fromZone && event.payload.from?.zone !== trigger.fromZone) return false;
  if (trigger.toZone && event.payload.to?.zone !== trigger.toZone) return false;
  if (trigger.fromPosition && event.payload.fromPosition !== trigger.fromPosition) return false;
  if (trigger.toPosition && event.payload.toPosition !== trigger.toPosition) return false;
  if (trigger.phase && event.payload.phase !== trigger.phase) return false;
  if (trigger.attackType && event.payload.attackType !== trigger.attackType) return false;
  return true;
}

function getZoneCards(player, zone) {
  if (zone === ZONE.WAITING_ROOM) return player.waitingRoom;
  return player[zone] ?? [];
}
