# Ability Type / Effect実行範囲整合 修正結果

## A. 調査とRoot Cause

AGENTSを最初に確認し、README、カード能力共通 / ACT / AUTO、カードデータモデル / JavaScript / GameEngine、CardAbility、Loader、Cost / Condition / Effect Resolver、Rule Provider、最近の複合Cost・availability・Condition履歴、テスト運用と現行テストを照合した。開始時clean。fetch後のmainは7132215（PR #42マージ後）で、専用branchを作成した。

Ability TypeはACT / AUTO / CONTINUOUS、正式EffectはTEST_LOG / BRAINSTORM_REVEAL / EFFECT_GROUP / SEARCH_DECK / ADD_TO_HAND / SHUFFLE_DECK / ENCORE_RETURN / REPLACE_OPPONENT_STOCK_TOPの8種。モデルはJSON互換定義のimmutable保持、Loaderは定義受付、Resolverはschema・一部解決、EngineはAbility固有Process制御を担当する。

従来LoaderはACT / AUTOともvalidateEffectsによるType存在・schemaだけを検証していた。AUTOのEffect availabilityも実行capabilityを見なかったため、AUTO + BRAINSTORM_REVEALを受理し、Pending consume・Cost支払い後に汎用resolveEffectで「requires ACT process resolution」例外となった。既存テストは対応済み能力と未知Type / schemaを主に確認し、既知Effectの不正Ability Typeとの組み合わせを扱っていなかった。

修正前の新規17件で2成功・15失敗を再現した。後から対応表全体・ACT VALIDATE・直接Resolver正常/不正文脈の3件を加え、新規は計20件である。

## B. Capability設計

[修正方針](AbilityEffect実行範囲整合_修正方針.md)を実装前に作成した。Loader専用allow-listは二重管理、Resolver別mapもHandlerの実行知識と離れるため採用しなかった。Effect HandlerにimmutableなsupportedAbilityTypes、必要なvalidateCapabilityを置き、共通validateAbilityEffectsが参照する最小方式を採用した。

| Effect | ACT | AUTO | 限定 |
| --- | --- | --- | --- |
| TEST_LOG | 可 | 可 | 開発/テスト用、共通resolve |
| BRAINSTORM_REVEAL | 可 | 不可 | ACT固有step / context / Resolution確認 |
| EFFECT_GROUP | 可 | 不可 | ACTトップレベルだけ。Group内Group不可 |
| SEARCH_DECK | 可 | 可 | ACTのmaxSelectは数値/結果参照、AUTOは数値のみ |
| ADD_TO_HAND | 可 | 可 | 先行検索等のinstance ID結果参照 |
| SHUFFLE_DECK | 可 | 可 | 既存shuffle経路 |
| ENCORE_RETURN | 不可 | 可 | RULE source / 元Stage slot snapshot必要 |
| REPLACE_OPPONENT_STOCK_TOP | 不可 | 可 | AUTO固有SELECT_ZONE_CARD child |

全非空EffectはCONTINUOUS非対応。Loaderは空effectsのplaceholderだけ保持可能とする。モデルの保持schemaを削らず、CONTINUOUS runtimeは実装していない。

PRINTED / RULEで別Effect体系を作らず共通validatorを使う。Encoreだけ元slotが必要な実行文脈のため補助source制約を置いた。GRANTED供給・一時能力は追加していない。

調査でACTの多段Group、AUTO検索の結果参照maxSelect、PRINTED Encoreに実行対応差があることも確認し、既存runtimeへ一般化せずcapabilityで受理範囲を閉じた。これらは今回の同じ不一致の範囲で解消し、新しい独立Blockerとして残していない。

## C. 実装と境界

- effectResolver.js：validateEffectsはschema・ID一意性に限定。validateAbilityEffectsでその後capabilityを検証し、Groupの子にも再帰適用する。capability例外は既存RangeErrorへ小さいcodeを付け、schema例外と区別する。Handler / metadataをfreezeし単一対応情報を守る。
- cardMasterLoader.js：Ability Type検証後、既存Condition / Cost / Trigger検証を維持し、全TypeのEffect検証を共通validatorへ委譲。trigger=nullのAUTOにも適用する。ErrorはAbility id / type・Effect typeを含み、Registry登録前にfail-fastする。
- gameEngine.js：ACT Query / VALIDATE、AUTO表示 / select / Prepared commitへ接続。両AbilityのPAY_COST直前とEffect実行入口にも防御を置く。Effect Type分岐や実mutation方式を追加・複製していない。
- resolveEffectのcontextへabilityTypeを明示。直接呼出しでもcapabilityと必要なEncore文脈を検証する。Process専用Effectの汎用resolveにはAbility Processを要求し、正常経路は従来orchestratorを使う。

capability NGは「この能力には実行できない効果が含まれています。」、schema NGは「効果の定義が不正です。」。AUTOは既存EFFECT categoryを使い、Condition → Cost → Effectの理由順とPending生成・表示・不使用semanticsを維持する。新taxonomy / reasonCategoryは追加していない。

