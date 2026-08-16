# Phase D 共通ルールチェック基盤 設計書

## 1. 目的

Phase Dでは、ゲーム状態を同一のチェック単位で確認し、ルール上発生している敗北候補と割り込み候補を列挙する共通基盤を追加する。

中心となるAPIは、引数なしの `runRuleCheck()` とする。

```js
const result = gameEngine.runRuleCheck();
```

`runRuleCheck()` は `self` と `opponent` の両方を必ず同じ呼び出し内で確認する。片方を確認した時点で勝敗を確定しない。これにより、同一チェックタイミングで両者が敗北条件を満たした場合を検出できるようにする。

Phase Dの責務は判定結果の生成までであり、Processの自動開始、待機列の解決、勝敗確定は行わない。

## 2. スコープ

### 2.1 Phase Dで行うこと

- 引数なしの `runRuleCheck()` を定義する。
- `self` と `opponent` を同一チェック単位で確認する。
- 各プレイヤーの敗北条件を確認し、`defeatCandidates` を返す。
- 各プレイヤーに発生している `REFRESH` / `LEVEL_UP` を確認し、`interrupts` を返す。
- 「山札0枚かつ控え室0枚」の敗北候補について、実行可能な割り込みで条件が解消し得る場合に確定保留であることを表現する。
- 同時敗北時に `turnPlayer` が勝者となる規則を、将来の敗北確定処理が利用できる情報として結果に含める。
- 判定順、返却形式、重複抑止方針、既存基盤との責務境界を定義する。

### 2.2 Phase Dで行わないこと

- `startRefresh()` / `startLevelUp()` の自動呼び出し
- `ProcessManager.pushProcess()` によるProcessの自動開始
- `ruleState.pendingInterrupts` への自動登録・並べ替え・取り出し・解決
- `ruleState.pendingChecks` への自動登録・取り出し・再チェック実行
- リフレッシュペナルティの実行
- 敗北の確定、勝者・敗者の保存、ゲーム終了状態への変更
- 勝敗オーバーレイの表示、入力停止、通信通知
- カード移動、ログ追加、描画

## 3. 用語

| 用語 | 意味 |
|---|---|
| チェック単位 | 1回の `runRuleCheck()` が観測する、変更されていない1つのゲーム状態 |
| 敗北候補 | 現在の状態が敗北条件に一致していることを示す判定結果。Phase Dでは敗北確定を意味しない |
| 即時候補 | 他の割り込みによる救済判定を必要としない敗北候補 |
| 保留候補 | 実行可能な割り込みの解決後に条件が解消し得るため、敗北確定を待つ候補 |
| 割り込み候補 | 現在の状態から発生し、実行可能と判定された `REFRESH` または `LEVEL_UP` |
| 同時敗北 | 同一チェック単位において、両プレイヤーの敗北が最終的に確定すること |

## 4. 基本方針

### 4.1 全体チェック

プレイヤーIDを引数として受け取る個別チェックAPIは公開しない。

```text
runRuleCheck()
  ├─ selfを観測
  ├─ opponentを観測
  ├─ 割り込み候補を判定
  ├─ 敗北候補を判定
  ├─ 救済可能性を付与
  └─ 1つの結果として返却
```

内部実装でプレイヤー単位の非公開ヘルパーを使うことは許容する。ただし、最終結果は両プレイヤーの観測が完了してから組み立てる。

### 4.2 判定専用API

`runRuleCheck()` は現在の `GameState` を読み取るだけとし、次の状態を変更しない。

- `players`
- `turn`
- `phase`
- `ruleState.processStack`
- `ruleState.pendingInterrupts`
- `ruleState.pendingChecks`
- `effectQueue`
- ログおよび表示状態

同じ `GameState` に対して連続して呼び出した場合、同値の結果を返すことを原則とする。

## 5. 対象ルール

### 5.1 敗北条件A: レベル・クロック

```text
level.length >= 3
AND
clock.length >= 7
```

この条件は即時の敗北候補として返す。

レベルが3枚以上の場合は `LEVEL_UP` を割り込み候補にしない。したがって、敗北条件Aと `LEVEL_UP` が同じプレイヤーについて同時に返ることはない。

### 5.2 敗北条件B: 山札・控え室

```text
deck.cards.length === 0
AND
waitingRoom.length === 0
```

