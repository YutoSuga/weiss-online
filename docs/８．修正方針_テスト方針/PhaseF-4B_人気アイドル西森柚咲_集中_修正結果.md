# Phase F-4B「人気アイドル 西森 柚咲」集中 修正結果

## 実装結果

- `Kch/W78-001S`をACT集中だけを持つ正式CardMasterとして追加した。
- BRAINSTORM keyword、Effect.id、EFFECT_RESULT、BRAINSTORM_REVEAL、EFFECT_GROUP、SEARCH_DECK、ADD_TO_HAND、SHUFFLE_DECKとLoader fail-fast検証を追加した。
- PUBLICな`ZONE.RESOLUTION`とplayer別`Player.resolution`を追加した。
- ACT contextにeffectResultsと集中の移動済みinstanceIdを保持し、既存REFRESH / REFRESH_PENALTY後に再開する処理を実装した。
- SEARCH_DECKを独立Processにし、0～N枚のeligible選択、同一instanceのHand移動、Group末尾の1回Shuffleを実装した。
- Deck全体をTOP→BOTTOM順に表示する検索UI、Card Detail連携、空時非表示のResolution UIを追加した。
- 選択状態表示をCardSelectionViewへ抽出し、MulliganとDeck Searchから利用した。

## テスト結果

F-4B専用テストでCardMaster/Loader、CX=0/1/複数、Group skip、Process Stack、filter、0枚確定、上限拒否、instance同一性、Refresh/Penalty resume、無関係Resolution保護、UI構造を確認した。全既存テスト、syntax check、diff checkも実施した。

## 未対応・持ち越し

AUTO能力、西森柚咲の【自】、effectQueue、汎用Condition DSL、Shuffle event、他の集中形式は対象外。F-4CでACT基盤レビュー、F-5以降でAUTOを扱う。ブラウザ実行環境がコンテナにないためスクリーンショットは取得できなかった。
