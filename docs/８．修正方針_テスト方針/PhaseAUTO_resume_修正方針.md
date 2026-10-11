# Phase AUTO提示・Phase終了後resume 修正方針

## 背景と範囲

最新main（前回Effect capability PRマージ後）の`enterPhase()`は終了Event・開始Event後にCheck Timingを通さずPhase固有処理を開始する。MAIN / CLOCKのCOMPLETEはpop後の`completeCurrentProcess()`結果がCONTINUEの場合だけローカル分岐でnextPhaseを呼ぶため、中断後には継続情報が残らない。

対象は既存PHASE_STARTED / PHASE_ENDEDとPending提示・Phase進行resumeの接続のみ。turn boundary snapshot、Cost / Effectのmutation / CARD_MOVED整合、Trigger拡張、CLIMAX固有処理、CONTINUOUS以降は扱わない。

## 方式比較と採用案

- ControllerでAUTO終了を検知してnextPhaseを呼び直す方式：責務逸脱・二重進行の危険があるため採用しない。
- Engineに独立callback / resumeフラグを保持する方式：既存stackと継続状態の二重管理になるため採用しない。
- 小さいPHASE_TRANSITION Process：既存step / parent-child / 共通Check Timing出口へ接続できるため採用する。

Process contextにfromPhase / toPhaseを保持し、終了Event → Check Timing → Phase状態確定・開始Event → Check Timing → Phase固有処理開始をstepに分ける。Check Point前には常に次stepを保存する。Phase終了入力の確定後、MAIN / CLOCK Processをtransitionへ引き継ぎ、pop後のローカル条件分岐へ継続を残さない。固有Process開始前にtransitionをpopし、旧Processを残さず一度だけ開始する。

Event dispatcherはPending生成のみ、提示はresolveCheckPointのまま。Ability中の提示抑止、Rule優先、Turn / Non-Turn順、複数Pending全処理を維持する。Game Overならtransitionを再開しない。ProcessManager API、Controller、Rendererは変更しない。

END → STANDは現行endTurnの手番更新順・Event snapshotを維持し、既知のturn boundary問題は別Follow-upとする。新しいPhase Triggerや新しい正式カードは追加しない。

## 検証予定

実装前にPhase開始AUTO未提示とMAIN終了継続消失を自動テストで再現する。使用 / 不使用、複数Pending・解決中追加、Player優先、Condition / Cost / Effect NG、Rule割り込み、二重Event・Process、Game Over、各Phase固有処理・初期準備を追加検証する。既存ACT / AUTO・Cost / Condition / capability・Ruleの関連と全体テストを実行する。

Chromiumで開始・Mulligan・MAIN、ACT集中、AUTO②、MAIN終了・CLIMAXを確認し、可能ならブラウザ内だけのPhase fixtureを通常UIで確認する。本番データ / DEV UIは変更しない。

正本のProcess / Engine / Check Timing / MAINと必要な関連文書を更新する。READMEは当該Follow-upのみ完了、F-5全体は未完了を維持。テストひな形に不足する画面観点を追加し、更新後全量コピーした結果ではユーザー実機を推測でOKにしない。
