# MAIN Phase 設計書

## 目的と適用範囲

本書は、MAIN Phaseと、通常のCHARACTERプレイ・舞台内移動の設計基準を定義する。
現時点では`MAIN_PHASE` ProcessとF-2Aの手札CHARACTER選択・Destination表示まで実装済みである。カード配置、Play Cost、Replacement、舞台内移動は後続Phaseで実装する。

本書でいうプレイヤーは、現在の画面視点での`self`を指す。`self` / `opponent`は`GameState.players`の現在の役割名であり、将来の通信層で視点へ変換する。

## 現在のアーキテクチャとの整合

現在の責務は次のとおりである。

```text
Controller（ユーザー入力）
  → GameEngine（ルール、Action、Process開始・実行）
  → GameState / Player / Card（対戦状態）
  → Renderer（表示のみ）
  → HTML / CSS
```

- `ProcessManager`は`gameState.ruleState.processStack`のpush/pop/step/status更新だけを担当する。
- `GameEngine`は`resolveRuleCheck()`と`completeCurrentProcess()`を使い、割り込み後に保存済みstepから元Processを再開する。
- `Renderer`はゲームルールやActionの妥当性を判断しない。
- Controllerが持つ一時的な選択状態はGameStateへ保存しない。これは既存のMulliganController、ClockController、LevelUpControllerと同じ方針である。

既存の`PROCESS_TYPE`には`DRAW_PHASE`、`CLOCK_PHASE`、`MAIN_PHASE`、`REFRESH`、`REFRESH_PENALTY`、`LEVEL_UP`がある。現在の`MAIN_STEP`は`START`、`WAITING_INPUT`、`END_MAIN`、`COMPLETE`である。

## MAIN_PHASE Process（v1設計）

MAIN Phase中は、終了を選択されるまでMAIN_PHASE Processを`processStack`上に保持する。1回のActionでProcessを終了しない。

F-2Aのカード選択中もProcessは`WAITING_INPUT`のまま維持する。`CARD_SELECTED`、`ACTION_SELECT`、`ACTION_PROCESS`は将来のAction実装候補であり、F-2Aでは追加しない。

```text
START
  ↓
WAITING_INPUT (waiting_input)
  ↓ カードを選択
CARD_SELECTED
  ↓ ActionまたはDestinationを選択
ACTION_SELECT
  ↓
ACTION_PROCESS
  ↓
WAITING_INPUT
  ↓ ... 繰り返し
END_MAIN
  ↓
COMPLETE
```

- `START`: MAIN開始に必要な準備を行う。
- `WAITING_INPUT`: プレイヤーのカード選択、選択解除、MAIN終了を待つ。
- `CARD_SELECTED`: Controllerの一時選択と同期し、カード由来の候補Actionを導出する段階。
- `ACTION_SELECT`: Destinationまたは明示的なActionボタンを待つ段階。
- `ACTION_PROCESS`: 確定済みActionをGameEngineが検証・実行する段階。必要なら個別Action ProcessをMAIN_PHASEの上へpushできる。
- `END_MAIN`: MAIN終了の確定処理を行う。
- `COMPLETE`: `completeCurrentProcess()`でMAIN_PHASEを終了し、既存のProcess再開・Rule Check出口を利用する。

`step`は常に「次に実行する処理」を表す。Actionやその途中のCheck Pointで割り込みが起きる場合は、次のresume stepを先に保存し、`resolveRuleCheck()`が`CONTINUE`以外なら即returnする。これは既存DRAW_PHASE/CLOCK_PHASEと同じ中断・再開規約である。

## 選択UI（v1設計）

MAINではドラッグ＆ドロップを使用せず、クリックまたはタップで操作する。

```text
WAITING_INPUT
  ↓ 操作可能な自分のカードをクリック
CARD_SELECTED / ACTION_SELECT
  ↓ Destinationまたは明示Actionをクリック
ACTION_PROCESS
  ↓
WAITING_INPUT
```

- 選択カードは右サイドバーのカード説明パネルへ詳細を表示する。
- 選択カードに由来するActionとACT能力は、カード説明パネル内に表示する。
- 有効なStage Destinationは既存共通選択UIの`.is-selectable`などを使い、青枠等で示す。
- 別の操作可能カードをクリックした場合は選択を切り替える。
- 盤面の空白部分または「選択を解除」で選択を解除する。
- Actionが1件だけでも自動実行しない。ActionボタンまたはDestinationの明示選択を必須とする。

