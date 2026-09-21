weiss-online の Phase F-3A
「CardMaster導入・Cardとの分離」を実装してください。

作業開始前に必ず現在のREADME.md、docs/設計書一覧.md、
docs/１．設計書/ 配下の関連設計書、および現在の実装を確認してください。

特に以下を確認してください。

- カードデータモデル.md
- エンティティ・オブジェクト一覧.md
- アーキテクチャ.md
- アプリケーションフロー.md
- ゲームエンジン.md
- JavaScript仕様.md
- プロセス.md
- メインフェイズ.md

設計書と現在の実装を確認したうえで、
既存の設計思想・命名・責務分離を尊重して実装してください。


# 1. 今回の目的

現在のCardは、

- カード種類として固定の情報
- 対戦中の1枚ごとのruntime情報

を同じオブジェクト内に持っています。

F-3Aではこれを、

CardMaster
= 「そのカードが何であるか」

Card
= 「その対戦中、その1枚が今どうなっているか」

に分離してください。


最終的な基本関係は以下です。

Card
  ↓ masterId
CardMasterRegistry
  ↓
CardMaster


CardMasterはカード種類ごとの固定情報を保持します。

Cardは対戦中のカードinstanceとして、
runtime情報を保持します。

CardMasterRegistryは、
読み込み済みCardMasterをmasterIdから取得するための
メモリ上のRegistryです。


# 2. 重要な前提

F-3Aはデータモデルの内部構造変更です。

F-2Cまでに実装済みのゲーム挙動・UI挙動を変更しないでください。

特に以下を回帰させないでください。

- ゲーム開始
- 初期手札
- Mulligan
- STAND
- DRAW
- CLOCK
- MAIN
- Refresh
- Refresh Penalty
- Level Up
- Rule Check
- Processの中断・再開
- 手札カード選択
- Hand → Stage通常Play
- Hand → occupied Stage Replacement
- Level条件
- Color条件
- Cost支払い
- Stage → empty Stage Move
- Stage → occupied Stage Swap
- Stage Move / Swap時のposition維持
- Stage Move / Swap時のface維持
- DEV UI
- opponent側の既存DEV操作

GameEngineのゲームルールを変更するフェーズではありません。


# 3. CardMasterクラスを追加

CardMasterクラスを適切なmodels配下へ追加してください。

現在のプロジェクト構成・命名規則を確認し、
既存構成に合わせて配置してください。


CardMasterが保持する固定情報は、
現在のCardおよびtest-cards.jsonを確認したうえで、
少なくとも以下を対象としてください。

CardMaster {
  id,
  cardNumber,
  name,
  cardType,
  color,
  level,
  cost,
  basePower,
  baseSoul,
  triggers,
  traits,
  text
}

abilitiesはF-3Bで正式導入するため、
今回CardAbility構造を実装しないでください。

既存データとの互換性のために必要であれば、
F-3Aではabilitiesを持たせない、
または空配列として予約するなど、
既存設計書との整合性を確認して最小限にしてください。


# 4. CardMasterはimmutable

CardMasterはimmutableとして扱ってください。

生成後に、

master.level = ...
master.basePower = ...

などで内容を書き換える設計にはしないでください。


traits / triggers など配列についても、
CardMaster生成時に外部から渡された配列をそのまま共有して、
外部変更によってCardMaster内部が変更される状態を避けてください。

必要に応じてコピーしたうえでfreezeしてください。

Object.freezeだけによる浅いfreezeで、
配列の中身だけ変更可能になる状態は避けてください。

ただし、汎用deepFreezeライブラリの導入など、
今回の目的以上に複雑な仕組みは不要です。


# 5. CardMasterRegistryを追加

CardMasterRegistryを追加してください。

役割は、

「読み込み済みCardMasterをmasterIdから取得する」

ことだけです。

想定APIは以下です。

register(master)
get(masterId)
has(masterId)
getAll()


## register(master)

CardMasterを登録します。

同じCardMaster.idがすでに登録されている場合は、
silent overwriteせず、明示的にErrorにしてください。


## get(masterId)

登録済みCardMasterを返します。

存在しないmasterIdの場合は、
nullやundefinedを返して後続処理を続けるのではなく、
原因が分かるErrorをthrowしてください。


## has(masterId)

登録済みかbooleanで返してください。


## getAll()

登録済みCardMaster一覧を返してください。

Registry内部状態を外部から直接破壊できない形にしてください。


# 6. Registryの責務

CardMasterRegistryは永続ストレージではありません。

以下のようなものを実装しないでください。

- localStorageへの保存
- IndexedDBへの保存
- DBアクセス
- APIアクセス
- JSON fetchそのもの

Registryはあくまで、

CardMasterをregisterする
↓
masterIdで取得する

ためのruntime上のlookupです。


また、Cardクラスから特定のJSONファイルを直接読むような実装にしないでください。


# 7. CardをCardMaster参照型へ変更

現在のCardから、
カード種類として固定の情報をCardMasterへ移してください。

