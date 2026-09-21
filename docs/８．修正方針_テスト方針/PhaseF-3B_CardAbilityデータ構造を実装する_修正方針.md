weiss-online の Phase F-3B
「CardAbilityデータ構造」を実装してください。

F-3Aでは以下が完了しています。

- CardMaster導入
- CardMasterRegistry導入
- Card / CardMaster分離
- instanceId / masterId分離
- Card固定情報のcompatibility getter
- Card serialization
- test-cards.json → CardMaster → Registry → Card の暫定ロード
- CardMasterのimmutable化

F-3Bでは、このCardMasterに「カードに記載されている能力」を表現する
CardAbilityデータ構造を導入します。

今回の目的は、

「カード能力をデータとして保持・参照できる状態にする」

ことです。

能力を実際に発動・実行するエンジンは今回実装しません。


# 1. 作業開始前の確認

作業開始前に必ず現在の実装と設計書を確認してください。

特に以下を確認してください。

- README.md
- docs/設計書一覧.md
- docs/１．設計書/カードデータモデル.md
- docs/１．設計書/エンティティ・オブジェクト一覧.md
- docs/１．設計書/アーキテクチャ.md
- docs/１．設計書/JavaScript仕様.md
- client/js/models/cardMaster.js
- client/js/models/cardMasterRegistry.js
- client/js/models/card.js
- client/js/data/testCardLoader.js
- client/data/test-cards.json
- client/tests/cardMaster.test.mjs

F-3Aで確立した責務分離・immutability・fail-fast方針を維持してください。


# 2. F-3Bの目的

CardMasterは、

「そのカードが何であるか」

を表すimmutableな固定情報です。

CardAbilityは、

「そのカードに何が書かれているか」

のうち、能力1つ分を表すimmutableな固定情報とします。


基本関係は以下です。


Card
  ↓ masterId
CardMasterRegistry
  ↓
CardMaster
  ◆── 0..* CardAbility


CardMasterがCardAbilityを直接包含します。

CardMasterがCardAbility IDだけを保持して、
別Registryから取得する方式にはしないでください。


# 3. CardAbilityクラスを追加

CardAbilityクラスをmodels配下の適切な場所へ追加してください。

現在の構成・命名規則に合わせて配置してください。


基本構造は以下です。

CardAbility {
  id,
  type,
  keywords,
  text,
  activationTrigger,
  conditions,
  costs,
  effects
}


各フィールドの役割は以下です。


## id

そのCardMaster内でCardAbilityを識別するIDです。

CardAbility.idはグローバル一意である必要はありません。

同一CardMaster内で一意であればOKです。


例：

CardMaster A
  - ABILITY_1
  - ABILITY_2

CardMaster B
  - ABILITY_1

は許可します。


将来的に対戦中の能力を特定する場合は、

Card.instanceId + CardAbility.id

などの組み合わせで識別できる設計を想定します。


# 4. CardAbility.type

能力種別として以下を定義してください。

ABILITY_TYPE = {
  CONTINUOUS: "CONTINUOUS",
  AUTO: "AUTO",
  ACT: "ACT"
}


意味：

CONTINUOUS
= 【永】

AUTO
= 【自】

ACT
= 【起】


コード内部では英語の固定値を使用します。

日本語表示と内部値は分離してください。


ABILITY_TYPEの配置については、
現在のconstants構成を確認し、
既存方針に合わせて適切な場所へ定義してください。


未知のtypeをsilentに受け入れないようにしてください。

CardAbility生成時にtypeが不正な場合は、
原因の分かるErrorでfail-fastしてください。


# 5. keywords

keywordsは能力に関連するキーワードを保持する配列です。

将来的には例えば、

- BRAINSTORM
- CHANGE
- ACCELERATE
- CX_COMBO
- SUPPORT

などを表現する可能性があります。

ただしF-3Bでは、
これら全キーワードのenumや実行処理を網羅的に実装する必要はありません。

今回の目的は、

CardAbilityがkeywords配列を保持できること

までです。

keywordsはimmutableにしてください。


# 6. text

CardAbility.textは、

「人間が読むための能力テキスト」

を保持します。

将来的にRendererやカード詳細画面で表示する元データになります。


重要：

GameEngineがCardAbility.textを文字列解析して
能力処理を判断する設計にはしないでください。


役割を以下のように分離します。


text
→ 人間が読む能力原文・表示用


activationTrigger
conditions
costs
effects
→ 将来GameEngineが能力を処理するための構造化データ


F-3Bでは実行処理は作りません。


# 7. activationTrigger

activationTriggerは、

「能力の発動契機」

を表すためのフィールドです。


特にAUTO能力で、

- このカードが手札から舞台に置かれた時
- このカードがアタックした時
- バトル相手がリバースした時

などを将来構造化するために使用します。


重要：

CardMasterが持つカード自体のトリガーアイコンとは
別概念です。


CardMaster.triggerIcons
= カード自体が持つトリガーアイコン


CardAbility.activationTrigger
= AUTO能力などの発動契機


この2つを明確に区別してください。


activationTriggerはすべての能力で必須ではありません。

特に、

CONTINUOUS
ACT

ではAUTOと同じ意味の発動契機を持たない場合があります。

そのためnull / 未使用を許容してください。


F-3BではactivationTriggerの全種類を定義しないでください。

具体的なイベントschemaは、
AUTO能力を実装する後続Phaseで必要なものから設計します。


# 8. conditions

conditionsは、

「その能力を適用・実行できる条件」

を将来構造化するための配列です。


ただしF-3Bでは、

- 全Condition type
- Condition evaluator
- 条件判定エンジン

を実装しないでください。


今回はCardAbilityがconditionsを
immutableな構造化データ配列として保持できるところまでとします。


# 9. costs

costsは、

「能力を使用・解決するために必要なコスト」

を将来構造化するための配列です。


将来的には例えば、

{
  type: "PAY_STOCK",
  amount: 1
}

{
  type: "REST_SELF"
}

