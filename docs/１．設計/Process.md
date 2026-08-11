# Common Process Foundation v1

## Purpose

共通プロセス基盤は、将来のREFRESHやLEVEL_UPなどによる処理の中断・再開に備え、現在の実行位置を管理する。

- GameEngineは「何を実行するか」を決定する。
- ProcessManagerは「現在どのProcessを実行中か」を管理する。
- Rendererは表示だけを担当する。
- Controllerはユーザー入力だけを担当する。

ProcessManagerは、割り込み条件、優先順位、ゲームルールを判断しない。

## ruleState

GameStateは次の状態を持つ。

```js
ruleState = {
  processStack: [],
  pendingInterrupts: [],
  pendingChecks: [],
};
```

- `processStack`: 実行中および割り込みによって中断されたProcess。末尾が現在Process。
- `pendingInterrupts`: 複数の実行可能な割り込み候補を将来並べ替えるための予約領域。
- `pendingChecks`: 将来のチェックタイミングまで待機するルール処理の予約領域。

各GameStateは独立した配列を生成し、他のGameStateと共有しない。

## Process structure

```js
{
  type,
  playerId,
  step,
  status,
  context,
}
```

- `type`: `PROCESS_TYPE`で定義したプロセス種別。
- `playerId`: 対象または現在のプレイヤー。
- `step`: **次に実行する処理**。完了済みの処理ではない。
- `status`: `running`または`waiting_input`。
- `context`: プロセス固有のデータ。

`PAUSED`状態は持たない。`processStack`の最上段より下にあるProcessは、スタック位置によって暗黙的に中断中と判断する。

## ProcessManager

`ProcessManager`は`GameState`を受け取り、`gameState.ruleState.processStack`を直接管理する。GameStateから分離した非公開スタックは持たない。

- `pushProcess(process)`: 検証・浅いコピー後、Processを末尾へ追加する。
- `popProcess()`: 現在Processを取り除いて返す。空の場合は`null`。
- `getCurrentProcess()`: 現在Processを返す。空の場合は`null`。
- `updateStep(step)`: 現在Processの次の処理を更新する。空の場合は`null`。
- `updateStatus(status)`: 現在Processの状態を更新する。空の場合は`null`。

## Constants

`PROCESS_TYPE`:

- `CLOCK_ACTION`
- `DRAW_PHASE`
- `REFRESH`
- `LEVEL_UP`

`PROCESS_STATUS`:

- `RUNNING`
- `WAITING_INPUT`

## effectQueue TODO

`effectQueue`と`processStack`は別の概念として扱う。

将来、`effectQueue`が次に解決するカード効果を選び、カード効果の実行開始後はProcessとして表現することで、REFRESHやLEVEL_UPによる中断・再開を可能にする方向を検討する。Phase Aでは、この連携やeffectQueueの動作を実装しない。

## Remaining TODO

- REFRESHおよびリフレッシュペナルティ
- LEVEL_UP
- 割り込み検出と優先順位
- `pendingInterrupts`の解決
- `pendingChecks`の解決
- CLOCK_ACTION / DRAW_PHASEのProcess化
- effectQueueとの連携