Card本体は概ね以下の責務にしてください。

Card {
  instanceId,
  masterId,

  owner,
  zone,
  row,
  index,
  face,
  position,

  currentPower,
  currentSoul,
  visibilityOverride
}


CardはCardMasterRegistryを通じて、
masterIdに対応するCardMasterを参照できる構造にしてください。


依存の基本イメージ：

Card
  ↓ masterId
CardMasterRegistry
  ↓
CardMaster


CardがJSONファイルや外部データソースを直接参照する構造にはしないでください。


# 8. Registryの注入

CardMasterRegistryをグローバル変数へハードコードしないでください。

F-3Aでは、Card生成時に必要なRegistryを明示的に渡す方式を基本としてください。

概念例：

new Card({
  instanceId,
  masterId,
  masterRegistry,
  ...
})

実際のconstructor形状については、
現在のCard実装と既存呼び出し箇所を確認し、
必要以上に変更範囲を広げない形で設計してください。

将来的にGameContext等へまとめる可能性はありますが、
今回はGameContextを新設する必要はありません。


# 9. instanceId / masterId

CardのID概念を明確に分離してください。


## instanceId

対戦中の物理的な1枚を一意に識別するIDです。

同じCardMasterから50枚作られた場合でも、
各Card.instanceIdは異なります。


## masterId

そのCardがどのCardMasterから作られたかを表します。

Card.masterId
→ CardMaster.id

という関係です。


# 10. 既存 card.id の互換性

現在の実装ではcard.idを使用している箇所が存在する可能性があります。

F-3Aでは既存コードへの影響を最小化するため、

card.id

は削除せず、

instanceIdを返すcompatibility getter

として維持してください。

概念例：

get id() {
  return this.instanceId;
}

新規コードではinstanceIdを正式名称としてください。

既存コードを機械的にすべてcard.id → card.instanceIdへ変更する必要はありません。


# 11. Card固定情報getter

既存GameEngineやRendererへの影響を最小化するため、
Cardには固定情報のcompatibility getterを用意してください。

少なくとも現在利用されている以下のAPIは維持してください。

card.name
card.cardType
card.level
card.cost
card.color
card.basePower
card.baseSoul

内部ではCardMasterを参照してください。

概念例：

get level() {
  return this.master.level;
}

また必要に応じて、

card.traits
card.text

など現在利用されている固定情報についても、
既存コードを調査したうえでgetterを提供してください。


重要：

GameEngineを、

card.master.level
card.master.cost

のような直接参照へ全面書き換えしないでください。

GameEngine側からは従来どおり、

card.level
card.cost

などを利用できる構造を維持してください。


# 12. trigger / triggers の互換性

CardMaster側の正式名称は、

triggers

としてください。

ただし既存Card APIまたは既存実装で、

card.trigger

が使われている場合は、
F-3Aでは互換getterとして維持してください。

概念例：

get trigger() {
  return this.master.triggers;
}

必要であればcard.triggersも提供して構いません。

旧trigger名称を削除する作業は今回行わないでください。


# 13. textの扱い

F-3Aでは既存のtextをCardMasterへ移してください。

ただし、

CardMaster.text
→ flavorText

と解釈して勝手に変換しないでください。

現在のtextはF-3Aではlegacy / transitionalな固定情報として保持してください。

F-3BでCardAbilityを導入するときに、

CardMaster.text
abilities[].text
flavorText

の関係を改めて整理します。

今回flavorTextへの意味変更は行わないでください。


# 14. currentPower / currentSoul

Cardのruntime値である、

currentPower
currentSoul

はCard側に残してください。

新規Card生成時、明示的なruntime値が渡されていない場合は、

currentPower = master.basePower
currentSoul = master.baseSoul

で初期化してください。


ただし、保存済みCard状態を復元する場合など、

currentPower
currentSoul

が明示的に指定されている場合は、
その値を優先してください。


0などfalsyな値も正しく復元できるようにし、

value || master.basePower

のような実装によって0が失われないよう注意してください。


# 15. Card生成時のfail-fast

Card生成時にmasterIdがRegistryへ登録されていない場合は、
そのまま不完全なCardを生成しないでください。

原因が分かるErrorをthrowしてください。

以下のようなfallbackは禁止です。

- masterがなければnull
- masterがなければ空オブジェクト
- masterがなければ仮カード
- masterがなければ固定値0


CardMasterRegistry.get(masterId)のfail-fastと整合する形にしてください。


# 16. test-cards.jsonのF-3A暫定対応

現在のtest-cards.jsonは、
F-2Bで導入したテストカードデータです。

F-3Aでは正式なCardMaster JSON schemaへの全面移行はまだ行いません。

正式なCardMaster JSON化はF-3Cで行います。


F-3Aでは現在の流れ：

test-cards.json
→ testCardLoader
→ Card

を、

test-cards.json
→ testCardLoader
→ CardMaster
→ CardMasterRegistry
→ Card instances

という暫定adapter構造へ変更してください。


