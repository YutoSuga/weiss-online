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

## REFRESH Process v1

REFRESHはGameEngineが明示的に開始し、ProcessManagerを通して次のProcessを`processStack`末尾へ追加する。

```js
{
  type: PROCESS_TYPE.REFRESH,
  playerId,
  step: REFRESH_STEP.MOVE_WAITING_ROOM_TO_DECK,
  status: PROCESS_STATUS.RUNNING,
  context: {},
}
```

`REFRESH_STEP`は次の順で進む。stepは常に「次に実行する処理」を表す。

```text
MOVE_WAITING_ROOM_TO_DECK
    ↓ 控え室の全カードを山札へ移動
step = SHUFFLE_DECK
    ↓ render
SHUFFLE_DECK
    ↓ 既存のDeck.shuffle()を実行
step = COMPLETE
    ↓ render
COMPLETE
    ↓ processStackからREFRESHをpop
```

REFRESHのstatusは全stepで`PROCESS_STATUS.RUNNING`とする。Phase E以降、完了時は`completeCurrentProcess()`を通り、pop後に`resolveRuleCheck()`で最新状態を再判定する。結果がCONTINUEなら、下にある既知Processを保存済みstepから再開する。

控え室が空でもREFRESHは拒否せず、移動枚数0枚の安全なno-opとしてシャッフルと完了まで実行する。これは開発用の明示実行を安全にするためであり、敗北条件を意味しない。

Phase Bに含めないもの：

- 山札切れによるREFRESHの自動検出
- REFRESHの実行可能条件判定
- リフレッシュペナルティおよび`pendingChecks`
- `pendingInterrupts`
- 敗北条件

## LEVEL_UP Process v1

LEVEL_UPはGameEngineの明示的な呼び出しで開始し、次のProcessをProcessManager経由でpushする。

```js
{
  type: PROCESS_TYPE.LEVEL_UP,
  playerId,
  step: LEVEL_UP_STEP.PREPARE_SELECTION,
  status: PROCESS_STATUS.RUNNING,
  context: {},
}
```

stepは次の順で進む。

```text
PREPARE_SELECTION (running)
    ↓ clock[0]からclock[6]の存在を検証
WAIT_FOR_SELECTION (waiting_input)
    ↓ LevelUpControllerから選択を受け取る
RESOLVE_SELECTION (running)
    ↓ 選択カードをレベル、残り6枚を控え室へ移動
COMPLETE (running)
    ↓ LEVEL_UPをpop
```

候補は常に現在のGameStateの`clock[0..6]`から導出し、Process contextへカード、カードID、候補配列を複製しない。contextは開始時に空で、入力確定後に`selectedClockIndex`だけを保持する。選択解決時にもクロック状態とインデックスを再検証する。

`WAIT_FOR_SELECTION`中は通常フェイズ進行とCLOCK操作を停止し、LevelUpControllerだけが入力を受け付ける。Phase E以降、完了時は`completeCurrentProcess()`を通ってpop・再Rule Checkを行い、CONTINUEなら下にある既知Processを保存済みstepから再開する。

Phase Cに含めないもの：

- `clock.length >= 7`によるLEVEL_UPの自動検出
- REFRESHとLEVEL_UPの同時割り込み順序
- `pendingInterrupts` / `pendingChecks`の解決
- リフレッシュペナルティ
- 敗北条件

## Remaining TODO

- REFRESHの自動検出およびリフレッシュペナルティ
- LEVEL_UPの自動検出
- 割り込み検出と優先順位
- `pendingInterrupts`の解決
- `pendingChecks`の解決
- CLOCK_ACTION / DRAW_PHASEのProcess化
- effectQueueとの連携
