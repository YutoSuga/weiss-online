# JavaScript仕様: Cardモデル

## 目的

`client/js/card.js` の `Card` は、Weiss Onlineにおけるカード1枚の
ゲーム状態を表すモデルです。

このモデルの責務は次のとおりです。

- カードの識別情報、所有者、現在位置、表裏、向きを保持する
- 状態変更時に値を検証し、不正な状態を防ぐ
- 保存や通信に使用できるプレーンオブジェクトへ変換する
- 保存データや通信データから、安全にカードを復元する

DOMの検索・生成・更新、CSSクラスの操作、描画、ゲームルールの判定は
`Card` の責務に含めません。今後は、ゲーム状態を管理する層が `Card` を保持し、
描画処理がその状態をHTMLへ反映する構成を想定します。

## エクスポート

`card.js` は次の値を名前付きエクスポートします。

- `Card`
- `ZONE`
- `FACE`
- `POSITION`

ES Moduleとして次のように読み込みます。

```js
import { Card, ZONE, FACE, POSITION } from "./card.js";
```

## Cardのプロパティ

| プロパティ | 型 | 意味 |
|---|---|---|
| `id` | `string` | カードインスタンスを一意に識別するID |
| `owner` | `'self' \| 'opponent'` | 現在の画面を基準にしたカードの所有者 |
| `zone` | `ZONE`の値 | カードが現在存在するゾーン |
| `row` | `string \| null` | ゾーン内の行。舞台では主に `front` / `back` |
| `index` | `number \| null` | 所有者視点でのゾーン内位置番号 |
| `face` | `'up' \| 'down'` | カードの表裏 |
| `position` | `'stand' \| 'rest' \| 'reverse'` | カードの向き・状態 |

### `id`

空でない文字列を必須とします。カード番号そのものではなく、同名カードを
複数枚扱えるよう、盤面上のカード1枚ごとに一意なインスタンスIDを使用します。

例: `self-card-001`

### `owner`

- `self`: 自分のカード
- `opponent`: 相手のカード

対戦相手の画面では `self` と `opponent` の見え方が入れ替わるため、
通信時にどのプレイヤーを基準とするかは、将来のゲーム状態管理層で変換します。

### `zone`

`ZONE` に定義された次の値を使用します。

| 定数 | 値 |
|---|---|
| `ZONE.DECK` | `deck` |
| `ZONE.HAND` | `hand` |
| `ZONE.STAGE` | `stage` |
| `ZONE.CLOCK` | `clock` |
| `ZONE.LEVEL` | `level` |
| `ZONE.STOCK` | `stock` |
| `ZONE.CLIMAX` | `climax` |
| `ZONE.WAITING_ROOM` | `waiting-room` |
| `ZONE.MEMORY` | `memory` |

### `row`

行という概念がないゾーンでは `null` を使います。舞台では次を基本とします。

- `front`: 前列
- `back`: 後列

現段階では将来のゾーン拡張を妨げないよう、空でない文字列を許可しています。
ゾーンごとの行制約は、将来のゲームルール層で検証します。

### `index`

ゾーン内の位置を表す0以上の整数、または位置を持たない場合の `null` です。

舞台の `index` は画面上の左右ではなく、カード所有者から見た位置を表します。
そのため、相手側は画面上では左右が反転します。

- 後列: 左が `1`、右が `2`
- 前列: 左が `1`、中央が `2`、右が `3`

### `face`

- `FACE.UP` (`up`): 表向き
- `FACE.DOWN` (`down`): 裏向き

### `position`

- `POSITION.STAND` (`stand`): スタンド
- `POSITION.REST` (`rest`): レスト
- `POSITION.REVERSE` (`reverse`): リバース

## 初期値

`id` と `owner` は必須です。その他の初期値は次のとおりです。

```js
{
  zone: ZONE.DECK,
  row: null,
  index: null,
  face: FACE.DOWN,
  position: POSITION.STAND
}
```

## 状態変更メソッド

### `moveTo({ zone, row, index })`

カードのゾーンとゾーン内位置をまとめて変更します。`row` と `index` を
省略した場合は `null` になり、以前のゾーンの位置情報を引き継ぎません。

### `setFace(face)`

カードの表裏を変更します。`up` / `down` 以外は例外になります。

### `setPosition(position)`

カードの向きを変更します。`stand` / `rest` / `reverse` 以外は
例外になります。

各状態変更メソッドは `Card` 自身を返すため、必要に応じてメソッドチェーンが
可能です。

## シリアライズ

### `toJSON()`

Cardの現在状態をプレーンオブジェクトとして返します。DOM要素や関数を含まない
ため、`JSON.stringify()`、保存、Socket.IO等の通信に使用できます。

### `Card.fromJSON(data)`

プレーンオブジェクトから新しい `Card` を生成します。コンストラクタと同じ検証を
行うため、不正な受信データは例外になります。

## HTMLのdata属性との対応方針

描画層では、Cardの状態を次の属性へ対応させます。

| Card | HTML |
|---|---|
| `owner` | `data-owner` |
| `zone` | `data-zone` |
| `row` | `data-row` |
| `index` | `data-index` |
| `face` | `data-face` |
| `position` | `data-position` |

例:

```html
<div
  class="card"
  data-card-id="self-card-001"
  data-owner="self"
  data-zone="stage"
  data-row="front"
  data-index="1"
  data-face="up"
  data-position="stand"
></div>
```

`id` は、HTMLでは `data-card-id` に対応させます。HTMLの `id` 属性には
依存しません。

`null` の `row` と `index` は、空文字列として出力するのではなく、対応する
data属性自体を付けない方針とします。

DOMを状態の正本にはしません。Cardおよび将来のGameStateを正本とし、
描画処理が状態からdata属性を生成します。ユーザー操作時はdata属性から対象を
特定できますが、状態更新はモデルを介して行い、その後に再描画します。
