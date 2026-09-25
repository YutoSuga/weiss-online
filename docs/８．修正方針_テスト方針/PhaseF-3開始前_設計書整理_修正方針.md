weiss-online の F-3A 着手前の設計書整理をお願いします。

今回の目的は、
1. docs/１．設計書/ 配下のMarkdownファイル名を日本語化する
2. Markdownリンクを新しいファイル名へ統一する
3. Entity / Objectの関係を整理する
4. F-3A以降のCardMaster設計方針を設計書へ明記する
ことです。

今回はドキュメント整理のみです。
JavaScript / HTML / CSSなどの実装コードは変更しないでください。


# 1. 設計書ファイル名の日本語化

`docs/１．設計書/` 配下について、以下の対応でリネームしてください。

- architecture.md
  → アーキテクチャ.md

- application-flow.md
  → アプリケーションフロー.md

- card-ability.md
  → カードデータモデル.md

- game-engine.md
  → ゲームエンジン.md

- html-spec.md
  → HTML仕様.md

- js-spec.md
  → JavaScript仕様.md

- layout.md
  → レイアウト.md

- main-phase.md
  → メインフェイズ.md

- process.md
  → プロセス.md

- rule-check.md
  → ルールチェック.md

- ui-rules.md
  → UI操作.md


また、`docs/README.md` がまだ存在する場合は、

docs/README.md
→ docs/設計書一覧.md

へ変更してください。


# 2. Markdownリンクの更新

リポジトリ全体を確認し、今回リネームしたMarkdownファイルへのリンク・参照をすべて新しいファイル名へ更新してください。

特に以下を確認してください。

- ルート README.md
- docs/設計書一覧.md
- docs/１．設計書/ 配下の各設計書
- その他Markdownからの相互参照

旧ファイル名へのMarkdownリンクを残さないでください。

リネーム後にリンク切れがないことも確認してください。


# 3. Entity / Object一覧の追加

以下を新規作成してください。

docs/１．設計書/システム共通/エンティティ・オブジェクト一覧.md

既存の設計書と現在の実装を確認したうえで、主要なEntity / Data ObjectとService / Componentを整理してください。


## Entity / Data Object

少なくとも以下を対象としてください。

- CardMaster
- CardAbility
- Card
- DeckDefinition
- Player
- GameState


## Service / Component

少なくとも以下を対象としてください。

- CardMasterRegistry
- GameEngine
- ProcessManager
- Renderer
- Controllers


各項目について、可能な範囲で以下を表形式で整理してください。

- 物理名
- 論理名
- 分類
- 主な役割
- mutable / immutable
- 主な保持先・管理主体
- 現在の実装状況

まだ実装されていないものについては、実装済みと誤解されないように、

- 概念設計
- F-3A予定
- F-3B予定
- 将来予定

などを明記してください。


# 4. データ関係図の整理

既存設計書にデータ関係を示す図・表が存在する場合は、それを尊重してブラッシュアップしてください。

似た関係図を複数の設計書へ無秩序に追加しないでください。

最終的に、少なくとも以下の関係が分かるようにしてください。


Card
  ↓ masterId
CardMasterRegistry
  ↓
CardMaster
  ↓
CardAbility[]（F-3B予定）


DeckDefinition
  ↓ masterId + count
CardMaster


GameState / Player / Deck
  ↓
Card instances


Mermaidを使用しても構いません。

ただし複雑にしすぎず、

「CardMaster / CardAbility / Cardは何が違うのか」

が一目で分かることを優先してください。


# 5. F-3A以降の設計方針

既存設計との整合性を確認し、必要な設計書へ以下の方針を反映してください。


## CardMaster

CardMasterは「そのカードが何であるか」を表す固定情報です。

CardMasterはimmutableとします。

想定する情報は以下です。

- id
- cardNumber
- name
- cardType
- color
- level
- cost
- basePower
- baseSoul
- triggers
- traits
- text
- abilities（F-3B以降）

CardMaster.id は weiss-online 内部で使用するMaster IDです。

cardNumberは実カードのカード番号を表します。

この2つは別概念として扱います。


## CardAbility