などを表現する可能性があります。


ただしF-3Bでは、

- PAY_STOCK
- REST_SELF
- DISCARD
- その他すべてのCost type

を網羅的に定義する必要はありません。


また、

- canPay
- pay
- Cost executor

なども実装しないでください。


具体的なCost schemaと共通処理は、
F-4で代表的なACT能力を実装するときに
必要なものから定義します。


# 10. effects

effectsは、

「能力によって実行される結果」

を将来構造化するための配列です。


ただしF-3Bでは、

- Power増加
- Draw
- Search
- Salvage
- Damage
- Move
- その他のEffect type

を網羅的に定義しないでください。


Effect executorも実装しないでください。


今回はCardAbilityがeffectsを
immutableな構造化データ配列として保持できるところまでです。


# 11. 同じ処理を持つ能力の共通化方針

将来的に複数カードが同じ種類の処理を持つ場合でも、
CardAbilityオブジェクトそのものを複数CardMasterで共有する設計にはしません。


例えば将来的に、

Card A
  └ CardAbility
       ├ PAY_STOCK
       └ REST_SELF

Card B
  └ CardAbility
       ├ PAY_STOCK
       └ REST_SELF

となる場合、

CardAbility自体は各CardMasterに直接包含します。


共通化するのは、

PAY_STOCK
REST_SELF

などの「処理タイプ」と、
それを実行する将来の共通処理です。


カードごとに同じ処理ロジックを個別実装する設計にはしません。


ただし、その共通実行処理自体はF-4以降の対象です。

F-3Bで先行実装しないでください。


# 12. CardAbilityはimmutable

CardAbilityはCardMasterと同じくimmutableとしてください。


生成後に、

ability.type = ...
ability.text = ...
ability.costs.push(...)

などで変更できる設計にはしないでください。


少なくとも以下は外部から変更できないようにしてください。

- CardAbility本体
- keywords
- conditions
- costs
- effects


重要：

conditions / costs / effectsには、
将来的にobjectが入ります。

配列だけfreezeして、

ability.costs[0].amount = 999

のように内部objectが変更できる状態は避けてください。


F-3Aではtraits / trigger系はprimitive中心でしたが、
F-3Bではnested objectを想定するため、
必要な範囲でnested structureもimmutableになるようにしてください。


ただし、

- 外部deep-freezeライブラリ導入
- 不必要に巨大なimmutability framework導入

は避けてください。

このプロジェクト内で扱うplain object / arrayに対する
小さく明確な方法を優先してください。


# 13. runtime状態をCardAbilityへ持たせない

CardAbilityは固定定義です。

以下のようなruntime状態をCardAbilityへ追加しないでください。

- used
- activated
- resolved
- selected
- disabled
- oncePerTurnUsed
- currentValue


将来的に、

「この能力をこのターン使用済み」

などの状態が必要になった場合は、

Card
GameState
Process
その他runtime state

で管理します。


責務：

CardMaster
  immutable

CardAbility
  immutable

Card
  mutable runtime state

GameState
  mutable runtime state

Process
  mutable runtime state


この境界を維持してください。


# 14. CardMaster.triggers → triggerIcons

F-3AではCardMasterのフィールド名を、

triggers

としていました。

F-3B開始前の設計整理で、
これはCardAbilityのactivationTriggerと混同しやすいことが分かりました。


そのためCardMaster側の正式名称を、

triggers
→ triggerIcons

へ変更してください。


意味：

triggerIcons
= カードに印刷されているトリガーアイコン


activationTrigger
= AUTO能力などの発動契機


この2つは別概念です。


# 15. trigger / triggers互換

F-3Aでは既存コード互換のため、

card.trigger
card.triggers

を提供しています。


F-3BでCardMasterの正式名称をtriggerIconsへ変更しても、
既存GameEngine / Renderer / その他コードへの影響を最小化するため、
必要なcompatibility getterは維持してください。


正式な新APIとして、

card.triggerIcons

を追加してください。


既存互換として必要であれば、

card.trigger
card.triggers

は、

master.triggerIcons

を返すgetterとして残してください。


既存コードを機械的に全面置換する必要はありません。


# 16. CardMasterにabilitiesを追加

CardMasterへ、

abilities

を追加してください。


CardMaster {
  ...
  triggerIcons,
  traits,
  text,
  abilities
}


abilitiesは、

CardAbility[]

です。


CardMasterはCardAbilityを直接包含します。


CardMaster生成時にabilitiesが指定されなかった場合は、
空配列をdefaultとして扱えるようにしてください。


CardMaster.abilities自体もimmutableにしてください。


# 17. CardAbilityの所有関係

CardAbilityはCardMasterに直接包含します。


CardMaster
  ◆── CardAbility[]


以下の仕組みは今回作らないでください。

- CardAbilityRegistry
- global Ability Registry
- ability IDだけをCardMasterへ保存して外部参照する仕組み
- CardAbility DB
- CardAbility API


CardAbility.idは、
CardMaster内で能力を識別するためのIDです。


# 18. CardMaster内のCardAbility.id重複

同じCardMasterのabilities内で、
CardAbility.idが重複している状態は許可しないでください。


例えば、

abilities: [
  { id: "ABILITY_1", ... },
  { id: "ABILITY_1", ... }
]

はErrorにしてください。


一方、

CardMaster A / ABILITY_1
CardMaster B / ABILITY_1

は許可してください。


duplicate ability IDは、
CardMaster生成時など適切な境界でfail-fastしてください。


# 19. CardMaster生成時のCardAbility変換

CardMasterへabilitiesを渡す際に、

CardAbility instanceのみ許可するのか、
plain objectからCardAbilityへ変換するのかは、
現在のCardMaster / loader設計を確認したうえで、
F-3CのJSON Loaderへ自然につながる方法を選んでください。


ただし以下を守ってください。

- CardMaster.abilitiesの最終状態はCardAbilityとして扱える
- invalid ability dataをsilentに受け入れない
- CardMaster自身がJSON fetchを担当しない
- CardAbility自身がJSON fetchを担当しない
- LoaderとDomain Modelの責務を混同しない


