YutoSuga/weiss-online に Phase F-3C を実装してください。

# Phase名

F-3C: CardMaster正式データ化 + DeckDefinition基盤

F-3AではCardMasterとCardを分離し、
F-3BではCardAbilityデータ構造を導入しました。

F-3Cでは、現在のテストカード専用データ／Loaderから、
将来DB/APIへ置き換え可能な正式なCardMasterデータ供給方式へ移行してください。

あわせて、対戦用Deckを「CardMasterを直接50件並べる」のではなく、
「どのCardMasterを何枚使用するか」を定義するDeckDefinitionから生成できる基盤を導入してください。

F-3Cではカード能力の実行処理は実装しません。


# 0. 最初に必ず既存実装を確認する

実装前に、少なくとも以下を確認してください。

- README.md
- docs/設計書一覧.md
- docs/１．設計書/カードデータモデル.md
- docs/１．設計書/エンティティ・オブジェクト一覧.md
- docs/１．設計書/アーキテクチャ.md
- docs/１．設計書/JavaScript仕様.md
- Card
- CardMaster
- CardMasterRegistry
- CardAbility
- ABILITY_TYPE
- Deck
- Player
- GameState
- 現在の testCardLoader
- client/data/test-cards.json
- main.dev.js
- F-3A / F-3Bで追加されたテスト
- 既存のゲームフロー／テスト

既存設計と命名を確認し、必要以上に既存コードを変更しないでください。

F-3A/F-3Bで確立した責務分離を維持してください。


# 1. F-3Cの目的

現在：

test-cards.json
  ↓
testCardLoader
  ↓
CardMaster
  ↓
CardMasterRegistry
  ↓
Card instances
  ↓
Deck

F-3C後：

card-masters.json
  ↓
CardMasterLoader
  ↓
CardMasterRegistry
       │
       │ masterId
       ↓
DeckDefinition
  ↓
Card instances × 50
  ↓
Deck
  ↓
Player
  ↓
GameState

という正式なデータフローへ移行してください。

将来的には、

JSON
↓
Loader

の部分を、

DB / API
↓
Loader相当

へ交換できることを意識してください。

GameEngine、Renderer、Card等がJSONの保存形式やfetch処理へ直接依存しない構造を維持してください。


# 2. 正式なCardMaster JSON

正式なCardMasterデータとして、例えば以下を作成してください。

client/data/card-masters.json

当面は1ファイルで管理します。
1 CardMaster = 1 JSON object とします。

基本schema：

{
  "id": "test-card-001",
  "cardNumber": null,
  "name": "テストキャラクター001",
  "cardType": "CHARACTER",
  "color": "YELLOW",
  "level": 0,
  "cost": 0,
  "basePower": 1500,
  "baseSoul": 1,
  "triggerIcons": [],
  "traits": ["テスト"],
  "abilities": []
}

既存CardMasterのconstructor仕様と整合させてください。

JSON独自の別モデルを作らず、
読み込み後の最終的なドメインモデルは既存CardMasterとしてください。


# 3. id と cardNumber を分離する

CardMaster.id と CardMaster.cardNumber は別の意味を持ちます。

id
= weiss-online内部でCardMasterを識別するID

cardNumber
= ヴァイスシュヴァルツ上の実カード番号

実カード番号をCardMaster.idとして使用しないでください。

F-3Cでは仮想カードなので、

id:
test-card-001
test-card-002
...

cardNumber:
null

で構いません。

将来的なDB用のID採番方式やUUID方式はF-3Cでは決定・実装しないでください。


# 4. triggerIconsを正式に定数化する

F-3Bで、

CardMaster.triggers
↓
CardMaster.triggerIcons

へ正式名称を変更済みです。

F-3Cではトリガーアイコンの種類を定数化してください。

既存constants構成に合わせ、適切なファイル名・配置にしてください。

少なくとも以下を定義してください。

SOUL
RETURN
POOL
COMEBACK
DRAW
SHOT
TREASURE
GATE
STANDBY
CHOICE
CHANCE
DISCOVERY
FOCUS

例：

