# Phase F-4B UI/UX Follow-up 2 修正結果

## 原因

Phase通知の`.message-overlay`が`z-index: 1000`、カード選択Modalが`z-index: 100`であり、通知がBackdrop / Modalより上のstacking orderになっていた。また両Modalのclick処理は通常盤面のCard Detailだけを更新していたため、Backdrop越しに確認できなかった。

## 変更結果

UI layer tokenを追加してPhase < Backdrop < Modal Contentを明示した。Resolution / Deck Searchへ空状態付きDetail containerを設け、描画先を指定できる共通`Renderer.renderCardDetail`で描画した。Resolutionはdetail onlyを維持し、Deck Searchは最後のDetail対象IDをController内に保持してselection再描画後も復元する。PC 2列 / narrow 1列とviewport内scrollを追加した。

## 確認結果

専用構造テストにlayer、Modal Detail、共通描画責務、操作差、responsiveを追加した。ゲームロジック、Process、Mulligan、能力表示データは変更していない。実行結果は完了報告に記載する。

## ブラウザ確認Regressionの追加修正

### 原因

Follow-up 2でModal内にも`.card-detail-panel`を追加した一方、`Renderer.renderCardDetail()`のcontainer未指定時は従来どおり`querySelector(".card-detail-panel")`を使用していた。HTML上ではDeck Search Modalが通常盤面の右上Detailより先に置かれているため、MAIN Controllerからの通常Card clickは失われておらず、再描画による初期化でもなかったが、最初に一致する非表示のDeck Search Modal内Detailへ描画されていた。

### 修正内容

通常盤面の右上Detailに`data-board-card-detail`を付与し、container未指定時の既定描画先をこの要素へ明示した。Resolution Controllerは`data-resolution-detail`、Deck Search Controllerは`data-deck-search-detail`を引き続きcontainer指定するため、共通`Renderer.renderCardDetail()`を3画面で再利用しつつ描画先を分離している。z-index、Phase表示、【起】表示、ゲームロジックおよびProcessは変更していない。

### Regression test結果

通常盤面での連続したCard切替、Modal終了後の通常Detail利用、ResolutionのModal内Detail、Deck Searchのeligible / ineligible別selection動作とModal内Detail、selection再描画後のDetail保持を専用テストで確認した。全既存テスト、全JS/MJS syntax check、`git diff --check`もpassした。

## 残課題

汎用Modal component化、汎用Resolution Process、他Zone閲覧は今回のNon-goalとして未対応である。

## Action Button UI追加調整

Resolutionの「控え室に置く」とDeck Searchの「決定」に、通常盤面Card Detailの「使用する」/「使用不可」および「選択を解除」と共通のAction Button visual classを適用した。背景、枠線、角丸、文字、padding、hover / focus、disabled、cursorを共通化し、既存Card Detail固有の横幅と余白は用途別classに残した。

Modal Action Buttonは`width: auto`を基準として文言と左右paddingに応じて伸縮させ、Modal panelのflex itemとして`align-self: flex-start`で状態表示と同じ左端へ配置した。PC / narrow viewportへ同じ規則を適用しており、SP専用再設計、Modal構造、カード一覧、Card Detail、ゲーム処理、UI layerは変更していない。カード一覧 → Card Detail → 状態 → Action Buttonという既存のdocument flowも維持している。
