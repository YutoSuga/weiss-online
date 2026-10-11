# Phase AUTO提示・Phase終了後resume 修正結果

## A. 調査・再現・root cause

対象はmain `540d662`（PR #43マージ後）。開始時のworking treeはcleanで、既存全166 testsが成功した。責務・正本・MAIN / CLOCK / Event / Pending / Rule / Ability・修正履歴・テスト運用を確認した。

現行進行はSTAND → DRAW → CLOCK → MAIN → CLIMAX → ATTACK → ENCORE → END。`startTurn()`はなく、Mulligan完了時にturnを設定してenterPhase(STAND)する。endTurnは手番更新・必要時番号増加後にenterPhase(STAND)へ委譲する。STANDはposition更新、DRAWは1枚ドローProcess、CLOCK / MAINは入力Processで、後半Phaseは定数・遷移のみ。DRAWは完了しても次Phaseへ自動進行しない。

修正前のPhase境界：

```text
enterPhase
 → PHASE_ENDED（Trigger Detection → Pending生成）
 → phase切替
 → PHASE_STARTED（Trigger Detection → Pending生成）
 → Check Timingなし
 → 固有処理開始 / 未実装Phaseはstackなし
```

修正前のMAIN終了継続：

```text
MAIN COMPLETE → pop → resolveCheckPoint
 → 既存Pendingあり：PENDING_AUTO提示・INTERRUPTEDでreturn
 → nextPhaseのローカル分岐は実行されず、継続情報なし
 → 不使用 → 最後のPendingをpop → stack空・phase MAINのまま
```

`PHASE_ENDED(MAIN)`だけを新規誘発する場合、従来はPending生成の前にMAINをpop・再チェックし、nextPhase内でEvent生成後にCLIMAXへ切り替えてしまう。そのため「MAIN終了由来Pendingを待つ継続」も存在しなかった。依頼のMAIN残留はCOMPLETE時点の既存Pendingで再現し、実際の終了Event fixtureも追加して終了前の提示順を保証した。

新規テストの最初の2件で未提示（候補0）とMAIN残留を実装前に再現した。fixtureの必須CardMasterフィールド不足を訂正した後、アプリ挙動による2件失敗を確認。最終fixtureもmainの一時snapshotへ適用し、同じ2件失敗を再確認した。既存F-5BテストはEvent後の生成だけを見て両Eventが即時進む前提だったため、中断後の進行や固有Processの順序を保証していなかった。今回そのテストを終了AUTO処理後に開始AUTOが生成される順序へ更新した。

## B. 採用方式・実装

[修正方針](PhaseAUTO_resume_修正方針.md)どおり小さいPHASE_TRANSITIONを採用。Controller callback方式は責務逸脱、Engine独立フラグ方式はstackとの二重管理になるため採用しない。generic workflowや全Phase再設計は作らない。

`PROCESS_TYPE.PHASE_TRANSITION`、`PHASE_TRANSITION_STEP`を追加。contextはfromPhase / toPhase、playerIdは現在turn player。END_PHASE → CHECK_POINT_AFTER_END → ENTER_PHASE → CHECK_POINT_AFTER_START → START_PHASE_PROCESSとし、Check Point前に次stepを保存する。

```text
Phase終了の確定 → PHASE_ENDED → Pending生成
 → resolveCheckPoint（Rule先行 → 全Pending）
 → Phase state確定 → PHASE_STARTED → Pending生成
 → resolveCheckPoint（Rule先行 → 全Pending）
 → transitionをpop → 固有処理 / 入力待ちを一度だけ開始
```

MAIN / CLOCK COMPLETEは自身をpopしてtransitionへ引き継ぎ、Check Timing後のnextPhaseをローカル分岐へ残さない。executeCurrentProcessからtransitionを再開する。nextPhase / enterPhase / endTurnは進行中Process・Rule順序選択・Mulligan・Game Over中の新規遷移を拒否する。戻った後に再度終了操作する必要はない。phaseが同じならPhase Eventは発行しない。

stackは提示時「transition → Pending」、解決時「transition → AUTO → 必要なchild」、AUTO完了後は残Pending選択またはtransition保存stepとなる。次Phase固有Processの開始前にtransitionをpopするので旧継続は残らない。

ProcessManagerは既存定数の許可範囲を読むだけで、API・優先判定を変更しない。Renderer / Controllerも変更なし。dispatcherも既存Trigger Detection・Pending生成のままで、直接modalを開かない。

## C. Pending / Rule / Game Over

