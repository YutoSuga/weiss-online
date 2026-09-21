YutoSuga/weiss-online に Phase F-4A「ACT Ability v1 基盤」を実装してください。

# 0. 今回の位置付け

現在：

F-3A CardMaster / Card分離                  COMPLETE
F-3B CardAbilityデータ構造                  COMPLETE
F-3C CardMaster正式JSON / DeckDefinition   COMPLETE
F-3D Card表示・詳細表示                     COMPLETE
DEV 山札→手札                              COMPLETE
F-3D follow-up UI修正                      COMPLETE

次：

F-4A ACT Ability v1 基盤                    今回
F-4B 「人気アイドル 西森 柚咲」【起】集中   次回

今回F-4Aでは、
実カード「人気アイドル 西森 柚咲」の集中そのものはまだ実装しません。

F-4Bで実カードの【起】集中を自然に載せられるよう、

- ACT Ability検出
- ACT使用可能判定
- ACT UI
- ACT_ABILITY Process
- Cost Resolver / Handler
- Effect Resolver / Handler
- PAY_STOCK
- REST_SELF
- 複数Cost
- テスト用最小Effect

までを実装してください。

AUTO / CONTINUOUS Abilityの実行は今回対象外です。


# 1. 最初に既存実装と最新公式ルールを確認する

実装前に少なくとも以下を確認してください。

Repository：
YutoSuga/weiss-online

Docs：
- README.md
- docs/設計書一覧.md
- docs/１．設計書/アーキテクチャ.md
- docs/１．設計書/アプリケーションフロー.md
- docs/１．設計書/カードデータモデル.md
- docs/１．設計書/エンティティ・オブジェクト一覧.md
- docs/１．設計書/ゲームエンジン.md
- docs/１．設計書/JavaScript仕様.md
- docs/１．設計書/メインフェイズ.md
- docs/１．設計書/プロセス.md
- docs/１．設計書/ルールチェック.md
- docs/１．設計書/UI操作.md

Code：
- Card
- CardMaster
- CardAbility
- GameState
- GameEngine
- ProcessManager
- Renderer
- MainPhaseController
- MAIN_PHASE Process
- PLAY_CHARACTER Process
- MOVE_STAGE
- SWAP_STAGE
- REFRESH
- REFRESH_PENALTY
- LEVEL_UP
- DRAW
- CLOCK
- resolveRuleCheck()
- ruleState
- effectQueue
- CardMasterLoader
- CardMasterRegistry
- card-masters.json
- test-decks.json
- 全関連テスト

特に、

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

というF-3Bの構造を確認してください。

また、実装前に必ず現在のヴァイスシュヴァルツ公式総合ルール最新版を確認してください。

2026-09-21時点では、
公式サイト上の総合ルールは Ver.1.112（2026/8/24更新）です。

特に以下を確認してください。

- 起動能力
- 能力のプレイと解決
- コストと支払い
- 複数Cost
- Costを支払えない場合
- チェックタイミング
- プレイタイミング
- Refresh
- Level Up
- 自動能力の待機状態
- 能力解決中のRule Check

今回の実装は、
既存実装だけを根拠にRule Check位置を推測しないでください。

最新公式総合ルールと既存Process設計を照合してください。


# 2. F-4Aのゴール

F-4Aのゴールは、

「Stage上のCardが持つ【起】Abilityを発見し、
現在使用可能か判定し、
右上Card詳細からユーザーが選択して、
ACT_ABILITY Processとしてプレイ・解決し、
MAIN WAITING_INPUTへ戻れる」

ところまでです。

概念：

MAIN WAITING_INPUT
        ↓
自分のStage Cardを選択
        ↓
ACT Ability一覧取得
        ↓
使用可能判定
        ↓
右上詳細に表示
        ↓
「使用する」
        ↓
ACT_ABILITY Process
        ↓
VALIDATE
        ↓
PREPARE
        ↓
PAY_COST
        ↓
RESOLVE_EFFECT
        ↓
Rule Check / Check Timing
        ↓
COMPLETE
        ↓
MAIN WAITING_INPUT


# 3. 責務

既存設計を維持してください。

GameEngine
→ Ability使用可能判定
→ ACT_ABILITY開始
→ Cost / Effect解決のゲームルール管理

ProcessManager
→ processStack
→ step
→ status
→ context
→ interrupt / resume

Renderer
→ ACT Ability一覧・状態の表示

MainPhaseController
→ ユーザー操作をGameEngineへ渡す

CardAbility
→ Ability定義データ

Cost / Effect Handler
→ 個々のCost / Effect typeの処理

Renderer / Controllerで、
CostやEffectのゲームルールを直接実行しないでください。


# 4. 「ACTを持つ」と「今使える」を分離する

以下を別概念として扱ってください。

A.
CardがACT Abilityを持っている

B.
そのACT Abilityを現在使用できる

概念的にはGameEngineに、

getActAbilities(card, playerId)

canUseActAbility(card, ability, playerId)

getActAbilityDisabledReason(card, ability, playerId)

のようなQuery APIを用意してください。

実際の命名は既存コードに合わせて調整して構いません。

重要なのは、

ability.type === ACT

だけでは「現在使用可能」としないことです。


# 5. F-4AでサポートするACT使用タイミング

現在サポートするACTの使用タイミングは、

- 自分のターン
- phase === MAIN
- MAIN_PHASE / WAITING_INPUT
- source Cardが自分のStageに存在する
- source CardがACT Abilityを持つ
- Card固有conditionsを満たす
- Costをすべて支払える

としてください。

ただし、

「ACTは永遠にMAIN専用」

という設計にはしないでください。

F-4A時点でサポートするプレイタイミングが
MAIN WAITING_INPUTである、という扱いです。


# 6. ACT Abilityの識別

CardAbility.idはCardMaster内でuniqueという既存設計を維持してください。

対戦中のAbilityは概念的に、

source Card.instanceId
+
CardAbility.id

で識別してください。

新しいglobal Ability ID体系は追加しないでください。


# 7. ACT_ABILITY Process

ACT Abilityを実行するためのAction Processを追加してください。

基本Stepは以下を想定します。

ACT_ABILITY

VALIDATE
↓
PREPARE
↓
PAY_COST
↓
RESOLVE_EFFECT
↓
CHECK_POINT
↓
COMPLETE

ただし、
CHECK_POINTの正確な位置については後述のRule Check要件に従ってください。

必要なら公式ルールに合わせてStep構成を微調整して構いません。

その場合は理由を設計書と完了報告に記載してください。


# 8. VALIDATE

ACT開始直前に使用可能性を再検証してください。

UI上で使用可能だったという結果を信用して、
直接mutationしないでください。

最低限、

- player
- turn
- phase
- MAIN Process status
- source Card
- source zone
- Ability
- Ability type
- conditions
- 全Cost支払可能性

を確認してください。

VALIDATE失敗時は、
GameStateを部分的に変更しないでください。


# 9. PREPARE

PREPAREでは、
Ability解決に必要なProcess固有状態を初期化してください。

例えば、

context: {
  playerId,
  sourceCardInstanceId,
  abilityId,
  costIndex,
  effectIndex
}

のような情報です。

実際のcontext構造は既存Process設計に合わせてください。


# 10. Process contextの責務

contextは、

「そのProcessが途中で中断・再開された場合にも必要になる、
Process固有の作業メモリ」

として扱ってください。

例えば将来、

ACT_ABILITY
→ Effect解決途中
→ REFRESH
→ REFRESH_PENALTY
→ ACT_ABILITYへresume

となった場合に、

- 誰のAbilityか
- source Cardはどれか
- Abilityはどれか
- Costはどこまで終わったか
- Effectはどこまで終わったか

を復元できる構造にしてください。

ただしF-4Aで、
F-4Bの集中用contextを先回りして大量に追加しないでください。


# 11. Costは配列として扱う

CardAbility.costs[]を記載順に処理してください。

例：

costs: [
  {
    type: "PAY_STOCK",
    amount: 1
  },
  {
    type: "REST_SELF"
  }
]

Costの順序は意味を持つものとして扱ってください。


# 12. Cost Type

F-4Aでは正式に以下の2種類をサポートしてください。

