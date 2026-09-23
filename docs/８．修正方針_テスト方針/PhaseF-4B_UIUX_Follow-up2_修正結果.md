# Phase F-4B UI/UX Follow-up 2 修正結果

## 原因

Phase通知の`.message-overlay`が`z-index: 1000`、カード選択Modalが`z-index: 100`であり、通知がBackdrop / Modalより上のstacking orderになっていた。また両Modalのclick処理は通常盤面のCard Detailだけを更新していたため、Backdrop越しに確認できなかった。

## 変更結果

UI layer tokenを追加してPhase < Backdrop < Modal Contentを明示した。Resolution / Deck Searchへ空状態付きDetail containerを設け、描画先を指定できる共通`Renderer.renderCardDetail`で描画した。Resolutionはdetail onlyを維持し、Deck Searchは最後のDetail対象IDをController内に保持してselection再描画後も復元する。PC 2列 / narrow 1列とviewport内scrollを追加した。

## 確認結果

専用構造テストにlayer、Modal Detail、共通描画責務、操作差、responsiveを追加した。ゲームロジック、Process、Mulligan、能力表示データは変更していない。実行結果は完了報告に記載する。

## 残課題

汎用Modal component化、汎用Resolution Process、他Zone閲覧は今回のNon-goalとして未対応である。