現在のtest-cards.jsonのschemaを、
F-3Aの都合だけで大幅変更しないでください。

testCardLoader側で現在のJSONをCardMasterへ変換する形を基本としてください。


# 17. testCardLoader

現在のtestCardLoader.jsを調査し、
既存の以下の性質を維持してください。

- JSON fetch
- 必須項目validation
- definition ID重複validation
- self/opponentそれぞれ独立したCard instance生成
- Card instance IDが一意
- JSONにはruntime状態を持たせない
- load error時のconsole表示
- load error時のoverlay表示

現在のテストデッキ生成結果を壊さないでください。


F-3Aでは、

JSON definition
→ CardMaster
→ Registry登録
→ Card生成

へ責務を整理してください。


# 18. CardMaster ID / cardNumber

CardMaster.idとcardNumberは別概念です。


CardMaster.id
= weiss-online内部のmaster ID


CardMaster.cardNumber
= 実カードに印刷されているカード番号


現時点のtest-cards.jsonに実カード番号が存在しない場合は、
無理に実在カード番号を作らないでください。

F-3Aの既存テストデータでcardNumberが必須でない方が自然であれば、
設計との整合性を保ちつつnullable / optionalとして扱って構いません。

架空の実カード番号を追加しないでください。


# 19. Card serialization

Card.toJSON()をCardMaster分離後の構造へ対応させてください。

CardMasterの固定情報をCard.toJSON()へ丸ごと埋め込まないでください。

基本的に以下のruntime情報をserializeしてください。

{
  instanceId,
  masterId,

  owner,
  zone,
  row,
  index,
  face,
  position,

  currentPower,
  currentSoul,
  visibilityOverride
}


CardMaster本体はserializeしません。


# 20. Card.fromJSON()

Card.fromJSON()でCard状態を復元できるようにしてください。

概念：

Card.fromJSON(data, masterRegistry)


復元時には、

data.masterId
→ masterRegistry
→ CardMaster

を解決してください。


未登録masterIdの場合はfail-fastしてください。

CardMaster情報をJSON内から復元する構造にはしないでください。


# 21. faceの既存仕様を維持

既存仕様として、

Card.faceのdefaultはnull

です。

nullの場合はZone由来の通常表示ルールを使用します。

FACE.UP / FACE.DOWNが明示された場合だけ、
物理的な表示overrideとして扱います。

CardMaster分離の影響で、
通常カード生成時にfaceを勝手にUP/DOWNへ変更しないでください。


# 22. visibilityOverrideの既存仕様を維持

visibilityOverrideもruntime情報としてCard側に残してください。

通常はnullです。

CardMaster側へ移動しないでください。


# 23. GameEngineへの影響を最小化

F-3AではGameEngineのルールロジックを変更しないでください。

Card getter互換によって、

card.level
card.cost
card.color
card.cardType

など既存APIを維持し、
GameEngineの変更を最小限にしてください。


GameEngineが、

- CardMasterRegistry
- test-cards.json
- CardMaster JSON形式

へ直接依存する構造にしないでください。


# 24. Rendererへの影響を最小化

F-3DでRenderer / カード詳細をMaster参照へ整理する予定です。

F-3AではRendererの全面改修を行わないでください。

Card compatibility getterによって、
既存Rendererが可能な限りそのまま動く状態を維持してください。

F-3Aで必要な最小限の互換対応だけ行ってください。


# 25. CardAbilityは実装しない

CardAbilityはF-3Bの対象です。

今回、

- ABILITY_TYPE
- trigger
- conditions
- costs
- effects
- ability execution

などのCardAbility構造・実行基盤を先行実装しないでください。

CardMaster / Cardの分離に集中してください。


# 26. DeckDefinitionは実装しない

DeckDefinitionは将来のデッキ構築・対戦準備で使用する概念です。

今回DeckDefinitionクラスやデッキ構築機能を実装しないでください。


# 27. オンライン機能は実装しない

今回以下は実装しないでください。

- WebSocket
- server authoritative GameState
- 再接続
- DB
- API
- ログイン
- Match / Room管理

ただし今回の、

masterId
CardMasterRegistry
Card.toJSON()
Card.fromJSON()

は将来のオンライン化を妨げない構造にしてください。


# 28. テスト

現在存在するテスト方法・テストコード・DEV UIを確認し、
可能な範囲で自動確認してください。

少なくともF-3A固有として以下を確認してください。


## CardMaster

- 固定情報が正しく保持される
- immutableである
- traits / triggersなどの配列が外部変更で書き換わらない


## CardMasterRegistry

- register → getできる
- hasが正しく動く
- getAllが正しく動く
- duplicate ID登録でError
- unknown masterIdのgetでError


## Card

- instanceIdを保持
- masterIdを保持
- card.idがinstanceIdを返す
- 固定情報getterがCardMaster値を返す
- currentPower初期値 = basePower
- currentSoul初期値 = baseSoul
- runtime値を明示した場合はその値を優先
- currentPower=0 / currentSoul=0も正しく保持
- unknown masterIdでは生成失敗


