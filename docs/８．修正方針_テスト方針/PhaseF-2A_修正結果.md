# PhaseF-2A 修正結果

対象：MAINカード選択・Destination UI

出典：Codexタスク「Phase D共通ルールチェック設計」（ID: 01a00a4d-c312-7680-917e-75f38686b7e9）。

2026-09-21に取得できた会話記録から作成。本文は当時の依頼・完了報告を原文中心に収録しています。記載されたテスト・コミット・push・作業ツリー状態は当時の報告であり、今回再実行・再検証した結果ではありません。パス・リンク・NEXTも当時の表記を保持しており、現在と異なる場合があります。

コミット70f8e9fはF-2A本体とFollow-up修正をまとめた共通コミットです。

---

## 完了報告（2026-09-11 23:19 JST）

出典ターン：01a090d6-c0a4-7422-a82f-f0a9e1d1eff6

Phase F-2A「MAINカード選択 / Destination UI」の実装が完了しました。

変更ファイル：

- `README.md`
- `client/index.html`
- `client/css/board.css`
- `client/js/core/gameEngine.js`
- `client/js/core/renderer.js`
- `client/js/main.dev.js`
- `client/js/ui/mainPhaseController.js`
- `docs/１．対戦画面設計書/main-phase.md`

実装内容：

- Selection Stateは `MainPhaseController` の `selectedCard` / `selectedHandIndex` に保持
- `GameState` には保存していない
- `GameEngine` に以下のQuery APIを追加

  - `canSelectCardForMain(card, playerId)`
  - `getMainDestinationCandidates(card, playerId)`

- 選択条件は以下に限定

  - MAIN Phase
  - `MAIN_STEP.WAITING_INPUT`
  - 自分ターン
  - 自分の手札
  - `cardType === "character"`

- 選択カードには既存の `.is-selected`
- 選択可能な手札には既存の `.is-selectable`
- EVENTなどの対象外カードには `.is-unselectable`
- Destinationには専用の `.is-main-destination` と `data-main-destination="true"` を使用
- 自分Stageの前列3・後列2を、使用状況にかかわらず候補表示
- Destinationクリックでは何も実行せず、Selectionを維持
- 右カード詳細に名前・種類・レベル・コスト・パワー・ソウル・特徴・テキストを表示
- カード詳細内に「選択を解除」ボタンを追加
- 盤面のカード・Destination・各操作UI以外を空白クリックとして解除
- MAIN終了前にSelection UIを消去
- CLIMAX遷移後やMAIN以外では動作しない
- `MAIN_PHASE` のstepは選択中も `WAITING_INPUT` のまま

確認結果：

- GameEngine Query条件：成功
- CHARACTER選択・別カードへの切替：成功
- カード詳細表示：成功
- Stage 5枠のDestination表示：成功
- 使用中Stageを含む候補表示：成功
- 解除ボタン：成功
- 盤面空白クリック解除：成功
- Destinationクリック後の手札・Stage・Stock・控え室不変：成功
- Destinationクリック後のSelection維持：成功
- MAIN終了後のCLIMAX遷移：成功
- MAIN終了時のSelection消去：成功
- MAIN以外での選択無効：成功
- Mulligan・CLOCKの既存候補表示：成功
- JavaScript構文・差分チェック：成功

READMEはPhase F-2Aを完了済みにし、NEXTを「Phase F-2B Character Hand → Stage」へ更新しました。移動後の設計書パスに合わせ、README内のリンクも修正しています。

F-2B向けのカード移動、Replacement、Level・Color・Cost条件、Stock支払いは意図的に未実装です。

設計上の留意点として、現在の `cardType` は文字列比較です。CardMaster導入時には定数化や参照方式の移行が必要になります。

---

## 後続のコミット・push報告（2026-09-12 00:59 JST）

出典ターン：01a09131-c280-74c3-ac52-a3ebd8bbaa2a

未コミット分をまとめてコミットし、`origin/main` へpushしました。

- Commit: `70f8e9f feat: implement main card selection UI`
- Push: `60bf83b..70f8e9f main -> main`
- Working tree: clean
- 変更内容: Phase F-2A本体、Follow-up修正、README・設計書更新を含む10ファイル

※上記本文の「未コミット」は各完了報告時点の状態です。後続の状態はこのコミット・push報告を参照してください。