採用した方針は完了報告で説明してください。


# 20. CardMaster.textの扱い

F-3AのCardMaster.textは、
legacy / transitionalな固定情報として存在しています。


F-3BではCardAbility.textが、
個々の能力テキストを保持する正式な場所になります。


ただし今回、

CardMaster.text

をいきなり削除しないでください。


F-3Bでは既存互換のため残してください。


また、

CardMaster.text
→ flavorText

へ勝手に意味変更しないでください。


F-3Cで正式CardMaster JSON schemaを作成するときに、
CardMaster.textを残すかどうか改めて判断します。


# 21. Card側からのabilities参照

既存のCard固定情報getterと同じ考え方で、

card.abilities

からCardMaster.abilitiesを参照できるようにしてください。


Cardがabilitiesをコピーして独自保持する構造にはしないでください。


基本：

card.abilities
→ CardMaster.abilities


CardAbilityはimmutableなので、
Card instanceごとにCardAbilityを複製する必要はありません。


# 22. test-cards.jsonの扱い

F-3Bでは、

client/data/test-cards.json

を正式なCardMaster JSON schemaへ全面移行しないでください。


正式なCardMaster JSON化はF-3Cです。


現在の暫定test-cards.jsonを可能な限り維持してください。


現在のテストカードに能力データが存在しない場合は、

abilities: []

としてCardMasterを生成できれば十分です。


F-3Bのためだけに大量の仮能力データをtest-cards.jsonへ追加しないでください。


必要であれば自動テスト内でCardAbilityを直接生成し、
F-3Bのデータ構造を検証してください。


# 23. 実カード能力はまだ実装しない

F-3Bでは実カード能力の実行は行いません。


今後の予定は以下です。


F-3B
CardAbilityデータ構造
→ 能力を保持・参照できる


F-3C
CardMaster JSON化・実カードデータ
→ 実カード1〜2枚をCardMaster / CardAbilityとして表現できる


F-3D
Renderer / カード詳細
→ 能力テキスト等を画面で確認できる


F-4
ACT Ability v1
→ 代表的なACT能力1〜2個を実際に動かす


F-5
AUTO Ability
→ AUTOの代表カードを実際に動かす


F-6
CONTINUOUS Ability
→ CONTINUOUSの代表カードを実際に動かす


F-4以降では、

データ
→ 使用可否判定
→ コスト
→ 効果
→ Process / Rule Check

まで縦に通して検証します。


# 24. 能力実行エンジンを作らない

今回以下は実装しないでください。

- AbilityEngine
- AbilityExecutor
- EffectExecutor
- CostExecutor
- TriggerEngine
- activation queue
- AUTO待機キュー
- CONTINUOUS再計算
- ACT使用UI
- Ability Process
- canPay
- pay
- resolveAbility
- activateAbility


これらは後続Phaseで、
実カードを使いながら必要なものから設計します。


# 25. effectQueueとの関係

既存GameStateにeffectQueueが予約されている場合でも、
F-3BでCardAbilityをeffectQueueへ接続しないでください。


effectQueueは将来の能力処理用として予約したままにしてください。


今回、

CardAbility
→ effectQueue
→ GameEngine

という実行フローは作りません。


# 26. ProcessManagerとの関係

F-3BではCardAbilityをProcessManagerへ接続しないでください。


能力発動によるProcess生成、
interrupt、
resume

などは後続Phaseの対象です。


既存のProcessManagerの挙動を変更しないでください。


# 27. GameEngineへの影響を最小化

F-3Bはデータモデル追加です。


GameEngineの既存ルール処理を変更しないでください。


特に、

- MAIN Play
- Replacement
- Move
- Swap
- Refresh
- Refresh Penalty
- Level Up
- Rule Check
- Process interrupt / resume

へ能力処理を追加しないでください。


# 28. Rendererへの影響を最小化

Renderer / カード詳細の正式なCardMaster参照統一はF-3Dです。


F-3Bでは、

card.abilities

を参照可能にするところまでで構いません。


能力一覧UI、
能力発動ボタン、
キーワード表示などを先行実装しないでください。


# 29. Serialization

CardAbilityはCardMasterの固定情報です。


F-3Aで確立したCard.toJSON()の方針を維持してください。


Card.toJSON()へ、

- abilities
- CardAbility
- ability text
- activationTrigger
- conditions
- costs
- effects

を埋め込まないでください。


Card.toJSON()は引き続き、

instanceId
masterId
runtime state

だけをserializeしてください。


Card.fromJSON()は、

masterId
→ CardMasterRegistry
→ CardMaster
→ abilities

という関係から能力定義を再取得できる構造を維持してください。


# 30. F-3B固有テスト

F-3B用の自動テストを追加してください。

既存のclient/tests/cardMaster.test.mjsを拡張するか、
責務上分けた方が明確ならCardAbility専用testを追加して構いません。


少なくとも以下を確認してください。


## CardAbility基本

- 正常に生成できる
- idを保持する
- CONTINUOUSを受け入れる
- AUTOを受け入れる
- ACTを受け入れる
- unknown typeを拒否する
- keywordsを保持する
- textを保持する
- activationTrigger=nullを許容する
- conditionsを保持する
- costsを保持する
- effectsを保持する


## immutable

- CardAbility本体を書き換えられない
- keywordsを書き換えられない
- conditionsを書き換えられない
- costsを書き換えられない
- effectsを書き換えられない
- costs/effects等にnested objectがある場合、その中身も書き換えられない
- constructorへ渡した元object/arrayを後から変更してもCardAbilityへ影響しない


## CardMaster

- abilities省略時は空配列
- abilitiesにCardAbilityを保持できる
- abilities配列がimmutable
- 同一CardMaster内のduplicate CardAbility.idを拒否する
- 別CardMasterで同じCardAbility.idを使用できる
- triggerIconsを保持できる


## Card compatibility

