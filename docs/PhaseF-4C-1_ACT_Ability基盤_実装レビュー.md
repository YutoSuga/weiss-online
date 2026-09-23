# Phase F-4C-1 ACT Ability基盤 実装レビュー

## 1. レビューの位置付けと目的

本書はPhase F-4C-1で実施したACT Ability基盤の実装レビュー記録である。不具合の修正記録ではなく、Phase F-4の完了判定と、後続Phaseへ引き継ぐ改善候補を区別して残す。

レビューでは、F-4で実装した基盤が`Kch/W78-001S`「人気アイドル 西森 柚咲」専用ではなく、別のACT Abilityを追加できる構造として成立しているかを確認した。対象はCost / Effect / Effect Result / `WAITING_INPUT` / child Process、Rule Check interrupt後の`REFRESH` / `REFRESH_PENALTY` / resume、CardMaster / CardAbility / GameEngine / ProcessManager / Controller / Rendererの責務、および代表Abilityのテストである。

## 2. 結論とPhase判定

**Phase F-4 ACT AbilityはCOMPLETEとする。** F-4A ACT Ability v1基盤、F-4B実在ACT Ability、F-4B UI/UX Follow-up、およびF-4C-1本レビューはいずれも完了した。

- 現行F-4範囲では、今後別のACTを追加できるACT Ability基盤として成立している。
- 汎用層に特定のカードID、カード名、`masterId`による分岐は確認されていない。
- Abilityは`source Card.instanceId + CardAbility.id`で識別される。
- Cost、複数Effect、Effect Result、`WAITING_INPUT`、child Processの各経路が成立している。
- Rule Checkによる`REFRESH` / `REFRESH_PENALTY`の割り込み後も、保存済みcontextからresumeできる。
- F-4完了を妨げる問題、およびF-5 AUTOへ進む前に必須となる修正は確認されていない。

以下の改善候補は、現在登録済みのAbilityを成立させるF-4完了条件ではない。**F-4未完了項目にはせず、F-5以降または次回ACT拡張時に再評価する。** 具体的なAbility要件を必要とする項目は、必要になった時点で設計・実装する。

## 3. 確認した主要構造

### 3.1 ACT定義と責務

定義と実行の参照経路は`CardMaster → CardAbility → Card → GameEngine`である。CardMaster / CardAbilityは固定情報を保持し、対戦中のmutationはGameEngineが担当する。ProcessManagerはProcess Stack、Controllerは入力の中継、Rendererは表示を担当し、CostやEffectのmutationをController / Rendererへ置かない。

ACTは`sourceCardInstanceId + abilityId`で特定する。Card instanceとAbility definitionを分離し、表示用`text`をゲームロジックの解析には使用しない。

### 3.2 Cost

Cost Resolver / Handlerが`PAY_STOCK`、`REST_SELF`等を処理する。すべてのCostについて支払可否をmutation前に確認し、支払可能な場合のみ`costs[]`の配列順で一括して支払う。

### 3.3 EffectとEffect Result

top-level Effectは`effectIndex`、`EFFECT_GROUP`内部は`groupEffectIndex`で進行位置を管理する。結果はACT Process contextの`effectResults`へ`Effect.id`をkeyとして保存する。`effectIndex`は進行位置、`Effect.id`は結果参照用IDであり、両者の役割は分離されている。

### 3.4 WAITING_INPUTとchild Process

`WAITING_INPUT`はUIだけの状態ではなく正式なProcess statusであり、現在はBrainstorm Resolution確認と`SEARCH_DECK`で使用する。`SEARCH_DECK`は独立したchild Processとして動作し、その間も親ACT ProcessをProcess Stack上に保持する。

### 3.5 interrupt / resume

ACT Process contextを中断・再開可能な進捗の正本とする。Effect解決中にRule Checkが`REFRESH`や`REFRESH_PENALTY`を割り込ませても、完了後は保存済みの`effectIndex` / `groupEffectIndex`等から親ACTをresumeする。

## 4. 代表ケース：「人気アイドル 西森 柚咲」

`Kch/W78-001S`「人気アイドル 西森 柚咲」の【起】集中は、次の複合経路を通る代表的な実在ACTとして基盤上で動作する。

```text
PAY_STOCK
→ REST_SELF
→ BRAINSTORM_REVEAL
→ Resolution確認（WAITING_INPUT）
→ EFFECT_GROUP
→ SEARCH_DECK（child Process）
→ ADD_TO_HAND
→ SHUFFLE_DECK
```

