# Condition基盤・前列Condition 修正結果

## A. 調査結果

PR #40マージ後のmainを起点に、AGENTS、README、能力共通 / ACT / AUTO / Encore / 複合Cost、システム共通Architecture / JavaScript / カードデータモデル / Entity / Engine / Process / Rule Check、PR #39整合結果・#40方針/結果、修正記録とテスト運用を確認した。開始時の作業ツリーはclean。

PR #40後はgetPendingAutoOptionsが表示Queryであり、Engine内の共通理由評価を表示/select/commitで使用する。Rendererは評価済み候補の表示のみ。支払い直前はPrepared Costを防御的に再検証する。CardAbility.conditionsはimmutableなJSON互換配列だが、AUTOはLoaderの非空拒否とruntimeガード、ACTもLoader/runtimeで空配列制約だった。

sourceはPending.source.cardInstanceId / abilityIdで本人を解決し、masterIdは固定情報の参照である。所在はPlayer / Deck collection membership、Stage row/indexはfront 1～3 / back 1～2のslot座標。配列添字・Card.zone・別instanceを所在の正本にしない。

## B. 実装前に確定した設計

1. Typeは`CONDITION_TYPE.SOURCE_IS_FRONT_ROW`、定義場所は`client/js/constants/ability.js`。
2. schemaは`{ type: "SOURCE_IS_FRONT_ROW" }`のみ。追加field・parameterはrejectする。
3. `abilities/conditionResolver.js`内のHandler mapをallow-listとし、getConditionHandler / validateConditions / getConditionsDisabledReasonを公開する。過剰なクラス階層を作らない。
4. Handlerはvalidateと非mutationのgetDisabledReasonを分離。返却は既存Cost / Effectと同じstring / null。Ability TypeやPendingに依存しない。
5. Engineで既存Pending IDから取得したsource Cardと、現在Stateを読むlocateCard callbackを渡す。既存所在APIを再利用し、二重のlocation Stateや探索実装を追加しない。
6. Stage membership → 本人のfront / index 1～3のslotを確認する。sourceのzone metadata、同master別Card、Trigger時点のsnapshotでは成立させない。
7. 既存Engine private評価をevaluatePendingAutoAvailabilityへ拡張し、`usable / disabledReason / reasonCategory`を返す。定義・Encore固有sourceガード後はCondition → Cost → Effectの順で最初の不成立理由を採用する。
8. categoryを導入した。CONDITION / COST / EFFECTに加え既存ガードをDEFINITION / SOURCEとし、成功時null。既存string契約は残るためRendererやControllerの再設計は不要だった。
9. 全AUTOのLoader条件をvalidateConditionsへ置き換える。trigger=nullも同じ検証、空配列・省略は許可、null/非配列・未知Type・不正item/fieldをindexed errorでrejectする。
10. runtimeは全itemを先に検証し、unknown / malformedを診断理由付き使用不可へ変換する。正常Condition NGで後段の未知定義を隠さない。
11. Query/select/commitは同じEngine評価で現在Stateを読む。表示snapshotの保存・流用はしない。
12. payment開始後にCondition検証を挟まない。全Cost事前検証、記載順の同期支払い、item間Rule Checkなし、支払い直前Prepared Cost検証、保存位置resumeを維持する。
13. 今回のruntime接続はAUTOのみ。ACTは既存MAIN timing・VALIDATE・空Condition拒否を維持する。共通Resolverは将来ACTへ再利用可能だが、ACTのLoader許可と全再検証境界を同時に揃える別タスクが必要である。
14. Rendererは変更なし。評価済みusable / disabledReasonを表示し、Condition判断やsource探索を戻さない。
15. Event / Trigger / Pending schema、ProcessManager、Stage移動、Cost / Effect Type、正式データ、CSS、環境設定は変更しない。

## C. 主要実装と挙動

主要コードはconstants/ability.js、abilities/conditionResolver.js、core/gameEngine.js、data/cardMasterLoader.js。モデルのimmutable schemaを維持し、conditionsの実行可能性をResolver境界で検証する。

| 状態・操作 | 結果 |
| --- | --- |
| source前列 | Condition成立、Cost/Effectも可ならusable=true・理由/categoryなし |
| source後列 | TriggerでPending生成、CONDITION理由・使用disabled・不使用可能 |
| sourceがHand / Waiting Room / Memory / Stock / Deck | 現在collectionを正としてCondition NG。Stage/front metadataが残っていても不可 |
| Trigger後に前列→後列/Stage外 | 表示/select/commitで現在Stateを再評価、古いusableでは使用確定しない |
| 後列でTrigger後に前列へ | 現在Stateで成立すれば使用可能になる |
| 同masterの別instanceが前列 | source本人を代用せず、後列sourceのPendingは不可 |
| Condition・Cost・Effect同時NG | Condition理由が優先。前列へ移動後Cost理由、Stock追加後Effect理由、全解消で使用可能 |
| 使用しない | 当該Pendingだけconsume、Cost/Effectなし、残PendingまたはMAINへ復帰 |
| unknown / malformed | Loader拒否。直接モデル生成時もCONDITION理由で使用不可、Pendingは不使用で処理可能 |