使用 / 不使用・複数Pending・非FIFO・Turn / Non-Turn順・解決中の新規Pendingは既存collectionとcoordinatorで処理する。Condition / Cost / Effect NGでも理由付きで表示し、不使用可能。全件処理後にのみphase継続へ戻る。

Abilityがstackに残る間のPending提示抑止はそのまま。Refresh / Penalty / Level Up後は親AUTOの残Cost / Effect位置へ戻り、AUTO COMPLETE、残Pending、最後にtransitionへ戻る。各Event / Cost / 通常Processを再実行しない。

Game OverではresolveCheckPointがGAME_OVERを返し、executeCurrentProcessとtransition実行は停止する。既存終了方針どおりstackは診断用に残り得るが、次Phase Event・固有Process・未実行Effectを開始せずGAME OVER表示を維持する。

## D. Scopeと残課題

Cost / Condition / Effect capability / Handler、Trigger schema、Event dispatcher、通常mutation経路、正式カード・デッキ、Renderer / Controller / DEV UI / 設定は変更していない。CLIMAX / ATTACK / ENCORE / ENDは固有処理未実装のまま。中期方針とF-7以降の未確定を維持する。

END → STANDは手番更新がEND終了Eventより前という従来順を維持した。新たなCheck TimingでもこのsnapshotとPlayer優先に従うため、既知のturn boundary整合問題は残る。今回はsnapshotの意味を修正していない。mutation / CARD_MOVED発行範囲も別Follow-up。独立した新規Blockerは確認していない。

## E. Documentation / テスト運用

READMEはPhase AUTO / resumeを完了へ更新し、F-5全体は未完了。正本8資料を確認・更新し、step / stack詳細はProcessへ集約した。共通能力・AUTO・MAIN・Engine・Rule Check・JS仕様・アプリケーションフローは対応する責務と参照先を同期した。

ひな形へ共通Phase AUTOの2観点（2-13-1 / 2-13-2）を追加。既存64 IDsは変更せず、更新後66項目を[実施結果](../９．テスト/実施結果/2026-10-11_PhaseAUTO_resume.md)へ全量コピーした。ユーザー実機は全件割愛、Codex Chromiumは別記する。

## F. 検証

- 実装前再現2件：0 passed / 2 failed（候補未提示・MAIN残留）。
- 新規phaseAutoResume.test.mjs：21 passed / 0 failed。
- 関連：Phase AUTO + phaseF4* / phaseF5* + Pending / Condition / Composite Cost / Effect capability、153 passed / 0 failed。
- 全体：node --test client/tests/*.test.mjs、187 passed / 0 failed、skip / cancelled / todo 0。
- Chromium（PC 1440×1000）：一時的なPython静的HTTPサーバーでGame Start・初期手札5枚・0枚Mulligan・MAIN、ACT集中のResolution 4枚 / 確認 / 必要時検索 / MAIN復帰、AUTO②の検索 / 確定 / MAIN復帰を確認。
- このページのメモリだけにPhase fixtureを作成し、既存UIからMAIN終了AUTO 2件を不使用 / 使用、CLIMAX開始AUTO 2件を不使用 / 使用で処理。Stock支払い・ログ各1回、MAIN終了 / CLIMAX開始Event各1回、未処理中nextPhase拒否、終了操作やり直し不要、最終stack空・CLIMAX残留を確認。正式CardMaster / DEV UIは変更なし。
- fatal pageerror 0件。最初のSmokeは非表示の古いボタンも数えるスクリプトのselectorで停止したため、可視selectorへ直して全体を再実行して成功した。アプリ修正は不要。外部カード画像の既知問題は今回解決確認していない。
- END → STANDのPending待ちでも手番交代・番号増加各1回を追加確認。snapshot順は従来維持を明示。
- git diff --check成功。変更文書のMarkdown参照127件（日本語パス・anchor含む）に欠落なし。ひな形66項目の全量コピー・ID / 順序 / 観点一致、既存64項目不変、ユーザー実機全件割愛を確認。
- 最終status / commit / PRは完了報告へ記載する。

## 判定と次のFollow-up

PASS：Phase AUTO / Phase終了後resumeの実行契約は成立した。F-5全体のCOMPLETEとは分離する。残るturn boundary Event・mutation / Event整合のうち、次はturn boundary Eventを推奨する。END → STANDの旧/新手番snapshotとCheck TimingのPlayer優先を確定し、今回閉じたPhase継続をターン境界でも一貫させる必要がある。