COST_TYPE.PAY_STOCK
COST_TYPE.REST_SELF

文字列を各所へ直接散在させず、
定数として管理してください。


# 13. PAY_STOCK

Schema：

{
  type: "PAY_STOCK",
  amount: number
}

意味：

自分のStock TOPからamount枚を支払い、
Waiting Room TOPへ順番に移動する。

既存のZone orderingを維持してください。

既存仕様：

Stock TOP
→ array end

Waiting Room TOP
→ array end

amountは正の整数としてvalidationしてください。

例えば、

{ type: "PAY_STOCK", amount: 1 }

{ type: "PAY_STOCK", amount: 2 }

を同じHandlerで扱えるようにしてください。


# 14. REST_SELF

Schema：

{
  type: "REST_SELF"
}

意味：

このACT Abilityのsource Card自身を
STANDからRESTへ変更する。

REST済み等、
CostとしてRESTできない状態では支払不可としてください。

F-4Aではsource Card以外をRESTするCostは実装しません。


# 15. 「Costを支払えるか」と「Costを支払う」を分離する

Cost Handlerは概念的に、

canPay(cost, context)
pay(cost, context)

を分離してください。

命名は既存コードに合わせて調整して構いません。

重要なのは、

使用可能判定
≠
mutation

とすることです。


# 16. 全Costを先に検証する

複数Costの場合、

Cost 1を支払う
↓
Cost 2が払えない
↓
Cost 1だけ支払い済み

という状態を作らないでください。

実際のmutation前に、
全Costを支払えることを検証してください。

一つでも支払えない場合、
ACT Ability自体を使用不可としてください。


# 17. Cost支払い順

全Costが支払えることを確認した後、

costs[]の先頭から順番に支払ってください。

例：

[
  PAY_STOCK 1,
  REST_SELF
]

なら、

Stock支払い
↓
REST_SELF

の順です。


# 18. Cost Handler方式

GameEngineにCost typeごとの巨大なif/switchを増やさないでください。

概念：

ACT_ABILITY
      ↓
Cost Resolver / Dispatcher
      ↓
Cost Handler

例えば、

PAY_STOCK
→ payStockCostHandler

REST_SELF
→ restSelfCostHandler

という構造です。

Handlerは大きなClassである必要はありません。

小さなmodule / object / function群で構いません。

例えば概念的には、

PayStockCostHandler {
  canPay(cost, context)
  pay(cost, context)
}

RestSelfCostHandler {
  canPay(cost, context)
  pay(cost, context)
}

です。

既存プロジェクトの構造に合う、
過剰でない実装を選択してください。


# 19. 未対応Cost Type

未対応のCost typeを、
黙って無視しないでください。

未知のCost typeを持つAbilityは、

- 使用可能と判定しない
- 実行しない
- fail-fastまたは明確なunsupported error

となるようにしてください。

CardMaster登録/読み込み時にも、
可能な範囲で未知Cost typeを早期検出してください。

ただしLoaderとruntime validationの責務は、
既存設計を確認して適切に分けてください。


# 20. Condition

CardAbility.conditions[]は、

「そのAbility固有の使用・適用条件」

として扱います。

例えば将来、

- 自分のLevelが2以上
- 手札が5枚以下
- 他の特定Trait Characterが存在する

等を構造化する領域です。

一方、

- 自分のターン
- MAIN
- WAITING_INPUT
- source Cardが自分のStage

はACT共通のプレイタイミングであり、
ability.conditions[]へ入れないでください。


# 21. F-4AのCondition

F-4AのテストACTは、

conditions: []

で構いません。

ただし将来Condition Handlerを追加できる
小さな拡張ポイントは確保してください。

F-4Aで大量のCondition typeを実装しないでください。


# 22. Effect Resolver / Handler

EffectもCostと同様、

effects[]を直接GameEngineの巨大if/switchで解釈し続ける設計を避けてください。

概念：

ACT_ABILITY
      ↓
Effect Resolver / Dispatcher
      ↓
Effect Handler

としてください。


# 23. F-4AのEffect Type

F-4Aでは実カード効果をまだ実装しません。

開発・テスト専用として、

TEST_LOG

のような最小Effectを1つ用意してください。

例：

{
  type: "TEST_LOG",
  message: "ACTテスト効果を解決"
}

このEffectは、

- GameState.logまたは既存ログ機構へ記録する
- ゲーム上のCard移動等は行わない

程度で構いません。

名称は既存設計に合わせて変更して構いませんが、
「開発/テスト専用Effect」であることを明確にしてください。


# 24. Effect Typeも定数管理する

例：

EFFECT_TYPE.TEST_LOG

のように定数として管理してください。

未知Effect typeを黙って無視しないでください。


# 25. テスト用ACT Ability

F-4Aでは仮想テストCardMasterを使用して、
実際にACTを最後まで実行できるようにしてください。

最低限、

A.
【起】[①] テスト効果

B.
【起】[このカードをレストする] テスト効果

をテスト可能にしてください。

構造例：

{
  id: "ACT_TEST_STOCK",
  type: "ACT",
  text: "【起】[①] テスト効果",
  conditions: [],
  costs: [
    {
      type: "PAY_STOCK",
      amount: 1
    }
  ],
  effects: [
    {
      type: "TEST_LOG",
      message: "ACTテスト効果Aを解決"
    }
  ]
}

{
  id: "ACT_TEST_REST",
  type: "ACT",
  text: "【起】[このカードをレストする] テスト効果",
  conditions: [],
  costs: [
    {
      type: "REST_SELF"
    }
  ],
  effects: [
    {
      type: "TEST_LOG",
      message: "ACTテスト効果Bを解決"
    }
  ]
}


# 26. 複数Costテスト

F-4Aでは、

PAY_STOCK
+
REST_SELF

を同時に要求するテストACTも用意してください。

例：

costs: [
  {
    type: "PAY_STOCK",
    amount: 1
  },
  {
    type: "REST_SELF"
  }
]

これにより、

- 全Cost事前検証
- Cost記載順
- PAY_STOCK
- REST_SELF
- 部分支払い防止

を検証してください。

この能力も仮想テスト用で構いません。


# 27. Rule Check / Check Timing

ここは今回の重要事項です。

既存のresolveRuleCheck()を、
機械的に以下のように呼ばないでください。

PAY_COST 1
→ resolveRuleCheck()
→ PAY_COST 2

最新公式総合ルールでは、
複数Costは記載順に実行しますが、
Cost支払い開始から完了までの間は、
RefreshやLevel Up等の所定のルール処理を行わない規定があります。

また、
Costを一部でも支払えない場合は、
そのAbilityのCost全体を支払えません。

そのためF-4Aでは、

「PAY_COST終了直後」
「Effect解決中」
「Ability解決完了時」

のどこに既存resolveRuleCheck()を呼ぶべきかについて、

1. 最新公式総合ルール
2. 既存resolveRuleCheck()
3. REFRESH / REFRESH_PENALTY
4. LEVEL_UP
5. defeat判定
6. Process interrupt/resume設計

を照合して決定してください。

特に以下を確認してください。

- Cost 1つごとのRule Checkは行わない
- 全Cost支払い中のRefresh/Level Upをどう抑止するか
- 全Cost支払い完了後の正しいCheck Timing
- Effect解決中にDeckが0になった場合の扱い
- Ability解決完了後のCheck Timing
- 既存Processへどう接続するか

この調査結果と採用したRule Check境界を、
設計書へ根拠付きで記載してください。

F-4Bで集中を実装したときに、

ACT Effect
→ Deck操作
→ Refresh
→ Refresh Penalty
→ ACTへresume

を正しく扱えることを見据えた設計にしてください。

ただしF-4Aでは集中Effect自体は実装しません。


# 28. effectQueue

F-4AではeffectQueueをACT Abilityの実行キューとして使用しないでください。

ACTは、

ユーザーが能動的にプレイ
↓
ACT_ABILITY Processをpush

という構造とします。

将来的に、

ACT Cost / Effect
↓
何らかのAUTOが誘発
↓
AUTOが待機状態になる
↓
適切なCheck TimingでAUTOを解決

という処理が必要になります。

