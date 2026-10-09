# Pending AUTO availability責務整理 修正結果

## A. 調査結果

AGENTS、README、システム共通Architecture / JavaScript / Entity / Engine / Process / Rule Check、カード能力共通 / AUTO / Encore / 複合Cost、Engine / Renderer / Loader / Resolver / Provider、既存AUTO回帰テスト、修正記録・チェックシート運用を照合した。PR #39マージ後のmainを起点とし、開始時はclean。

処理経路はEvent発行 → Trigger Detection → Pending追加 → Rule安定化 → Turn / Non-Turn順のCheck Timing → Pending表示 → 使用/不使用 → Prepared Cost → commit → AUTO_ABILITY支払い・Effect → Rule interrupt/resume → 能力完了 → 残Pending再提示 → 親Process復帰。生成はavailabilityから独立し、非FIFOの単一collectionと現在State再評価を維持した。

修正前の判定箇所は、EngineのgetPendingAutoOptions / select / commitで共通private理由評価、executeAutoAbilityProcessの支払い直前検証、Rendererの独立したCost / Effect ResolverとRULE所在検証。Rendererは全RULEのCard.zoneを見てEngineのSTANDARD_ENCORE_3専用collection membership・master player検証と異なり、理由の上書き順も異なった。

CostはgetCostsDisabledReason → Cost Handler、EffectはgetEffectsDisabledReason → Effect Handler。Encore所在はEngineのlocateCard結果とmaster player Waiting Roomを正本とする。元slotはEvent LKIのoriginalStagePosition。AUTO conditionsは従来Loaderで受理されruntime未評価、ACTは空配列のみ対応だった。

## B. 設計判断

1. 既存GameEngine.getPendingAutoOptionsを単一の表示Queryとする。新たなResolver / DTO階層は導入しない。
2. 結果は `{ pending, card, ability, usable, disabledReason }[]`。非SELECT_AUTO時は空。Stateを変更せず、Pendingに判定結果を保存しない。
3. Domain評価は既存private getPendingAutoDisabledReason。Cost / Effectは既存Resolverを再利用し、Encore固有所在は同じEngine内で評価する。
4. Engine.renderが毎回Query結果をRendererの第2引数へ渡す。Rendererへdomain callbackやEngine参照を注入しない。
5. Rendererはカード名・本文・Cost表示、画像/fallback、理由、ボタン、レイアウト、Processによる表示状態のみ担当する。source探索、RULE Provider参照、Cost / Effect / Encore判定を削除した。
6. selectとPrepared Cost commitは同じDomainルールで現在Stateを再検証する。表示snapshotをcommitに流用しない。
7. payment直前の全Cost検証とPrepared Cost検証は不可逆境界の安全性のため残す。後続Cost不成立時の部分支払い、二重実行を防ぐ。
8. structured reason categoryは見送った。文字列理由で本目的を満たし、Condition導入時にCONDITION / COST / EFFECTを共通評価で拡張できる。
9. 全AUTOの非空・不正conditionsをLoaderでfail-fast。trigger=nullでも適用し、空配列・省略は許可。直接モデル生成の非空ConditionもEngineで使用不可にする。
10. Pending / Event schema、ProcessManager、Trigger、Check Timing、Cost / Effect Handler、Stage配置・Zone移動、カードデータ、CSSは変更しない。

## C. 実装と影響

- client/js/core/gameEngine.js：usable追加、非空Conditionのruntimeガード、評価済みQueryを描画へ渡す。
- client/js/core/renderer.js：Engine結果を表示し、独立domain判定・source探索と関連importを削除する。
- client/js/data/cardMasterLoader.js：AUTOの未対応Condition拒否を追加する。
- client/tests/pendingAutoAvailability.test.mjs：Queryの純粋性・描画受渡し、Cost / Effect不足、Encore membership、stale select/commit、payment境界、Loader/runtime、Rendererの動作を9件追加する。
- phaseF5D1 / D2テスト：変更された内部ソース表現への依存assertionを除き、新しいRenderer動作テストへ置き換える。既存UI画像・構造・レイアウト観点は維持する。

RULE / PRINTEDは同じQuery・使用・不使用経路を維持する。AUTO①は相手StockなしでもPending表示、AUTO②は複合Cost・検索・shuffle・resume、Encoreは3 Stock・元slot REST復帰を維持した。Pending追加・非FIFO再評価、優先順、解決中に追加Pendingを提示しない契約は変更していない。

## D. Condition基盤への接続

正式Condition Type / Resolverは実装していない。Loader経由と直接モデル生成の非空AUTO Conditionのsilent ignoreは塞いだ。次タスクは共通Engine評価へCondition availabilityを接続する。実在の代表カードを確認し、最初の必要Typeだけについてschema、Handler / Resolver、Loader allow-listとruntime validation、理由区分、表示/select/commitの現在State再評価、TriggerとCondition分離のテストを同時に追加する。Cost / Effect対象有無をConditionへ移さない。

## E. Documentation

現在仕様を更新したのはArchitecture、JavaScript仕様、ゲームエンジン、カード能力共通、AUTO能力共通。READMEは責務整理完了・NEXT Conditionへ更新した。Process / Rule Check / Encoreの既存仕様は変更不要である。

[修正方針](PendingAUTO_availability責務整理_修正方針.md)を実装前に作成し、本結果と[一覧](修正記録一覧.md)を追加した。[チェックシートひな形](../９．テスト/チェックシート_ひな形.md)へ2-6-4 / 2-6-5を追加し、既存IDを維持して[全量コピー実施結果](../９．テスト/実施結果/2026-10-09_PendingAUTO_availability責務整理.md)を作成した。ユーザー実機は全項目割愛、Codexブラウザは別記する。テスト運用の再描画補助をgameEngine.renderへ合わせた。

## F. 検証

- 関連：`node --test client/tests/pendingAutoAvailability.test.mjs client/tests/phaseF5*.test.mjs`：49 passed / 0 failed。
- 全体：`node --test client/tests/*.test.mjs`：114 passed / 0 failed（新規9件）。AUTO①②・Encore・Turn/NonTurn・Rule resume・Cost境界・Stage全slot回帰を含む。
- Chromium：ページロード、開始、初期手札、マリガン、使用不可理由・disabled・不使用、AUTO①・AUTO②の0枚検索とMAIN復帰、Encore元slot REST復帰、Encore source移動後の不使用、PC2列・狭幅モーダルを確認。fatal JavaScript errorなし。
- 開発パネルが検索決定ボタンに重なる既存状況があり、既存の折畳み操作で確認した。狭幅での検索決定は今回未確認。外部画像は既知の証明書問題でfallback確認に限定した。今回CSS・画像・環境設定は変更しない。
- git diff --check成功。変更Markdownのローカル参照108件に欠落なし。ひな形と実施結果の全57チェックID一致・重複なし。最終commit / PR / clean確認は完了報告に記載する。

## 判定

責務整理と回帰確認はPASS。RendererはDomainの評価結果を表示し、Conditionを同じEngine経路へ接続できる。次のgeneric Condition基盤はGO。本変更を採用したうえで、対応Typeのallow-list・runtime評価・理由区分・必要な回帰テストを同時実装する。外部画像とDEV表示の既知課題は別タスクで扱う。
