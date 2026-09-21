/** カード能力の種別。表示上の【永】【自】【起】とは分離した内部値。 */
export const ABILITY_TYPE = Object.freeze({
  CONTINUOUS: "CONTINUOUS",
  AUTO: "AUTO",
  ACT: "ACT",
});

/** F-4AでGameEngineが解釈できるAbility Cost。 */
export const COST_TYPE = Object.freeze({
  PAY_STOCK: "PAY_STOCK",
  REST_SELF: "REST_SELF",
});

/** F-4AでGameEngineが解釈できるAbility Effect。 */
export const EFFECT_TYPE = Object.freeze({
  TEST_LOG: "TEST_LOG",
});
