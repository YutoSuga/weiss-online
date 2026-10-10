# 複合Cost全体判定 修正結果

## A. 調査・Root Cause

AGENTS、README、カード能力共通 / ACT / AUTO、GameEngine / Process / JavaScript仕様、Cost / Effect / Condition Resolver、EngineのQuery / select / Prepared commit / payment、最近のavailability・Condition修正結果、テスト運用を照合した。開始時clean。origin/mainをfetchし、起点4c4fe72の内容が調査時HEADと同一であることを確認して専用branchで作業した。

現行CostはPAY_STOCK（positive integer）、MOVE_DECK_TOP_TO_CLOCK（amount=1固定）、REST_SELF（STAND必要）の3Type。getCostsDisabledReasonは各Handlerを同じmutation前Stateで独立評価し、前Costによる消費を後Costへ反映しなかった。payCostsも同じ判定後に同期記載順で実mutationするため、Stock 1にPAY_STOCK 1×2は最初の支払い後にundefined.moveToで例外となる。既存テストは異種Cost不足・通常の単一Stock Costを確認していたが、同じ資源の重複消費を扱っていなかった。

修正前に新規18テストを実行し8成功・10失敗。Stock / Deck / REST重複のavailability誤判定、stale select / Prepared commitでのpayment途中例外を再現した。

## B. 比較・採用方式

[修正方針](複合Cost全体判定_修正方針.md)を実装前に作成した。

- ResolverでTypeごとに合計予約する方式：単純な枚数には使えるがType分岐の集中と順序依存の表現不足がある。
- Handlerが仮想contextを順番に更新する方式：既存責務を維持し最小の3値で足りるため採用。
- simulation用Player / Cardを作る方式：モデル模倣が増え、今回不要。

Resolverは全schemaを先に検証し、stockCount / deckCount / sourcePositionだけのローカル資源状態を作る。配列順にgetDisabledReasonで判定し、成立したHandlerのconsumeAvailabilityで仮想消費する。実GameState / Player / Card / collectionは参照するだけで変更しない。実際の支払い・schema・Type固有理由はHandler、全体順序と共通境界はResolverが担当する。GameState clone / transaction / rollback / undoは導入していない。

## C. 接続・実行契約

getCostsDisabledReasonの公開signatureは維持。ACT Query / VALIDATEとAUTOの表示・select・commitは既存経路から全体判定へ接続し、GameEngine / Rendererのコード変更は不要だった。

prepareCostSelectionsの対象選択準備は維持し、getPreparedCostsDisabledReasonは選択整合検証後にcurrent Stateから全体判定する。現行3Typeは選択不要。将来の選択Cost追加時には対象の重複予約や支払いの影響をHandlerの仮想消費へ整合させる必要があり、その仕様を先行実装したものではない。

payCosts自身も全Costをnon-mutating再検証し、NGなら例外として実mutation / onPaid callback 0件で拒否する。全体OK後は通常availabilityをitem間に挟まず、既存payを記載順に実行する。Rule Checkもitem間に挟まず全Cost後に入る。costIndex保存・AUTOのpayment監査値・Check Point・Rule child後resumeは変更していない。

正常なcollectionと同じState上の現行Handlerについてavailabilityとpaymentが一致する。任意callbackの例外、不正Card object、外部によるpayment中mutationまでrollbackする汎用transaction保証は対象外である。

## D. 主要ケースと回帰

| ケース | 結果 |
| --- | --- |
| Stock 1 / PAY_STOCK 1×2 | Stock理由で拒否、Stock 1・Waiting Room不変 |
| Stock 2 / PAY_STOCK 1×2 | Stock TOPから2枚を記載順に一度ずつ支払い |
| Stock 2 / PAY_STOCK 1+2 | 全体不足、mutation 0件 |
| Stock 3 / PAY_STOCK 1+2 | 3枚支払い、順序・同一instance維持 |
| Deck 1 / Deck top Clock×2 | Deck / Clock / metadata不変 |
| Deck 2 / Deck top Clock×2 | Deck TOP順に2枚Clockへ移動 |
| STAND / REST_SELF×2 | 2件目仮想RESTで不可、実sourceはSTANDのまま |
| Stock + Deck + REST | 互いに干渉せず記載順支払い、逆順も成功 |
| 異種Costの各資源不足 | 先行Costも支払わずmutation 0件 |
| Prepared後・表示後のStock減少 | current Stateで再検証、Pending consumeなし |
| 使用不能AUTO | 表示対象・COST理由・使用disabled・不使用可能を維持 |
| ACT複合Stock | 共通Resolverで不足拒否、十分ならMAIN復帰 |

