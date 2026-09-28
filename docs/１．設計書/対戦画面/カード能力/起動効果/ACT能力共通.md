# ACT能力共通設計

## 1. 目的と責務

本書は、プレイヤーが自らプレイする`ACT`（【起】）の使用可能タイミング、Query、`ACT_ABILITY` Process、UIの正本である。CardAbility schema、Cost / Condition / Effect TypeとHandler、Cost payment boundary、Effect単位のCheck Point、Process stack / interrupt / resumeは[カード能力共通](../カード能力共通.md)を正本とする。

AUTO固有のGame Event、Trigger Detection、Pending AUTO、Check Timingは[AUTO能力共通](../自動効果/AUTO能力共通.md)で扱う。

## 2. 使用可能性とQuery

GameEngineは能力の所有と現在の使用可能性を分離する。

- `getActAbilities(card, playerId)`: `type === ACT`の定義を複数返す。
- `getActAbilityDisabledReason(card, ability, playerId)`: 最初の不可理由、使用可能なら`null`。
- `canUseActAbility(...)`: 上記結果のboolean Query。
- `useActAbility(...)`: 直前再検証を行う`ACT_ABILITY`をpushする。

現行実装の共通使用条件は以下のすべてである。

1. 自分のターンかつ`phase === MAIN`。
2. 自分の親`MAIN_PHASE`が`WAITING_INPUT / waiting_input`。
3. sourceが自分のStageに存在。
4. Ability IDで引いた定義が`ACT`。
5. `conditions[]`が空（現行は非空Condition未対応）。
6. 全Costが支払可能で、全Effect schemaが対応範囲。

これは現行実装の対応範囲であり、ACTを永久にMAIN専用と定義するものではない。

## 3. ACT_ABILITY Process

```text
MAIN / WAITING_INPUT
  → ACT_ABILITY
     VALIDATE → PREPARE → PAY_COST → CHECK_POINT_AFTER_COST
     → RESOLVE_EFFECT ↔ CHECK_POINT_AFTER_EFFECT → COMPLETE
  → MAIN / WAITING_INPUT
```

### 3.1 stepとACT固有context

| step | ACT固有責務 |
| --- | --- |
| `VALIDATE` | turn / MAIN / 親MAIN / Stage source / Ability type / conditions / Cost / Effectを再検証。失敗はmutation前にpopして例外 |
| `PREPARE` | index、`effectResults`、集中作業状態を初期化し、使用ログを追加 |
| `PAY_COST` | 共通`payCosts()`で全Costを記載順に支払。position変更Eventを発行 |
| `CHECK_POINT_AFTER_COST` | 次stepを保存し、共通Check Pointへ接続 |
| `RESOLVE_EFFECT` | `effectIndex`のEffectを解決。入力/childが必要なら停止 |
| `WAIT_FOR_BRAINSTORM_CONFIRMATION` | 集中のResolution確認待ち |
| `CHECK_POINT_AFTER_EFFECT` | 次Effect位置から共通Check Pointへ接続 |
| `COMPLETE` | `completeCurrentProcess()`でpopし、最終Check Point後に親MAINへ復帰 |

ACT contextは`sourceCardInstanceId / abilityId / costIndex / effectIndex / effectResults`に加え、集中用の`groupEffectIndex / brainstorm`を持つ。共通のindex保存契約は[カード能力共通](../カード能力共通.md#5-ability-process--rule-check共通原則)に従う。ACTは同期的な`payCosts()`でpayment boundaryを実現し、AUTO固有の`costPaymentInProgress`は持たない。

## 4. 集中とACT固有Effect

`BRAINSTORM`はAbility TypeではなくACT keywordである。`BRAINSTORM_REVEAL`はDeckからResolutionへ小刻みに公開し、必要なRule ProcessからACTへresumeし、CX数を`effectResults`に保存する。Resolution確認後に対象だけをWaiting Roomへ移す。`EFFECT_GROUP`によるCX数条件付きの`SEARCH_DECK → ADD_TO_HAND → SHUFFLE_DECK`を使う。

詳細は[集中（BRAINSTORM）](キーワード能力/集中.md)を正本とする。`SEARCH_DECK`、`CardSelectionView`、Rule Check接続はAUTOからも使う共通基盤だが、Reveal、Resolution、CX集計、集中確認UI、MAINへの復帰はACT集中固有である。

## 5. UI責務

Stage Card選択時、右上詳細はACTごとに本文、使用/使用不可ボタン、不可理由を表示する。ControllerはAbility IDをEngineへ渡すだけでCost / Effectを変更しない。完了後のrenderでZone、position、再評価したdisabled状態を反映する。

## 6. 現行の制約

- 正式対応Cost / Effectの最新一覧は[カード能力共通](../カード能力共通.md#3-cost共通設計)のみを正本とし、本書に複製しない。
- 非空`conditions[]`は未対応である。
- Effect validationはResolverに共通化済みだが、入力待ちや複数stepを持つACT Effectのexecutionは`GameEngine`のACT分岐に残る。Type増加時に登録型への再分離を検討する。