## Serialization

- toJSONにCardMaster固定情報を埋め込まない
- instanceId / masterId / runtime stateを保持
- fromJSONで同じruntime stateを復元できる
- fromJSON時にunknown masterIdならError


## testCardLoader

- 現在のtest-cards.jsonからCardMasterを生成できる
- Registryへ登録できる
- self/opponent用Card instanceを生成できる
- instanceIdが重複しない


# 29. F-2Cまでの回帰確認

可能な範囲で既存テストを実行してください。

特にMAIN Phaseについて以下を確認してください。

1. Hand Characterを選択できる
2. Level 0 Characterを通常Playできる
3. Level 1以上のLevel条件が機能する
4. Color条件が機能する
5. Cost不足時にPlay不可になる
6. Cost支払いでStock TOPからWaiting Roomへ移動する
7. occupied StageへのPlayで既存CharacterがWaiting Roomへ移動する
8. Stage → empty StageでMoveできる
9. Stage → occupied StageでSwapできる
10. Move / Swapでpositionが維持される
11. Move / Swapでfaceが維持される
12. Action完了後にMAIN WAITING_INPUTへ戻る


また、

- Refresh
- Refresh Penalty
- Level Up
- Rule Check
- Process interrupt / resume

について既存テストが存在する場合は実行してください。


# 30. 現在のテストに対する注意

F-2B以降、test-cards.jsonにはLevel / Cost / Colorの異なる複数カードが含まれています。

「手札の1枚目は必ずLevel 0 / Cost 0」

のような手札位置依存のテストを新たに作らないでください。

必要なカード条件を明示的に検索してテストしてください。


# 31. ドキュメント更新

実装完了後、実際のコードと整合するよう必要な設計書を更新してください。

特に、

- README.md
- docs/設計書一覧.md
- カードデータモデル.md
- エンティティ・オブジェクト一覧.md
- アーキテクチャ.md
- JavaScript仕様.md

など、今回の変更に直接関係する文書を確認してください。


実装完了・テスト成功後のみ、

F-3A
CardMaster導入・Cardとの分離

を完了扱いにしてください。


次の開発予定は、

F-3B
CardAbilityデータ構造

としてください。


# 32. 今回の非対象

以下は実装しないでください。

- CardAbility正式実装
- Ability実行処理
- CONTINUOUS / AUTO / ACT処理
- 正式CardMaster JSON schemaへの移行
- 実カードデータ投入
- Rendererの全面Master参照化
- DeckDefinition実装
- デッキ構築画面
- 対戦準備画面
- オンライン通信
- WebSocket
- DB/API
- 再接続処理
- CPU対戦

これらは後続Phaseです。


# 33. 完了条件

以下をすべて満たした場合のみF-3A完了としてください。

- CardMasterが追加されている
- CardMasterがimmutable
- CardMasterRegistryが追加されている
- duplicate master IDを拒否する
- unknown masterIdをfail-fastする
- CardがinstanceId / masterIdを持つ
- card.id互換getterが機能する
- Card固定情報getterがCardMasterを参照する
- GameEngineの既存Card APIが維持されている
- currentPower/currentSoulの初期化が正しい
- runtime値0も正しく保持できる
- trigger/triggers互換が維持されている
- textの意味を勝手にflavorTextへ変更していない
- Card.toJSON()がCardMasterを埋め込まない
- Card.fromJSON()がRegistryを使って復元する
- test-cards.jsonを大幅変更していない
- testCardLoaderがCardMaster → Registry → Card生成へ対応している
- self/opponentで独立したCard instanceが生成される
- instanceIdが一意
- F-2Cまでの既存挙動が維持されている
- F-3B以降の機能を先行実装していない
- 関連ドキュメントが実装内容と一致している


# 34. 作業完了後の報告

完了後、以下を報告してください。

1. 新規作成したファイル
2. 変更したファイル
3. CardMasterの最終構造
4. CardMasterRegistryの最終API
5. Cardの変更前後の責務
6. instanceId / masterId / card.idの扱い
7. compatibility getter一覧
8. currentPower / currentSoulの初期化方法
9. test-cards.json → CardMaster → Registry → Card の実際の生成フロー
10. toJSON / fromJSONのserialization仕様
11. fail-fastを入れた箇所
12. 実施したテスト
13. F-2Cまでの回帰確認結果
14. ドキュメント更新内容
15. git diff / git statusの概要
16. F-3Aを完了扱いにしたか
17. 次PhaseがF-3Bになっているか


# 35. 実装上の判断について

既存コードとこの依頼文に細かな差異がある場合は、
まず現在のコードと設計書を調査してください。

既存挙動を壊さずに実現できる小さな変更を優先してください。

推測だけで大規模なリファクタリングを行わないでください。

設計上の重大な矛盾が見つかり、
F-3Aの範囲内で安全に判断できない場合は、
無理に実装を進めず、その点を報告してください。weiss-online の Phase F-3A
「CardMaster導入・Cardとの分離」を実装してください。