既存全体テストで標準EncoreのStock 3と不足・元slot REST・Stage全slot、AUTO①の相手Stock置換、AUTO②の異種Cost順序・0/1枚検索・shuffle、ACT集中、Condition、Refresh / Penalty / Level Up、Cost item間Checkなし・parent resumeを回帰確認した。

## E. Documentation・対象外

READMEの現在地点をF-5完了前Follow-up対応中へ更新し、複合Cost完了と残る4項目を明記した。中期方針はF-5安全化・完了レビュー→最小CONTINUOUS→ゲーム進行→Full Turn→Local Full Match→Deck / Setup→Online基盤→Online Match。F-7以降の番号を正式確定していない。

正本更新は[カード能力共通](../１．設計書/対戦画面/カード能力/カード能力共通.md)のCost契約とACT / AUTOの接続説明。Engine / Process / JavaScript仕様は既に共通正本を参照し、API・責務・step変更がないため本文を重複追記していない。

画面の新規機能はなく、既存のCost不足・disabled・不使用・再評価・Cost境界観点で足りるため、チェックシートひな形のIDは追加・変更していない。Domain atomicityはcompositeCosts.test.mjsで保証し、[実施結果](../９．テスト/実施結果/2026-10-10_複合Cost全体判定.md)は現行ひな形の全量コピーで記録した。ユーザー実機は全件割愛、Codexブラウザ結果は別記している。

Event emission整合、Ability Type / Effect対応範囲、Phase AUTO / resume、turn boundary Event、ACT Condition、新Cost / 選択Cost、代表実カード追加、CONTINUOUS以降は対象外。カードデータ・Engine・Renderer・Controller・設定を変更していない。

## F. 検証

- 新規：compositeCosts.test.mjs、18 passed / 0 failed。
- 関連：compositeCosts、phaseF4*、phaseF5*、pendingAutoAvailability、conditionAvailability、112 passed / 0 failed。
- 全体：node --test client/tests/*.test.mjs、146 passed / 0 failed、skip / cancelled / todo 0。
- Chromium：一時的なPython静的HTTPサーバーでclientを開き、開始・初期手札5枚・0枚マリガン・MAIN到達を確認。Engine正規操作で実在集中Card / Stockを準備し、通常画面のACT使用・Resolution確認・必要時検索確定・MAIN復帰を操作。AUTO②も通常のPending使用・0枚検索確定・残AUTO不使用・MAIN復帰を確認した。Stock 1→0、Clock 0→1、集中source REST / Resolution 4枚を確認。fatal pageerrorなし。
- DEVパネルがCLOCKボタンに重なり初回Smokeが停止したため、既存折畳み操作で再実施し成功。UI / CSSは変更していない。外部画像の表示問題解決は今回確認していない。
- diff --check成功。変更Markdownのローカル参照107件（日本語path・fragment含む）に欠落なし。チェックシート全64 IDの一致・重複なし・全量コピー整合・ユーザー実機全件割愛を確認した。commit / PR / 最終statusは完了報告へ記載する。

## 判定・次のFollow-up

PASS：複合Cost全体の支払可能性と部分mutation防止に関するF-5実行契約は成立。F-5全体をCOMPLETEとはしない。

現行main由来コードにはAUTO向けLoaderのEffect validationと実行対応範囲の差、Phase開始Pendingの提示 / MAIN出口resume、endTurn後の旧Phase手番snapshot、Cost移動などのCARD_MOVED未発行が残る。今回はそれらを修正していない。新しい独立Blockerは発見していない。

次は **Ability Type / Effect実行範囲の整合** を1タスクとして推奨する。受理されたAUTOにACT専用Effectが入ると、Cost支払い・Pending消費後に実行例外となるため、今回のCost安全化に続き定義受付とruntime契約を揃える優先度が高い。