- card.triggerIconsがmaster.triggerIconsを返す
- 既存card.trigger互換が維持される
- 既存card.triggers互換が維持される
- card.abilitiesがmaster.abilitiesを返す
- Card.toJSON()へabilitiesが入らない
- Card.fromJSON()後もRegistry経由でabilitiesを参照できる


# 31. F-3A回帰テスト

F-3Aで追加したテストをすべて通してください。


特に、

- CardMaster immutability
- CardMasterRegistry
- duplicate master ID
- unknown master ID
- Card getter
- currentPower/currentSoul
- 0値の復元
- serialization
- self/opponentの独立Card instance
- instanceId一意性

を壊さないでください。


# 32. 既存ゲーム処理の回帰

可能な範囲で既存テスト・構文チェックを実行してください。


今回GameEngineやRendererのルールロジックを変更しないため、
F-2Cまでの既存呼び出し境界が維持されていることを確認してください。


特に、

card.id
card.name
card.cardType
card.level
card.cost
card.color
card.basePower
card.baseSoul

などF-3Aで維持したcompatibility APIを壊さないでください。


# 33. ドキュメント更新

実装完了後、実際のコードと一致するよう関連設計書を更新してください。


特に以下を確認してください。

- README.md
- docs/設計書一覧.md
- docs/１．設計書/カードデータモデル.md
- docs/１．設計書/エンティティ・オブジェクト一覧.md
- docs/１．設計書/アーキテクチャ.md
- docs/１．設計書/JavaScript仕様.md


設計書には少なくとも以下を明記してください。


- CardMaster ◆── 0..* CardAbility の直接包含関係
- CardAbilityはimmutable
- CardAbility.idはCardMaster内で一意
- CardAbility.typeはCONTINUOUS / AUTO / ACT
- triggerIconsとactivationTriggerの違い
- CardAbility.textは表示・人間向け原文
- activationTrigger / conditions / costs / effectsは構造化データ
- CardAbilityはruntime状態を持たない
- 同種能力の共通化はCardAbility共有ではなく処理タイプ/実行処理で行う
- 実行エンジンはF-4以降
- CardMaster.textはF-3Bではlegacy / transitionalとして残す


# 34. READMEのPhase更新

実装とテストが成功した場合のみ、

F-3B
CardAbilityデータ構造

を完了扱いにしてください。


次Phaseは、

F-3C
CardMaster JSON化・実カードデータ数枚投入

としてください。


# 35. 今回の非対象

以下は今回実装しないでください。

- 実カード能力の実行
- AbilityEngine
- AbilityExecutor
- Cost executor
- Effect executor
- Trigger engine
- AUTO発動処理
- ACT発動処理
- CONTINUOUS適用処理
- activation queue
- effectQueue接続
- ProcessManagerとの能力連携
- 能力発動UI
- 能力一覧UIの本格実装
- 正式CardMaster JSON schemaへの移行
- 大量の実カードデータ投入
- Renderer全面改修
- DeckDefinition
- デッキ構築
- オンライン通信
- WebSocket
- DB/API
- 再接続
- CPU対戦


# 36. 完了条件

以下をすべて満たした場合のみF-3B完了としてください。


- CardAbilityクラスが追加されている
- ABILITY_TYPEがCONTINUOUS / AUTO / ACTで定義されている
- invalid typeをfail-fastする
- CardAbilityがimmutable
- nested structureも外部から変更できない
- CardAbility.idはCardMaster内で一意
- CardMasterがCardAbility[]を直接包含する
- CardAbilityRegistryを作っていない
- CardMaster.abilitiesがimmutable
- abilities省略時に空配列として扱える
- CardMaster.triggersの正式名称がtriggerIconsへ変更されている
- card.triggerIconsから参照できる
- 必要なcard.trigger / card.triggers互換が維持されている
- activationTriggerとtriggerIconsが別概念として実装・文書化されている
- CardAbility.textと構造化データの責務が分離されている
- CardMaster.textを勝手に削除・flavorText化していない
- CardAbilityにruntime状態を持たせていない
- Card.toJSON()へCardAbilityを埋め込んでいない
- test-cards.jsonを正式schemaへ全面移行していない
- 能力実行エンジンを先行実装していない
- F-3Aテストが引き続き成功する
- F-3B固有テストが成功する
- 関連ドキュメントが実装内容と一致する


# 37. 作業完了後の報告

作業完了後、以下を報告してください。


1. 新規作成したファイル
2. 変更したファイル
3. CardAbilityの最終構造
4. ABILITY_TYPEの定義場所と内容
5. CardAbilityのimmutability実装方法
6. nested object/arrayのimmutability対応
7. CardMasterとCardAbilityの所有関係
8. CardAbility.idの一意性チェック方法
9. triggers → triggerIconsの変更内容
10. card.trigger / card.triggersの互換対応
11. card.abilitiesの参照方法
12. CardMaster.textとCardAbility.textの扱い
13. activationTrigger / conditions / costs / effectsをF-3Bでどこまで実装したか
14. Card serializationへの影響
15. 実施したF-3B固有テスト
16. F-3A回帰テスト結果
17. その他の既存テスト・構文チェック結果
18. ドキュメント更新内容
19. git diff / git statusの概要
20. F-3Bを完了扱いにしたか
21. 次PhaseがF-3Cになっているか


# 38. 実装上の判断

既存コード・設計書とこの依頼文に細かな差異がある場合は、
まず現在のコードを調査してください。

既存挙動を壊さず、
F-3Aで確立した設計を自然に拡張する小さな変更を優先してください。

F-3Bの目的は、

「将来のすべてのカード能力を今実装すること」

ではありません。


目的は、

「CardMasterが0件以上のimmutableなCardAbilityを持ち、
能力をデータとして安全に保持・参照できる基盤を作ること」

です。


将来の能力処理について判断が必要になった場合は、
F-4以降へ先送りできるものを無理にF-3Bへ入れないでください。

