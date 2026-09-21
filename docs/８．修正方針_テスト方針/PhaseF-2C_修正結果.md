# PhaseF-2C 修正結果

対象：Stage Move・Swap

出典：Codexタスク「Phase D共通ルールチェック設計」（ID: 01a00a4d-c312-7680-917e-75f38686b7e9）。

2026-09-21に取得できた会話記録から作成。本文は当時の依頼・完了報告を原文中心に収録しています。記載されたテスト・コミット・push・作業ツリー状態は当時の報告であり、今回再実行・再検証した結果ではありません。パス・リンク・NEXTも当時の表記を保持しており、現在と異なる場合があります。

---

## 完了報告（2026-09-14 00:35 JST）

出典ターン：01a09b68-f2a7-74a2-8ec4-a6325148aafe

Phase F-2Cの実装と回帰確認が完了しました。変更はまだコミットしていません。

【変更ファイル】

- [process.js](C:/Users/sugay/git/weiss-online/weiss-online/client/js/constants/process.js)
- [gameEngine.js](C:/Users/sugay/git/weiss-online/weiss-online/client/js/core/gameEngine.js)
- [mainPhaseController.js](C:/Users/sugay/git/weiss-online/weiss-online/client/js/ui/mainPhaseController.js)
- [index.html](C:/Users/sugay/git/weiss-online/weiss-online/client/index.html)
- [README.md](C:/Users/sugay/git/weiss-online/weiss-online/README.md)
- [main-phase.md](C:/Users/sugay/git/weiss-online/weiss-online/docs/１．対戦画面設計書/main-phase.md)

【Selection】

`selectedCard`、`selectedHandIndex`、確認中Destinationは引き続き`MainPhaseController`に保持しています。GameStateには追加していません。

HandカードとStageカードは同じ`selectedCard`を排他的に使い、`card.zone`により処理を分岐します。

【Query API】

GameEngineへ以下を追加しました。

- `canSelectStageCardForMain()`
- `getMainStageMoveDestinations()`
- `canMoveStageCard()`

自分ターン、MAIN、親ProcessのWAITING_INPUT、所有者、zone、cardType、現在位置を確認します。

【MOVE_STAGE】

Process構造：

```text
VALIDATE
→ MOVE
→ CHECK_POINT
→ COMPLETE
```

実行直前に親MAIN、ターン、source位置、Destination、空slotであることを再検証します。

Moveでは`row`と`index`だけを更新し、Cost、Stock、Waiting Roomには触れません。

【SWAP_STAGE】

Process構造：

```text
VALIDATE
→ SWAP
→ CHECK_POINT
→ COMPLETE
```

sourceとDestinationカードのID・現在位置を再検証してから、双方の`row/index`を交換します。即Swapせず、独自確認UIを経由します。

【UI】

使用中slotの確認UIに以下を実装しました。

- 「入れ替える」
- 「このカードを選択」
- 「戻る」

Hand選択時は「置き換える」、Stage選択時は「入れ替える」に切り替わります。

Stage選択では既存の黄色い`.is-selected`と青い`.is-main-destination`を再利用し、現在slotを除く4slotを候補表示します。

【状態保持】

Move／Swapとも次の値を変更しません。

- `position`
- `face`
- `currentPower`
- `currentSoul`

STAND、REST、REVERSEそれぞれの保持を確認しました。

【F-2Bとの共存】

- Hand → 使用中Stage：Replacement
- Stage → 使用中Stage：Swap

として選択元zoneで分岐します。

Replacement確認から「このカードを選択」を押し、Destination側Stage Characterへ選択を切り替える処理も追加しました。

【確認結果】

Case A〜Hをブラウザ上で確認し、すべて成功しました。

- STAND Move
- REST Move
- REVERSE Move
- positionを保持したSwap
- Destinationカードへの選択切替
- 「戻る」による元選択維持
- Hand Replacementとの区別
- Stage Swapとの区別
- Cost／Stock／Waiting Roomが変化しないこと
- MAIN_PHASE / WAITING_INPUTへの復帰
- MAIN終了時のSelection cleanup

既存のF-2B、test-cards.json、Level／Color／Cost、Stock TOP支払い、Replacement、相手CLOCK skip、相手MAIN終了、Stock表示のテストも通過しています。

【NEXT】

READMEではF-2Cを完了へ更新し、NEXTを「Phase F-3 CardMaster / CardAbility v1」に変更しました。

---

## 後続のコミット・push報告（2026-09-14 09:03 JST）

出典ターン：01a09d39-9272-7fa1-ad35-4d6f03040b8c

コミット・push完了しました。

- ブランチ: `main`
- コミット: `79b661e feat: implement stage move and swap`
- リモート: `origin/main`
- 作業ツリー: クリーンです。

※上記本文の「未コミット」は各完了報告時点の状態です。後続の状態はこのコミット・push報告を参照してください。