作業開始前に必ず現在のREADME.md、docs/設計書一覧.md、
docs/１．設計書/ 配下の関連設計書、および現在の実装を確認してください。

特に以下を確認してください。

- カードデータモデル.md
- エンティティ・オブジェクト一覧.md
- アーキテクチャ.md
- アプリケーションフロー.md
- ゲームエンジン.md
- JavaScript仕様.md
- プロセス.md
- メインフェイズ.md

設計書と現在の実装を確認したうえで、
既存の設計思想・命名・責務分離を尊重して実装してください。


# 1. 今回の目的

現在のCardは、

- カード種類として固定の情報
- 対戦中の1枚ごとのruntime情報

を同じオブジェクト内に持っています。

F-3Aではこれを、

CardMaster
= 「そのカードが何であるか」

Card
= 「その対戦中、その1枚が今どうなっているか」

に分離してください。


最終的な基本関係は以下です。

Card
  ↓ masterId
CardMasterRegistry
  ↓
CardMaster


CardMasterはカード種類ごとの固定情報を保持します。

Cardは対戦中のカードinstanceとして、
runtime情報を保持します。

CardMasterRegistryは、
読み込み済みCardMasterをmasterIdから取得するための
メモリ上のRegistryです。


# 2. 重要な前提

F-3Aはデータモデルの内部構造変更です。

F-2Cまでに実装済みのゲーム挙動・UI挙動を変更しないでください。

特に以下を回帰させないでください。

- ゲーム開始
- 初期手札
- Mulligan
- STAND
- DRAW
- CLOCK
- MAIN
- Refresh
- Refresh Penalty
- Level Up
- Rule Check
- Processの中断・再開
- 手札カード選択
- Hand → Stage通常Play
- Hand → occupied Stage Replacement
- Level条件
- Color条件
- Cost支払い
- Stage → empty Stage Move
- Stage → occupied Stage Swap
- Stage Move / Swap時のposition維持
- Stage Move / Swap時のface維持
- DEV UI
- opponent側の既存DEV操作

GameEngineのゲームルールを変更するフェーズではありません。


# 3. CardMasterクラスを追加

CardMasterクラスを適切なmodels配下へ追加してください。

現在のプロジェクト構成・命名規則を確認し、
既存構成に合わせて配置してください。


CardMasterが保持する固定情報は、
現在のCardおよびtest-cards.jsonを確認したうえで、
少なくとも以下を対象としてください。

CardMaster {
  id,
  cardNumber,
  name,
  cardType,
  color,
  level,
  cost,
  basePower,
  baseSoul,
  triggers,
  traits,
  text
}

abilitiesはF-3Bで正式導入するため、
今回CardAbility構造を実装しないでください。

既存データとの互換性のために必要であれば、
F-3Aではabilitiesを持たせない、
または空配列として予約するなど、
既存設計書との整合性を確認して最小限にしてください。


# 4. CardMasterはimmutable

CardMasterはimmutableとして扱ってください。

生成後に、

master.level = ...
master.basePower = ...

などで内容を書き換える設計にはしないでください。


traits / triggers など配列についても、
CardMaster生成時に外部から渡された配列をそのまま共有して、
外部変更によってCardMaster内部が変更される状態を避けてください。

必要に応じてコピーしたうえでfreezeしてください。

Object.freezeだけによる浅いfreezeで、
配列の中身だけ変更可能になる状態は避けてください。

ただし、汎用deepFreezeライブラリの導入など、
今回の目的以上に複雑な仕組みは不要です。


# 5. CardMasterRegistryを追加

CardMasterRegistryを追加してください。

役割は、

「読み込み済みCardMasterをmasterIdから取得する」

ことだけです。

想定APIは以下です。

register(master)
get(masterId)
has(masterId)
getAll()


## register(master)

CardMasterを登録します。

同じCardMaster.idがすでに登録されている場合は、
silent overwriteせず、明示的にErrorにしてください。


## get(masterId)

登録済みCardMasterを返します。

存在しないmasterIdの場合は、
nullやundefinedを返して後続処理を続けるのではなく、
原因が分かるErrorをthrowしてください。


## has(masterId)

登録済みかbooleanで返してください。


## getAll()

登録済みCardMaster一覧を返してください。

Registry内部状態を外部から直接破壊できない形にしてください。


# 6. Registryの責務

CardMasterRegistryは永続ストレージではありません。

以下のようなものを実装しないでください。

- localStorageへの保存
- IndexedDBへの保存
- DBアクセス
- APIアクセス
- JSON fetchそのもの

Registryはあくまで、

CardMasterをregisterする
↓
masterIdで取得する

ためのruntime上のlookupです。


また、Cardクラスから特定のJSONファイルを直接読むような実装にしないでください。


# 7. CardをCardMaster参照型へ変更

現在のCardから、
カード種類として固定の情報をCardMasterへ移してください。

