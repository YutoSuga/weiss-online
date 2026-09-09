# weiss-online

## 概要

**weiss-online** は、ブラウザ上で友人同士が対戦できる、ヴァイスシュヴァルツ風カードゲームとして開発している個人利用・学習目的のプロジェクトです。

現在はPC版の対戦盤面とゲーム進行基盤を中心に開発しています。カード操作はドラッグ＆ドロップではなく、**クリック / タップでカードを選択し、ActionまたはDestinationを選択する**方針です。

## 開発目標

- ブラウザでプレイできること
- PC版を中心に、将来的にスマホでも確認しやすいUIにすること
- 友人同士のオンライン対戦へ拡張できること
- 実際のカードゲームに近いルール進行を段階的に実装すること
- カード効果を追加しやすい構造にすること
- UIとゲームルールを分離し、保守しやすくすること

オンライン通信、デッキ管理、実カード能力の解決は、現時点では未実装です。

## 現在のアーキテクチャ

```text
Controller（ユーザー入力）
  ↓
GameEngine（ゲームルール・フェイズ進行・Process実行）
  ↓
GameState / Player / Card（対戦状態）
  ↓
ProcessManager（processStackの管理）
  ↓
Renderer（表示のみ）
  ↓
HTML / CSS
```

- `GameState` はプレイヤー、ターン、フェイズ、ログ、ルール処理状態を保持します。
- `GameEngine` はゲームルール、フェイズ進行、Rule Check、Process開始・再開を担当します。
- `ProcessManager` は `gameState.ruleState.processStack` のpush/popとstep/status更新を担当します。
- `Renderer` はGameStateを既存の盤面DOMへ反映し、ルール判断や入力処理は行いません。
- `Controllers` はMulligan、CLOCK、LEVEL_UP、MAIN終了などのユーザー入力をGameEngineへ渡します。
- `Card`、`Deck`、`Player` はカード1枚、山札、各プレイヤーのゾーン状態を表します。

## 現在の実装状況

- 対戦盤面UIと各Zoneの表示
- `Card` / `Deck` / `Player` / `GameState` の基本モデル
- 山札・手札・舞台・クロック・レベル・ストック・控え室・思い出・クライマックスの描画
- 手札の動的表示、横スクロール、スクロール方向インジケーター
- Cardのvisibilityとfaceを分離した表裏表示
- ゲーム開始、初期手札、Mulligan
- STAND、DRAW、CLOCKを含むフェイズ進行
- `DRAW_PHASE`、`CLOCK_PHASE`、`MAIN_PHASE` Process
- Rule Check、Processの中断・再開、GAME OVER
- `REFRESH`、`REFRESH_PENALTY`、`LEVEL_UP` Process
- 開発用のProcess Stack確認UI

カードの通常プレイ、舞台移動、カード能力、オンライン対戦は未実装です。

## Process / Rule Interrupt

ゲーム進行は、必要に応じてProcessを中断してルール処理を割り込ませ、保存済みstepから元のProcessへ戻る構造です。

```text
通常Process
  ↓ Check Point
Rule Check
  ↓ 必要なら
Interrupt Process
  ↓ 完了
元Processを保存済みstepから再開
```

現在の `PROCESS_TYPE` には、`DRAW_PHASE`、`CLOCK_PHASE`、`MAIN_PHASE`、`REFRESH`、`REFRESH_PENALTY`、`LEVEL_UP` があります。`CLOCK_ACTION` は定数として存在しますが、独立したProcessとしては未実装です。

## 現在地点

**Phase F-1：MAIN_PHASE基盤 完了**

現在、CLOCKフェイズの完了後には以下の流れが成立します。

```text
CLOCK
  ↓
MAIN_PHASE
  ↓
WAITING_INPUT
  ↓ 「メインフェイズ終了」
MAIN_PHASE COMPLETE
  ↓
CLIMAX
```

`MAIN_PHASE` は `WAITING_INPUT` 中も `processStack` 上に保持されます。MAIN Phase内でのカード選択、配置、移動などの実際のActionは、まだ実装していません。

## 開発ロードマップ

- [x] 基本Game Model / Architecture
- [x] 対戦盤面UI基盤
- [x] Mulligan
- [x] Process / Rule Interrupt基盤
- [x] Refresh / Refresh Penalty
- [x] Level Up
- [x] Draw Phase Process
- [x] Clock Phase Process
- [x] Phase F-1 MAIN Phase基盤
- [ ] **Phase F-2A MAINカード選択 / Destination UI（NEXT）**
- [ ] Phase F-2B Character Hand → Stage
- [ ] Phase F-2C Stage → Stage
- [ ] Phase F-3 CardMaster / CardAbility v1
- [ ] Phase F-4 ACT Ability v1
- [ ] Phase F-5 AUTO Ability基盤
- [ ] Phase F-6 CONTINUOUS Ability基盤

