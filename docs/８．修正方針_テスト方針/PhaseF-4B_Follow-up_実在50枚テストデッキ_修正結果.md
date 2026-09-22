# Phase F-4B Follow-up 実在50枚テストデッキ 修正結果

## 変更結果

- 指定された実在カード16種類をCardMasterへ追加した。能力はすべて空配列である。
- ブラウザ確認用DeckDefinitionを既存の「人気アイドル 西森 柚咲」を含む17種類・50枚へ更新した。
- 内訳はCHARACTER 40枚、EVENT 2枚、CLIMAX 8枚である。
- Level 3 Characterの`SOUL`重複、Level 2 Characterの`SOUL`、CLIMAXの`SOUL + GATE`を配列のまま保持した。
- 既存F-4BのCardMaster IDとACT集中定義、および仮想CardMasterは変更していない。
- 実在デッキ専用テストを追加し、CardMaster固定値、能力、枚数、Card Type、owner別instance、DEV選択用集約を確認した。

## Power / Soul

外部一次情報へは実行環境から接続できなかった。新規カードについて推測値は設定せず、現行CardMaster schemaで明示的に許容される`basePower: null` / `baseSoul: null`を使用した。既存の「人気アイドル 西森 柚咲」の値は変更していない。

## 非変更・残課題

F-4B Ability Engine、DEV UIおよび各カード固有能力は変更していない。新規16種類のPower / Soulと画像は、一次情報へアクセス可能な別Follow-upで補完できる。
