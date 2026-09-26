import { GAME_EVENT_TYPE_VALUES } from "../constants/gameEvent.js";
import { detectAutoTriggers } from "../abilities/autoTriggerDetector.js";

/** 確定済みmutationの小さいsnapshotを発行し、同期的にPending AUTOへ固定する。 */
export class GameEventDispatcher {
  constructor(gameState) { this.gameState = gameState; }

  emit(type, actorPlayerId, payload) {
    if (!GAME_EVENT_TYPE_VALUES.includes(type)) throw new RangeError(`Unsupported Game Event: ${type}.`);
    const sequence = this.gameState.ruleState.nextGameEventSequence++;
    const event = deepFreezeCopy({ id: `event-${sequence}`, sequence, type,
      actorPlayerId: actorPlayerId ?? null, payload });
    const pendingAutos = detectAutoTriggers(this.gameState, event).map((candidate) => {
      const pendingSequence = this.gameState.ruleState.nextPendingAutoSequence++;
      return deepFreezeCopy({
        id: `pending-auto-${pendingSequence}`,
        sequence: pendingSequence,
        masterPlayerId: candidate.masterPlayerId,
        ownerId: candidate.sourceCard.owner,
        controllerId: candidate.masterPlayerId,
        source: {
          kind: candidate.sourceKind,
          cardInstanceId: candidate.sourceCard.instanceId,
          cardMasterId: candidate.sourceCard.masterId,
          abilityId: candidate.ability.id,
        },
        triggerContext: candidate.sourceKind === "RULE" && event.type === "CARD_MOVED"
          ? { originalStagePosition: { row: event.payload.from.row, index: event.payload.from.index } }
          : {},
        trigger: event,
      });
    });
    this.gameState.ruleState.pendingAutos.push(...pendingAutos);
    return { event, pendingAutos };
  }
}

function deepFreezeCopy(value) {
  if (value === null || typeof value !== "object") return value;
  const copy = Array.isArray(value)
    ? value.map(deepFreezeCopy)
    : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepFreezeCopy(item)]));
  return Object.freeze(copy);
}
