Summary
Phase F-4A「ACT Ability v1 基盤」を実装し、READMEの進捗を F-4A COMPLETE / F-4B NEXT に更新しました。コミットは 00e51b15e3a6377fd8b86243d7406d23db288e8a（feat: add ACT ability execution foundation）です。

COST_TYPE.PAY_STOCK、COST_TYPE.REST_SELF、EFFECT_TYPE.TEST_LOGをコード上の定数として追加しました。

ACT_ABILITY Processと、VALIDATE → PREPARE → PAY_COST → CHECK_POINT_AFTER_COST → RESOLVE_EFFECT → CHECK_POINT_AFTER_EFFECT → COMPLETEのStepを追加しました。

GameEngineに次のQuery / Action APIを追加しました。

getActAbilities()

getActAbilityDisabledReason()

canUseActAbility()

useActAbility()

ACT所持と使用可能性を分離し、自分のターン、MAIN、親MAIN ProcessのWAITING_INPUT、自分のStage、ACT定義、conditions、全Cost支払可能性を個別に検証します。

対戦中のAbilityは、新しいglobal IDを設けず、Process contextのsourceCardInstanceId + abilityIdで識別します。costIndexとeffectIndexも保持し、将来のRefresh割り込み・resumeに備えています。

VALIDATEではUI判定を信用せず、ターン、フェイズ、親MAIN Process、source Card、Stage所属、Ability type、conditions、Cost、Effectを再検証します。失敗時はCostやEffectを変更する前にACT Processを取り除きます。

PREPAREでCost / Effect indexを初期化し、PAY_COSTでは全Costの支払可能性を再検証してから、配列の記載順に支払います。

Cost Resolver / Handlerを新設しました。

PAY_STOCK: amountを正の整数として検証し、Stock配列末尾からWaiting Room配列末尾へ順番に移動します。

REST_SELF: source CardがSTANDの場合だけRESTにします。

支払可能性確認とmutationをgetDisabledReason / payとして分離しています。

全件事前検証後にのみ順次支払うため、部分支払いは発生しません。

未知Costは明確なunsupported errorになります。

Effect Resolver / Handlerを新設し、Development / Test専用のTEST_LOGを実装しました。messageを既存GameStateログへ記録し、未知Effectは明示的に拒否します。

CardMaster LoaderでACTのconditions、Cost、Effect schemaを検証し、未知Typeや不正parameterをJSON読込境界でfail-fastさせます。CardAbility自体は将来の定義をimmutableに保持する既存責務を維持しています。

開発用CardMasterに、以下の複数ACTを追加しました。

PAY_STOCK 1

REST_SELF

PAY_STOCK 1 + REST_SELF

いずれもTEST_LOGへ接続しており、実カードの集中処理は追加していません。

右上Card詳細に、ACTごとの本文、個別の「使用する」/「使用不可」ボタン、使用不可理由を描画するUIを追加しました。

MainPhaseControllerはAbility IDをGameEngineへ渡すだけとし、Stock移動やREST処理を直接行いません。既存のStage Move / Swap用選択・Destination表示とも共存します。

ACT完了後は共通Process完了処理によって親MAIN_PHASE / WAITING_INPUTへ戻り、再描画でStock、Waiting Room、REST状態、再評価されたdisabled理由が反映されます。

Rule Check境界は次のようにしました。

Cost開始前に全Costを検証。

Cost間ではRule Checkを一切実行しない。

全Cost支払い完了後にRule Check。

各Effect解決単位の完了後にRule Check。

ACT ProcessをpopしたAbility完了時にも共通出口でRule Check。

これにより、Cost支払い途中のRefresh / Level Up割り込みを防ぎつつ、将来F-4BのEffect途中でRefresh → Refresh Penalty → ACT resumeへ接続できます。

新設したカード能力.mdには、CardAbility schema、Ability種別、ACT実行フロー、context、Handler構造、対応Condition / Cost / Effect一覧、未知Type、CardMaster登録規則、effectQueueとの分離、Rule Check境界、F-4B追加検証事項を記載しました。

F-4A専用テストでは、ACT検出、タイミング、PAY_STOCK、REST_SELF、複数Costの原子性・順序、TEST_LOG、Process context、Rule Check回数、未知Type、UI責務分離を検証しています。

effectQueueは変更せず、AUTO / CONTINUOUS実行、AUTO待機、西森柚咲の集中、山札上4枚操作、CX count等は実装していません。

PRメタデータを feat: add ACT ability execution foundation というタイトルと、実装概要・Rule Check境界・テスト内容を含む本文で作成しました。

Rule Check / 公式ルール確認について
設計上は、指定された公式総合ルール Ver.1.112の「Costは記載順」「Cost支払い開始から完了まではRefresh / Level Upを挟まない」「一部でも払えなければCost全体を支払えない」という境界を採用しました。

F-4AのTEST_LOGはDeckを操作しないため、Effect途中の山札切れ、Refresh、Refresh Penalty、残り枚数への復帰は、F-4Bで実Effect Handlerとともに追加検証する項目として明記しています。

公式サイトへの外部アクセスは実行環境のHTTPプロキシにより拒否されたため、公式PDFそのものの再取得・ブラウザ表示はできませんでした。実装と文書化には依頼内で指定された版・ルール要件を使用しています。

Testing
✅ node --test client/tests/phaseF4A.test.mjs — 8 tests passed

✅ node --test client/tests/*.test.mjs — 37 tests passed

✅ find client -type f \( -name '*.js' -o -name '*.mjs' \) -print0 | xargs -0 -n1 node --check

✅ git diff --check

✅ rg -n "effectQueue|AUTO.*execute|CONTINUOUS.*execute|西森|集中|stock\.pop|setPosition\(POSITION\.REST" client/js/core/renderer.js client/js/ui/mainPhaseController.js client/js/core/gameEngine.js client/js/abilities docs/１．設計書/カード能力.md — Controller / RendererにAbility Cost mutationがなく、AUTO / CONTINUOUS実行やeffectQueue変更がないことを確認

✅ git status --short --branch — ## work、working tree clean

⚠️ curl -L --max-time 30 -sS -D /tmp/h 'https://ws-tcg.com/rules/' -o /tmp/rules.html — 実行環境のCONNECT tunnelがHTTP 403を返したため、公式サイトを再取得できませんでした

⚠️ command -v chromium chromium-browser google-chrome playwright — 利用可能なブラウザ実行環境がなく、スクリーンショットを含む目視確認は未実施です。ユーザー環境では、複数ACT表示、Stock/Waiting Room変化、REST後のdisabled理由、複数Cost支払不能時の非mutation、およびStage Move / Swapの継続動作をご確認ください。
