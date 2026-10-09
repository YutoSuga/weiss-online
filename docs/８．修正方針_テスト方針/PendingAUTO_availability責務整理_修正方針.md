# Pending AUTO availability責務整理 修正方針

## 調査と変更前の判断

PR #39マージ後のmainを確認し、AGENTS、README、能力共通・AUTO・アンコール・複合Cost、Engine・Process・Rule Check、Architecture・JavaScript・Entity、前回整合結果、修正記録・テスト運用を照合した。開始時の作業ツリーはclean。

Event / Trigger Detectorがimmutableな誘発事実を単一pendingAutos配列へ追加し、Rule安定化・能力完了後のCheck TimingがTurn / Non-Turn順に提示する。使用選択・Prepared Cost・commit・支払い・Effect・Rule child / resumeの経路は維持する。

修正前のRendererはCost / Effect Resolverを直接呼び、RULE全般でCard.zoneを判定する。EngineはSTANDARD_ENCORE_3についてcollection所在とmaster playerを確認し、Cost→Effectの理由を返す。Rendererには別の理由順・対象条件があり、既存getPendingAutoOptionsは画面経路で利用されていない。

## 採用する最小構成

1. 単一の表示Queryは既存`GameEngine.getPendingAutoOptions()`。既存`pending / card / ability / disabledReason`に`usable`を追加し、既存private disabled reason経路を維持する。新Resolver / DTO階層は作らない。
2. Engine.renderが毎回Queryの結果をRenderer.renderの表示optionsへ渡す。Rendererは既存Processの表示状態と評価済みoptionsだけを描画し、能力解決・collection探索・Cost/Effect/RULE判定を除去する。
3. Costは`getCostsDisabledReason`、Effectは`getEffectsDisabledReason`を再利用し、Encore固有所在はEngine内でcollectionを正とする。元slot情報は既存triggerContextをそのまま使用する。
4. select / commitで同じprivate評価を現在Stateから再実行する。Prepared Costと支払い直前検証は不可逆境界の安全性のため残す。表示snapshotをPendingへ保存しない。
5. 理由categoryは見送る。現在のstring disabledReasonで責務整理でき、Condition導入時に共通評価内で区分を拡張できる。
6. 正式データに非空AUTO Conditionがないことを確認した。Loaderで全AUTO（null triggerの表示定義も含む）の非空・不正conditionsをrejectする。省略時はモデル同様空配列扱い。直接モデル生成経路もruntime共通評価で非空を使用不可とし、silent ignoreを防ぐ。Condition Type / 評価器は追加しない。

## 変更範囲・検証

Engine / Renderer / Loaderと関連テスト、責務の正本、README現在地、方針・結果・一覧、必要なチェックシートだけを変更する。Cost/Effect handler、Event/Pending schema、ProcessManager、Stage / Zone移動、Cost境界、UIデザイン、カードデータ・画像問題は変更しない。

関連・全体テストでQuery、Cost不足、Effect不足、Encore所在、現在State再評価、select/commit/payment、non-empty AUTO Condition拒否、正式データ読込を確認する。既存AUTO①②・アンコール・Rule resume・slot回帰を実行する。Rendererは評価結果を描画する動作をテストする。

Chromiumで使用可/不可、理由、不使用、AUTO①②・アンコール、レイアウト、fatal JS errorを確認する。チェックシートは安定IDを維持して必要観点を追加し、全量コピーの実施結果へ自動確認を記録する。Codexブラウザ確認は備考・修正結果へ別記し、ユーザー本人の実機確認は未実施（割愛）とする。

`git diff --check`、Markdown参照確認、最終status、対象diffを確認し、commit・PR作成する。