CardAbilityは「そのカードに何が書かれているか」を表す能力定義です。

F-3Bで導入予定です。

F-3Aでは実装しません。


## Card

Cardは「その対戦中、その1枚が現在どうなっているか」を表すmutableなカードinstanceです。

Cardは以下のようなruntime情報を持つ想定です。

- instanceId
- masterId
- owner
- zone
- row
- index
- face
- position
- currentPower
- currentSoul
- visibilityOverride

`Card.instanceId`
= 対戦中の物理カード固有ID

`Card.masterId`
= CardMasterを参照するID

既存の `card.id` は当面、instanceIdを返す互換getterとして残す予定です。


# 6. CardとCardMasterの参照方針

Cardの固定情報については、既存GameEngineへの影響を小さくするため、Card側にgetterを残す方針です。

例えば、

card.name
card.cardType
card.level
card.cost
card.color
card.basePower
card.baseSoul

という既存APIは維持し、

内部的にはCardMasterの値を参照する構造とします。

GameEngineがCardMasterの保存形式やJSON構造へ直接依存しないようにしてください。


# 7. CardMasterRegistry

F-3AではCardMasterRegistryを導入する予定です。

役割は、読み込み済みCardMasterをmasterIdから取得するためのメモリ上のRegistryです。

想定API：

- register(master)
- get(masterId)
- has(masterId)
- getAll()

重要：

CardMasterRegistryは永続ストレージではありません。

ブラウザを再読み込みするとメモリ上のRegistryは失われ、必要なCardMasterを再読み込みしてRegistryを再構築する想定です。

将来的にCardMasterの取得元が、

JSON
→ API
→ DB

などへ変わっても、

Card
GameEngine

などが取得元へ直接依存しない構造を目指します。


# 8. 将来のオンライン対戦・再接続

今回実装する内容ではありませんが、将来の設計方針として必要であればアーキテクチャ設計書へ簡潔に記載してください。

将来オンライン対戦でブラウザ更新・クラッシュ等が発生した場合、

サーバー上の確定済みGameStateを正として再接続し、

- GameState
- Card runtime state
- turn / phase
- 必要なProcess状態

などを復元できる構造を想定します。

CardMasterRegistryは再構築します。

一方、

- 選択中カード
- hover状態
- 未確定のUI選択

などControllerが保持するUI-local stateは、原則として復元対象にしません。

今回、オンライン通信や再接続機能そのものは実装しないでください。


# 9. 今回の非対象

以下は今回実施しないでください。

- JavaScriptの変更
- HTMLの変更
- CSSの変更
- CardMasterクラスの実装
- CardMasterRegistryの実装
- Cardクラスの変更
- CardAbilityの実装
- test-cards.jsonの正式なCardMaster JSON化
- 実カードデータの追加
- RendererのCardMaster対応
- オンライン通信の実装
- 再接続機能の実装

また、今回の作業だけでF-3Aを完了扱いにはしないでください。


# 10. 完了条件

以下をすべて確認してください。

- 指定した設計書ファイル名が日本語化されている
- docs/README.mdが存在する場合はdocs/設計書一覧.mdへ変更されている
- Markdownリンクが新しいファイル名へ更新されている
- 旧ファイル名へのリンクが残っていない
- Markdownリンク切れがない
- エンティティ・オブジェクト一覧.mdが追加されている
- CardMaster / CardAbility / Cardの責務が明確になっている
- CardMasterRegistryの役割が明確になっている
- 現在実装済みの内容と将来予定が明確に区別されている
- JavaScript / HTML / CSSなど実装コードに変更がない
- F-3Aを完了扱いにしていない


# 11. 作業完了後の報告

作業完了後、以下を報告してください。

1. リネームしたファイル一覧
2. 新規作成したファイル一覧
3. 内容を更新した設計書一覧
4. Entity / Object整理で明確にしたポイント
5. CardMaster / Card / CardAbilityの関係
6. Markdownリンクチェック結果
7. 旧ファイル名への参照が残っていないこと
8. 実装コードを変更していないこと
9. git diff / git statusの概要

不明点がある場合は推測で大きく設計変更せず、既存実装・既存設計を優先してください。
