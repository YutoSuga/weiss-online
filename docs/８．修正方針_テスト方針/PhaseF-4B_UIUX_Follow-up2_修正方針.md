# Phase F-4B UI/UX Follow-up 2 修正方針

## 目的

Phase通知とModalのlayer競合を解消し、Resolution / Deck Searchの閲覧・選択・確定操作をModal内で完結させる。

## 方針

- Normal Board、Phase、Backdrop、Modal Contentのz-indexを意味のあるCSS custom propertyで順序化する。
- RendererのCard Detail描画に描画先containerを指定可能にし、通常盤面と両Modalで再利用する。
- Resolutionはdetail only、Deck Searchはeligibleのみdetail + toggle、ineligibleはdetail onlyを維持する。
- Detail対象はControllerのUIローカル状態で保持し、ゲーム状態・Process意味論を変更しない。
- PCは一覧とDetailの2列、narrow viewportは縦配置とし、Deck Searchの操作部を一覧scrollから分離する。

## テスト方針

layer tokenの順序、Modal内Detailと空状態、共通Renderer利用、Resolution非選択、Deck Searchのeligible判定とDetail保持、responsive CSSを構造テストする。既存全テスト、全JS/MJS syntax check、`git diff --check`も実行する。
