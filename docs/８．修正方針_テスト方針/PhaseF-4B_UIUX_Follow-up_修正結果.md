# Phase F-4B UI/UX Follow-up 修正結果

## 原因と修正

- ResolutionはBRAINSTORM Handler内でReveal、CX集計、Waiting Room移動まで同期的に実行していたため確認不能だった。ACTを明示的な確認入力待ちにした。
- Deck Searchはclick時にDetail描画後、selection toggleによる全体再描画がDetailを消していた。toggle後にDetailを描く順へ変更した。
- 西森柚咲の`CardAbility.text`が【起】を含む一方、Rendererも`type`から【起】を付加していた。データ本文からtype labelを除いた。

## 実装結果

Resolution確認ダイアログ、対象限定の控え室移動、Reveal順表示、Card Detail連携、集中ログ、Deck Searchの動的案内と選択枚数表示を追加した。Mulligan、Effect.id / effectResults、Group no-op、検索・手札追加・1回Shuffle、Refresh resumeの意味論は維持した。

## 確認結果

Follow-up項目を`phaseF4B.test.mjs`へ追加・更新し、全テスト、JavaScript syntax check、差分checkを実施した。実行コマンドと最終結果はcommit時の完了報告に記載する。

## 残課題

控え室等の汎用Zone閲覧、汎用Resolution Process、移動animationはNon-goalのため未実装である。
