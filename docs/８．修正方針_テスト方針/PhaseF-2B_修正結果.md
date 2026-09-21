# PhaseF-2B 修正結果

対象：Character HandからStageへのPlay

出典：Codexタスク「Phase D共通ルールチェック設計」（ID: 01a00a4d-c312-7680-917e-75f38686b7e9）。

2026-09-21に取得できた会話記録から作成。本文は当時の依頼・完了報告を原文中心に収録しています。記載されたテスト・コミット・push・作業ツリー状態は当時の報告であり、今回再実行・再検証した結果ではありません。パス・リンク・NEXTも当時の表記を保持しており、現在と異なる場合があります。

途中で書き込み権限による停止報告がありますが、その後の実装完了報告を以下に収録しています。コミットf2b4be8はFollow-up 2とF-2Bをまとめた共通コミットです。

---

## 完了報告（2026-09-13 23:03 JST）

出典ターン：01a09b14-4720-7332-8b7a-d486d43e2670

Phase F-2B本体の実装と回帰確認まで完了しました。現在は未コミットです。直前のFollow-up 2の変更も保持されています。

## 変更ファイル

- [README.md](C:/Users/sugay/git/weiss-online/weiss-online/README.md:107)
- [board.css](C:/Users/sugay/git/weiss-online/weiss-online/client/css/board.css)
- [index.html](C:/Users/sugay/git/weiss-online/weiss-online/client/index.html:283)
- [process.js](C:/Users/sugay/git/weiss-online/weiss-online/client/js/constants/process.js:10)
- [gameEngine.js](C:/Users/sugay/git/weiss-online/weiss-online/client/js/core/gameEngine.js:502)
- [renderer.js](C:/Users/sugay/git/weiss-online/weiss-online/client/js/core/renderer.js:170)
- [devController.js](C:/Users/sugay/git/weiss-online/weiss-online/client/js/ui/devController.js)
- [mainPhaseController.js](C:/Users/sugay/git/weiss-online/weiss-online/client/js/ui/mainPhaseController.js:192)
- [main-phase.md](<C:/Users/sugay/git/weiss-online/weiss-online/docs/１．対戦画面設計書/main-phase.md:27>)

## GameEngine

追加したQuery API：

- `canPlayCharacterToStage(card, playerId)`
- `getCharacterPlayDisabledReason(card, playerId)`

判定条件：

1. 自分ターンの `MAIN_PHASE / WAITING_INPUT`
2. 自分のHandに存在するCharacter
3. `card.level <= player.level.length`
4. Level 1以上はLEVELまたはCLOCKに同色カードが存在
5. `player.stock.length >= card.cost`

プレイ不可カードも選択・詳細表示は可能です。Level、Color、Stockの優先順で理由を右カード説明内へ表示し、Destinationは表示しません。

Action確定時はGameEngineで再検証します。失敗時はProcess開始前、または `VALIDATE` で停止するため、Costだけ支払われる状態にはなりません。

## PLAY_CHARACTER Process

追加したProcess：

```text
PLAY_CHARACTER
```

step：

```text
VALIDATE
→ PAY_COST
→ REMOVE_EXISTING
→ MOVE_TO_STAGE
→ CHECK_POINT
→ COMPLETE
```

処理経路：

```text
MAIN_PHASE / WAITING_INPUT
↓
PLAY_CHARACTERをpush
↓
各stepを実行
↓
completeCurrentProcess()でpop
↓
MAIN_PHASE / WAITING_INPUTへ復帰
```

Characterを1枚出してもMAINは終了せず、複数回Playできます。

## Cost

- Stock TOP：配列末尾
- Waiting Room TOP：配列末尾
- Costは `stock.pop()` でTOPから1枚ずつ支払い
- 支払いカードは `waitingRoom.push(card)`

移動後の状態：

```text
zone     = waiting-room
row      = null
index    = waitingRoom末尾
position = stand
face     = null
```

Cost 2、Stock `[A, B, C, D]` では、`D → C` の順で控え室へ移動することを確認しました。

## Replacement

空きslot：

- Hand CharacterだけをStageへ移動

使用中slot：

- Destinationクリック時点では移動しない
- 独自の確認UIを表示
- 「置き換える」で既存StageカードをWaiting Roomへ送り、新Characterを同じrow/indexへ配置
- 「戻る」で確認UIだけを閉じ、Hand Selectionを維持

Stageカードの「このカードを選択」は、F-2CのStage Selection設計を先取りするため今回は導入していません。

新Characterの状態：

```text
zone     = stage
row      = Destination row
index    = Destination index
position = stand
face     = null
```

## Rule Check

Cost支払い、Replacement、Stage配置を一連Actionとして完了した後にだけ `CHECK_POINT` を実行します。

```text
MOVE_TO_STAGE
↓
CHECK_POINT
↓
resume stepをCOMPLETEへ保存
↓
resolveRuleCheck()
```

`CONTINUE` 以外なら停止し、割り込み完了後に `PLAY_CHARACTER / COMPLETE` から再開します。

## UI

- プレイ不可理由をカード詳細パネル内へ追加
- プレイ可能な場合だけStage 5slotを青表示
- 使用中slotでは標準`confirm()`を使わずReplacement確認UIを表示
- Selection、pending Destination、確認表示はすべて`MainPhaseController`ローカル
- Play完了時にカード選択、Destination、確認UIをクリア
- GameStateへ未確定UI状態は保存していません

## 確認結果

成功した確認：

- Level 0 / Cost 0の空きStage配置
- Level条件NGと理由表示
- Color条件NGと理由表示
- Color条件OK
- Stock不足と理由表示
- Cost 2をStock TOPから順番に支払い
- 空きslot配置
- 使用中slotで即時置換されない
- Replacement確認の「戻る」
- Replacement実行
- Action直前のStock変化によるvalidation失敗
- validation失敗時にHand・Waiting Roomが変化しない
- Play後のSelection cleanup
- 連続2回Play
- `PLAY_CHARACTER` pop後の `MAIN_PHASE / WAITING_INPUT`
- F-2A Query
- 相手CLOCKスキップ
- 相手MAIN終了
- Stock表示・動的圧縮
- DRAW
- REFRESH
- REFRESH_PENALTY
- LEVEL_UP
- JS構文確認
- `git diff --check`

READMEはF-2Bを完了へ変更し、NEXTをPhase F-2C Stage → Stageへ更新しました。

F-2Cへ持ち越した内容：

- Stageカード選択
- Stage → Stage Move
- 使用中Stage同士のSwap
- Replacement確認からのStageカード選択切替

CardMaster導入までは、`cardType === "character"` と色文字列比較を維持しています。

---

## 後続のコミット・push報告（2026-09-13 23:17 JST）

出典ターン：01a09b21-963d-7f72-93e1-94a8c9186446

コミットとpushが完了しました。

- Commit: `f2b4be8 feat: implement character play to stage`
- Push: `70f8e9f..f2b4be8 main -> main`
- 対象: Follow-up 2とPhase F-2B、README・設計書更新
- Working tree: clean

※上記本文の「未コミット」は各完了報告時点の状態です。後続の状態はこのコミット・push報告を参照してください。

