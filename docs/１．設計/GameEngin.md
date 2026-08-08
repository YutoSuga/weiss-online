# GameEngine v2 設計書

## Purpose

`GameEngine`はゲームルールの進行、`GameState`の更新、`Renderer`への再描画要求を担当する。

次の処理は担当しない。

- DOM操作
- HTMLの直接変更
- ボタン、クリック、選択表示などのUIロジック

`Renderer`は`GameState`を読み取って画面へ反映するだけとし、ゲーム状態を変更しない。

## Responsibilities

### Public methods

| Method | 日本語名 | Purpose | Parameters | Return value | Processing summary |
|---|---|---|---|---|---|
| `startGame()` | ゲーム開始 | ゲームの初期準備 | なし | `void` | 両山札をシャッフルし、初期手札を配り、先攻のマリガンを開始して再描画する |
| `drawInitialHand()` | 初期手札配布 | 両プレイヤーへ5枚ずつ配る | なし | `{first: Card[], second: Card[]}` | `turnOrder`順に`drawCards()`を呼ぶ |
| `startMulligan()` | マリガン開始 | マリガン状態を開始する | なし | `void` | `active`を有効にし、操作対象を先攻へ設定してフェイズを`MULLIGAN`へ変更する |
| `mulligan(playerId, handIndexes)` | マリガン実行 | 選択した手札を控え室へ送り同数引く | プレイヤーID、1始まりの手札番号配列 | `Card[]` | 操作権を検証し、カード移動とドロー後に次のプレイヤーまたは通常ターンへ進む |
| `drawCards(playerId, count)` | 複数枚ドロー | 指定プレイヤーが複数枚引く | プレイヤーID、0以上の整数 | `Card[]` | `drawCard()`を繰り返し、結果をログへ記録する |
| `nextPhase()` | 次フェイズへ進行 | 次に入るフェイズを決定する | なし | `void` | `getNextPhase()`で決定し、常に`enterPhase()`へ委譲する |
| `addLog(player, message)` | ログ追加 | 対戦ログを追加する | プレイヤー識別子、メッセージ | `GameLogEntry` | 配列参照を保ったまま最新20件に制限する |

`drawInitialHand()`、`startMulligan()`、`drawCards()`は構成処理のため個別描画しない。操作の終端で`startGame()`、`mulligan()`、`nextPhase()`、`endTurn()`が`render()`を呼ぶ。

### Internal methods

| Method | 日本語名 | Purpose | Parameters | Return value | Processing summary |
|---|---|---|---|---|---|
| `drawCard(playerId)` | 1枚ドロー | 山札から手札へ1枚移動 | プレイヤーID | `Card\|null` | `Deck.draw()`を使い、`owner`、`zone`、`row`、`index`を更新する。山札切れ時はログを残す |
| `getNextPhase()` | 次フェイズ決定 | 現在フェイズから次フェイズを決める | なし | `string` | 状態変更やフェイズ固有処理を行わず、次のフェイズだけを返す |
| `enterPhase(phase)` | フェイズ進入 | 指定フェイズへ入り開始処理を実行する | フェイズ | `void` | `phase`を更新し、対応する開始処理後に再描画する |
| `startStandPhase()` | STAND開始処理 | 現在プレイヤーの舞台をSTANDにする | なし | `void` | 現在ターンのプレイヤーの舞台カードだけをSTANDにする |
| `startDrawPhase()` | DRAW開始処理 | 通常の1枚ドローを行う | なし | `void` | 現在ターンのプレイヤーに対して既存の`drawCards()`を呼ぶ |
| `endTurn()` | ターン終了 | 手番交代と次のSTAND開始 | なし | `void` | `turnOrder`を参照して交代し、後攻終了時だけターン番号を増やす |
| `render()` | 再描画要求 | Rendererへ現在状態を渡す | なし | `void` | `renderer.render(gameState)`だけを呼ぶ |

内部メソッドはUIから直接呼び出すことを前提としない。

## Game Start Flow

```text
Game Start
    ↓
Determine Turn Order (Currently fixed)
    ↓
Shuffle both decks
    ↓
Draw Initial Hand
    ↓
Start Mulligan
    ↓
First Player Mulligan
    ↓
Second Player Mulligan
    ↓
Turn 1
    ↓
STAND Phase
```