重大な設計矛盾が見つかり、
F-3Bの範囲で安全に判断できない場合は、
推測で大規模実装せず、その点を報告してください。weiss-online の Phase F-3B
「CardAbilityデータ構造」を実装してください。

F-3Aでは以下が完了しています。

- CardMaster導入
- CardMasterRegistry導入
- Card / CardMaster分離
- instanceId / masterId分離
- Card固定情報のcompatibility getter
- Card serialization
- test-cards.json → CardMaster → Registry → Card の暫定ロード
- CardMasterのimmutable化

F-3Bでは、このCardMasterに「カードに記載されている能力」を表現する
CardAbilityデータ構造を導入します。

今回の目的は、

「カード能力をデータとして保持・参照できる状態にする」

ことです。

能力を実際に発動・実行するエンジンは今回実装しません。


# 1. 作業開始前の確認

作業開始前に必ず現在の実装と設計書を確認してください。

特に以下を確認してください。

- README.md
- docs/設計書一覧.md
- docs/１．設計書/カードデータモデル.md
- docs/１．設計書/エンティティ・オブジェクト一覧.md
- docs/１．設計書/アーキテクチャ.md
- docs/１．設計書/JavaScript仕様.md
- client/js/models/cardMaster.js
- client/js/models/cardMasterRegistry.js
- client/js/models/card.js
- client/js/data/testCardLoader.js
- client/data/test-cards.json
- client/tests/cardMaster.test.mjs

F-3Aで確立した責務分離・immutability・fail-fast方針を維持してください。


# 2. F-3Bの目的

CardMasterは、

「そのカードが何であるか」

を表すimmutableな固定情報です。

CardAbilityは、

「そのカードに何が書かれているか」

のうち、能力1つ分を表すimmutableな固定情報とします。


基本関係は以下です。


Card
  ↓ masterId
CardMasterRegistry
  ↓
CardMaster
  ◆── 0..* CardAbility


CardMasterがCardAbilityを直接包含します。

CardMasterがCardAbility IDだけを保持して、
別Registryから取得する方式にはしないでください。


# 3. CardAbilityクラスを追加

CardAbilityクラスをmodels配下の適切な場所へ追加してください。

現在の構成・命名規則に合わせて配置してください。


基本構造は以下です。

CardAbility {
  id,
  type,
  keywords,
  text,
  activationTrigger,
  conditions,
  costs,
  effects
}


各フィールドの役割は以下です。


## id

そのCardMaster内でCardAbilityを識別するIDです。

CardAbility.idはグローバル一意である必要はありません。

同一CardMaster内で一意であればOKです。


例：

CardMaster A
  - ABILITY_1
  - ABILITY_2

CardMaster B
  - ABILITY_1

は許可します。


将来的に対戦中の能力を特定する場合は、

Card.instanceId + CardAbility.id

などの組み合わせで識別できる設計を想定します。


# 4. CardAbility.type

能力種別として以下を定義してください。

ABILITY_TYPE = {
  CONTINUOUS: "CONTINUOUS",
  AUTO: "AUTO",
  ACT: "ACT"
}


意味：

CONTINUOUS
= 【永】

AUTO
= 【自】

ACT
= 【起】


コード内部では英語の固定値を使用します。

日本語表示と内部値は分離してください。


ABILITY_TYPEの配置については、
現在のconstants構成を確認し、
既存方針に合わせて適切な場所へ定義してください。


未知のtypeをsilentに受け入れないようにしてください。

CardAbility生成時にtypeが不正な場合は、
原因の分かるErrorでfail-fastしてください。


# 5. keywords

keywordsは能力に関連するキーワードを保持する配列です。

将来的には例えば、

- BRAINSTORM
- CHANGE
- ACCELERATE
- CX_COMBO
- SUPPORT

などを表現する可能性があります。

ただしF-3Bでは、
これら全キーワードのenumや実行処理を網羅的に実装する必要はありません。

今回の目的は、

CardAbilityがkeywords配列を保持できること

までです。

keywordsはimmutableにしてください。


# 6. text

CardAbility.textは、

「人間が読むための能力テキスト」

を保持します。

将来的にRendererやカード詳細画面で表示する元データになります。


重要：

GameEngineがCardAbility.textを文字列解析して
能力処理を判断する設計にはしないでください。


役割を以下のように分離します。


text
→ 人間が読む能力原文・表示用


activationTrigger
conditions
costs
effects
→ 将来GameEngineが能力を処理するための構造化データ


F-3Bでは実行処理は作りません。


# 7. activationTrigger

activationTriggerは、

「能力の発動契機」

を表すためのフィールドです。


特にAUTO能力で、

- このカードが手札から舞台に置かれた時
- このカードがアタックした時
- バトル相手がリバースした時

などを将来構造化するために使用します。


重要：

CardMasterが持つカード自体のトリガーアイコンとは
別概念です。


CardMaster.triggerIcons
= カード自体が持つトリガーアイコン


CardAbility.activationTrigger
= AUTO能力などの発動契機


この2つを明確に区別してください。


activationTriggerはすべての能力で必須ではありません。

特に、

CONTINUOUS
ACT

ではAUTOと同じ意味の発動契機を持たない場合があります。

そのためnull / 未使用を許容してください。


F-3BではactivationTriggerの全種類を定義しないでください。

具体的なイベントschemaは、
AUTO能力を実装する後続Phaseで必要なものから設計します。


# 8. conditions

conditionsは、

「その能力を適用・実行できる条件」

を将来構造化するための配列です。


ただしF-3Bでは、

- 全Condition type
- Condition evaluator
- 条件判定エンジン

を実装しないでください。


今回はCardAbilityがconditionsを
immutableな構造化データ配列として保持できるところまでとします。


# 9. costs

costsは、

「能力を使用・解決するために必要なコスト」

を将来構造化するための配列です。


将来的には例えば、

{
  type: "PAY_STOCK",
  amount: 1
}

{
  type: "REST_SELF"
}

などを表現する可能性があります。


ただしF-3Bでは、

