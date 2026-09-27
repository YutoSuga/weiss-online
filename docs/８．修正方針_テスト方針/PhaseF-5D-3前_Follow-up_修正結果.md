# Phase F-5D-3前 Follow-up 修正結果

## 不具合修正

### Resolution一覧画像

原因は、Resolution確認Controllerが画像URLを`background-image`へ設定する一方、一覧枠に画像の縮尺・反復・はみ出しの指定がなかったことだった。共通のModalカード一覧枠を84×118pxに固定し、`background-size: contain`、中央寄せ、非反復、`overflow: hidden`を指定した。画像なしは従来どおりCard名を表示し、右側Detailは変更していない。

### アンコール後のStage位置

原因はGame State側だった。共通`moveCard()`がsource collectionからCardを除去した後、Stageにも通常Zone用の連番再採番を行い、残ったCardのslot座標である`index`を書き換えていた。Rendererは書き換わったStateを正しく描画したため、表示だけの問題ではない。

sourceがStageの場合は再採番しないよう修正した。アンコール対象の元slotは従来どおり`CARD_MOVED`のLKIからPendingの`triggerContext.originalStagePosition`へsnapshotされ、共通Stage配置によりRESTで復帰する。対象外Cardはmutation対象にならず、4つの他slotで`zone/row/index/position`が不変であることを自動テストした。

## ACT集中とルール処理の調査

集中の`ACT_ABILITY`はCost後と各Effect後に`resolveCheckPoint()`を呼ぶ。公開中にDeckが空になると`BRAINSTORM_REVEAL`自身も同入口を呼ぶ。`resolveRuleCheck()`はDeck 0の`REFRESH`、Clock 7枚以上の`LEVEL_UP`、`pendingChecks`の`REFRESH_PENALTY`を候補化し、単一候補を子Processとしてpushする。複数候補は`pendingInterrupts`に置き、ユーザー選択後に開始する。

Refresh完了時はpenaltyを`pendingChecks`へ追加し、`completeCurrentProcess()`がpop後に再Rule Checkする。penaltyはDeck topをClockへ置いてCheck Pointを通るため、Clock 7枚ならLevel Upへ割り込める。各子Process完了時の`completeCurrentProcess()`は再チェック後、`executeCurrentProcess()`で保存済みstepの親Processを再開する。集中公開は`movedCardInstanceIds`、ACT本体は`effectIndex/groupEffectIndex/effectResults`をcontextに保持するため再開できる。検索は独立`SEARCH_DECK`子Processで、選択確定時に親のEffect位置を進めてから完了・再チェック・親再開を行う。

次回AUTO②で再利用できるのは、Rule CheckによるRefresh/Level Up同時候補、割り込み順選択、Refresh、penalty予約と実行、penalty後のLevel Up再判定、Process stack、共通完了出口とresumeである。不足しているのは、AUTO Costを1項目ずつ進めて各mutation後にCheck Pointへ入る仕組み、AUTO Effectの山札検索・0～1枚選択・Hand移動、およびAUTOの保存済みCost/Effect位置から再開するEffect handlerである。今回これらは実装していない。

## テスト資料・未対応

チェックシートひな形へ、アンコール対象外Stage位置不変、集中公開中のRefresh復帰、検索でDeck 0となるRefresh復帰、Resolution画像/fallbackの4観点を追加した。実施結果は更新後ひな形の全量コピーで作成し、ユーザー確認済みの集中2ケースだけを実機OK、Codex未実施のResolution画像とアンコールは実機割愛とした。

Refresh / penaltyの発生が盤面変化やログを注視しないと分かりにくい点は、今後のUI改善候補として本節に記録する。今回、新しいModal、Toast、演出は追加していない。