`startGame()`直後は通常ターンを開始せず、マリガン完了を待つ。マリガン中は次の状態を使用し、`nextPhase()`を許可しない。

```js
phase = PHASE.MULLIGAN;
turn.player = null;
turn.number = 0;
```

## Turn Order

```js
turnOrder = {
  first: "self",
  second: "opponent",
};
```

現在は`first = self`、`second = opponent`で固定する。将来はランダム決定またはネットワーク同期へ変更する。

GameEngineは`self`を先攻として決め打ちせず、常に次を参照する。

```js
gameState.turnOrder.first
gameState.turnOrder.second
```

## Mulligan State

```js
mulliganState = {
  active: false,
  currentPlayer: null,
};
```

- `active`: 現在マリガンモードかを表す。
- `currentPlayer`: 現在マリガン操作を許可されたプレイヤー。非実行時は`null`。

```text
inactive
    ↓
first player
    ↓
second player
    ↓
inactive
```

## Mulligan Flow

```text
Initial Hand
    ↓
Player selects cards
    ↓
Press Mulligan button
    ↓
Selected cards move to Waiting Room
    ↓
Draw same number
    ↓
Next player
    ↓
Finish
```

`handIndexes`は画面および`Card.index`と同じ1始まりとする。重複、範囲外、整数以外は不正入力とする。空配列による0枚選択を許可する。

選択カードは手札順を維持して控え室の末尾へ移す。残った手札と新しく引いたカードは1から連続する`index`へ再採番する。

後攻のマリガン完了時は次を設定する。

```js
mulliganState.active = false;
mulliganState.currentPlayer = null;
turn.player = turnOrder.first;
turn.number = 1;
phase = PHASE.STAND;
```

## drawCards()

複数枚ドローは`Deck`ではなく`GameEngine`へ配置する。

### Deck responsibilities

- `draw()`
- `shuffle()`
- `peek()`
- 山札上・下へのカード追加

### GameEngine responsibilities

- 複数枚ドロー
- 手札ゾーンへの追加
- `owner`、`zone`、`index`の更新
- ログ記録
- 将来の山札切れルール処理

`drawCards()`は内部で`drawCard()`を繰り返す。v2では山札切れ時に停止してログへ記録し、リフレッシュは行わない。

## Phase Control

フェイズ進行は「次フェイズの決定」と「フェイズへ入った直後の処理」を分離する。

- `nextPhase()`：現在フェイズから次フェイズを決定し、常に`enterPhase()`へ委譲する。
- `getNextPhase()`：現在フェイズから次フェイズを決定する。フェイズ固有処理や状態更新は行わない。
- `enterPhase(phase)`：指定フェイズを`GameState`へ設定し、対応するフェイズ開始処理を実行してから再描画する。ENDからSTANDへ入るときは`endTurn()`へターン交代を委譲する。
- `startStandPhase()`：現在ターンのプレイヤーの舞台にある全カードを`stand`へ変更する。相手の舞台は変更しない。
- `startDrawPhase()`：既存の`drawCards()`を使い、現在ターンのプレイヤーが1枚引く。

STANDとDRAWは開始処理後も同じフェイズに留まり、自動的に次フェイズへは進まない。最初のターンおよびターン交代後も、`enterPhase(PHASE.STAND)`を通して同じSTAND処理を実行する。

通常フェイズへ入ると、`enterPhase()`は`PHASE_LABELS`を参照して既存の`messageOverlay`を現在フェイズ名へ更新する。説明文は空文字とし、次フェイズへ入るまで表示を維持する。手札交換中は専用の既存文言を使用する。ENCOREは独立ラベルを持たず、暫定的にATTACK表示を維持する。

> TODO: `PHASE.ENCORE`は既存フローへの影響を避けるため暫定的にトップレベルフェイズとして維持する。ATTACK内部のEncore Stepを実装する際に整理する。

## Future Extensions

- 先攻プレイヤーのランダム決定
- オンライン対戦時の同期
- リプレイ対応
- 山札切れ時のリフレッシュ
- リフレッシュダメージ