この条件に一致した場合も `defeatCandidates` に含める。ただし、同じチェック結果に含まれる他の実行可能な割り込みを解決することで、そのプレイヤーの山札または控え室が1枚以上になり得る場合は、候補を確定保留として返す。

Phase Dでは割り込みを実行しないため、「救済された」とは判定しない。候補に `deferred: true` と、保留理由となる割り込みの識別情報を付与する。

例:

```text
level = 2
clock = 7
deck = 0
waitingRoom = 0
```

`LEVEL_UP` を解決すると、選ばれなかったクロック6枚が控え室へ移動する。このため、山札・控え室0枚の敗北候補は返すが、`LEVEL_UP` によって条件が解消し得る保留候補とする。

### 5.3 割り込み条件

#### REFRESH

```text
deck.cards.length === 0
AND
waitingRoom.length >= 1
```

控え室が0枚の場合は、移動可能なカードがないため `REFRESH` を実行可能候補として返さない。

#### LEVEL_UP

```text
clock.length >= 7
AND
level.length < 3
```

既存の `startLevelUp(playerId)` が要求するクロック7枚を満たし、かつレベル・クロック敗北が成立していない場合だけ候補とする。

### 5.4 救済可能性の判定

割り込み候補には、その解決によって対象プレイヤーの `deck` または `waitingRoom` が1枚以上になり得るかを表す `canResolveEmptyDeckAndWaitingRoom` を持たせる。

Phase Dで対象となる既存Processでは、次のように扱う。

| Process | 救済可能性 | 理由 |
|---|---:|---|
| `LEVEL_UP` | `true` | クロック7枚のうち6枚が控え室へ移動する |
| `REFRESH` | `true` | 控え室のカードが山札へ移動する。ただし、山札・控え室がともに0枚なら実行可能候補にならない |

将来Process種別を追加するときは、Process名だけで推測せず、そのProcessのルール定義に救済可能性を明示する。

## 6. 返却形式

```js
{
  checkedPlayers: ["self", "opponent"],
  turnPlayer: "self",
  defeatCandidates: [
    {
      playerId: "self",
      reason: "empty_deck_and_waiting_room",
      deferred: true,
      deferredBy: [
        {
          type: "level_up",
          playerId: "self"
        }
      ]
    }
  ],
  interrupts: [
    {
      type: "level_up",
      playerId: "self",
      executable: true,
      canResolveEmptyDeckAndWaitingRoom: true
    }
  ],
  simultaneousDefeatRule: {
    winnerPlayerId: "self",
    appliesOnlyAfterBothDefeatsAreConfirmed: true
  }
}
```

### 6.1 `defeatCandidates`

```ts
type DefeatReason =
  | "level_and_clock"
  | "empty_deck_and_waiting_room";

type DefeatCandidate = {
  playerId: "self" | "opponent";
  reason: DefeatReason;
  deferred: boolean;
  deferredBy: Array<{
    type: "refresh" | "level_up";
    playerId: "self" | "opponent";
  }>;
};
```

- 条件ごとに1件を返す。同じプレイヤーが両方の敗北条件を満たす場合は2件になり得る。
- `level_and_clock` は常に `deferred: false` とする。
- `empty_deck_and_waiting_room` は、救済可能な割り込みがある場合だけ `deferred: true` とする。
- `deferredBy` は救済対象と同じ `playerId` の割り込みだけを含める。他方プレイヤーの割り込みは救済理由にしない。

### 6.2 `interrupts`

```ts
type RuleInterrupt = {
  type: "refresh" | "level_up";
  playerId: "self" | "opponent";
  executable: true;
  canResolveEmptyDeckAndWaitingRoom: boolean;
};
```

Phase Dでは実行可能な候補だけを返すため、`executable` は常に `true` となる。フィールドは、将来 `pendingInterrupts` に格納するデータ形式や診断表示との互換性を保つため明示する。

### 6.3 同時敗北規則の情報

`simultaneousDefeatRule.winnerPlayerId` には、チェック時点の `gameState.turn.player` を写す。

この値は「現在、同時敗北が確定した」という意味ではない。将来の敗北確定処理が、両者の敗北を同一タイミングで確定した場合に使用する規則情報である。

ターンプレイヤーが未設定の状態では通常のルールチェックを呼ばない。防御的実装として、`turn.player` が `self` / `opponent` のどちらでもなければ例外とし、不正な勝者情報を返さない。