Card本体は概ね以下の責務にしてください。

Card {
  instanceId,
  masterId,

  owner,
  zone,
  row,
  index,
  face,
  position,

  currentPower,
  currentSoul,
  visibilityOverride
}


CardはCardMasterRegistryを通じて、
masterIdに対応するCardMasterを参照できる構造にしてください。


依存の基本イメージ：

Card
  ↓ masterId
CardMasterRegistry
  ↓
CardMaster


CardがJSONファイルや外部データソースを直接参照する構造にはしないでください。


# 8. Registryの注入

CardMasterRegistryをグローバル変数へハードコードしないでください。

F-3Aでは、Card生成時に必要なRegistryを明示的に渡す方式を基本としてください。

概念例：

new Card({
  instanceId,
  masterId,
  masterRegistry,
  ...
})

実際のconstructor形状については、
現在のCard実装と既存呼び出し箇所を確認し、
必要以上に変更範囲を広げない形で設計してください。

将来的にGameContext等へまとめる可能性はありますが、
今回はGameContextを新設する必要はありません。


# 9. instanceId / masterId

CardのID概念を明確に分離してください。


## instanceId

対戦中の物理的な1枚を一意に識別するIDです。

同じCardMasterから50枚作られた場合でも、
各Card.instanceIdは異なります。


## masterId

そのCardがどのCardMasterから作られたかを表します。

Card.masterId
→ CardMaster.id

という関係です。


# 10. 既存 card.id の互換性

現在の実装ではcard.idを使用している箇所が存在する可能性があります。

F-3Aでは既存コードへの影響を最小化するため、

card.id

は削除せず、

instanceIdを返すcompatibility getter

として維持してください。

概念例：

get id() {
  return this.instanceId;
}

新規コードではinstanceIdを正式名称としてください。

既存コードを機械的にすべてcard.id → card.instanceIdへ変更する必要はありません。


# 11. Card固定情報getter

既存GameEngineやRendererへの影響を最小化するため、
Cardには固定情報のcompatibility getterを用意してください。

少なくとも現在利用されている以下のAPIは維持してください。

card.name
card.cardType
card.level
card.cost
card.color
card.basePower
card.baseSoul

内部ではCardMasterを参照してください。

概念例：

get level() {
  return this.master.level;
}

また必要に応じて、

card.traits
card.text

など現在利用されている固定情報についても、
既存コードを調査したうえでgetterを提供してください。


重要：

GameEngineを、

card.master.level
card.master.cost

のような直接参照へ全面書き換えしないでください。

GameEngine側からは従来どおり、

card.level
card.cost

などを利用できる構造を維持してください。


# 12. trigger / triggers の互換性

CardMaster側の正式名称は、

triggers

としてください。

ただし既存Card APIまたは既存実装で、

card.trigger

が使われている場合は、
F-3Aでは互換getterとして維持してください。

概念例：

get trigger() {
  return this.master.triggers;
}

必要であればcard.triggersも提供して構いません。

旧trigger名称を削除する作業は今回行わないでください。


# 13. textの扱い

F-3Aでは既存のtextをCardMasterへ移してください。

ただし、

CardMaster.text
→ flavorText

と解釈して勝手に変換しないでください。

現在のtextはF-3Aではlegacy / transitionalな固定情報として保持してください。

F-3BでCardAbilityを導入するときに、

CardMaster.text
abilities[].text
flavorText

の関係を改めて整理します。

今回flavorTextへの意味変更は行わないでください。


# 14. currentPower / currentSoul

Cardのruntime値である、

currentPower
currentSoul

はCard側に残してください。

新規Card生成時、明示的なruntime値が渡されていない場合は、

currentPower = master.basePower
currentSoul = master.baseSoul

で初期化してください。


ただし、保存済みCard状態を復元する場合など、

currentPower
currentSoul

が明示的に指定されている場合は、
その値を優先してください。


0などfalsyな値も正しく復元できるようにし、

value || master.basePower

のような実装によって0が失われないよう注意してください。


# 15. Card生成時のfail-fast

Card生成時にmasterIdがRegistryへ登録されていない場合は、
そのまま不完全なCardを生成しないでください。

原因が分かるErrorをthrowしてください。

以下のようなfallbackは禁止です。

- masterがなければnull
- masterがなければ空オブジェクト
- masterがなければ仮カード
- masterがなければ固定値0


CardMasterRegistry.get(masterId)のfail-fastと整合する形にしてください。


# 16. test-cards.jsonのF-3A暫定対応

現在のtest-cards.jsonは、
F-2Bで導入したテストカードデータです。

F-3Aでは正式なCardMaster JSON schemaへの全面移行はまだ行いません。

正式なCardMaster JSON化はF-3Cで行います。


F-3Aでは現在の流れ：

test-cards.json
→ testCardLoader
→ Card

を、

test-cards.json
→ testCardLoader
→ CardMaster
→ CardMasterRegistry
→ Card instances

という暫定adapter構造へ変更してください。


