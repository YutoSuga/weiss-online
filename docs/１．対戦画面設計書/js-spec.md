# JavaScriptモデル仕様

## ディレクトリ

```text
client/js/
├── constants/
│   ├── phase.js
│   └── zone.js
├── models/
│   ├── card.js
│   ├── deck.js
│   ├── player.js
│   └── gameState.js
├── core/
└── ui/
```

- `models`: 対戦データを表すクラス
- `constants`: 複数のモデルや将来のゲーム処理で共有する定数
- `core`: 将来のGameEngine、Rendererなど
- `ui`: 将来の画面操作、カード詳細表示など

## 基本方針

モデルを対戦状態の正本とし、DOMを状態の正本にはしません。
将来のRendererはモデルの状態をHTMLへ反映し、GameEngineはルールに従ってモデルを更新します。

```text
ユーザー操作
  → GameEngine
  → GameState / Player / Card
  → Renderer
  → HTML
```

## import例

```js
import { PHASE } from "./client/js/constants/phase.js";
import { ZONE } from "./client/js/constants/zone.js";
import { Card, FACE, POSITION } from "./client/js/models/card.js";
import { Deck } from "./client/js/models/deck.js";
import { Player } from "./client/js/models/player.js";
import { GameState } from "./client/js/models/gameState.js";
```

## Card

カード1枚の固定情報と現在状態を保持します。

- 固定情報: `id`, `name`, `cardType`, `level`, `cost`, `color`,
  `basePower`, `baseSoul`, `trigger`, `traits`, `text`
- 現在状態: `owner`, `zone`, `row`, `index`, `face`, `position`,
  `currentPower`, `currentSoul`

`trigger` と `traits` は外部配列から独立させるため、コンストラクタと
`toJSON()` の両方でコピーします。

## Deck

`cards[0]` を山札の一番上として扱います。

- `draw()`
- `shuffle()`
- `peek()`
- `addTop()`
- `addBottom()`

## Player

プレイヤー情報、`Deck`、各ゾーンのカード配列を保持します。
ゾーン配列は実際にカードが置かれた順を維持し、後から置かれたカードほど
配列の後ろへ追加する方針です。描画時の重なり順はRendererがこの順序から決定します。

## GameState

対戦全体の状態を保持します。

- `players`: `{ self, opponent }`
- `room`: `{ id, name, host, guest, status }`
- `turn`: `{ player, number }`
- `phase`
- `log`: `{ time, player, message }[]`
- `effectQueue`: 将来の解決待ち効果用（現時点ではTODO）

`self` と `opponent` は画面上の役割です。通信時に各ユーザーから見た役割へ
変換する処理は、将来の通信・ゲーム進行層で担当します。
