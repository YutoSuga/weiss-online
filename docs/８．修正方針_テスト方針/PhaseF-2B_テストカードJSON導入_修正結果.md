# PhaseF-2B_テストカードJSON導入 修正結果

対象：実地テスト用test-cards.json導入

出典：Codexタスク「Phase D共通ルールチェック設計」（ID: 01a00a4d-c312-7680-917e-75f38686b7e9）。

2026-09-21に取得できた会話記録から作成。本文は当時の依頼・完了報告を原文中心に収録しています。記載されたテスト・コミット・push・作業ツリー状態は当時の報告であり、今回再実行・再検証した結果ではありません。パス・リンク・NEXTも当時の表記を保持しており、現在と異なる場合があります。

---

## 完了報告（2026-09-14 00:06 JST）

出典ターン：01a09b4e-0cbf-7022-9ea4-5a34b7d8519e

実装完了しました。現在は未コミット状態です。

変更ファイル：

- [test-cards.json](C:/Users/sugay/git/weiss-online/weiss-online/client/data/test-cards.json)
- [testCardLoader.js](C:/Users/sugay/git/weiss-online/weiss-online/client/js/data/testCardLoader.js)
- [main.dev.js](C:/Users/sugay/git/weiss-online/weiss-online/client/js/main.dev.js)
- [README.md](C:/Users/sugay/git/weiss-online/weiss-online/README.md)
- [card-ability.md](C:/Users/sugay/git/weiss-online/weiss-online/docs/１．対戦画面設計書/card-ability.md)

実装内容：

- Level／Cost／Colorが異なるCharacterを6種類追加
- `fetch`でJSONを読み込み、既存の`Card` constructorから生成
- self／opponent各50枚の独立したCard instanceを生成
- IDは `owner-定義ID-copy番号` 形式で一意化
- JSONには固定情報のみを保存
- `owner`、`zone`、`index`などは生成時に設定
- 配列・必須field・定義ID重複を検証
- 読み込み失敗時はコンソールと画面オーバーレイへ原因を表示
- READMEのNEXTはPhase F-2Cのまま維持
- CardMaster／masterId／Ability構造は追加していません

確認結果：

- self／opponentとも50枚生成
- 全100枚のinstance IDが一意
- 6種類すべてがDeckへ含まれる
- Level 0 Play可能
- Level条件NG
- Color条件NG／OK
- Stock不足
- Cost 2のStock TOP順支払い
- Replacement＋Cost
- PLAY_CHARACTER完了後にMAIN_PHASEへ復帰
- F-2B E2E、F-2A Query、DEV関連確認を通過
- `git diff --check`異常なし

既存の古いF-2Aテストに「最初の手札が必ずLv0／Cost 0」という前提があり、混成Deck化により1ケースだけそのままでは成立しなくなりました。新しい実地テストでは対象カードを明示して同じSelection動作を確認しています。

---

## 後続のコミット・push報告（2026-09-14 00:20 JST）

出典ターン：01a09b5b-4e0b-7dc3-b606-03dfa1f17772

コミット・push完了しました。

- ブランチ: `main`
- コミット: `ef5d04a feat: load F-2B test cards from JSON`
- リモート: `origin/main`
- 作業ツリー: クリーンです。

※上記本文の「未コミット」は各完了報告時点の状態です。後続の状態はこのコミット・push報告を参照してください。