その際にeffectQueue等を利用する可能性があります。

ただし、
AUTO待機・AUTO解決はF-5以降で正式設計します。

F-4AではeffectQueueの仕様を先回りして変更しないでください。


# 29. 右上Card詳細UI

現在の右上Card詳細に表示しているAbility一覧を利用してください。

Stage Cardを選択した場合、

ACT Abilityについて、

- Ability text
- 使用可能/使用不可
- 「使用する」操作
- 使用不可の場合の理由

を表示できるようにしてください。

イメージ：

能力

【永】...
【自】...

【起】[①] テスト効果
[使用する]

【起】[このカードをレストする] テスト効果
[使用する]


# 30. 複数ACT対応

1枚のCardが複数のACT Abilityを持つ場合に、
Abilityごとに個別に使用可否判定・使用操作ができるようにしてください。

Card全体に対して一つだけ
「起動能力を使用」
という設計にはしないでください。


# 31. 使用不可UI

例えば、

Stock不足

の場合、

【起】[①] テスト効果
[使用不可]
理由：ストックが足りません

のように、
なぜ使用できないか分かるようにしてください。

REST_SELFについて、
source CardがすでにRESTの場合も同様です。

文言は既存UIに合わせて調整して構いません。


# 32. ACT実行後のUI

ACT Ability完了後は、
MAIN_PHASE / WAITING_INPUTへ戻してください。

GameStateを再renderし、

- Stock減少
- Waiting Room増加
- source Card REST

等が通常UIへ反映されるようにしてください。

F-4Aではアニメーションは不要です。

将来的に、

- Stock支払いAnimation
- REST Animation

等を追加する可能性がありますが、
今回は実装しないでください。


# 33. 既存Stage操作との共存

現在Stage Card選択は、

- Move
- Swap
- Replacement関連
- Card detail

等でも使用されています。

ACT UI追加によって、

- Stage Move
- Stage Swap
- Hand → Stage Replacement
- Card selection切替

を壊さないでください。

Stage Cardを選択した際、

「移動先選択」
と
「ACT Ability使用」

が同じCard detailから共存できる構造にしてください。


# 34. 新しい設計書「カード能力.md」

以下を新設してください。

docs/１．設計書/カード能力.md

また、

docs/設計書一覧.md

から参照できるようにしてください。


# 35. カード能力.md の内容

最低限以下を記載してください。

1. CardAbilityの責務

2. CardAbility Schema

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

3. Ability Type一覧

CONTINUOUS
AUTO
ACT

4. activationTriggerの役割

5. conditionsの役割

6. costsの役割

7. effectsの役割

8. ACT Abilityの現在の実行フロー

9. ACT_ABILITY Process

10. Process contextの役割

11. Condition / Cost / Effect Handler方式

12. 対応Condition Type一覧

13. 対応Cost Type一覧

14. 対応Effect Type一覧

15. 新しいTypeを追加するときの手順

16. CardMaster登録時の確認事項

17. 未対応Typeの扱い

18. 将来のAUTO / CONTINUOUSとの関係

19. effectQueueとの現在の責務分離

20. Rule Check / Check Timingとの関係


# 36. 対応Cost Type一覧

カード能力.mdに、
最低限以下の表を作成してください。

Cost Type:
PAY_STOCK

意味:
自分のStockから指定枚数をWaiting Roomへ移動する

Parameters:
amount: positive integer

Handler:
実装したHandler名

Status:
Supported


Cost Type:
REST_SELF

意味:
source Card自身をSTANDからRESTにする

Parameters:
なし

Handler:
実装したHandler名

Status:
Supported


# 37. 対応Effect Type一覧

F-4Aでは最低限、

TEST_LOG

を記載してください。

ただし、

Development / Test only

であることを明示してください。

実カード登録用の正式Effect Typeではないことを明記してください。


# 38. Condition Type一覧

F-4A時点では、
カード固有Condition Typeが未実装であれば、

「現在正式対応なし」

と明記してください。

空欄にしないでください。

将来追加予定であることも記載してください。


# 39. CardMaster登録時の重要ルール

カード能力.mdに以下の方針を明記してください。

CardMasterへ新しいAbilityを登録するときは、

conditions[]
costs[]
effects[]

に含まれる全Typeが、
現在の「対応Type一覧」に存在するか確認する。

未対応Typeが必要な場合、

データだけを追加してはいけない。

先に、

- Type定義
- Handler
- validation
- tests
- 設計書の対応Type一覧

を追加する。

その後にCardMasterへ登録する。

これにより、

「新しいCardを登録したがEngineがその能力を解釈できない」

状態を防止してください。


# 40. コード上の対応Type一覧

設計書だけでなくコード上でも、
対応Typeを定数として管理してください。

最低限：

COST_TYPE.PAY_STOCK
COST_TYPE.REST_SELF

EFFECT_TYPE.TEST_LOG

を用意してください。

Conditionについても、
将来追加しやすい配置を検討してください。

ただし空の定数objectを作るだけの過剰実装は不要です。


# 41. 未知Typeはfail-fast

CardMaster / CardAbilityの読み込みまたは実行時に、

UNKNOWN_COST
UNKNOWN_EFFECT

等が存在した場合、
黙って無視しないでください。

可能な限り早い段階で明確なerrorにしてください。

どの層でvalidationするかは、
既存CardMasterLoader / CardAbility設計を確認して決定してください。

設計書にも責務を記載してください。


# 42. テスト

最低限以下をテストしてください。


## ACT detection

- ACT Abilityを取得できる
- AUTOをACTとして取得しない
- CONTINUOUSをACTとして取得しない
- 複数ACTを取得できる


## ACT timing

- 自分のMAIN WAITING_INPUTで使用可能
- 相手ターンでは使用不可
- MAIN以外では使用不可
- MAINがWAITING_INPUTでなければ使用不可
- source Cardが自分のStageになければ使用不可


## PAY_STOCK

- amount=1を支払える
- amount=2等、amount parameterを扱える
- Stock不足なら支払不可
- Stock TOPから支払う
- Waiting Room TOPへ入る
- 他Stock Cardの順序を壊さない


## REST_SELF

- STANDなら支払える
- RESTなら支払えない
- 支払い後RESTになる
- 他Cardのpositionを変更しない


## Multiple Costs

PAY_STOCK + REST_SELFについて、

- 両方支払える場合のみACT使用可能
- Stock不足ならどちらもmutationしない
- REST_SELF不可ならStockもmutationしない
- costs[]の順番で支払う
- 部分支払いが発生しない


## Effect

- TEST_LOGが実行される
- messageがログへ反映される
- 未知Effectを無視しない


## Process

- ACT_ABILITYがpushされる
- VALIDATE
- PREPARE
- PAY_COST
- RESOLVE_EFFECT
- 適切なCheck Timing
- COMPLETE

まで進行する

- 完了後MAIN WAITING_INPUTへ戻る
- contextがsource Card / Abilityを特定できる


## UI

可能な範囲で、

- Stage Card詳細にACTを表示
- 使用可能ACTに「使用する」
- 使用不可ACTはdisabled
- 使用不可理由を表示
- 複数ACTを個別操作できる


## Regression

- PLAY_CHARACTER
- Stage Move
- Stage Swap
- Replacement
- DRAW
- CLOCK
- REFRESH
- REFRESH_PENALTY
- LEVEL_UP
- defeat
- visibility
- Card detail
- DEV操作

を壊していないこと。


# 43. Rule Check専用テスト

今回決定したRule Check境界について、
可能な範囲で専用テストを追加してください。

特に、

- Cost間で不適切なRule Checkが発生しない
- Cost支払い開始～完了の間にRefresh / Level Upを割り込ませない
- Ability完了時のRule Checkが公式ルールと一致する

ことを確認してください。

F-4AのTEST_LOGではDeck操作がないため、
F-4Bで追加テストが必要になる部分は、
TODOではなく設計書の「F-4Bで検証する項目」として明記してください。


# 44. Non-goals

今回実装しないもの：

- 「人気アイドル 西森 柚咲」の正式CardMaster
- 集中
- 山札上4枚→控え室
- CX count
- Deck search
- Card selection from Deck
- Add to Hand
- Shuffle
- 集中Effect中のRefresh実動作