現在のtest-cards.jsonのschemaを、
F-3Aの都合だけで大幅変更しないでください。

testCardLoader側で現在のJSONをCardMasterへ変換する形を基本としてください。


# 17. testCardLoader

現在のtestCardLoader.jsを調査し、
既存の以下の性質を維持してください。

- JSON fetch
- 必須項目validation
- definition ID重複validation
- self/opponentそれぞれ独立したCard instance生成
- Card instance IDが一意
- JSONにはruntime状態を持たせない
- load error時のconsole表示
- load error時のoverlay表示

現在のテストデッキ生成結果を壊さないでください。


F-3Aでは、

JSON definition
→ CardMaster
→ Registry登録
→ Card生成

へ責務を整理してください。


# 18. CardMaster ID / cardNumber

CardMaster.idとcardNumberは別概念です。


CardMaster.id
= weiss-online内部のmaster ID


CardMaster.cardNumber
= 実カードに印刷されているカード番号


現時点のtest-cards.jsonに実カード番号が存在しない場合は、
無理に実在カード番号を作らないでください。

F-3Aの既存テストデータでcardNumberが必須でない方が自然であれば、
設計との整合性を保ちつつnullable / optionalとして扱って構いません。

架空の実カード番号を追加しないでください。


# 19. Card serialization

Card.toJSON()をCardMaster分離後の構造へ対応させてください。

CardMasterの固定情報をCard.toJSON()へ丸ごと埋め込まないでください。

基本的に以下のruntime情報をserializeしてください。

{
  instanceId,
  masterId,

  owner,
  zone,
  row,
  index,
  face,
  position,

  currentPower,
  currentSoul,
  visibilityOverride
}


CardMaster本体はserializeしません。


# 20. Card.fromJSON()

Card.fromJSON()でCard状態を復元できるようにしてください。

概念：

Card.fromJSON(data, masterRegistry)


復元時には、

data.masterId
→ masterRegistry
→ CardMaster

を解決してください。


未登録masterIdの場合はfail-fastしてください。

CardMaster情報をJSON内から復元する構造にはしないでください。


# 21. faceの既存仕様を維持

既存仕様として、

Card.faceのdefaultはnull

です。

nullの場合はZone由来の通常表示ルールを使用します。

FACE.UP / FACE.DOWNが明示された場合だけ、
物理的な表示overrideとして扱います。

CardMaster分離の影響で、
通常カード生成時にfaceを勝手にUP/DOWNへ変更しないでください。


# 22. visibilityOverrideの既存仕様を維持

visibilityOverrideもruntime情報としてCard側に残してください。

通常はnullです。

CardMaster側へ移動しないでください。


# 23. GameEngineへの影響を最小化

F-3AではGameEngineのルールロジックを変更しないでください。

Card getter互換によって、

card.level
card.cost
card.color
card.cardType

など既存APIを維持し、
GameEngineの変更を最小限にしてください。


GameEngineが、

- CardMasterRegistry
- test-cards.json
- CardMaster JSON形式

へ直接依存する構造にしないでください。


# 24. Rendererへの影響を最小化

F-3DでRenderer / カード詳細をMaster参照へ整理する予定です。

F-3AではRendererの全面改修を行わないでください。

Card compatibility getterによって、
既存Rendererが可能な限りそのまま動く状態を維持してください。

F-3Aで必要な最小限の互換対応だけ行ってください。


# 25. CardAbilityは実装しない

CardAbilityはF-3Bの対象です。

今回、

- ABILITY_TYPE
- trigger
- conditions
- costs
- effects
- ability execution

などのCardAbility構造・実行基盤を先行実装しないでください。

CardMaster / Cardの分離に集中してください。


# 26. DeckDefinitionは実装しない

DeckDefinitionは将来のデッキ構築・対戦準備で使用する概念です。

今回DeckDefinitionクラスやデッキ構築機能を実装しないでください。


# 27. オンライン機能は実装しない

今回以下は実装しないでください。

- WebSocket
- server authoritative GameState
- 再接続
- DB
- API
- ログイン
- Match / Room管理

ただし今回の、

masterId
CardMasterRegistry
Card.toJSON()
Card.fromJSON()

は将来のオンライン化を妨げない構造にしてください。


# 28. テスト

現在存在するテスト方法・テストコード・DEV UIを確認し、
可能な範囲で自動確認してください。

少なくともF-3A固有として以下を確認してください。


## CardMaster

- 固定情報が正しく保持される
- immutableである
- traits / triggersなどの配列が外部変更で書き換わらない


## CardMasterRegistry

- register → getできる
- hasが正しく動く
- getAllが正しく動く
- duplicate ID登録でError
- unknown masterIdのgetでError


## Card

- instanceIdを保持
- masterIdを保持
- card.idがinstanceIdを返す
- 固定情報getterがCardMaster値を返す
- currentPower初期値 = basePower
- currentSoul初期値 = baseSoul
- runtime値を明示した場合はその値を優先
- currentPower=0 / currentSoul=0も正しく保持
- unknown masterIdでは生成失敗


