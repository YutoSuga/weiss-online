# Condition基盤・前列Condition 修正方針

## 調査と目的

PR #40マージ後のmain、AGENTS、README、能力共通 / ACT / AUTO / Encore / 複合Cost、Architecture / JavaScript / データモデル / Entity / Engine / Process / Rule Check、PR #39・#40結果、修正記録とテスト運用を照合した。開始時はclean。

現在はimmutableなCardAbility.conditionsを保持するが、ACTはLoader/runtimeで空配列のみ、AUTOはLoaderで非空をrejectしEngineでも非空を使用不可にする。表示・select・commitはEngineの共通評価、Rendererは評価済み結果の表示のみ。最初の正式Conditionを追加してAUTOの暫定ガードを対応Typeの検証・評価へ置き換える。

## 実装前の設計判断

1. `constants/ability.js`に`CONDITION_TYPE.SOURCE_IS_FRONT_ROW`を追加する。schemaは`{ type: "SOURCE_IS_FRONT_ROW" }`のみ。追加parameterは不要、未知fieldはrejectする。
2. `abilities/conditionResolver.js`に最小のHandler mapを置き、Type登録、validate、非mutationのgetDisabledReasonを分離する。Cost / Effect Resolverと同じstring / null契約を使う。
3. `validateConditions`は全配列と全itemを検証する。Loaderは全AUTO（trigger=null含む）で利用し、未知Type、不正item・fieldをfail-fastする。省略は空配列、nullは不正とする。
4. runtimeのschema不正は使用不可理由へ変換しsilent ignoreしない。全item検証を評価より先に行い、後段の未知Typeを通常のCondition NGで隠さない。
5. sourceは既存Pending.source.cardInstanceIdから解決したCard本人。Handlerへ現在Stateを読む既存locateCard callbackを渡し、所在の正本はcollectionとする。Stage / front / index 1～3を確認し、Card.zoneやmasterId一致では判断しない。
6. 既存Engine private評価をavailability objectへ拡張する。返却は`usable / disabledReason / reasonCategory`。区分はCONDITION / COST / EFFECT、既存固有ガードはSOURCE / DEFINITIONとする。StateやPendingへ保存しない。
7. 定義・Encore固有source検証の後、Condition → Cost → Effectの最初の不可理由を返す。Query / select / commitで同一評価を再実行する。
8. 支払い開始後のCondition再評価は追加しない。Prepared Costの支払い直前検証、全Cost事前検証、同期記載順支払い、item間Rule Checkなし、resume位置を維持する。
9. ResolverはAbility TypeやPendingに依存しない構造とするが、今回runtime接続はAUTOのみ。ACTのLoader・MAIN timing・VALIDATE・空Condition制約は変更しない。
10. Renderer、Event / Trigger Detection、Pending / ProcessManager、Stage / Zone移動、Cost / Effect Type、正式カードデータ、CSS・環境設定は変更しない。代表実カード本体やAttack Phaseへ進まない。

## 検証と記録

テストfixtureのAUTOと既存Eventで前列・後列・Stage外・同master別instance・現在State変化・stale select/Prepared Cost commit・理由優先順・未知/不正定義・Loaderを検証する。既存Encore、AUTO①②、Cost境界、Rule resume、非FIFO・Player優先順・Stage slotを回帰実行する。

Chromiumはメモリ上だけにテストCardMaster / Cardを生成して確認し、正式データに架空能力を追加しない。成立/不成立のボタン・理由・不使用、PC/狭幅、fatal errorを確認する。ユーザー本人の実機は未実施として割愛、Codex確認を別記する。

関連・全体テスト、diff --check、Markdown参照・全量コピーID整合を確認する。正本・README・方針/結果/一覧・必要チェックシートを更新し、commit・push・PR作成する。