- AUTO Ability実行
- CONTINUOUS Ability実行
- AUTO待機
- AUTO解決
- effectQueueの本格実装/再設計

- 全Condition Type
- 全Cost Type
- 全Effect Type
- デッキ内全ACT
- AbilityEngineという巨大な抽象レイヤー

- Stock支払いAnimation
- REST Animation
- その他Ability Animation


# 45. 過剰抽象化を避ける

F-4Aでは、

GameEngine
↓
ACT_ABILITY Process
↓
Condition / Cost / Effect Resolver
↓
小さなHandler

程度の構造を基本としてください。

F-5でAUTOを実装した際に、
ACT/AUTO間の共通部分が明確になってから、
必要であればAbilityEngine等への抽象化を検討します。

今回、
将来必要になるかもしれない全能力を想定した
巨大なframeworkを作らないでください。


# 46. README

READMEの進捗を、

F-4A ACT Ability v1 基盤 COMPLETE
F-4B 「人気アイドル 西森 柚咲」【起】集中 NEXT

へ更新してください。

ただし実装がAcceptance Criteriaを満たした場合のみです。


# 47. Acceptance Criteria

以下をすべて満たしたらF-4A COMPLETEとしてください。

1. Stage CardのACT Abilityを取得できる
2. ACTをAUTO/CONTINUOUSと区別できる
3. ACT使用可能判定がGameEngine側にある
4. ACT所持とACT使用可能が別概念になっている
5. 自分のMAIN WAITING_INPUTのみ現在サポートする
6. source Cardが自分のStageに必要
7. 複数ACTを扱える
8. Card.instanceId + CardAbility.idでAbilityを特定できる

9. ACT_ABILITY Processが存在する
10. VALIDATEがある
11. PREPAREがある
12. PAY_COSTがある
13. RESOLVE_EFFECTがある
14. 正しいCheck Timingへ接続する
15. COMPLETEがある
16. contextでProcess固有状態を保持できる
17. interrupt/resume拡張を妨げない

18. costs[]を順番付き配列として扱う
19. PAY_STOCKを実装している
20. PAY_STOCK amountをparameter化している
21. REST_SELFを実装している
22. canPayとpayを分離している
23. 全Costをmutation前に検証する
24. 部分支払いが発生しない
25. Cost Handler方式になっている
26. 未知Costを無視しない

27. Effect Resolver / Handlerがある
28. TEST_LOG等の最小テストEffectがある
29. 未知Effectを無視しない
30. 実カードEffectを先取りしていない

31. Cost支払い中のRule Check境界が公式ルールと整合している
32. Rule Check位置の根拠が設計書に記載されている
33. Costごとに不適切なRule Checkをしていない
34. F-4BのRefresh interruptを妨げない

35. 右上Card詳細からACTを使用できる
36. 使用不可ACTをdisabled表示できる
37. 使用不可理由を表示できる
38. 複数ACTを個別操作できる
39. ACT完了後MAIN WAITING_INPUTへ戻る
40. Stock / RESTの変化がrenderされる
41. Stage Move / Swapと共存する

42. docs/１．設計書/カード能力.md が新設されている
43. 設計書一覧.mdから参照できる
44. CardAbility Schemaが記載されている
45. ACT_ABILITY Processが記載されている
46. contextの役割が記載されている
47. Cost Type一覧がある
48. PAY_STOCKが一覧にある
49. REST_SELFが一覧にある
50. Effect Type一覧がある
51. TEST_LOGがDevelopment/Test onlyと明記されている
52. Condition Type一覧がある
53. 未対応Type追加手順が記載されている
54. CardMaster登録時の確認ルールが記載されている

55. COST_TYPEをコード上で管理している
56. EFFECT_TYPEをコード上で管理している
57. 未知Typeをfail-fastできる

58. AUTO実行を追加していない
59. CONTINUOUS実行を追加していない
60. effectQueueをACT実行キューにしていない
61. 巨大AbilityEngineを追加していない
62. 西森柚咲の集中を実装していない

63. 関連テストが成功する
64. 全既存テストが成功する
65. node --checkが成功する
66. git diff --checkが成功する
67. working treeがcleanである


# 48. 実装後の確認

最低限以下を実行してください。