## Serialization

- toJSONにCardMaster固定情報を埋め込まない
- instanceId / masterId / runtime stateを保持
- fromJSONで同じruntime stateを復元できる
- fromJSON時にunknown masterIdならError


## testCardLoader

- 現在のtest-cards.jsonからCardMasterを生成できる
- Registryへ登録できる
- self/opponent用Card instanceを生成できる
- instanceIdが重複しない


# 29. F-2Cまでの回帰確認

可能な範囲で既存テストを実行してください。

特にMAIN Phaseについて以下を確認してください。

1. Hand Characterを選択できる
2. Level 0 Characterを通常Playできる
3. Level 1以上のLevel条件が機能する
4. Color条件が機能する
5. Cost不足時にPlay不可になる
6. Cost支払いでStock TOPからWaiting Roomへ移動する
7. occupied StageへのPlayで既存CharacterがWaiting Roomへ移動する
8. Stage → empty StageでMoveできる
9. Stage → occupied StageでSwapできる
10. Move / Swapでpositionが維持される
11. Move / Swapでfaceが維持される
12. Action完了後にMAIN WAITING_INPUTへ戻る


また、

- Refresh
- Refresh Penalty
- Level Up
- Rule Check
- Process interrupt / resume

について既存テストが存在する場合は実行してください。


# 30. 現在のテストに対する注意

F-2B以降、test-cards.jsonにはLevel / Cost / Colorの異なる複数カードが含まれています。

「手札の1枚目は必ずLevel 0 / Cost 0」

のような手札位置依存のテストを新たに作らないでください。

必要なカード条件を明示的に検索してテストしてください。


# 31. ドキュメント更新

実装完了後、実際のコードと整合するよう必要な設計書を更新してください。

特に、

- README.md
- docs/設計書一覧.md
- カードデータモデル.md
- エンティティ・オブジェクト一覧.md
- アーキテクチャ.md
- JavaScript仕様.md

など、今回の変更に直接関係する文書を確認してください。


実装完了・テスト成功後のみ、

F-3A
CardMaster導入・Cardとの分離

を完了扱いにしてください。


次の開発予定は、

F-3B
CardAbilityデータ構造

としてください。


# 32. 今回の非対象

以下は実装しないでください。

- CardAbility正式実装
- Ability実行処理
- CONTINUOUS / AUTO / ACT処理
- 正式CardMaster JSON schemaへの移行
- 実カードデータ投入
- Rendererの全面Master参照化
- DeckDefinition実装
- デッキ構築画面
- 対戦準備画面
- オンライン通信
- WebSocket
- DB/API
- 再接続処理
- CPU対戦

これらは後続Phaseです。


# 33. 完了条件

以下をすべて満たした場合のみF-3A完了としてください。

- CardMasterが追加されている
- CardMasterがimmutable
- CardMasterRegistryが追加されている
- duplicate master IDを拒否する
- unknown masterIdをfail-fastする
- CardがinstanceId / masterIdを持つ
- card.id互換getterが機能する
- Card固定情報getterがCardMasterを参照する
- GameEngineの既存Card APIが維持されている
- currentPower/currentSoulの初期化が正しい
- runtime値0も正しく保持できる
- trigger/triggers互換が維持されている
- textの意味を勝手にflavorTextへ変更していない
- Card.toJSON()がCardMasterを埋め込まない
- Card.fromJSON()がRegistryを使って復元する
- test-cards.jsonを大幅変更していない
- testCardLoaderがCardMaster → Registry → Card生成へ対応している
- self/opponentで独立したCard instanceが生成される
- instanceIdが一意
- F-2Cまでの既存挙動が維持されている
- F-3B以降の機能を先行実装していない
- 関連ドキュメントが実装内容と一致している


# 34. 作業完了後の報告

完了後、以下を報告してください。

1. 新規作成したファイル
2. 変更したファイル
3. CardMasterの最終構造
4. CardMasterRegistryの最終API
5. Cardの変更前後の責務
6. instanceId / masterId / card.idの扱い
7. compatibility getter一覧
8. currentPower / currentSoulの初期化方法
9. test-cards.json → CardMaster → Registry → Card の実際の生成フロー
10. toJSON / fromJSONのserialization仕様
11. fail-fastを入れた箇所
12. 実施したテスト
13. F-2Cまでの回帰確認結果
14. ドキュメント更新内容
15. git diff / git statusの概要
16. F-3Aを完了扱いにしたか
17. 次PhaseがF-3Bになっているか


# 35. 実装上の判断について

既存コードとこの依頼文に細かな差異がある場合は、
まず現在のコードと設計書を調査してください。

既存挙動を壊さずに実現できる小さな変更を優先してください。

推測だけで大規模なリファクタリングを行わないでください。

設計上の重大な矛盾が見つかり、
F-3Aの範囲内で安全に判断できない場合は、
無理に実装を進めず、その点を報告してください。