TRIGGER_ICON = Object.freeze({
  SOUL: "SOUL",
  RETURN: "RETURN",
  POOL: "POOL",
  COMEBACK: "COMEBACK",
  DRAW: "DRAW",
  SHOT: "SHOT",
  TREASURE: "TREASURE",
  GATE: "GATE",
  STANDBY: "STANDBY",
  CHOICE: "CHOICE",
  CHANCE: "CHANCE",
  DISCOVERY: "DISCOVERY",
  FOCUS: "FOCUS"
});

既存プロジェクトの定数実装スタイルがある場合は、それに合わせてください。

重要：

「トリガーアイコンなし」を表す NONE は定義しないでください。

アイコンなしは、

"triggerIcons": []

で表現します。

triggerIconsは配列のまま維持してください。

例えば同じ種類を複数持つ場合も表現可能である必要があります。

"triggerIcons": ["SOUL", "SOUL"]

CardMaster生成時に未知のtrigger icon値が渡された場合は、
fail-fastするようにしてください。

F-3Bで残したlegacy compatibility API
(card.trigger / card.triggers / CardMaster.triggers等)を、
今回の目的と無関係に破壊しないでください。


# 5. traits

traitsは文字列配列のままとしてください。

例：

"traits": ["音楽", "生徒会"]

特徴なし：

"traits": []

traits用の巨大enumは作成しないでください。


# 6. abilities

F-3Bで確定したCardAbility構造を、そのままJSONから表現できるようにしてください。

CardAbility：

{
  "id": "ABILITY_1",
  "type": "ACT",
  "keywords": [],
  "text": "能力テキスト",
  "activationTrigger": null,
  "conditions": [],
  "costs": [],
  "effects": []
}

F-3Bですでに、

plain object
↓
CardMaster constructor
↓
CardAbility

へ変換できる構造を導入済みのため、
その設計を利用してください。

F-3Cでは実際のゲーム用仮想カードについては原則、

"abilities": []

としてください。

ただし、自動テスト上必要であれば、
CardAbilityを含むJSON相当データがCardMaster/CardAbilityへ正常に変換されることを確認するテストは追加してください。


# 7. F-3CではAbility実行処理を実装しない

以下はF-3Cの対象外です。

- AbilityEngine
- AbilityExecutor
- ACT実行
- AUTO実行
- CONTINUOUS実行
- activationTriggerの具体的評価
- conditionsの具体的評価
- costsの具体的支払い処理
- effectsの具体的実行
- effectQueueとの接続
- ProcessManagerとのAbility連携
- Ability用UI

F-3Cはあくまで「能力データを正式なCardMaster JSONから保持できる」段階です。

実際のAbility実行はF-4以降です。


# 8. 仮想CardMasterを用意する

card-masters.jsonには、
開発用の仮想CardMasterを10～15種類程度用意してください。

すべて同じ能力値にはせず、
現在までに実装したゲーム処理やMAINフェイズの動作確認に使いやすいよう、
バランスよく構成してください。

少なくとも以下のようなバリエーションを適度に含めてください。

Level:
- 0
- 1
- 2
- 3

Cost:
- 0
- 1
- 2

Color:
- YELLOW
- GREEN
- RED
- BLUE

triggerIcons:
- []
- ["SOUL"]
- 必要に応じて他の定義済みtrigger icon

Power / Soulについても、Level/Costに応じて開発テストに使いやすい妥当な値を設定してください。

ただしF-3Cの目的はデッキバランス調整ではありません。
「既存のLevel / Cost / Color / triggerIcons等の挙動を確認しやすいテストデータ」
であることを優先してください。

abilitiesは原則すべて [] としてください。

実在カードをF-3Cで無理に投入する必要はありません。


# 9. DeckDefinitionを導入する

DeckDefinitionを新しいデータモデルとして導入してください。

責務は、

「このデッキに、どのCardMasterが何枚含まれているかを表現する」

ことだけです。

概念構造：

DeckDefinition {
  id,
  name,
  cards: [
    {
      masterId,
      count
    }
  ]
}

DeckDefinitionはimmutableなデータとして扱ってください。

入力配列／entry objectから独立した状態になるよう、
F-3A/F-3Bのimmutable方針と整合する実装にしてください。