Cost不足ならCost理由、Effect非対応ならEffect理由で使用不可となる。未対応EffectはCost支払い・Effect mutation・Pending consume前に拒否する。使用不可Pendingは生成・表示対象に残り、「使用」disabled・「使用しない」可能である。Prepared commitでも拒否し、直接ProcessのPAY_COSTから開始しても部分支払いしない。

## D. 検証した挙動と回帰

AUTO + Reveal、ACT + Stock置換 / Encore、ACT Group内AUTO専用Effect、二重Group、AUTO Group、AUTOの結果参照maxSelect、PRINTED Encore、CONTINUOUS非空EffectをLoaderで拒否した。正しいschemaであってもcapability NGを区別する。Loader bypass fixtureではQuery / select / Prepared commit / payment前に拒否し、Cost・Pending・Effect状態を変更しないことを確認した。

ACT / AUTO双方で共通SEARCH_DECK → ADD_TO_HAND → SHUFFLE_DECKをfixtureから完走し、同一instanceのHand追加・shuffle一度・親復帰を確認した。正式CardMaster JSON全件を通し、登録可能件数が元データ件数と一致した。対応済み実カードを通すための例外や本番テスト能力は追加していない。

既存テストでEncoreの3 Stock・元slot REST・Stage全slot、AUTO①のStock置換・exactly 1選択、AUTO②の異種Cost・0/1枚検索・shuffle、ACT集中のReveal / Group / 検索、複合Cost、Condition、Rule Check、Refresh / Penalty / Level Up、parent resumeを回帰確認した。

## E. Documentationと対象外

READMEは今回Follow-upを完了にし、F-5全体未完了・残3項目と中期方針を維持した。F-7以降の番号は正式化していない。

現在仕様はカード能力共通のcapability matrix / API・検証境界、ACT / AUTO、カードデータモデル、JavaScript仕様、GameEngineを更新。詳細対応表は共通正本へ集約し、他文書は責務・接続だけを記載した。

[修正記録一覧](修正記録一覧.md)を更新。[チェックシートひな形](../９．テスト/チェックシート_ひな形.md)は既存の使用不能理由 / disabled / 不使用 / 復帰観点で足りるため変更しない。Domain validationを画面チェックとして増やさず、[実施結果](../９．テスト/実施結果/2026-10-10_AbilityEffect実行範囲整合.md)は全量コピーし、ユーザー実機は全件割愛とした。Codex Chromiumは別記した。

Cost Resolver / Handler、Condition、Trigger、Event emission、Phase AUTO / resume、turn boundary、ACT Condition、新Cost / Effect、GRANTED、CONTINUOUS runtime、ゲーム進行、Online、Renderer / UI / 正式カードデータ / 設定は変更していない。

## F. 検証結果

- 新規：abilityEffectCapabilities.test.mjs、20 passed / 0 failed。
- 関連：新規 + compositeCosts + phaseF4* / phaseF5* + pendingAutoAvailability + conditionAvailability、132 passed / 0 failed。
- 全体：node --test client/tests/*.test.mjs、166 passed / 0 failed。skip / cancelled / todo 0。
- Chromium（PC 1440×1000）：一時的なPython静的HTTPサーバーで開始・初期手札5枚・0枚Mulligan・MAIN、集中のStock支払い / source REST / Resolution 4枚・確認・必要時検索・MAIN復帰、AUTO②のStock 1→0 / Clock 0→1 / 検索・0枚確定・残AUTO不使用・MAIN復帰、Encoreの3 Stock / 元front 1 REST / MAIN復帰を確認。準備はEngine正規操作、操作は既存Controllerを通す通常画面入力。fatal pageerrorなし。
- DEVは既存折畳みを利用。最初のEncore準備はSmoke側のZone名誤指定で停止したが、正しい値で全体を再実施して成功。アプリ変更による失敗ではない。外部画像の既知問題は今回解決確認していない。
- git diff --check成功。変更文書のMarkdown参照121件（日本語パス・anchor含む）を確認し、欠落なし。チェックシート64件のID・順序・観点を保持し、ユーザー実機は全件割愛。最終status / commit / PRは完了報告へ記載する。

## 判定と次のFollow-up

PASS：Ability Type / Effect実行範囲に関するF-5実行契約は成立した。schemaとcapabilityを分離し、Loaderとruntimeが同じ対応情報を使って未対応組み合わせをCost前に拒否する。F-5全体は引き続き未完了である。

現行main由来コードでPhase AUTO / resume、turn boundary Event、mutation / Event整合が残ることを再確認した。次は **Phase AUTO / resume** を1タスクとして推奨する。Phase由来Pendingを提示できず、MAIN終了時のPending処理後に次Phase継続を失う経路があり、既存AUTO基盤を通常進行へ安全に接続するための優先課題である。相手Phase Trigger拡張やAttack実装とは分離する。
