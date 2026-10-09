import { CONDITION_TYPE } from "../constants/ability.js";
import { ZONE } from "../constants/zone.js";

const CONDITION_HANDLERS = Object.freeze({
  [CONDITION_TYPE.SOURCE_IS_FRONT_ROW]: Object.freeze({
    validate(condition) {
      if (Object.keys(condition).some((key) => key !== "type")) {
        throw new TypeError("SOURCE_IS_FRONT_ROW only supports the type field.");
      }
    },
    getDisabledReason(_condition, { sourceCard, locateCard }) {
      if (!sourceCard) return "このカードが舞台の前列にいません。";
      // Zoneはcollection所属、row/indexはそのStage instanceのslot座標を読む。
      const { location } = locateCard(sourceCard.instanceId);
      return location.zone === ZONE.STAGE && location.row === "front" &&
        Number.isInteger(location.index) && location.index >= 1 && location.index <= 3
        ? null : "このカードが舞台の前列にいません。";
    },
  }),
});

export function getConditionHandler(condition) {
  if (condition === null || typeof condition !== "object" || Array.isArray(condition)) {
    throw new TypeError("Ability Condition must be an object.");
  }
  if (!Object.hasOwn(condition, "type") || typeof condition.type !== "string" ||
      !Object.hasOwn(CONDITION_HANDLERS, condition.type)) {
    throw new RangeError(`Unsupported Ability Condition type: ${String(condition.type)}.`);
  }
  const handler = CONDITION_HANDLERS[condition.type];
  handler.validate(condition);
  return handler;
}

/** 対応Typeと全itemのschemaを検証する。Loaderのallow-list境界。 */
export function validateConditions(conditions) {
  if (!Array.isArray(conditions)) throw new TypeError("conditions must be an array.");
  for (const condition of conditions) getConditionHandler(condition);
}

/** Stateを変更せず、最初の不成立理由またはnullを返す。 */
export function getConditionsDisabledReason(conditions, context) {
  try {
    validateConditions(conditions);
  } catch (error) {
    // 直接モデル生成でも未知・不正定義を無視しない。Loaderでは例外のまま拒否する。
    return `使用条件の定義が不正です: ${error.message}`;
  }
  for (const condition of conditions) {
    const reason = getConditionHandler(condition).getDisabledReason(condition, context);
    if (reason) return reason;
  }
  return null;
}
