# Phase F-4B UI/UX Follow-up 修正方針

## 目的

集中のルール意味論を維持したまま、Reveal結果をユーザーが確認してから進行できる入力待ち、ゲームログ、Card Detail連携、Deck Searchの案内改善、Ability Typeラベルの責務整理を行う。

## 方針

- BRAINSTORM_REVEALの追跡instance IDとReveal順をACT contextに維持し、4枚集計後に`WAITING_INPUT`へ遷移する。
- 確認入力では今回追跡したカードだけをResolutionからWaiting Roomへ移し、ACTを再開する。
- Resolution / Deck Searchの一覧は`CardSelectionView`の状態表現と既存Card Detailを再利用する。Resolutionはdetail onlyとする。
- Ability使用、Reveal枚数、CX枚数を`GameState.log`へ記録する。
- `CardAbility.text`から重複した【起】をデータ修正し、type labelはRendererの責務に統一する。

## テスト方針

CX=0 / 複数CX、Refresh割り込み、無関係なResolution Card、0枚検索、全山札順、UI文言、Card Detail連携、ラベル重複、既存回帰を自動テストする。全MJSのsyntax check、全テスト、`git diff --check`も実行する。