CX=0、CX=1、CX複数、検索時の0枚選択、および途中にRefresh / Refresh Penaltyを挟むケースをテスト済みである。実装は実測した`climaxCount`を使用し、1または2へ固定していないため、CX=3/4を構造上排除していない。一方、CX=3/4に特化した回帰テストは現時点では存在せず、将来のテスト補強候補とする。この注記はCX=3/4が未対応であることを意味しない。

## 5. F-5以降または将来のACT拡張時に再評価する技術的負債

### 5.1 nested EFFECT_GROUP

Loader validationはnested `EFFECT_GROUP`を再帰的に受理できる一方、runtime executionは1階層の`EFFECT_GROUP`を前提としており、validation上の受理範囲とruntime上の実行可能範囲が一致していない。登録済みAbilityはnested Groupを使用しないため、F-4完了を妨げない。

Groupを拡張する前に、(A) nested `EFFECT_GROUP`を正式に実行可能にする、または(B) 正式対応までLoaderでnested Groupを明示拒否する、のいずれかに揃える。現時点で大規模な再帰Effect Framework化は行わない。

### 5.2 Effect Result参照の静的検証

runtimeはEffect Result参照時にEffect ID、field、value typeを検証する。一方Loaderは、参照先Effect IDの存在、参照先が参照元より前に解決されること、fieldが対象EffectのResultとして妥当であることまでは静的検証していない。西森柚咲の定義は正しいためF-4完了を妨げない。ACT定義が増えた段階で、限定的なfail-fast validationの追加を検討する。

### 5.3 Effect executionの配置と設計書との差異

正式設計はEffect Resolverがtype別Handlerへ処理を委譲し、GameEngineに巨大なtype分岐を置かない方向性を示す。現在の実装では、`TEST_LOG`等を除く複数の正式Effect executionの一部が`GameEngine.#resolveActEffect()`のtype別分岐に残っている。

これは現時点で機能不具合ではなく、F-4完了も妨げない。設計書を現在実装へ全面的に書き換えて将来方針を消すことも行わない。Effect typeがさらに2〜3種類以上増え、分岐が肥大化した段階で、validationとexecutionの登録方法・責務配置を再評価する。今回の完了処理ではリファクタリングしない。

## 6. 具体的な要件が必要になった時点で対応する事項

- **Condition評価**：ACT v1は空の`conditions`のみ正式対応する。非空conditionsを持つ具体的Abilityが登場した時点で評価方式を設計する。
- **MAIN以外のACT timing**：現行ACTはMAIN / `WAITING_INPUT`を起動タイミングとする。MAIN以外で使用する具体的ACTが登場した時点で拡張する。
- **ユーザー入力を伴うCost**：現行Costは同期的に一括支払いする。カード選択等が必要になった場合にCost Process化または1件単位のresume設計を検討する。
- **source Card自身をStage外へ移すCost / Effect**：現行ACTにはsourceをStageから再取得する設計がある。該当Abilityの登場時にAbility定義とsource参照の保持方法を再検討する。
- **任意条件式 / 汎用Effect DSL**：具体的なAbility要件が出るまで、AND / OR / NOT等を含む汎用DSL Frameworkを導入しない。
- **CX=3/4専用テスト**：実装は`climaxCount`を動的に扱うが専用テストはない。必要に応じて回帰テストを補強する。

## 7. F-5 AUTO Abilityへの引き継ぎ

次の主要実装対象は**Phase F-5 AUTO Ability**である。F-5の詳細分割や詳細設計は本レビューでは確定しない。

F-5設計では、F-4で確認した次の知見を参照する。

- AbilityをCardMaster / CardAbilityの構造化データとして保持し、表示用`text`をロジック解析に使わない。
- Card instanceとAbility definitionを分離する。
- Process contextを中断・再開可能な正本とし、`WAITING_INPUT`を正式なProcess statusとして扱う。
- Rule Check割り込み後は保存済みcontextからresumeする。
- Controllerは入力中継、Rendererは表示に留める。
- 特定カードID / カード名によるGameEngine分岐を避け、実在Abilityを代表ケースとして基盤を検証する。

ただしACTの実装方式をそのままAUTOへコピーするとは決定しない。AUTO固有のtrigger detection、pending ability、発動順、複数AUTO同時発生、解決タイミングはF-5設計時に改めて検討し、本レビューでは実装・詳細設計しない。

## 8. 完了確認

レビュー時に、CX=0 / 1 / 複数、0枚選択、Refreshを含む既存ACTテストと全既存テストを確認した。Phase完了文書化後にも全テスト、JavaScript構文検査、`git diff --check`を再実行し、結果はコミットおよびPull Requestの完了報告に記録する。