# 10. DeckDefinitionにルール判定を持たせない

DeckDefinitionは単なるデッキ内容の定義です。

以下のルール判定をDeckDefinitionへ実装しないでください。

- 50枚ちょうどか
- 同一カードが規定枚数以内か
- クライマックスが規定枚数以内か
- ネオスタンダード等の構築区分
- 禁止／制限カード
- その他のデッキ構築ルール

将来的に必要になった場合は、
DeckValidator等の別責務として実装する想定です。

F-3CではDeckValidatorを作成しないでください。


# 11. 開発用DeckDefinition JSON

開発用デッキデータとして、例えば以下を作成してください。

client/data/test-decks.json

例：

[
  {
    "id": "test-deck-001",
    "name": "開発用テストデッキ",
    "cards": [
      {
        "masterId": "test-card-001",
        "count": 4
      },
      {
        "masterId": "test-card-002",
        "count": 4
      }
    ]
  }
]

開発用デッキは、
card-masters.jsonの仮想CardMasterを組み合わせて、
結果として50枚になるよう構成してください。

CardMasterは10～15種類程度を使い、
各カードのcountを適切に設定してください。

既存MAINフェイズのLevel/Cost/Color確認等に使いやすいよう、
偏りすぎない構成にしてください。

ただし、

「DeckDefinitionは必ず50枚でなければならない」

というvalidationをDeckDefinition自体には実装しないでください。

開発用test-deckが正しく展開された結果50 Card instancesになることは、
自動テストで確認してください。


# 12. DeckDefinitionからCard instancesを生成する

DeckDefinitionをそのまま対戦中のDeckとして使用しないでください。

以下の流れを実装してください。

DeckDefinition
  +
CardMasterRegistry
  ↓
各masterIdをRegistryから解決
  ↓
count分のCard instanceを生成
  ↓
Card instances
  ↓
Deck

例えば、

test-card-001 × 4

なら、

同じCardMasterを参照する
4つの独立したCard instance

を生成してください。

各Cardは異なるinstanceIdを持つ必要があります。

self / opponent間でもCard instanceを共有しないでください。

CardMasterは共有して構いません。

未知のmasterIdがDeckDefinitionに含まれる場合はfail-fastしてください。


# 13. instanceId

現在のF-3A/F-3Bで確立した、

CardMaster
= immutableな固定情報

Card
= 対戦中の1枚のruntime instance

という分離を維持してください。

DeckDefinitionから同じCardMasterを複数枚展開する場合も、
各Card instanceに一意なinstanceIdを付与してください。

instanceIdの具体的な生成方式については、
既存実装と整合する方法を使用してください。

F-3Cのために不要な大規模ID基盤を導入しないでください。


# 14. CardMasterLoaderを正式化する

現在のtestCardLoaderを、
正式なCardMaster読み込み処理へ移行してください。

例えば：

client/js/data/cardMasterLoader.js

責務：

データソースからCardMasterデータを取得
↓
基本形式を検証
↓
CardMaster生成
↓
CardMasterRegistryへ登録

としてください。

CardMaster自身にfetch責務を持たせないでください。

CardAbility自身にもfetch責務を持たせないでください。

GameEngineがJSONを直接読まないでください。

RendererがJSONを直接読まないでください。

CardがJSONを直接読まないでください。


# 15. Loaderの利用タイミング

現在の開発版では、
アプリ起動／対戦準備時にcard-masters.jsonを読み込み、
CardMasterRegistryを構築してからDeck/GameStateを生成する流れで構いません。

ただしCardMasterLoader自体を、

「ゲーム開始時にしか使用できない」

設計にはしないでください。

将来的には、

- デッキ構築画面
- カード一覧
- 対戦準備画面
- DB/APIからの読み込み

等でもCardMasterを利用する可能性があります。

Loaderの責務はあくまで、

「必要なタイミングでデータソースからCardMasterを読み込み、CardMasterRegistryを構築する」

ことです。


# 16. 旧test-cards系を廃止する

F-3Cへの移行完了後は、

client/data/test-cards.json

および旧testCardLoaderを廃止してください。

旧：

