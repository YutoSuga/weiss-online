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

/** F-4AでGameEngineが解釈できるAbility Cost。 */
export const COST_TYPE = Object.freeze({
  PAY_STOCK: "PAY_STOCK",
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
