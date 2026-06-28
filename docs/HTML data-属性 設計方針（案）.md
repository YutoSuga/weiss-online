# HTML `data-*` 属性 設計方針（案）

## 基本方針

HTMLは「画面」を表現するだけではなく、**ゲーム状態の初期定義**も表現する。

CSSは見た目を担当し、JavaScriptは `data-*` 属性を参照してゲームロジックを制御する。

---

## 1. `data-orientation` について

当初は

```html
data-orientation="vertical"
```

```html
data-orientation="horizontal"
```

を持たせることを検討していた。

しかし、これは

* 山札は縦
* ストックは横
* 思い出は横

など、**UIレイアウトの情報**であり、ゲーム状態ではない。

そのため、

* HTMLには持たせない
* CSSで表現する

方針とする。

---

## 2. `data-face`

カードの表裏を管理する。

```html
data-face="up"
```

表向き

```html
data-face="down"
```

裏向き

これはゲーム状態なので、HTMLへ保持する。

JavaScriptでは

```javascript
card.dataset.face = "up";
```

のように変更する。

---

## 3. `data-index`

`data-index` は **1始まり** とする。

例

```
Clock
1
2
3
4
5
6
```

JavaScriptの配列は0始まりだが、HTMLはゲームルールに合わせた定義とする。

---

## 4. カードの向き

舞台のカードは

* スタンド
* レスト

へ変化するため、状態として保持する。

候補

```html
data-state="stand"
```

```html
data-state="rest"
```

---

### 検討結果

将来的に

* Reverse
* Rest
* Stand

など、カード状態が増える可能性がある。

そのため、

「状態」と「向き」は分離する。

最終案は

```html
data-position="stand"
```

```html
data-position="rest"
```

とする。

---

## 5. HTMLが保持するゲーム情報

各カードスロットは以下の属性を保持する。

```html
data-owner="self"
data-zone="stage"
data-row="front"
data-index="2"
data-face="up"
data-position="stand"
```

---

## 6. CSSが担当するもの

以下はHTMLには持たせず、CSSで表現する。

* カードサイズ
* カード位置
* 背景色
* 枠線
* 縦横レイアウト

---

## 7. 将来的な拡張

カード自体には

```html
data-card-id="HOL-W104-001"
```

のような識別子を保持する予定。

JavaScriptでは

```javascript
card.dataset.cardId
```

でカード情報を取得できるようにする。

---

## 設計思想

このHTMLは単なる画面構造ではなく、

**「ゲーム盤面の定義書」**

として設計する。

HTML・CSS・JavaScript・Node.js が共通の設計思想を持てるよう、`data-*` 属性を中心にゲーム状態を管理する。
