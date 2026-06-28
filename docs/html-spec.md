# html-spec.md

# HTML仕様書

## 概要

本ドキュメントは、`client/index.html` におけるHTML構造および `data-*` 属性の仕様を定義する。

HTMLは単なる画面レイアウトではなく、**ゲーム盤面の初期状態を表現する定義書**として扱う。

CSSは見た目を担当し、JavaScript・Node.jsは本仕様で定義した `data-*` 属性を参照してゲームロジックを制御する。

---

# 基本方針

HTMLは以下の役割のみを持つ。

* 画面構造
* ゲーム盤面の定義
* ゲーム状態の初期値

以下はHTMLでは管理しない。

* 色
* サイズ
* 座標
* アニメーション
* ドラッグ処理

これらはCSS・JavaScriptで管理する。

---

# card-slot

カードを配置可能なすべての場所は、共通クラス `card-slot` を使用する。

例

```html
<article
    class="card-slot"
    data-owner="self"
    data-zone="stage"
    data-row="front"
    data-index="2"
    data-face="up"
    data-position="stand"
    data-card-id="">
</article>
```

---

# data-* 属性一覧

## data-owner

カードの所有者を表す。

| 値        | 説明 |
| -------- | -- |
| self     | 自分 |
| opponent | 相手 |

---

## data-zone

カードが存在するエリアを表す。

| 値            | 説明      |
| ------------ | ------- |
| hand         | 手札      |
| stage        | 舞台      |
| clock        | クロック    |
| level        | レベル     |
| climax       | クライマックス |
| stock        | ストック    |
| deck         | 山札      |
| waiting-room | 控え室     |
| memory       | 思い出     |

---

## data-row

舞台のみ使用する。

| 値     | 説明 |
| ----- | -- |
| front | 前列 |
| back  | 後列 |

舞台以外では設定しない。

---

## data-index

エリア内の位置を表す。

**1始まり**で定義する。

例

### 前列

| index | 位置 |
| ----: | -- |
|     1 | 左  |
|     2 | 中央 |
|     3 | 右  |

### 後列

| index | 位置 |
| ----: | -- |
|     1 | 左  |
|     2 | 右  |

### クロック

1 ～ 6

### レベル

1 ～ 4

表示順は各エリア仕様に従う。

---

## data-face

カードの表裏を表す。

| 値    | 説明  |
| ---- | --- |
| up   | 表向き |
| down | 裏向き |

初期状態

| エリア    | 値    |
| ------ | ---- |
| 手札(自分) | up   |
| 手札(相手) | down |
| 山札     | down |
| ストック   | down |
| その他    | up   |

---

## data-position

カードの向きを表す。

| 値       | 説明   |
| ------- | ---- |
| stand   | スタンド |
| rest    | レスト  |
| reverse | リバース |

初期状態はすべて `stand` とする。

### CSSでの表示

* `data-position="stand"`

  * 通常表示

* `data-position="rest"`

  * 90°回転表示

* `data-position="reverse"`

  * 180°回転表示
  * （将来的にゲームルールに合わせて表示方法を変更する可能性あり）

### JavaScript例

```javascript
card.dataset.position = "stand";

card.dataset.position = "rest";

card.dataset.position = "reverse";
```


## data-card-id

カードIDを保持する。

初期状態では空文字とする。

例

```html
data-card-id=""
```

ゲーム開始時にカード情報を設定する。

例

```html
data-card-id="HOL-W104-001"
```

---

# class の役割

class は見た目・レイアウトを表す。

例

* player-section
* stage-area
* clock-zone
* stock-zone
* card-slot

JavaScriptは基本的に `data-*` 属性を利用して対象を取得する。

---

# JavaScript取得例

```javascript
document.querySelector(
    '[data-owner="self"]' +
    '[data-zone="stage"]' +
    '[data-row="front"]' +
    '[data-index="2"]'
);
```

---

# CSS利用例

```css
[data-face="down"] {
    /* 裏向きカード */
}

[data-position="rest"] {
    transform: rotate(90deg);
}
```

# エリアの最大枚数

| エリア     |   最大枚数 |
| ------- | -----: |
| 手札      |      7 |
| 前列      |      3 |
| 後列      |      2 |
| クロック    | 6（表示上） |
| レベル     |      4 |
| クライマックス |      1 |
| ストック    |   上限なし |
| 山札      |   上限なし |
| 控え室     |   上限なし |
| 思い出     |   上限なし |


---

# 今後追加予定

以下の属性は必要になった時点で追加する。

* data-selected
* data-highlight
* data-draggable
* data-target
* data-effect
* data-counter

---

# 更新履歴

## v0.1

* 初版作成
* card-slot 共通仕様を定義
* data-* 属性仕様を定義
* CSSとJavaScriptの責務を明確化
