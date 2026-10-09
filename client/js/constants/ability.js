/** カード能力の種別。表示上の【永】【自】【起】とは分離した内部値。 */
export const ABILITY_TYPE = Object.freeze({
  CONTINUOUS: "CONTINUOUS",
  AUTO: "AUTO",
  ACT: "ACT",
});

/** Ability definitionの供給元。使用可否ではなく定義の由来を表す。 */
export const ABILITY_SOURCE = Object.freeze({
  PRINTED: "PRINTED",
  RULE: "RULE",
  GRANTED: "GRANTED",
});

/** CardAbility.conditionsで正式に評価できる必要状態。 */
export const CONDITION_TYPE = Object.freeze({
  SOURCE_IS_FRONT_ROW: "SOURCE_IS_FRONT_ROW",
});

/** Pending AUTO使用不可理由の責務区分。使用可能時はnull。 */
export const AVAILABILITY_REASON_CATEGORY = Object.freeze({
  DEFINITION: "DEFINITION",
  SOURCE: "SOURCE",
  CONDITION: "CONDITION",
  COST: "COST",
  EFFECT: "EFFECT",
});

/** F-4AでGameEngineが解釈できるAbility Cost。 */
export const COST_TYPE = Object.freeze({
  PAY_STOCK: "PAY_STOCK",
  MOVE_DECK_TOP_TO_CLOCK: "MOVE_DECK_TOP_TO_CLOCK",
  REST_SELF: "REST_SELF",
});

/** F-4Bで対応するAbility Keyword。 */
export const ABILITY_KEYWORD = Object.freeze({
  BRAINSTORM: "BRAINSTORM",
});

/** F-4AでGameEngineが解釈できるAbility Effect。 */
export const EFFECT_TYPE = Object.freeze({
  TEST_LOG: "TEST_LOG",
  BRAINSTORM_REVEAL: "BRAINSTORM_REVEAL",
  EFFECT_GROUP: "EFFECT_GROUP",
  SEARCH_DECK: "SEARCH_DECK",
  ADD_TO_HAND: "ADD_TO_HAND",
  SHUFFLE_DECK: "SHUFFLE_DECK",
  ENCORE_RETURN: "ENCORE_RETURN",
  REPLACE_OPPONENT_STOCK_TOP: "REPLACE_OPPONENT_STOCK_TOP",
});

export const EFFECT_VALUE_SOURCE = Object.freeze({ EFFECT_RESULT: "EFFECT_RESULT" });