`selectedCard`、候補Destination、確認ダイアログの表示状態はController/UIローカル状態である。F-2Aでは`MainPhaseController`が一時選択を保持し、`GameEngine.canSelectCardForMain()`と`getMainDestinationCandidates()`をQueryとして利用する。GameEngineへ確定済みActionを渡す処理はF-2B以降で追加する。

## 右サイドバー

カード説明パネルの責務は、選択カードに由来する情報と操作である。

- カード情報
- 選択カードのAction一覧
- ACT能力ボタン
- 「選択を解除」

カード説明パネル外のゲーム操作領域は、カードに属さない操作を置く。

- ゲーム開始
- MAIN Phase終了
- Phaseまたはゲーム全体に属する操作

この分離により、カードActionとゲーム/Phase Actionを混在させない。

## CHARACTERのHand → Stage

### Destination

プレイ可能なHANDのCHARACTERを選択した場合、自分の5つのStage slotをDestination候補にする。空slotだけでなく、使用中slotもReplacement先として候補に含める。

### 空slotへの配置

```text
HAND → STAGE
```

選択カードを指定row/indexへ配置する。配置前にすべてのプレイ条件、Destination、Cost支払い可能性を検証する。

### 使用中slotへのReplacement

```text
既存STAGEカード → WAITING_ROOM
選択HANDカード → STAGE
```

Swapではない。使用中slotへのDestination選択時は確認UIを表示する。

| 選択肢 | 結果 |
| --- | --- |
| 置き換える | 既存カードをWAITING_ROOMへ送り、HANDカードを配置する。 |
| このカードを選択 | HANDの選択を解除し、Destination側Stageカードへ選択を切り替える。 |
| 戻る | 元のHANDカードを選択した状態へ戻る。 |

### v1プレイ条件

1. `cardType`がCHARACTERであること。現在`Card.cardType`は文字列であり、`CARD_TYPE`定数は未実装である。定数化の是非は将来実装時に決める。
2. `card.level <= player.level.length` であること。
3. level 1以上では、同じ`color`のカードがPlayerの`level`または`clock`に1枚以上あること。level 0には不要。
4. `player.stock.length >= card.cost` であること。

色の候補（YELLOW/GREEN/RED/BLUE）を定数化するかは未確定である。現行の開発カードは文字列（例: `"yellow"`）を使用する。

### Play Cost

`CardMaster.cost`への分離後は、その値を基本Play Costとする。現在のCardでは`Card.cost`である。Ability Costとは別概念である。

Cost支払い時は、`player.stock`の末尾をTopとして、必要枚数を順に`waitingRoom`へ移動する。

```text
stock = [A, B, C, D]  // DがTop
cost = 2
D → WAITING_ROOM
C → WAITING_ROOM
```

プレイ条件・Destination・Cost支払い可能性をすべて確認してから、Cost支払いと配置を実行する。検証失敗によりCostだけが支払われる状態を許容しない。

## CHARACTERのStage → Stage

選択した自分のStage CHARACTERについて、現在位置以外の自分のStage slotをDestination候補にする。空slotと使用中slotのどちらも候補である。

### 空slotへの移動

```text
選択STAGEカード → Destination
元slot → empty
```

### 使用中slotとのSwap

```text
selected card → destination slot
destination card → selected cardの元slot
```

この場合、WAITING_ROOMへカードを送らない。使用中slotの選択時は次の確認UIを表示する。

| 選択肢 | 結果 |
| --- | --- |
| 入れ替える | 2枚のStageカードのrow/indexを交換する。 |
| このカードを選択 | Destination側Stageカードへ選択を切り替える。 |
| 戻る | 元のStageカードを選択した状態へ戻る。 |

Action名の候補は`PLAY_TO_STAGE`、`MOVE_STAGE`、`SWAP_STAGE`である。現在はAction Type定数がないため、名称は未確定であり実装時に定数設計とあわせて確定する。

## v1対象外・将来対応

- Opponentカードの操作
- EVENT/CLIMAXのプレイと解決
- ACT能力のEffect実行
- AUTO/CONTINUOUS能力の完全実装
- Drag & Drop
- 全Phase共通の公開カード閲覧（Global Card Inspection）
- MAIN Actionごとの個別Process仕様
- 色・カード種別・Action Typeの定数化

## 既存資料との注意点

`docs/１．設計/ui-rules.md`は、本書と同じクリック/タップによる「カード選択 → Action選択 / Destination選択」の方針へ更新済みである。全Phase共通の詳細なAction UIは、MAIN実装時に必要な範囲で補足する。