- F-4A専用テスト
- node --test client/tests/*.test.mjs
- 全JS/MJSへのnode --check
- git diff --check
- git status --short

また検索等で、

- RendererがCost/Effectを直接mutationしていない
- ControllerがCost/Effectを直接mutationしていない
- effectQueueをACT用に変更していない
- AUTO実行を追加していない
- CONTINUOUS実行を追加していない
- 西森柚咲の集中を先取りしていない

ことを確認してください。


# 49. ブラウザ目視確認

ブラウザ環境が利用可能なら、

1. ACT付きテストCardをStageへ置く
2. Stage Cardを選択
3. 右上詳細に複数ACTが表示される
4. PAY_STOCK ACTを使用
5. Stockが1枚減る
6. Waiting Roomが1枚増える
7. TEST_LOGが実行される
8. MAIN WAITING_INPUTへ戻る
9. REST_SELF ACTを使用
10. CardがRESTになる
11. 再度REST_SELF ACTが使用不可になる
12. 使用不可理由が表示される
13. Stock 0ならPAY_STOCKが使用不可
14. 複数Cost ACTで片方を払えない場合、どちらもmutationされない
15. Stage Move / Swapが従来どおり可能

を確認してください。

ブラウザ環境がない場合は、
ユーザー側確認項目として完了報告へ残してください。


# 50. Commit

F-4Aを独立した小さなPhaseとしてcommitしてください。

例：

feat: add ACT ability execution foundation

F-4Bの実カード集中を同じcommitへ入れないでください。


# 51. 完了報告

完了時には最低限以下を報告してください。

1. 実装概要
2. 変更ファイル
3. 新規/削除ファイル
4. ACT使用可能条件
5. GameEngine Query API
6. ACT Ability識別方法
7. ACT_ABILITY Process構造
8. 各Stepの責務
9. context構造と役割
10. COST_TYPE一覧
11. PAY_STOCK Schema
12. REST_SELF Schema
13. Cost Resolver / Handler構造
14. canPay / payの分離方法
15. 複数Cost事前検証方法
16. Cost支払い順
17. EFFECT_TYPE一覧
18. TEST_LOGの実装
19. Effect Resolver / Handler構造
20. Conditionの現状
21. 未知Typeのfail-fast方法
22. Rule Check / Check Timingの調査結果
23. 採用したRule Check境界
24. その公式ルール上の根拠
25. 既存resolveRuleCheck()との接続方法
26. Refresh / Level Upとの関係
27. F-4Bで追加検証が必要な点
28. effectQueueへの影響
29. 右上ACT UI
30. 複数ACT UI
31. 使用不可理由UI
32. Stage Move / Swapへの影響
33. カード能力.mdの内容
34. 対応Cost Type一覧
35. 対応Effect Type一覧
36. CardMaster登録時の新ルール
37. 追加/更新テスト
38. F-4A専用テスト結果
39. 全テスト結果
40. node --check結果
41. git diff --check結果
42. ブラウザ確認の実施可否
43. ユーザー側で確認すべき項目
44. README更新内容
45. commit hash / message
46. PR情報
47. 最終git status

特に完了報告では、

「Cost支払い後・Effect解決中・Ability解決完了時の
Rule Check / Check Timingをどのように設計したか」

を省略せず説明してください。


# 52. F-4Aの設計原則

今回の中心は、

CardAbilityを単なる表示データから、
実際にゲームエンジンが解釈・実行できる構造へ
最初の一歩を進めることです。

ただし、

「西森柚咲を動かすためだけの専用コード」

にも、

「将来の全Abilityを先回りした巨大framework」

にもしてくださいません。

F-4Aでは、

ACT
↓
GameEngine
↓
ACT_ABILITY Process
↓
Cost / Effect Resolver
↓
小さなHandler

という最小限の共通基盤を作り、

PAY_STOCK
REST_SELF
TEST_LOG

を通して実際に縦方向に動作することを確認してください。

F-4Bではこの基盤を利用して、
「人気アイドル 西森 柚咲」の【起】集中を実装します。YutoSuga/weiss-online に Phase F-4A「ACT Ability v1 基盤」を実装してください。

# 0. 今回の位置付け

現在：

F-3A CardMaster / Card分離                  COMPLETE
F-3B CardAbilityデータ構造                  COMPLETE
F-3C CardMaster正式JSON / DeckDefinition   COMPLETE
F-3D Card表示・詳細表示                     COMPLETE
DEV 山札→手札                              COMPLETE
F-3D follow-up UI修正                      COMPLETE

次：

F-4A ACT Ability v1 基盤                    今回
F-4B 「人気アイドル 西森 柚咲」【起】集中   次回

今回F-4Aでは、
実カード「人気アイドル 西森 柚咲」の集中そのものはまだ実装しません。

F-4Bで実カードの【起】集中を自然に載せられるよう、

- ACT Ability検出
- ACT使用可能判定
- ACT UI
- ACT_ABILITY Process
- Cost Resolver / Handler
- Effect Resolver / Handler
- PAY_STOCK
- REST_SELF
- 複数Cost
- テスト用最小Effect

までを実装してください。

AUTO / CONTINUOUS Abilityの実行は今回対象外です。


# 1. 最初に既存実装と最新公式ルールを確認する

実装前に少なくとも以下を確認してください。

Repository：
YutoSuga/weiss-online

Docs：
- README.md
- docs/設計書一覧.md
- docs/１．設計書/アーキテクチャ.md
- docs/１．設計書/アプリケーションフロー.md
- docs/１．設計書/カードデータモデル.md
- docs/１．設計書/エンティティ・オブジェクト一覧.md
- docs/１．設計書/ゲームエンジン.md
- docs/１．設計書/JavaScript仕様.md
- docs/１．設計書/メインフェイズ.md
- docs/１．設計書/プロセス.md
- docs/１．設計書/ルールチェック.md
- docs/１．設計書/UI操作.md

Code：
- Card
- CardMaster
- CardAbility
- GameState
- GameEngine
- ProcessManager
- Renderer
- MainPhaseController
- MAIN_PHASE Process
- PLAY_CHARACTER Process
- MOVE_STAGE
- SWAP_STAGE
- REFRESH
- REFRESH_PENALTY
- LEVEL_UP
- DRAW
- CLOCK
- resolveRuleCheck()
- ruleState
- effectQueue
- CardMasterLoader
- CardMasterRegistry
- card-masters.json
- test-decks.json
- 全関連テスト

特に、

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

というF-3Bの構造を確認してください。

また、実装前に必ず現在のヴァイスシュヴァルツ公式総合ルール最新版を確認してください。

2026-09-21時点では、
公式サイト上の総合ルールは Ver.1.112（2026/8/24更新）です。

特に以下を確認してください。

- 起動能力
- 能力のプレイと解決
- コストと支払い
- 複数Cost
- Costを支払えない場合
- チェックタイミング
- プレイタイミング
- Refresh
- Level Up
- 自動能力の待機状態
- 能力解決中のRule Check

今回の実装は、
既存実装だけを根拠にRule Check位置を推測しないでください。

最新公式総合ルールと既存Process設計を照合してください。


# 2. F-4Aのゴール

F-4Aのゴールは、

「Stage上のCardが持つ【起】Abilityを発見し、
現在使用可能か判定し、
右上Card詳細からユーザーが選択して、
ACT_ABILITY Processとしてプレイ・解決し、
MAIN WAITING_INPUTへ戻れる」

ところまでです。

概念：

MAIN WAITING_INPUT
        ↓
自分のStage Cardを選択
        ↓
ACT Ability一覧取得
        ↓
使用可能判定
        ↓
右上詳細に表示
        ↓
「使用する」
        ↓
ACT_ABILITY Process
        ↓
VALIDATE
        ↓
PREPARE
        ↓
PAY_COST
        ↓
RESOLVE_EFFECT
        ↓
Rule Check / Check Timing
        ↓
COMPLETE
        ↓
MAIN WAITING_INPUT


# 3. 責務

既存設計を維持してください。

GameEngine
→ Ability使用可能判定
→ ACT_ABILITY開始
→ Cost / Effect解決のゲームルール管理

ProcessManager
→ processStack
→ step
→ status
→ context
→ interrupt / resume

Renderer
→ ACT Ability一覧・状態の表示

MainPhaseController
→ ユーザー操作をGameEngineへ渡す

CardAbility
→ Ability定義データ

Cost / Effect Handler
→ 個々のCost / Effect typeの処理

Renderer / Controllerで、
CostやEffectのゲームルールを直接実行しないでください。


# 4. 「ACTを持つ」と「今使える」を分離する

以下を別概念として扱ってください。

A.
CardがACT Abilityを持っている

B.
そのACT Abilityを現在使用できる

概念的にはGameEngineに、

getActAbilities(card, playerId)

canUseActAbility(card, ability, playerId)

getActAbilityDisabledReason(card, ability, playerId)

のようなQuery APIを用意してください。

実際の命名は既存コードに合わせて調整して構いません。

重要なのは、

ability.type === ACT

だけでは「現在使用可能」としないことです。


# 5. F-4AでサポートするACT使用タイミング

現在サポートするACTの使用タイミングは、

- 自分のターン
- phase === MAIN
- MAIN_PHASE / WAITING_INPUT
- source Cardが自分のStageに存在する
- source CardがACT Abilityを持つ
- Card固有conditionsを満たす
- Costをすべて支払える

としてください。

ただし、

「ACTは永遠にMAIN専用」

という設計にはしないでください。

F-4A時点でサポートするプレイタイミングが
MAIN WAITING_INPUTである、という扱いです。


# 6. ACT Abilityの識別

CardAbility.idはCardMaster内でuniqueという既存設計を維持してください。

対戦中のAbilityは概念的に、

source Card.instanceId
+
CardAbility.id

で識別してください。

新しいglobal Ability ID体系は追加しないでください。


# 7. ACT_ABILITY Process

ACT Abilityを実行するためのAction Processを追加してください。

基本Stepは以下を想定します。

ACT_ABILITY

VALIDATE
↓
PREPARE
↓
PAY_COST
↓
RESOLVE_EFFECT
↓
CHECK_POINT
↓
COMPLETE

ただし、
CHECK_POINTの正確な位置については後述のRule Check要件に従ってください。

必要なら公式ルールに合わせてStep構成を微調整して構いません。

その場合は理由を設計書と完了報告に記載してください。


# 8. VALIDATE

ACT開始直前に使用可能性を再検証してください。

UI上で使用可能だったという結果を信用して、
直接mutationしないでください。

最低限、

- player
- turn
- phase
- MAIN Process status
- source Card
- source zone
- Ability
- Ability type
- conditions
- 全Cost支払可能性

を確認してください。

VALIDATE失敗時は、
GameStateを部分的に変更しないでください。


# 9. PREPARE

PREPAREでは、
Ability解決に必要なProcess固有状態を初期化してください。

例えば、

context: {
  playerId,
  sourceCardInstanceId,
  abilityId,
  costIndex,
  effectIndex
}

のような情報です。

実際のcontext構造は既存Process設計に合わせてください。


# 10. Process contextの責務

contextは、

「そのProcessが途中で中断・再開された場合にも必要になる、
Process固有の作業メモリ」

として扱ってください。

例えば将来、

ACT_ABILITY
→ Effect解決途中
→ REFRESH
→ REFRESH_PENALTY
→ ACT_ABILITYへresume

となった場合に、

- 誰のAbilityか
- source Cardはどれか
- Abilityはどれか
- Costはどこまで終わったか
- Effectはどこまで終わったか

を復元できる構造にしてください。

ただしF-4Aで、
F-4Bの集中用contextを先回りして大量に追加しないでください。


# 11. Costは配列として扱う

CardAbility.costs[]を記載順に処理してください。

例：

costs: [
  {
    type: "PAY_STOCK",
    amount: 1
  },
  {
    type: "REST_SELF"
  }
]

Costの順序は意味を持つものとして扱ってください。


# 12. Cost Type

F-4Aでは正式に以下の2種類をサポートしてください。

COST_TYPE.PAY_STOCK
COST_TYPE.REST_SELF

文字列を各所へ直接散在させず、
定数として管理してください。


# 13. PAY_STOCK

Schema：

{
  type: "PAY_STOCK",
  amount: number
}

意味：

自分のStock TOPからamount枚を支払い、
Waiting Room TOPへ順番に移動する。

既存のZone orderingを維持してください。

既存仕様：

Stock TOP
→ array end

Waiting Room TOP
→ array end

amountは正の整数としてvalidationしてください。

例えば、

{ type: "PAY_STOCK", amount: 1 }

{ type: "PAY_STOCK", amount: 2 }

を同じHandlerで扱えるようにしてください。


# 14. REST_SELF

Schema：

{
  type: "REST_SELF"
}

意味：

このACT Abilityのsource Card自身を
STANDからRESTへ変更する。

REST済み等、
CostとしてRESTできない状態では支払不可としてください。

F-4Aではsource Card以外をRESTするCostは実装しません。


# 15. 「Costを支払えるか」と「Costを支払う」を分離する

Cost Handlerは概念的に、

canPay(cost, context)
pay(cost, context)

を分離してください。

命名は既存コードに合わせて調整して構いません。

重要なのは、

使用可能判定
≠
mutation

とすることです。


# 16. 全Costを先に検証する

複数Costの場合、

Cost 1を支払う
↓
Cost 2が払えない
↓
Cost 1だけ支払い済み

という状態を作らないでください。

実際のmutation前に、
全Costを支払えることを検証してください。

一つでも支払えない場合、
ACT Ability自体を使用不可としてください。


# 17. Cost支払い順

全Costが支払えることを確認した後、

costs[]の先頭から順番に支払ってください。

例：

[
  PAY_STOCK 1,
  REST_SELF
]

なら、

Stock支払い
↓
REST_SELF

の順です。


# 18. Cost Handler方式

GameEngineにCost typeごとの巨大なif/switchを増やさないでください。

概念：

ACT_ABILITY
      ↓
Cost Resolver / Dispatcher
      ↓
Cost Handler

例えば、

PAY_STOCK
→ payStockCostHandler

REST_SELF
→ restSelfCostHandler

という構造です。

Handlerは大きなClassである必要はありません。

小さなmodule / object / function群で構いません。

例えば概念的には、

PayStockCostHandler {
  canPay(cost, context)
  pay(cost, context)
}

RestSelfCostHandler {
  canPay(cost, context)
  pay(cost, context)
}

です。

既存プロジェクトの構造に合う、
過剰でない実装を選択してください。


# 19. 未対応Cost Type

未対応のCost typeを、
黙って無視しないでください。

未知のCost typeを持つAbilityは、

- 使用可能と判定しない
- 実行しない
- fail-fastまたは明確なunsupported error

となるようにしてください。

CardMaster登録/読み込み時にも、
可能な範囲で未知Cost typeを早期検出してください。

ただしLoaderとruntime validationの責務は、
既存設計を確認して適切に分けてください。


# 20. Condition

CardAbility.conditions[]は、

「そのAbility固有の使用・適用条件」

として扱います。

例えば将来、

- 自分のLevelが2以上
- 手札が5枚以下
- 他の特定Trait Characterが存在する

等を構造化する領域です。

一方、

- 自分のターン
- MAIN
- WAITING_INPUT
- source Cardが自分のStage

はACT共通のプレイタイミングであり、
ability.conditions[]へ入れないでください。


# 21. F-4AのCondition

F-4AのテストACTは、

conditions: []

で構いません。

ただし将来Condition Handlerを追加できる
小さな拡張ポイントは確保してください。

F-4Aで大量のCondition typeを実装しないでください。


# 22. Effect Resolver / Handler

EffectもCostと同様、

effects[]を直接GameEngineの巨大if/switchで解釈し続ける設計を避けてください。

概念：

ACT_ABILITY
      ↓
Effect Resolver / Dispatcher
      ↓
Effect Handler

としてください。


# 23. F-4AのEffect Type

F-4Aでは実カード効果をまだ実装しません。

開発・テスト専用として、

TEST_LOG

のような最小Effectを1つ用意してください。

例：

{
  type: "TEST_LOG",
  message: "ACTテスト効果を解決"
}

このEffectは、

- GameState.logまたは既存ログ機構へ記録する
- ゲーム上のCard移動等は行わない

程度で構いません。

名称は既存設計に合わせて変更して構いませんが、
「開発/テスト専用Effect」であることを明確にしてください。


# 24. Effect Typeも定数管理する

例：

EFFECT_TYPE.TEST_LOG

のように定数として管理してください。

未知Effect typeを黙って無視しないでください。


# 25. テスト用ACT Ability

F-4Aでは仮想テストCardMasterを使用して、
実際にACTを最後まで実行できるようにしてください。

最低限、

A.
【起】[①] テスト効果

B.
【起】[このカードをレストする] テスト効果

をテスト可能にしてください。

構造例：

{
  id: "ACT_TEST_STOCK",
  type: "ACT",
  text: "【起】[①] テスト効果",
  conditions: [],
  costs: [
    {
      type: "PAY_STOCK",
      amount: 1
    }
  ],
  effects: [
    {
      type: "TEST_LOG",
      message: "ACTテスト効果Aを解決"
    }
  ]
}

{
  id: "ACT_TEST_REST",
  type: "ACT",
  text: "【起】[このカードをレストする] テスト効果",
  conditions: [],
  costs: [
    {
      type: "REST_SELF"
    }
  ],
  effects: [
    {
      type: "TEST_LOG",
      message: "ACTテスト効果Bを解決"
    }
  ]
}


# 26. 複数Costテスト

F-4Aでは、

PAY_STOCK
+
REST_SELF

を同時に要求するテストACTも用意してください。

例：

costs: [
  {
    type: "PAY_STOCK",
    amount: 1
  },
  {
    type: "REST_SELF"
  }
]

これにより、

- 全Cost事前検証
- Cost記載順
- PAY_STOCK
- REST_SELF
- 部分支払い防止

を検証してください。

この能力も仮想テスト用で構いません。


# 27. Rule Check / Check Timing

ここは今回の重要事項です。

既存のresolveRuleCheck()を、
機械的に以下のように呼ばないでください。

PAY_COST 1
→ resolveRuleCheck()
→ PAY_COST 2

最新公式総合ルールでは、
複数Costは記載順に実行しますが、
Cost支払い開始から完了までの間は、
RefreshやLevel Up等の所定のルール処理を行わない規定があります。

また、
Costを一部でも支払えない場合は、
そのAbilityのCost全体を支払えません。

そのためF-4Aでは、

「PAY_COST終了直後」
「Effect解決中」
「Ability解決完了時」

のどこに既存resolveRuleCheck()を呼ぶべきかについて、

1. 最新公式総合ルール
2. 既存resolveRuleCheck()
3. REFRESH / REFRESH_PENALTY
4. LEVEL_UP
5. defeat判定
6. Process interrupt/resume設計

を照合して決定してください。

特に以下を確認してください。

- Cost 1つごとのRule Checkは行わない
- 全Cost支払い中のRefresh/Level Upをどう抑止するか
- 全Cost支払い完了後の正しいCheck Timing
- Effect解決中にDeckが0になった場合の扱い
- Ability解決完了後のCheck Timing
- 既存Processへどう接続するか

この調査結果と採用したRule Check境界を、
設計書へ根拠付きで記載してください。

F-4Bで集中を実装したときに、

ACT Effect
→ Deck操作
→ Refresh
→ Refresh Penalty
→ ACTへresume

を正しく扱えることを見据えた設計にしてください。

ただしF-4Aでは集中Effect自体は実装しません。


# 28. effectQueue

F-4AではeffectQueueをACT Abilityの実行キューとして使用しないでください。

ACTは、

ユーザーが能動的にプレイ
↓
ACT_ABILITY Processをpush

という構造とします。

将来的に、

ACT Cost / Effect
↓
何らかのAUTOが誘発
↓
AUTOが待機状態になる
↓
適切なCheck TimingでAUTOを解決

という処理が必要になります。

その際にeffectQueue等を利用する可能性があります。

ただし、
AUTO待機・AUTO解決はF-5以降で正式設計します。

F-4AではeffectQueueの仕様を先回りして変更しないでください。


# 29. 右上Card詳細UI

現在の右上Card詳細に表示しているAbility一覧を利用してください。

Stage Cardを選択した場合、

ACT Abilityについて、

- Ability text
- 使用可能/使用不可
- 「使用する」操作
- 使用不可の場合の理由

を表示できるようにしてください。

イメージ：

能力

【永】...
【自】...

【起】[①] テスト効果
[使用する]

【起】[このカードをレストする] テスト効果
[使用する]


# 30. 複数ACT対応

1枚のCardが複数のACT Abilityを持つ場合に、
Abilityごとに個別に使用可否判定・使用操作ができるようにしてください。

Card全体に対して一つだけ
「起動能力を使用」
という設計にはしないでください。


# 31. 使用不可UI

例えば、

Stock不足

の場合、

【起】[①] テスト効果
[使用不可]
理由：ストックが足りません

のように、
なぜ使用できないか分かるようにしてください。

REST_SELFについて、
source CardがすでにRESTの場合も同様です。

文言は既存UIに合わせて調整して構いません。


# 32. ACT実行後のUI

ACT Ability完了後は、
MAIN_PHASE / WAITING_INPUTへ戻してください。

GameStateを再renderし、

- Stock減少
- Waiting Room増加
- source Card REST

等が通常UIへ反映されるようにしてください。

F-4Aではアニメーションは不要です。

将来的に、

- Stock支払いAnimation
- REST Animation

等を追加する可能性がありますが、
今回は実装しないでください。


# 33. 既存Stage操作との共存

現在Stage Card選択は、

- Move
- Swap
- Replacement関連
- Card detail

等でも使用されています。

ACT UI追加によって、

- Stage Move
- Stage Swap
- Hand → Stage Replacement
- Card selection切替

を壊さないでください。

Stage Cardを選択した際、

「移動先選択」
と
「ACT Ability使用」

が同じCard detailから共存できる構造にしてください。


# 34. 新しい設計書「カード能力.md」

以下を新設してください。

docs/１．設計書/カード能力.md

また、

docs/設計書一覧.md

から参照できるようにしてください。


# 35. カード能力.md の内容

最低限以下を記載してください。

1. CardAbilityの責務

2. CardAbility Schema

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

3. Ability Type一覧

CONTINUOUS
AUTO
ACT

4. activationTriggerの役割

5. conditionsの役割

6. costsの役割

7. effectsの役割

8. ACT Abilityの現在の実行フロー

9. ACT_ABILITY Process

10. Process contextの役割

11. Condition / Cost / Effect Handler方式

12. 対応Condition Type一覧

13. 対応Cost Type一覧

14. 対応Effect Type一覧

15. 新しいTypeを追加するときの手順

16. CardMaster登録時の確認事項

17. 未対応Typeの扱い

18. 将来のAUTO / CONTINUOUSとの関係

19. effectQueueとの現在の責務分離

20. Rule Check / Check Timingとの関係


# 36. 対応Cost Type一覧

カード能力.mdに、
最低限以下の表を作成してください。

Cost Type:
PAY_STOCK

意味:
自分のStockから指定枚数をWaiting Roomへ移動する

Parameters:
amount: positive integer

Handler:
実装したHandler名

Status:
Supported


Cost Type:
REST_SELF

意味:
source Card自身をSTANDからRESTにする

Parameters:
なし

Handler:
実装したHandler名

Status:
Supported


# 37. 対応Effect Type一覧

F-4Aでは最低限、

TEST_LOG

を記載してください。

ただし、

Development / Test only

であることを明示してください。

実カード登録用の正式Effect Typeではないことを明記してください。


# 38. Condition Type一覧

F-4A時点では、
カード固有Condition Typeが未実装であれば、

「現在正式対応なし」

と明記してください。

空欄にしないでください。

将来追加予定であることも記載してください。


# 39. CardMaster登録時の重要ルール

カード能力.mdに以下の方針を明記してください。

CardMasterへ新しいAbilityを登録するときは、

conditions[]
costs[]
effects[]

に含まれる全Typeが、
現在の「対応Type一覧」に存在するか確認する。

未対応Typeが必要な場合、

データだけを追加してはいけない。

先に、

- Type定義
- Handler
- validation
- tests
- 設計書の対応Type一覧

を追加する。

その後にCardMasterへ登録する。

これにより、

「新しいCardを登録したがEngineがその能力を解釈できない」

状態を防止してください。


# 40. コード上の対応Type一覧

設計書だけでなくコード上でも、
対応Typeを定数として管理してください。

最低限：

COST_TYPE.PAY_STOCK
COST_TYPE.REST_SELF

EFFECT_TYPE.TEST_LOG

を用意してください。

Conditionについても、
将来追加しやすい配置を検討してください。

ただし空の定数objectを作るだけの過剰実装は不要です。


# 41. 未知Typeはfail-fast

CardMaster / CardAbilityの読み込みまたは実行時に、

UNKNOWN_COST
UNKNOWN_EFFECT

等が存在した場合、
黙って無視しないでください。

可能な限り早い段階で明確なerrorにしてください。

どの層でvalidationするかは、
既存CardMasterLoader / CardAbility設計を確認して決定してください。

設計書にも責務を記載してください。


# 42. テスト

最低限以下をテストしてください。


## ACT detection

- ACT Abilityを取得できる
- AUTOをACTとして取得しない
- CONTINUOUSをACTとして取得しない
- 複数ACTを取得できる


## ACT timing

- 自分のMAIN WAITING_INPUTで使用可能
- 相手ターンでは使用不可
- MAIN以外では使用不可
- MAINがWAITING_INPUTでなければ使用不可
- source Cardが自分のStageになければ使用不可


## PAY_STOCK

- amount=1を支払える
- amount=2等、amount parameterを扱える
- Stock不足なら支払不可
- Stock TOPから支払う
- Waiting Room TOPへ入る
- 他Stock Cardの順序を壊さない


## REST_SELF

- STANDなら支払える
- RESTなら支払えない
- 支払い後RESTになる
- 他Cardのpositionを変更しない


## Multiple Costs

PAY_STOCK + REST_SELFについて、

- 両方支払える場合のみACT使用可能
- Stock不足ならどちらもmutationしない
- REST_SELF不可ならStockもmutationしない
- costs[]の順番で支払う
- 部分支払いが発生しない


## Effect

- TEST_LOGが実行される
- messageがログへ反映される
- 未知Effectを無視しない


## Process

- ACT_ABILITYがpushされる
- VALIDATE
- PREPARE
- PAY_COST
- RESOLVE_EFFECT
- 適切なCheck Timing
- COMPLETE

まで進行する

- 完了後MAIN WAITING_INPUTへ戻る
- contextがsource Card / Abilityを特定できる


## UI

可能な範囲で、

- Stage Card詳細にACTを表示
- 使用可能ACTに「使用する」
- 使用不可ACTはdisabled
- 使用不可理由を表示
- 複数ACTを個別操作できる


## Regression

- PLAY_CHARACTER
- Stage Move
- Stage Swap
- Replacement
- DRAW
- CLOCK
- REFRESH
- REFRESH_PENALTY
- LEVEL_UP
- defeat
- visibility
- Card detail
- DEV操作

を壊していないこと。


# 43. Rule Check専用テスト

今回決定したRule Check境界について、
可能な範囲で専用テストを追加してください。

特に、

- Cost間で不適切なRule Checkが発生しない
- Cost支払い開始～完了の間にRefresh / Level Upを割り込ませない
- Ability完了時のRule Checkが公式ルールと一致する

ことを確認してください。

F-4AのTEST_LOGではDeck操作がないため、
F-4Bで追加テストが必要になる部分は、
TODOではなく設計書の「F-4Bで検証する項目」として明記してください。


# 44. Non-goals

今回実装しないもの：

- 「人気アイドル 西森 柚咲」の正式CardMaster
- 集中
- 山札上4枚→控え室
- CX count
- Deck search
- Card selection from Deck
- Add to Hand
- Shuffle
- 集中Effect中のRefresh実動作

- AUTO Ability実行
- CONTINUOUS Ability実行
- AUTO待機
- AUTO解決
- effectQueueの本格実装/再設計

- 全Condition Type
- 全Cost Type
- 全Effect Type
- デッキ内全ACT
- AbilityEngineという巨大な抽象レイヤー

- Stock支払いAnimation
- REST Animation
- その他Ability Animation


# 45. 過剰抽象化を避ける

F-4Aでは、

GameEngine
↓
ACT_ABILITY Process
↓
Condition / Cost / Effect Resolver
↓
小さなHandler

程度の構造を基本としてください。

F-5でAUTOを実装した際に、
ACT/AUTO間の共通部分が明確になってから、
必要であればAbilityEngine等への抽象化を検討します。

今回、
将来必要になるかもしれない全能力を想定した
巨大なframeworkを作らないでください。


# 46. README

READMEの進捗を、

F-4A ACT Ability v1 基盤 COMPLETE
F-4B 「人気アイドル 西森 柚咲」【起】集中 NEXT

へ更新してください。

ただし実装がAcceptance Criteriaを満たした場合のみです。


# 47. Acceptance Criteria

以下をすべて満たしたらF-4A COMPLETEとしてください。

1. Stage CardのACT Abilityを取得できる
2. ACTをAUTO/CONTINUOUSと区別できる
3. ACT使用可能判定がGameEngine側にある
4. ACT所持とACT使用可能が別概念になっている
5. 自分のMAIN WAITING_INPUTのみ現在サポートする
6. source Cardが自分のStageに必要
7. 複数ACTを扱える
8. Card.instanceId + CardAbility.idでAbilityを特定できる

9. ACT_ABILITY Processが存在する
10. VALIDATEがある
11. PREPAREがある
12. PAY_COSTがある
13. RESOLVE_EFFECTがある
14. 正しいCheck Timingへ接続する
15. COMPLETEがある
16. contextでProcess固有状態を保持できる
17. interrupt/resume拡張を妨げない

18. costs[]を順番付き配列として扱う
19. PAY_STOCKを実装している
20. PAY_STOCK amountをparameter化している
21. REST_SELFを実装している
22. canPayとpayを分離している
23. 全Costをmutation前に検証する
24. 部分支払いが発生しない
25. Cost Handler方式になっている
26. 未知Costを無視しない

27. Effect Resolver / Handlerがある
28. TEST_LOG等の最小テストEffectがある
29. 未知Effectを無視しない
30. 実カードEffectを先取りしていない

31. Cost支払い中のRule Check境界が公式ルールと整合している
32. Rule Check位置の根拠が設計書に記載されている
33. Costごとに不適切なRule Checkをしていない
34. F-4BのRefresh interruptを妨げない

35. 右上Card詳細からACTを使用できる
36. 使用不可ACTをdisabled表示できる
37. 使用不可理由を表示できる
38. 複数ACTを個別操作できる
39. ACT完了後MAIN WAITING_INPUTへ戻る
40. Stock / RESTの変化がrenderされる
41. Stage Move / Swapと共存する

42. docs/１．設計書/カード能力.md が新設されている
43. 設計書一覧.mdから参照できる
44. CardAbility Schemaが記載されている
45. ACT_ABILITY Processが記載されている
46. contextの役割が記載されている
47. Cost Type一覧がある
48. PAY_STOCKが一覧にある
49. REST_SELFが一覧にある
50. Effect Type一覧がある
51. TEST_LOGがDevelopment/Test onlyと明記されている
52. Condition Type一覧がある
53. 未対応Type追加手順が記載されている
54. CardMaster登録時の確認ルールが記載されている

55. COST_TYPEをコード上で管理している
56. EFFECT_TYPEをコード上で管理している
57. 未知Typeをfail-fastできる

58. AUTO実行を追加していない
59. CONTINUOUS実行を追加していない
60. effectQueueをACT実行キューにしていない
61. 巨大AbilityEngineを追加していない
62. 西森柚咲の集中を実装していない

63. 関連テストが成功する
64. 全既存テストが成功する
65. node --checkが成功する
66. git diff --checkが成功する
67. working treeがcleanである


# 48. 実装後の確認

最低限以下を実行してください。

- F-4A専用テスト
- node --test client/tests/*.test.mjs
- 全JS/MJSへのnode --check
- git diff --check
- git status --short

また検索等で、

- RendererがCost/Effectを直接mutationしていない
- ControllerがCost/Effectを直接mutationしていない
- effectQueueをACT用に変更していない
- AUTO実行を追加していない
- CONTINUOUS実行を追加していない
- 西森柚咲の集中を先取りしていない

ことを確認してください。


# 49. ブラウザ目視確認

ブラウザ環境が利用可能なら、

1. ACT付きテストCardをStageへ置く
2. Stage Cardを選択
3. 右上詳細に複数ACTが表示される
4. PAY_STOCK ACTを使用
5. Stockが1枚減る
6. Waiting Roomが1枚増える
7. TEST_LOGが実行される
8. MAIN WAITING_INPUTへ戻る
9. REST_SELF ACTを使用
10. CardがRESTになる
11. 再度REST_SELF ACTが使用不可になる
12. 使用不可理由が表示される
13. Stock 0ならPAY_STOCKが使用不可
14. 複数Cost ACTで片方を払えない場合、どちらもmutationされない
15. Stage Move / Swapが従来どおり可能

を確認してください。

ブラウザ環境がない場合は、
ユーザー側確認項目として完了報告へ残してください。


# 50. Commit

F-4Aを独立した小さなPhaseとしてcommitしてください。

例：

feat: add ACT ability execution foundation

F-4Bの実カード集中を同じcommitへ入れないでください。


# 51. 完了報告

完了時には最低限以下を報告してください。

1. 実装概要
2. 変更ファイル
3. 新規/削除ファイル
4. ACT使用可能条件
5. GameEngine Query API
6. ACT Ability識別方法
7. ACT_ABILITY Process構造
8. 各Stepの責務
9. context構造と役割
10. COST_TYPE一覧
11. PAY_STOCK Schema
12. REST_SELF Schema
13. Cost Resolver / Handler構造
14. canPay / payの分離方法
15. 複数Cost事前検証方法
16. Cost支払い順
17. EFFECT_TYPE一覧
18. TEST_LOGの実装
19. Effect Resolver / Handler構造
20. Conditionの現状
21. 未知Typeのfail-fast方法
22. Rule Check / Check Timingの調査結果
23. 採用したRule Check境界
24. その公式ルール上の根拠
25. 既存resolveRuleCheck()との接続方法
26. Refresh / Level Upとの関係
27. F-4Bで追加検証が必要な点
28. effectQueueへの影響
29. 右上ACT UI
30. 複数ACT UI
31. 使用不可理由UI
32. Stage Move / Swapへの影響
33. カード能力.mdの内容
34. 対応Cost Type一覧
35. 対応Effect Type一覧
36. CardMaster登録時の新ルール
37. 追加/更新テスト
38. F-4A専用テスト結果
39. 全テスト結果
40. node --check結果
41. git diff --check結果
42. ブラウザ確認の実施可否
43. ユーザー側で確認すべき項目
44. README更新内容
45. commit hash / message
46. PR情報
47. 最終git status

特に完了報告では、

「Cost支払い後・Effect解決中・Ability解決完了時の
Rule Check / Check Timingをどのように設計したか」

を省略せず説明してください。


# 52. F-4Aの設計原則

今回の中心は、

CardAbilityを単なる表示データから、
実際にゲームエンジンが解釈・実行できる構造へ
最初の一歩を進めることです。

ただし、

「西森柚咲を動かすためだけの専用コード」

にも、

「将来の全Abilityを先回りした巨大framework」

にもしてくださいません。

F-4Aでは、

ACT
↓
GameEngine
↓
ACT_ABILITY Process
↓
Cost / Effect Resolver
↓
小さなHandler

という最小限の共通基盤を作り、

PAY_STOCK
REST_SELF
TEST_LOG

を通して実際に縦方向に動作することを確認してください。

F-4Bではこの基盤を利用して、
「人気アイドル 西森 柚咲」の【起】集中を実装します。
