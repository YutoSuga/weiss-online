# Ability Type / Effect実行範囲整合 修正方針

## 背景と対象

最新main（PR #42マージ後）で、AUTO + BRAINSTORM_REVEALが共通schema validationを通り、Pending使用・Cost支払い後にACT Process依存の例外へ到達できる。Loader受理範囲とruntime能力の不一致を解消する。Cost / Condition / Trigger / Event / Phaseは変更しない。

## 現行実行範囲と方式

共通：TEST_LOG、SEARCH_DECK、ADD_TO_HAND、SHUFFLE_DECK。
ACT専用：BRAINSTORM_REVEAL、EFFECT_GROUP（トップレベルのみ、Group内のGroupは未対応）。
AUTO専用：REPLACE_OPPONENT_STOCK_TOP、ENCORE_RETURN（元Stage slotを持つRULE文脈が必要）。
AUTO SEARCH_DECKはmaxSelectの数値のみ対応し、ACTの結果参照型maxSelectを受理しない。CONTINUOUS runtimeは未実装で、Loaderでは空effectsだけを保持可能とする。

Loader専用allow-listは実装知識と二重管理になる。Resolver側の別対応mapより、既存Effect HandlerへsupportedAbilityTypesと必要な限定条件を置く方式が自然なため採用する。schemaとcapabilityのvalidatorを分離し、共通validatorをLoaderとruntimeが共有する。実Effectを複製・一般化せず、現行Process依存を明示する。

## 境界

全schema検証の後、再帰的capability検証でGroup内Effectも確認する。LoaderはAbility id / type / Effect typeを含むエラーで登録前に拒否し、trigger=nullのAUTOにも適用する。ACT / AUTO Query、select / Prepared commit、payment直前で同じcapabilityを検証する。AUTOはEFFECT理由・使用disabled・不使用可能とし、Pendingを消さない。Effect実行入口にも最終防御を置くが、正常経路ではCost前に拒否する。

ENCOREのsource制約は元slotの文脈が必要なための補助条件であり、PRINTED / RULEの別Effect体系は作らない。モデルはimmutableな定義保持の責務を維持する。

## 検証と資料

修正前のAUTO + Reveal / ACT + AUTO専用fixtureで失敗を再現する。Loader・direct model・使用可否・Pending保持・Prepared commit・payment直前・直接Resolver・nested Group・正式データ全件・共通Effect実行を自動テストする。既存Encore / AUTO①② / 集中 / 複合Cost / Condition / Rule resumeを回帰し、Chromiumで開始・Mulligan・MAIN・集中・AUTO②・EncoreまたはAUTO①を確認する。

READMEの今回Follow-upだけを完了にし、正本のcapability matrixとLoader / runtime契約、結果・履歴一覧を更新する。画面観点は既存の使用不可理由・disabled・不使用で足りるか確認し、不要なDomain項目をひな形へ増やさない。実施結果を作る場合は全量コピーし、ユーザー実機は未実施を割愛とする。

Phase AUTO / resume、turn boundary、mutation / Event、新Type、ACT Condition、GRANTED、CONTINUOUS runtime、ゲーム進行、Onlineは対象外。F-7以降の番号は正式化しない。