## 7. 判定アルゴリズム

```text
1. GameStateとturnPlayerの妥当性を確認する
2. self/opponentそれぞれのゾーン枚数を同じ状態から読み取る
3. 両プレイヤーの実行可能な割り込み候補を列挙する
   3-1. REFRESH条件を確認する
   3-2. LEVEL_UP条件を確認する
4. 両プレイヤーの敗北条件を列挙する
   4-1. level >= 3 かつ clock >= 7
   4-2. deck == 0 かつ waitingRoom == 0
5. 条件Bの候補ごとに、同じplayerIdの救済可能な割り込みを照合する
6. 救済可能な割り込みがあれば deferred と deferredBy を設定する
7. turnPlayerと同時敗北規則を添えて結果を返す
```

割り込みを先に列挙するのは、敗北条件Bの保留判定に利用するためである。実際のルール解決順をPhase Dで決定するものではない。

## 8. 判定例

### 8.1 何も発生しない

| Player | Level | Clock | Deck | Waiting Room |
|---|---:|---:|---:|---:|
| self | 2 | 6 | 10 | 3 |
| opponent | 1 | 2 | 12 | 0 |

結果は `defeatCandidates: []`、`interrupts: []`。

### 8.2 LEVEL_UPのみ

`self` が `level=2, clock=7, deck=10, waitingRoom=0` の場合、`self` の `LEVEL_UP` を返す。敗北候補は返さない。

### 8.3 レベル・クロック敗北候補

`self` が `level=3, clock=7` の場合、`level_and_clock` を返す。`self` の `LEVEL_UP` は返さない。

### 8.4 山札・控え室敗北候補をLEVEL_UPが救済し得る

`self` が `level=2, clock=7, deck=0, waitingRoom=0` の場合:

- `LEVEL_UP` を `interrupts` に返す。
- `empty_deck_and_waiting_room` を `defeatCandidates` に返す。
- 敗北候補を `deferred: true` とし、`deferredBy` に `self` の `LEVEL_UP` を入れる。

### 8.5 山札・控え室敗北候補を救済できない

`self` が `level=2, clock=6, deck=0, waitingRoom=0` の場合、実行可能な割り込みがないため `empty_deck_and_waiting_room` を `deferred: false` で返す。

### 8.6 REFRESH

`self` が `deck=0, waitingRoom=5` の場合、`self` の `REFRESH` を返す。山札・控え室敗北条件は成立しない。

### 8.7 両者がレベル・クロック敗北候補

両者が `level>=3, clock>=7` で、`turn.player === "opponent"` の場合、両者の `level_and_clock` 候補を同じ結果に返す。

Phase Dでは勝敗を確定しない。将来の敗北確定処理は、両候補が同一タイミングで最終確定した場合に `opponent` を勝者とする。

### 8.8 一方が保留中の「見かけ上の同時敗北」

`self` に即時候補があり、`opponent` の条件Bが割り込みによって保留されている場合、Phase Dの結果には両者の候補が存在する。しかし、まだ同時敗北とは確定しない。

将来処理は割り込み解決後に再度 `runRuleCheck()` を実行し、保留候補が残るかを確認してから同時敗北規則を適用する。

## 9. 既存設計との関係

### 9.1 GameEngine

`runRuleCheck()` はゲームルールを読み取って判定するため、`GameEngine` の公開メソッドとして配置する。

既存の `startRefresh(playerId)` と `startLevelUp(playerId)` は、Phase Dでは引き続き明示呼び出し専用とする。`runRuleCheck()` から呼び出してはならない。

### 9.2 ProcessManager

`ProcessManager` の責務は、既存設計どおり `gameState.ruleState.processStack` の管理だけとする。

`ProcessManager` は次を担当しない。

- ルール条件の検出
- 割り込み候補の生成
- 敗北候補の生成
- 割り込み優先順位の決定
- 敗北確定

したがって、Phase Dによる `ProcessManager` のAPI変更は不要である。

### 9.3 ruleState

既存の構造を維持する。

```js
ruleState = {
  processStack: [],
  pendingInterrupts: [],
  pendingChecks: [],
};
```

- `processStack`: 実行中Processの管理に使用中。
- `pendingInterrupts`: 将来、`runRuleCheck()` の結果から候補を登録し、優先順位に従って解決するための予約領域。
- `pendingChecks`: 将来、Process完了後などの再チェック要求を保持するための予約領域。