### NEXT：Phase F-2A MAINカード選択 / Destination UI

予定している内容です。

- 自分のHANDのCHARACTERをクリック / タップして選択する
- 選択状態をController / UIローカルで保持する
- 選択カードの情報を右側のカード説明パネルへ表示する
- 配置可能なDestinationを青枠などで示す
- 別カードのクリックによる選択切替、空白クリックと「選択を解除」による解除
- この段階では実際のカード移動を行わない

確定前の選択状態はGameStateに保存せず、Controller / UIローカルで扱います。

### Phase F-2B：Character Hand → Stage

予定している内容です。

- CHARACTER判定、Level条件、Color条件の確認
- Stockと基本Play Costの支払い可能判定
- 空きStage slotへの配置
- 使用中Stage slotへのReplacement
- すべての検証後に行うPlay Cost支払い

基本Play Costは、将来の `CardMaster.cost` に相当するカード固有のコストです。Ability Costとは別概念です。

### Phase F-2C：Stage → Stage

予定している内容です。

- Stageカードの選択
- 空きslotへのMove
- 使用中slotとのSwap
- 確認UI

HANDから使用中Stageへ置く場合は**Replacement**、Stageから使用中Stageへ移す場合は**Swap**です。

### Phase F-3：CardMaster / CardAbility v1

カード種類の固定情報を `CardMaster`、対戦中の物理的な1枚をCard instanceとして分離する予定です。Card instanceは将来 `masterId` からCardMasterを参照します。

`CardAbility` は `type`、`keywords`、`text`、`trigger`、`conditions`、`costs`、`effects` を持つ構造を予定しています。Trigger、Condition、CardFilter、Cost、Effect、Valueの詳細は設計書を参照してください。

### Phase F-4：ACT Ability v1

最初の検証候補は、`Kch/W78-001`「人気アイドル 西森 柚咲」の【起】集中です。

- Ability Cost v1：`PAY_STOCK`、`REST_SELF`
- 使用可能なACTは有効ボタン、使用不可ならdisabled / gray表示を想定
- 集中Effect自体の詳細な解決仕様は、この段階では未確定

### Phase F-5 / F-6

- **F-5 AUTO Ability基盤**：Game EventからTriggerを検出し、AUTO Abilityを解決する基盤
- **F-6 CONTINUOUS Ability基盤**：GameStateや盤面状態に応じて継続的に状態を評価する基盤

## プレイ画面 / Zone

各プレイヤーは、次のZoneを持ちます。

- 手札
- クロック
- レベル
- クライマックス
- 舞台（前列3 / 後列2）
- ストック
- 山札
- 控え室
- 思い出

盤面は相手側と自分側を向かい合わせて表示します。表裏表示はZone由来のvisibilityとCardのfaceを使って決定し、自分視点では相手の手札を裏向きに表示します。

## 詳細設計

READMEは現在地点と概要を扱い、詳細な仕様は `docs/` を参照してください。

- [MAIN Phase設計（F-2以降を含む詳細案）](docs/main-phase.md)
- [CardMaster / CardAbility設計](docs/card-ability.md)
- [UI操作仕様](docs/１．設計/ui-rules.md)
- [Process基盤設計](docs/１．設計/Process.md)
- [Rule Check設計](docs/１．設計/RuleCheck.md)
- [JavaScript仕様](docs/１．設計/js-spec.md)
- [HTML仕様](docs/１．設計/html-spec.md)
- [レイアウト仕様](docs/１．設計/layout.md)

## 将来候補

実装順は未確定です。

- EVENTカード、CLIMAXカード
- ATTACK Phase、Damage、Trigger、Encore
- Global Card Inspection
- より多くの実カードAbility
- オンライン対戦、ルーム招待、チャット
- デッキ管理、デッキインポート
- 対戦ログ、リプレイ、観戦
- カード検索

## 開発方針

- 小さな単位で機能を追加し、その都度動作確認する
- Game RuleとUIの責務を分離する
- Process単位で中断・再開できる構造を維持する
- Rendererへゲームルールや入力処理を持ち込まない
- 最初から全カード能力を過度に汎用化せず、実カードの追加に合わせて拡張する
- 保守しやすいコードとUI / UXを重視する

### READMEの運用

開発を再開するときは、まずこのREADMEの「現在地点」と「NEXT」を確認します。大きなPhaseを完了したら、現在地点・ロードマップ・NEXTを更新し、詳細仕様はREADMEへ増やしすぎず `docs/` に記載します。

## ライセンス

本リポジトリは学習・個人開発を目的としています。

カード画像・カード名・テキストなど、第三者の知的財産権が関係するコンテンツについては、公開・配布時には権利関係を十分に確認してください。