- PAY_STOCK
- REST_SELF
- DISCARD
- その他すべてのCost type

を網羅的に定義する必要はありません。


また、

- canPay
- pay
- Cost executor

なども実装しないでください。


具体的なCost schemaと共通処理は、
F-4で代表的なACT能力を実装するときに
必要なものから定義します。


# 10. effects

effectsは、

「能力によって実行される結果」

を将来構造化するための配列です。


ただしF-3Bでは、

- Power増加
- Draw
- Search
- Salvage
- Damage
- Move
- その他のEffect type

を網羅的に定義しないでください。


Effect executorも実装しないでください。


今回はCardAbilityがeffectsを
immutableな構造化データ配列として保持できるところまでです。


# 11. 同じ処理を持つ能力の共通化方針

将来的に複数カードが同じ種類の処理を持つ場合でも、
CardAbilityオブジェクトそのものを複数CardMasterで共有する設計にはしません。


例えば将来的に、

Card A
  └ CardAbility
       ├ PAY_STOCK
       └ REST_SELF

Card B
  └ CardAbility
       ├ PAY_STOCK
       └ REST_SELF

となる場合、

CardAbility自体は各CardMasterに直接包含します。


共通化するのは、

PAY_STOCK
REST_SELF

などの「処理タイプ」と、
それを実行する将来の共通処理です。


カードごとに同じ処理ロジックを個別実装する設計にはしません。


ただし、その共通実行処理自体はF-4以降の対象です。

F-3Bで先行実装しないでください。


# 12. CardAbilityはimmutable

CardAbilityはCardMasterと同じくimmutableとしてください。


生成後に、

ability.type = ...
ability.text = ...
ability.costs.push(...)

などで変更できる設計にはしないでください。


少なくとも以下は外部から変更できないようにしてください。

- CardAbility本体
- keywords
- conditions
- costs
- effects


重要：

conditions / costs / effectsには、
将来的にobjectが入ります。

配列だけfreezeして、

ability.costs[0].amount = 999

のように内部objectが変更できる状態は避けてください。


F-3Aではtraits / trigger系はprimitive中心でしたが、
F-3Bではnested objectを想定するため、
必要な範囲でnested structureもimmutableになるようにしてください。


ただし、

- 外部deep-freezeライブラリ導入
- 不必要に巨大なimmutability framework導入

は避けてください。

このプロジェクト内で扱うplain object / arrayに対する
小さく明確な方法を優先してください。


# 13. runtime状態をCardAbilityへ持たせない

CardAbilityは固定定義です。

以下のようなruntime状態をCardAbilityへ追加しないでください。

- used
- activated
- resolved
- selected
- disabled
- oncePerTurnUsed
- currentValue


将来的に、

「この能力をこのターン使用済み」

などの状態が必要になった場合は、

Card
GameState
Process
その他runtime state

で管理します。


責務：

CardMaster
  immutable

CardAbility
  immutable

Card
  mutable runtime state

GameState
  mutable runtime state

Process
  mutable runtime state


この境界を維持してください。


# 14. CardMaster.triggers → triggerIcons

F-3AではCardMasterのフィールド名を、

triggers

としていました。

F-3B開始前の設計整理で、
これはCardAbilityのactivationTriggerと混同しやすいことが分かりました。


そのためCardMaster側の正式名称を、

triggers
→ triggerIcons

へ変更してください。


意味：

triggerIcons
= カードに印刷されているトリガーアイコン


activationTrigger
= AUTO能力などの発動契機


この2つは別概念です。


# 15. trigger / triggers互換

F-3Aでは既存コード互換のため、

card.trigger
card.triggers

を提供しています。


F-3BでCardMasterの正式名称をtriggerIconsへ変更しても、
既存GameEngine / Renderer / その他コードへの影響を最小化するため、
必要なcompatibility getterは維持してください。


正式な新APIとして、

card.triggerIcons

を追加してください。


既存互換として必要であれば、

card.trigger
card.triggers

は、

master.triggerIcons

を返すgetterとして残してください。


既存コードを機械的に全面置換する必要はありません。


# 16. CardMasterにabilitiesを追加

CardMasterへ、

abilities

を追加してください。


CardMaster {
  ...
  triggerIcons,
  traits,
  text,
  abilities
}


abilitiesは、

CardAbility[]

です。


CardMasterはCardAbilityを直接包含します。


CardMaster生成時にabilitiesが指定されなかった場合は、
空配列をdefaultとして扱えるようにしてください。


CardMaster.abilities自体もimmutableにしてください。


# 17. CardAbilityの所有関係

CardAbilityはCardMasterに直接包含します。


CardMaster
  ◆── CardAbility[]


以下の仕組みは今回作らないでください。

- CardAbilityRegistry
- global Ability Registry
- ability IDだけをCardMasterへ保存して外部参照する仕組み
- CardAbility DB
- CardAbility API


CardAbility.idは、
CardMaster内で能力を識別するためのIDです。


# 18. CardMaster内のCardAbility.id重複

同じCardMasterのabilities内で、
CardAbility.idが重複している状態は許可しないでください。


例えば、

abilities: [
  { id: "ABILITY_1", ... },
  { id: "ABILITY_1", ... }
]

はErrorにしてください。


一方、

CardMaster A / ABILITY_1
CardMaster B / ABILITY_1

は許可してください。


duplicate ability IDは、
CardMaster生成時など適切な境界でfail-fastしてください。


# 19. CardMaster生成時のCardAbility変換

CardMasterへabilitiesを渡す際に、

CardAbility instanceのみ許可するのか、
plain objectからCardAbilityへ変換するのかは、
現在のCardMaster / loader設計を確認したうえで、
F-3CのJSON Loaderへ自然につながる方法を選んでください。


ただし以下を守ってください。

- CardMaster.abilitiesの最終状態はCardAbilityとして扱える
- invalid ability dataをsilentに受け入れない
- CardMaster自身がJSON fetchを担当しない
- CardAbility自身がJSON fetchを担当しない
- LoaderとDomain Modelの責務を混同しない