Phase Dの `runRuleCheck()` は返却値をこれらの配列へ書き込まない。判定結果と待機状態を混同せず、同じ状態での複数回チェックによる重複登録を防ぐためである。

### 9.4 REFRESH

既存 `REFRESH` Processは、控え室のカードを山札へ移し、シャッフルして完了する。

Phase Dは `REFRESH` の発生条件と実行可能性だけを返す。以下は後続Phaseで扱う。

- 候補からのProcess開始
- 他の割り込みとの優先順位
- リフレッシュペナルティ
- Process完了後の再チェック

### 9.5 LEVEL_UP

既存 `LEVEL_UP` Processは、クロック先頭7枚から1枚をレベルへ、残り6枚を控え室へ移す。

この既存動作により、`LEVEL_UP` は山札・控え室0枚の状態を解消し得る割り込みとして扱う。ただし `level.length >= 3` では敗北条件Aが成立するため、`LEVEL_UP` 候補は生成しない。

## 10. 将来の解決フロー

Phase Dの後続Phaseでは、概ね次の流れを実装する。

```text
ゲーム状態が変化
  ↓
runRuleCheck()
  ↓
interruptsをpendingInterruptsへ登録
  ↓
優先順位に従ってProcessを開始・解決
  ↓
Process完了時にpendingChecksを処理
  ↓
runRuleCheck()を再実行
  ↓
保留されていない敗北候補を両者分まとめて確定
  ├─ 0人: 続行
  ├─ 1人: そのプレイヤーの敗北
  └─ 2人: turnPlayerの勝利
```

このフローは将来設計の方向性であり、Phase Dでは実装しない。

## 11. 実装上の制約

- プレイヤーの確認順によって結果の意味が変わってはならない。
- 配列の出力順は決定的にする。推奨順はプレイヤーを `self`, `opponent`、同一プレイヤー内の種別を `REFRESH`, `LEVEL_UP`、敗北理由を `level_and_clock`, `empty_deck_and_waiting_room` とする。
- 同一の `{ type, playerId }` の割り込みを重複して返さない。
- 同一の `{ reason, playerId }` の敗北候補を重複して返さない。
- ゾーン枚数はチェック開始時の同じ状態から読み取り、チェック途中でProcessを実行しない。
- `Deck` の枚数は `player.deck.cards.length` を参照する。
- `level`, `clock`, `waitingRoom` は各配列の `length` を参照する。
- 判定にUIやDOMの状態を使用しない。

## 12. 受け入れ条件

1. `runRuleCheck()` は引数なしで呼び出せる。
2. 1回の呼び出しで `self` と `opponent` の両方を確認する。
3. `level>=3 && clock>=7` を `level_and_clock` 敗北候補として返す。
4. `deck==0 && waitingRoom==0` を `empty_deck_and_waiting_room` 敗北候補として返す。
5. `level<3 && clock>=7` を `LEVEL_UP` 候補として返す。
6. `level>=3 && clock>=7` のプレイヤーには `LEVEL_UP` 候補を返さない。
7. `deck==0 && waitingRoom>=1` を `REFRESH` 候補として返す。
8. `deck==0 && waitingRoom==0` では `REFRESH` 候補を返さない。
9. 条件Bが同じプレイヤーの実行可能な割り込みで解消し得る場合、敗北候補を保留として返す。
10. 両者の敗北候補を同じ返却値に含められる。
11. 同時敗北規則の勝者情報はチェック時点の `turnPlayer` を指す。
12. 判定によってGameState、Process、待機列、ログ、表示を変更しない。
13. Processの自動開始、`pendingInterrupts` / `pendingChecks` の解決、敗北確定を行わない。

## 13. Phase D完了後も残る課題

- `REFRESH` と `LEVEL_UP` が同時発生した場合の厳密な登録順・解決順
- `pendingInterrupts` のデータ型、重複排除、優先順位、選択処理
- `pendingChecks` の登録契機と再チェックの実行契機
- Process完了後に自動で共通チェックへ戻る制御
- リフレッシュペナルティと、その結果による再チェック
- 敗北確定単位と「同時」の境界の厳密な定義
- 勝者・敗者・ゲーム終了状態のGameStateモデル
- ゲーム終了後の入力停止、表示、ログ、通信同期
- カード効果による新しい割り込みと救済可能性の定義方法