## D. 回帰と今回実装しなかった基盤

空Conditionの標準Encore、AUTO①②は従来の共通availabilityへ接続したまま。既存テストで3 Stock・元slot REST・source移動、相手Stock置換とWaiting Room選択、複合Cost・0/1枚検索・公開Hand追加・shuffle、Refresh / Penalty / Level Up・parent resumeを確認した。

Cost全体の不可分境界、解決中Pending提示抑止、単一非FIFO collectionのD追加後B/C/D再評価、Turn / Non-Turn順、Stageの全slot不変条件を回帰確認した。新Conditionテストでもirreversible boundaryへ移管した後にCondition再評価で処理を巻き戻さないことを確認した。

代表実カード本体は実装していない。Attack Phase / 新Event / 新Cost / 新Effect / 一時的能力付与 / CONTINUOUS / オンラインへ進んでいない。正式CardMaster / DeckDefinitionへ架空能力は追加せず、テストファイルとブラウザのメモリfixtureだけで検証した。

## E. Documentation

現在仕様を更新したのはカード能力共通、AUTO能力共通、ACT能力共通、Architecture、JavaScript仕様、カードデータモデル、Entity一覧、ゲームエンジン。既に正しいProcess / Rule Check / Encore / 複合Costの詳細は変更していない。READMEにCondition共通基盤とAUTO前列Type完了・ACT未対応・NEXTを反映した。新Phase番号は作っていない。

[修正方針](Condition基盤_前列Condition_修正方針.md)をコード前に作成し、本結果と[修正記録一覧](修正記録一覧.md)を追加した。[ひな形](../９．テスト/チェックシート_ひな形.md)へ2-12-1～7を追加して既存IDを維持し、その時点の全量コピーで[実施結果](../９．テスト/実施結果/2026-10-09_Condition基盤_前列Condition.md)を作成した。自動確認とCodex Chromiumを区別し、ユーザー実機は全項目割愛である。

## F. 検証

- Condition関連：conditionAvailability.test.mjsの14 tests passed（関連実行に含む）。
- 関連：`node --test client/tests/conditionAvailability.test.mjs client/tests/pendingAutoAvailability.test.mjs client/tests/phaseF5*.test.mjs`：63 passed / 0 failed。
- 全体：`node --test client/tests/*.test.mjs`：128 passed / 0 failed（新規14件）。Refresh・Level Up・ACT集中・Stage回帰も含む。
- Chromium：ゲーム開始・初期手札5枚・0枚マリガン、前列fixtureのenabled・理由なし・使用・MAIN復帰、後列fixtureの理由・disabled・不使用、前列で誘発後Hand移動の現在State表示・不使用を確認。PCと390px幅のモーダル・理由・ボタンを画像でも確認。狭幅は表示のみ、操作はPCで確認した。fatal JavaScript errorなし。
- 外部画像問題の解決確認は今回実施していない。fixtureはURLなしでfallback表示。DEVは既存折畳みを利用し、UI重なり・スマホ盤面・CSSの別問題は変更していない。
- diff --check成功。変更Markdownのローカル参照118件に欠落なし。ひな形・実施結果の全64チェックID一致・重複なし、既存ID保持とユーザー実機OK未転記を確認した。最終status、commit / PRは完了報告へ記載する。

## 判定と次タスク

**PASS**：CardAbility共通の最小Condition Resolverが成立し、前列TypeがPending AUTOの表示・select・commitで安全に機能する。ACTの非空対応は今回の範囲外として明示した。

次は **D：その他の前提整備** を推奨する。追加Typeを先行して増やす根拠はなく、ACT完成も相手Phase開始AUTOの直接前提ではない。代表実カードの公式本文を確認して不足基盤を分解し、その後Aの能力全体を結合する。

| 分解対象 | 現在地・次タスクの単位 |
| --- | --- |
| Trigger / Phase | PHASE_STARTEDとphase値照合は存在するが相手手番限定照合は未対応。EventのturnPlayerIdを使う限定schema・Loader・Triggerテストを独立単位とする。実際のAttack進行は別タスク |
| Condition | 前列Typeは対応済み。新Typeはカード本文が要求するときだけ追加 |
| Cost | PAY_STOCK / REST_SELF / MOVE_DECK_TOP_TO_CLOCKのみ。指定カードDiscardが必要なら対象filter・選択・Prepared Cost・全体payment境界を揃えた独立単位にする |
| 検索Effect | SEARCH_DECK / ADD_TO_HAND / SHUFFLE_DECKは存在する。正式本文の対象条件が既存filterで表現可能か確認し、不足があれば限定拡張 |
| 正面選択・一時付与 | 正面キャラの対象選択、GRANTED供給、一時能力の保持・期限・失効は未実装。継続的攻撃制約との責務を設計して分割する |
| 能力全体の結合 | 上記対応後に実カードデータ登録・Trigger→Condition→Cost→Effectの結合確認を1タスクにする |

今回公式本文の未確認部分や条文番号を推測で補完していない。正式カードの同定・本文確認を前提とし、上記を実装済みとも扱わない。