採用した方針は完了報告で説明してください。


# 20. CardMaster.textの扱い

F-3AのCardMaster.textは、
legacy / transitionalな固定情報として存在しています。


F-3BではCardAbility.textが、
個々の能力テキストを保持する正式な場所になります。


ただし今回、

CardMaster.text

をいきなり削除しないでください。


F-3Bでは既存互換のため残してください。


また、

CardMaster.text
→ flavorText

へ勝手に意味変更しないでください。


F-3Cで正式CardMaster JSON schemaを作成するときに、
CardMaster.textを残すかどうか改めて判断します。


# 21. Card側からのabilities参照

既存のCard固定情報getterと同じ考え方で、

card.abilities

からCardMaster.abilitiesを参照できるようにしてください。


Cardがabilitiesをコピーして独自保持する構造にはしないでください。


基本：

card.abilities
→ CardMaster.abilities


CardAbilityはimmutableなので、
Card instanceごとにCardAbilityを複製する必要はありません。


# 22. test-cards.jsonの扱い

F-3Bでは、

client/data/test-cards.json

を正式なCardMaster JSON schemaへ全面移行しないでください。


正式なCardMaster JSON化はF-3Cです。


現在の暫定test-cards.jsonを可能な限り維持してください。


現在のテストカードに能力データが存在しない場合は、

abilities: []

としてCardMasterを生成できれば十分です。


F-3Bのためだけに大量の仮能力データをtest-cards.jsonへ追加しないでください。


必要であれば自動テスト内でCardAbilityを直接生成し、
F-3Bのデータ構造を検証してください。


# 23. 実カード能力はまだ実装しない

F-3Bでは実カード能力の実行は行いません。


今後の予定は以下です。


F-3B
CardAbilityデータ構造
→ 能力を保持・参照できる


F-3C
CardMaster JSON化・実カードデータ
→ 実カード1〜2枚をCardMaster / CardAbilityとして表現できる


F-3D
Renderer / カード詳細
→ 能力テキスト等を画面で確認できる


F-4
ACT Ability v1
→ 代表的なACT能力1〜2個を実際に動かす


F-5
AUTO Ability
→ AUTOの代表カードを実際に動かす


F-6
CONTINUOUS Ability
→ CONTINUOUSの代表カードを実際に動かす


F-4以降では、

データ
→ 使用可否判定
→ コスト
→ 効果
→ Process / Rule Check

まで縦に通して検証します。


# 24. 能力実行エンジンを作らない

今回以下は実装しないでください。

- AbilityEngine
- AbilityExecutor
- EffectExecutor
- CostExecutor
- TriggerEngine
- activation queue
- AUTO待機キュー
- CONTINUOUS再計算
- ACT使用UI
- Ability Process
- canPay
- pay
- resolveAbility
- activateAbility


これらは後続Phaseで、
実カードを使いながら必要なものから設計します。


# 25. effectQueueとの関係

既存GameStateにeffectQueueが予約されている場合でも、
F-3BでCardAbilityをeffectQueueへ接続しないでください。


effectQueueは将来の能力処理用として予約したままにしてください。


今回、

CardAbility
→ effectQueue
→ GameEngine

という実行フローは作りません。


# 26. ProcessManagerとの関係

F-3BではCardAbilityをProcessManagerへ接続しないでください。


能力発動によるProcess生成、
interrupt、
resume

などは後続Phaseの対象です。


既存のProcessManagerの挙動を変更しないでください。


# 27. GameEngineへの影響を最小化

F-3Bはデータモデル追加です。


GameEngineの既存ルール処理を変更しないでください。


特に、

- MAIN Play
- Replacement
- Move
- Swap
- Refresh
- Refresh Penalty
- Level Up
- Rule Check
- Process interrupt / resume

へ能力処理を追加しないでください。


# 28. Rendererへの影響を最小化

Renderer / カード詳細の正式なCardMaster参照統一はF-3Dです。


F-3Bでは、

card.abilities

を参照可能にするところまでで構いません。


能力一覧UI、
能力発動ボタン、
キーワード表示などを先行実装しないでください。


# 29. Serialization

CardAbilityはCardMasterの固定情報です。


F-3Aで確立したCard.toJSON()の方針を維持してください。


Card.toJSON()へ、

- abilities
- CardAbility
- ability text
- activationTrigger
- conditions
- costs
- effects

を埋め込まないでください。


Card.toJSON()は引き続き、

instanceId
masterId
runtime state

だけをserializeしてください。


Card.fromJSON()は、

masterId
→ CardMasterRegistry
→ CardMaster
→ abilities

という関係から能力定義を再取得できる構造を維持してください。


# 30. F-3B固有テスト

F-3B用の自動テストを追加してください。

既存のclient/tests/cardMaster.test.mjsを拡張するか、
責務上分けた方が明確ならCardAbility専用testを追加して構いません。


少なくとも以下を確認してください。


## CardAbility基本

- 正常に生成できる
- idを保持する
- CONTINUOUSを受け入れる
- AUTOを受け入れる
- ACTを受け入れる
- unknown typeを拒否する
- keywordsを保持する
- textを保持する
- activationTrigger=nullを許容する
- conditionsを保持する
- costsを保持する
- effectsを保持する


## immutable

- CardAbility本体を書き換えられない
- keywordsを書き換えられない
- conditionsを書き換えられない
- costsを書き換えられない
- effectsを書き換えられない
- costs/effects等にnested objectがある場合、その中身も書き換えられない
- constructorへ渡した元object/arrayを後から変更してもCardAbilityへ影響しない


## CardMaster

- abilities省略時は空配列
- abilitiesにCardAbilityを保持できる
- abilities配列がimmutable
- 同一CardMaster内のduplicate CardAbility.idを拒否する
- 別CardMasterで同じCardAbility.idを使用できる
- triggerIconsを保持できる


## Card compatibility

