# Application Flow / Deck設計

## 目的と範囲

カードデータがデッキ構築から対戦結果までどう受け渡されるかを定義する。今回は将来構想の境界だけを定め、画面、DeckDefinition、MatchResult、外部Importは実装しない。

## 画面フロー

```mermaid
flowchart LR
  Build[デッキ構築] --> Preparation[対戦準備]
  Preparation --> Battle[対戦]
  Battle --> Result[対戦結果]
```

### デッキ構築

CardMaster一覧からカードを選び、CardMaster全文を複製せず`masterId + count`をDeckDefinitionへ保存する。

```js
DeckDefinition {
  id,
  name,
  cards: [
    { masterId, count },
  ],
}
```

デッキ構築ルール、永続化方式、ユーザー所有カードの扱いは未確定とする。

### 対戦準備

使用Deck、対戦相手、Room / Matchを選択・作成する。オンライン同期やRoomの詳細仕様は、通信実装時に確定する。

### 対戦開始

```text
DeckDefinition + CardMaster registry
  ↓ masterIdを解決
対戦ごとに一意なCard instanceを必要枚数生成
  ↓
Deck
  ↓
GameState
```

Card instanceは対戦ごとに新規生成し、異なる対戦やDeck位置で同じobjectを共有しない。固定情報はCardMasterを参照し、owner、zone、position等はCardが保持する。

### 対戦結果

将来の`MatchResult`はwinner、players、使用deck、開始時刻、終了時刻等を保持する可能性がある。履歴、リプレイ、詳細ログの保存範囲は未確定とする。

## 外部デッキ・カードデータ境界

外部サービスのschemaを内部CardMaster schemaとして採用しない。

```mermaid
flowchart LR
  External[外部カード・デッキデータ] --> Importer[Import / Convert]
  Importer --> Internal[weiss-online CardMaster / DeckDefinition]
  Internal --> Battle[対戦エンジン]
```

外部形式のURL、field名、欠損値、仕様変更はImporterで吸収する。GameEngine、Card、Rendererは外部schemaを参照しない。権利・利用規約・再配布条件の確認もImport導入時の必須事項とする。

## 暫定test-cards.json

現在の`client/data/test-cards.json`はF-2の実地確認用であり、既存Card constructorへ固定情報をコピーする暫定形式である。F-3CでCardMaster JSON schemaへ移行し、本番用とテスト用が同じschemaとローダー境界を利用できる構造を目指す。

CardMaster / Card / CardAbilityの詳細は[カードデータ設計](card-ability.md)を正本とする。