test-cards.json
↓
testCardLoader
↓
CardMaster
↓
Card

から、

card-masters.json
↓
CardMasterLoader
↓
CardMasterRegistry

test-decks.json
↓
DeckDefinition
↓
Card instances
↓
Deck

へ切り替えてください。

不要になったlegacy loader/dataを残さないでください。

ただしF-3Bで意図的に残した
Card.trigger / Card.triggers等のcompatibility APIとは別の話なので、
それらを今回勝手に削除しないでください。


# 17. 既存ゲーム挙動を変更しない

F-3Cは主にデータ供給方式の変更です。

以下を含む既存ゲームロジック／UI挙動を変更しないでください。

- DRAW
- CLOCK
- REFRESH
- REFRESH_PENALTY
- LEVEL_UP
- MAIN
- Hand → Stage
- Replacement
- Stage Move
- Stage Swap
- DEV操作
- Renderer
- visibility
- ProcessManager
- rule check

既存のGameEngineロジックをCardMaster JSON対応のために不要に変更しないでください。


# 18. データ順に依存するテストを作らない

以前、mixed deck導入時に、

「手札の最初のカードはLv0 / Cost0」

のような暗黙のデータ順依存テストが問題になりました。

F-3Cでも同じ問題を作らないでください。

特定条件のCardが必要なテストでは、

- level
- cost
- color
- cardType
- masterId

等の明示的条件で対象Cardを検索・選択してください。

配列位置や初期手札順に意味を持たせないでください。


# 19. テスト

F-3C専用テストを追加してください。

最低限、以下を確認してください。

## TRIGGER_ICON

- 定義済みtrigger iconを受け付ける
- triggerIcons=[]を受け付ける
- ["SOUL", "SOUL"]等の配列を保持できる
- 未知のtrigger iconをfail-fastする
- F-3B compatibility getterを壊していない

## CardMaster JSON / Loader

- card-masters形式のplain objectからCardMasterを生成できる
- CardMasterRegistryへ登録される
- abilities=[]を正常に扱える
- CardAbility plain objectがある場合、既存CardAbilityへ変換できる
- duplicate master ID等、既存fail-fast挙動を壊していない

## DeckDefinition

- id / name / cardsを保持する
- immutableである
- constructor入力配列／entry objectから独立している
- 同じmasterIdを複数countで定義できる
- DeckDefinition自身は50枚ルール等を判定しない

## Deck生成

- DeckDefinition + CardMasterRegistryからCard instancesを生成できる
- count分だけCardが生成される
- 同じmasterIdでもCard instanceは独立している
- instanceIdが重複しない
- self / opponentのCard instancesを共有しない
- 未知のmasterIdはfail-fastする
- 開発用test-deckを展開すると50枚になる

## Regression

F-3A/F-3Bおよび既存ゲームテストをすべて実行し、
既存機能が壊れていないことを確認してください。


# 20. ドキュメント更新

以下を中心に、必要な設計書を実装内容に合わせて更新してください。

- README.md
- docs/設計書一覧.md
- docs/１．設計書/カードデータモデル.md
- docs/１．設計書/エンティティ・オブジェクト一覧.md
- docs/１．設計書/アーキテクチャ.md
- docs/１．設計書/JavaScript仕様.md

必要であれば、既存の他設計書も更新してください。

READMEでは、

F-3C 完了

次Phase：
F-3D Renderer / カード詳細のMaster参照整理

と分かるようにしてください。


# 21. 「F-3C完成時の全体像」を設計書へ明記する

これは必須です。

今回整理したF-3C完成時のデータフロー／責務分離を、
適切な設計書（主にアーキテクチャ.md、カードデータモデル.md等）へ
Mermaidまたは既存ドキュメント形式に合った図として記載してください。

少なくとも以下の関係が設計書から理解できるようにしてください。

card-masters.json
        ↓
CardMasterLoader
        ↓
CardMasterRegistry
        │
        │ masterIdで解決
        ↓
CardMaster
        │
        └─ CardAbility[]

test-decks.json
        ↓
DeckDefinition
        │
        │ masterId + count
        ↓
CardMasterRegistryと組み合わせる
        ↓
Card instances