- card.triggerIconsがmaster.triggerIconsを返す
- 既存card.trigger互換が維持される
- 既存card.triggers互換が維持される
- card.abilitiesがmaster.abilitiesを返す
- Card.toJSON()へabilitiesが入らない
- Card.fromJSON()後もRegistry経由でabilitiesを参照できる


# 31. F-3A回帰テスト

F-3Aで追加したテストをすべて通してください。


特に、

- CardMaster immutability
- CardMasterRegistry
- duplicate master ID
- unknown master ID
- Card getter
- currentPower/currentSoul
- 0値の復元
- serialization
- self/opponentの独立Card instance
- instanceId一意性

を壊さないでください。


# 32. 既存ゲーム処理の回帰

可能な範囲で既存テスト・構文チェックを実行してください。


今回GameEngineやRendererのルールロジックを変更しないため、
F-2Cまでの既存呼び出し境界が維持されていることを確認してください。


特に、

card.id
card.name
card.cardType
card.level
card.cost
card.color
card.basePower
card.baseSoul

などF-3Aで維持したcompatibility APIを壊さないでください。


# 33. ドキュメント更新

実装完了後、実際のコードと一致するよう関連設計書を更新してください。


特に以下を確認してください。

- README.md
- docs/設計書一覧.md
- docs/１．設計書/カードデータモデル.md
- docs/１．設計書/エンティティ・オブジェクト一覧.md
- docs/１．設計書/アーキテクチャ.md
- docs/１．設計書/JavaScript仕様.md


設計書には少なくとも以下を明記してください。


- CardMaster ◆── 0..* CardAbility の直接包含関係
- CardAbilityはimmutable
- CardAbility.idはCardMaster内で一意
- CardAbility.typeはCONTINUOUS / AUTO / ACT
- triggerIconsとactivationTriggerの違い
- CardAbility.textは表示・人間向け原文
- activationTrigger / conditions / costs / effectsは構造化データ
- CardAbilityはruntime状態を持たない
- 同種能力の共通化はCardAbility共有ではなく処理タイプ/実行処理で行う
- 実行エンジンはF-4以降
- CardMaster.textはF-3Bではlegacy / transitionalとして残す


# 34. READMEのPhase更新

実装とテストが成功した場合のみ、

F-3B
CardAbilityデータ構造

を完了扱いにしてください。


次Phaseは、

F-3C
CardMaster JSON化・実カードデータ数枚投入

としてください。


# 35. 今回の非対象

以下は今回実装しないでください。

- 実カード能力の実行
- AbilityEngine
- AbilityExecutor
- Cost executor
- Effect executor
- Trigger engine
- AUTO発動処理
- ACT発動処理
- CONTINUOUS適用処理
- activation queue
- effectQueue接続
- ProcessManagerとの能力連携
- 能力発動UI
- 能力一覧UIの本格実装
- 正式CardMaster JSON schemaへの移行
- 大量の実カードデータ投入
- Renderer全面改修
- DeckDefinition
- デッキ構築
- オンライン通信
- WebSocket
- DB/API
- 再接続
- CPU対戦


# 36. 完了条件

以下をすべて満たした場合のみF-3B完了としてください。


- CardAbilityクラスが追加されている
- ABILITY_TYPEがCONTINUOUS / AUTO / ACTで定義されている
- invalid typeをfail-fastする
- CardAbilityがimmutable
- nested structureも外部から変更できない
- CardAbility.idはCardMaster内で一意
- CardMasterがCardAbility[]を直接包含する
- CardAbilityRegistryを作っていない
- CardMaster.abilitiesがimmutable
- abilities省略時に空配列として扱える
- CardMaster.triggersの正式名称がtriggerIconsへ変更されている
- card.triggerIconsから参照できる
- 必要なcard.trigger / card.triggers互換が維持されている
- activationTriggerとtriggerIconsが別概念として実装・文書化されている
- CardAbility.textと構造化データの責務が分離されている
- CardMaster.textを勝手に削除・flavorText化していない
- CardAbilityにruntime状態を持たせていない
- Card.toJSON()へCardAbilityを埋め込んでいない
- test-cards.jsonを正式schemaへ全面移行していない
- 能力実行エンジンを先行実装していない
- F-3Aテストが引き続き成功する
- F-3B固有テストが成功する
- 関連ドキュメントが実装内容と一致する


# 37. 作業完了後の報告

作業完了後、以下を報告してください。


1. 新規作成したファイル
2. 変更したファイル
3. CardAbilityの最終構造
4. ABILITY_TYPEの定義場所と内容
5. CardAbilityのimmutability実装方法
6. nested object/arrayのimmutability対応
7. CardMasterとCardAbilityの所有関係
8. CardAbility.idの一意性チェック方法
9. triggers → triggerIconsの変更内容
10. card.trigger / card.triggersの互換対応
11. card.abilitiesの参照方法
12. CardMaster.textとCardAbility.textの扱い
13. activationTrigger / conditions / costs / effectsをF-3Bでどこまで実装したか
14. Card serializationへの影響
15. 実施したF-3B固有テスト
16. F-3A回帰テスト結果
17. その他の既存テスト・構文チェック結果
18. ドキュメント更新内容
19. git diff / git statusの概要
20. F-3Bを完了扱いにしたか
21. 次PhaseがF-3Cになっているか


# 38. 実装上の判断

既存コード・設計書とこの依頼文に細かな差異がある場合は、
まず現在のコードを調査してください。

既存挙動を壊さず、
F-3Aで確立した設計を自然に拡張する小さな変更を優先してください。

F-3Bの目的は、

「将来のすべてのカード能力を今実装すること」

ではありません。


目的は、

「CardMasterが0件以上のimmutableなCardAbilityを持ち、
能力をデータとして安全に保持・参照できる基盤を作ること」

です。


将来の能力処理について判断が必要になった場合は、
F-4以降へ先送りできるものを無理にF-3Bへ入れないでください。

重大な設計矛盾が見つかり、
F-3Bの範囲で安全に判断できない場合は、
推測で大規模実装せず、その点を報告してください。
