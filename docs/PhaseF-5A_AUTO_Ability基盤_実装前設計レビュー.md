# Phase F-5A AUTO Ability基盤 実装前設計レビュー

## 0. 本書の位置付け

本書はPhase F-5Aの調査と実装前の推奨設計を記録する。実装済み仕様ではない。対象は2026-09-24時点の`GameEngine`、`ProcessManager`、各model / resolver / Controller / Renderer、関連設計書とテストである。このレビューではゲームロジック、UI、データ、テストを変更しない。

## 1. Executive Summary

### 結論

- **F-5Bへ進める。** CardAbilityの構造化データ、GameState、Process Stack、`WAITING_INPUT`、child Process、Rule Checkのinterrupt / resumeはAUTOの土台として再利用できる。
- **大きなアーキテクチャ変更は不要。** 必要なのは、事象発行境界、Trigger Detector、`pendingAutos`、および既存Rule Checkを包むCheck Point coordinatorの追加である。
- **F-5B開始を妨げる既存不具合Blockerはない。** ただしF-5Bで最初のeventを発行する前に、event schema、ゾーン表現、移動ヘルパーが保証する発行契約をテスト可能な形で固定することは**F-5B内のBLOCKER**である。
- 既存`pendingChecks`はAUTO queueに転用しない。これは現在Refresh完了後のRefresh Penaltyを「後続Rule Checkで実行する個別事象」として保持し、`pendingInterrupts`の選択候補に変換する専用構造である。
- Check Pointは**既存Rule Checkの外に別系統を作らず、Rule Checkを最初に反復安定化させ、次にPending AUTOを一件選ぶorchestratorへ発展させる**のが最小で安全である。

## 2. Current Architecture Investigation

### 2.1 GameEngine

`GameEngine`はAction / Phase Processのstep machine、ゾーンmutation、Rule Check、表示更新を集中管理する。DRAW、CLOCK、カードプレイ、Stage move / swap、ACT、Refresh Penaltyには明示的なCheck Point stepがある。一方、mutationは複数メソッドへ分散し、`Card.moveTo()`だけでなく元collectionのremoveと先collectionへのinsertを各呼出側が行う。Eventを`moveTo()`内で発行するとcollection mutationの途中を観測するため不適切である。

AUTOとの接続点は、確定mutation全体が完了した直後のEngine層である。F-5Bでは発行メソッドを一つにし、発行と同期にDetection / Pending化まで行い、AUTO Processは開始しない。

### 2.2 ProcessManager / Process Stack / WAITING_INPUT

`ProcessManager`は`gameState.ruleState.processStack`のpush / pop、current Process取得、step / status更新のみを担い、ルール優先順位は持たない。contextはpush時に浅くcopyされる。下層Processは追加statusなしで暗黙にinterrupt中と扱われる。

`WAITING_INPUT`は正式なProcess statusであり、MAIN、CLOCK、LEVEL_UP、集中確認、SEARCH_DECKで利用済みである。AUTO確認とCost Preparationもこのstatusを再利用できる。Pendingの誘発済み事実と、現在UIが何を待っているかは異なるため、PendingにProcess statusの複製を持たせない。

### 2.3 Rule Check / pendingChecks

`runRuleCheck()`は両Playerを読み取り、空Deck、Level Up、敗北を副作用なしで列挙する。`resolveRuleCheck()`は敗北を確定し、Refresh / Level Upと`pendingChecks`内のRefresh Penaltyを実行候補にし、1件ならinterrupt Processをpush、複数なら`pendingInterrupts`へ置いて選択待ちにする。Process完了時は`completeCurrentProcess()`がpop後に再度Rule Checkし、安定時に親Processを保存stepからresumeする。

`pendingChecks`は汎用queueの名称に見えるが、実装上は`REFRESH_PENALTY`だけを受理する。Pending AUTOと合流させると、Rule actionの選択とAUTOの「使用する/しない」を同じinterrupt UIで扱うことになる。`pendingAutos`(仮称)とは分離する。

### 2.4 Card / Player / Zone

Playerは`deck`と`hand / stage / clock / level / stock / waitingRoom / memory / resolution / climax`を保持し、Card instanceは同時に`owner / zone / row / index / position`を持つ。すなわち現在もcollection membershipとCard上の位置metadataは並存している。

推奨Source of Truthは**Player / Deckのcollection membership**である。`Card.zone / row / index`は描画・serialization用の同期metadataとし、`currentLocation`や`previousLocation`は追加しない。F-5Bで`locateCard(instanceId)`相当の読み取りhelperを導入する場合は、全Player collectionとDeckを走査し、所在0件/複数件をinvariant違反とし、Card metadataと一致するか検証する。毎回その走査が性能問題になった時点でindexを追加すればよく、F-5で二重の所在マップは導入しない。

### 2.5 CardAbility / activationTrigger

CardAbilityはimmutableで、`id / type / keywords / text / activationTrigger / conditions / costs / effects`を持つ。`activationTrigger`はnested structureを保持できるが、現在は実行解釈されない。runtime flagをCardAbilityへ追加する必要はない。LoaderはF-5Bで正式対応する限定trigger schemaだけをfail-fast validationすべきである。

### 2.6 Cost Resolver / ACT_ABILITY

Cost Resolverはtype別handlerの`validate / getDisabledReason / pay`を分離し、`PAY_STOCK`と`REST_SELF`をサポートする。`payCosts()`は全Costを事前検証した後に配列順で同期的に支払う。この「照会」と「確定後のmutation」の分離は再利用できるが、選択が必要なCostにはprepare / validateSelectionがない。

`ACT_ABILITY`はsourceを常にPlayer.stageから再取得し、MAINの親Processを必須とする。これはAUTOにコピーできない。再利用するのはProcess step/context、Rule Check後resume、Effect executionの境界であり、AUTOの起動、source参照、省略選択は別に設計する。

### 2.7 Controller / Renderer / Modal

ControllerはEngine Queryを使って選択と確定操作を中継し、RendererはGameStateをDOMへ反映する。Card detailは能力本文、ACTボタン、disabled reasonを表示できる。Resolution / Deck SearchはModal、Modal内detail、共通`CardSelectionView`、child Processの実績がある。AUTOでは選択中データをControllerだけの正本にせず、resumeに必要なselection / stepはAUTO Process contextへ置く。Controllerはindexやボタン意味をEngineへ渡すだけとする。

## 3. Proposed AUTO Architecture

```text
確定mutation完了
  → Game Eventを一回発行
  → Trigger DetectorがPRINTED / RULE候補を照合
  → matchごとにPending AUTOをappend
  → 発行元Processは次の明示Check Pointまで続行
  → Check Point coordinator
      1. Rule Checkを優先して安定化
      2. Turn PlayerのPendingから1件を提示
      3. なければNon-Turn PlayerのPendingから1件を提示
  → AUTO_ABILITY Process (WAITING_INPUT)
  → decline / playability / Cost Preparation
  → COMMIT → PAY_COST → Effect
  → Process完了後に再びCheck Point
```

Event dispatcher / DetectorはPhase Processを直接知らず、発行者はPending化の終了までを同期的に保証する。Check PointだけがAUTO Processをpushする。これにより`Event emission != AUTO resolution != Check Point`を維持する。

Event発行中にDetectorが生成したPendingは、同じmutationからの複数matchを全てappendしてから次へ進む。DetectorはEffect、Cost、renderを実行しない。

## 4. Game Event Model

### 4.1 共通契約

```js
{
  id,                 // 単調増加sequence等。Pendingとデバッグの相関用
  type,
  actorPlayerId,      // 事象を行ったPlayer。不要ならnull
  payload             // typeごとのimmutable snapshot
}
```

`id`は順序と相関のためであり、同一Abilityを重複排除するkeyではない。Event全履歴はGameStateへ永久保存しない。Pending生成後は、必要なpayload snapshotだけがPendingから参照される。オブジェクト自体をfreezeするかdeep copyするかはF-5Bで統一する。Card object参照はpayloadに入れない。

### 4.2 F-5初期の5 Event

| type | 最小payload | 発行位置候補 / 契約 |
| --- | --- | --- |
| `CARD_MOVED` | `cardInstanceId`, `cardMasterId`, `ownerId`, `from: { zone, ownerId, row?, index? }`, `to: { zone, ownerId, row?, index? }` | source collectionからremoveし、Card metadata更新、destinationへinsert / reindexまで完了した直後。`from` はremove前にlocal snapshotする |
| `CARD_POSITION_CHANGED` | `cardInstanceId`, `cardMasterId`, `ownerId`, `location`, `fromPosition`, `toPosition` | `setPosition`を含む一連のルール操作完了後。同値設定は発行しない |
| `PHASE_STARTED` | `phase`, `turnPlayerId`, `turnNumber` | phase値を更新し、そのphaseの開始時状態を確定した後。開始AUTOを取りこぼさないようPhase固有Processの実行前/後のどちらかをF-5Bテストで固定する |
| `PHASE_ENDED` | `phase`, `turnPlayerId`, `turnNumber` | 次phaseへ更新する前、終了が確定した時点。発行後のCheck Point完了までphase値を進めない |
| `ABILITY_USED` | `abilitySource`, `sourceCardInstanceId?`, `sourceCardMasterId?`, `abilityId`, `masterPlayerId` | 「使用する」が再検証され、Cost COMMITが成立した直後。確認表示やCost選択開始では発行しない |

Eventの発行カバレッジを一度に全mutationへ広げない。F-5Bは対象フローを明示し、共通mutation helperの導入が小規模で済む範囲でのみ集約する。`moveTo()`自体はGameState / collectionを知らないためEvent emitterにしない。

## 5. Trigger Detection Model

### 5.1 最小activationTrigger schema

F-5ではdiscriminated objectとし、typeごとに受理するfieldを制限する。AND / OR / NOT、任意式、コード断片は導入しない。

```js
// SELF zone change
{ event: "CARD_MOVED", subject: "SELF", fromZone: "hand", toZone: "stage" }

// another character controlled by the ability master
{ event: "CARD_POSITION_CHANGED", subject: "OTHER_YOUR_CHARACTER", toPosition: "reverse" }

// phase boundary
{ event: "PHASE_STARTED", phase: "..." }
{ event: "PHASE_ENDED", phase: "..." }

// another ability use (具体的な実在Abilityが必要になった時にfilterを追加)
{ event: "ABILITY_USED", subject: "YOUR_ABILITY" }
```

`event`をdiscriminator、`subject`をevent対象とability source / master playerの関係とする。`SELF`はinstance ID一致、`OTHER_YOUR_CHARACTER`は異なるinstance ID、対象owner/controllerが`masterPlayerId`と一致、かつCharacterであることを比較する。将来control変更が入るまではCard.ownerをcontroller相当とするが、field名は`masterPlayerId`とし、owner概念と意図的に分ける。

### 5.2 activeZonesと候補列挙

`activeZones` はCardAbilityの「通常そのsourceがどのZoneで機能するか」を表すoptionalな明示的配列として持たせてよい。ただし、**常に現在Zoneだけへ適用するfilterにはしない**。正式データではAUTOごとに省略時defaultを曖昧にせず、F-5対象Abilityに必要な値を明示する。

Detectorは次のトリガー意味上のlocationを使う。

- `SELF` + `CARD_MOVED`: Event対象のimmutable masterからAUTOを取得し、「〜から移動」は`from`、「〜へ置かれた」は`to`をsource locationとして評価する。舞台を離れた自身能力を現在のWaiting Roomの無条件走査に頼らない。
- `OTHER` / phase / ability-used系: `activeZones`ごとにPlayer collectionからsource候補を列挙し、Event発行直後の現在所在で評価する。Stage限定ならStageだけを見る。
- `RULE`: CardMaster走査ではなくRule Ability providerがEventから候補を生成する。標準アンコールは`from.zone === STAGE`であるEvent対象自身がsourceになる。

これにより、印刷AbilityとRule Abilityは候補供給元だけが異なり、以後のmatch → Pending化は共通にできる。相手のsourceも両Playerの`activeZones`を列挙し、関係判定を各sourceの`masterPlayerId`基準で行う。

### 5.3 LKI

LKIはCardの`previousLocation`ではなくEvent payloadの`from / to`、移動時の`cardMasterId / ownerId`とする。Pendingはtrigger eventの必要部分を保持するため、対象がその後何度移動しても誘発理由は変わらない。Effectが「移動前のpower」等を必要とする実例が登場したときに、そのEvent typeへ限定fieldを追加する。予測でCard全体をsnapshotしない。

## 6. Pending AUTO Model

### 6.1 推奨最小構造

```js
{
  id,                         // 誘発1回ごとの一意ID
  sequence,                   // 同じPlayerの初期表示安定性/調査用
  masterPlayerId,
  source: {
    kind: "PRINTED" | "RULE",
    cardInstanceId,
    cardMasterId,
    abilityId                 // RULEではrule ability ID
  },
  trigger: {
    eventId,
    type,
    actorPlayerId,
    payload                   // そのtypeの小さなimmutable snapshot
  }
}
```

F-5初期は`gameState.ruleState.pendingAutos`(仮称)のappend-only arrayとし、解決対象をAUTO Processにpushするときに一度だけconsumeする。選択中の対象はProcess contextの`pendingAuto`または`pendingAutoId`と必要snapshotで固定する。`status`はPendingに追加せず、queue内 = pending、AUTO Process内 = presenting/preparing/resolving、pop済み = declined/unplayable/completedと、所有場所とProcess stepで表す。監査履歴が必要にったときはlogを別途追加する。

Printed abilityは`cardMasterId + abilityId`からimmutable definitionを再取得できるため定義全体をcopyしない。ただし誘発した事実は再判定せず、解決時にsourceが移動していてもPendingは消さない。`trigger.payload.cardInstanceId / from / to`はEvent対象の後続移動に影響されない。GRANTEDは将来、付与時定義IDまたは必要最小のimmutable definition snapshotが必要になるがF-5では実装しない。

### 6.2 複数誘発とPlayer順

- match一回ごとに新しいPending IDをappendし、Ability IDのSetで重複排除しない。
- Check PointはTurn Playerの候補だけを先に提示する。同Playerで複数あれば一覧から1件を選び、残りの順序は固定しない。
- 一件の完了/辞退後は新しいCheck PointとしてRule Checkからやり直す。そのAUTOが生成した新Pendingも次回の候補になる。
- Turn Playerのqueueが空になったときだけNon-Turn Playerを提示する。両者の一括順序確定はしない。

## 7. Check Point / Rule Check Integration

### 7.1 比較

| 案 | 評価 |
| --- | --- |
| Rule Checkの外に独立AUTO Check Point系統を作る | 呼出し順の抜け、Process完了時の二重resume、Rule action前のAUTO開始が起こりやすく非推奨 |
| `pendingChecks`へAUTOを混ぜる | 既存のRule interrupt選択とAUTO選択の意味が異なる。優先順位と「使用しない」が模糊になるため非推奨 |
| 既存Rule Checkを保ったCheck Point coordinatorへ発展 | interrupt / resumeと現行の敗北優先を保ち、AUTOを安定後の次層として追加できる。**推奨** |

### 7.2 推奨方式

`runRuleCheck()`の純粋Query、`resolveRuleCheck()`のRule interrupt処理、Refresh / Penalty / Level Up Processは維持する。その上に`resolveCheckPoint()`(仮称)を置く。

```text
resolveCheckPoint()
  if GAME_OVER: stop
  result = resolveRuleCheck()
  if INTERRUPTED or WAITING_INTERRUPT_SELECTION or GAME_OVER: stop
  if turn player's pending AUTO exists: start AUTO selection Process; stop
  if non-turn player's pending AUTO exists: start AUTO selection Process; stop
  return CONTINUE
```

Rule Processが完了すると`completeCurrentProcess()`から再度`resolveCheckPoint()`を通るため、Refresh → Penalty → Level Upの反復を止めず、Ruleが安定してからAUTOを提示できる。AUTO Effect / Costの中間Check Pointも同じentry pointを使う。`pendingInterrupts`は引き続きRule処理候補だけを保持する。

F-5BではEvent / DetectionとPending生成までを単体テストで固定し、既存Check Point呼出しの全置換はF-5CでAUTO Processと同時に行う。置換時はDRAW / CLOCK / PLAY_CHARACTER / MOVE / SWAP / ACT Cost後 / ACT Effect後 / Refresh Penalty / Process共通出口の回帰をテストする。

## 8. Ability Source

`source.kind` discriminantをPendingとability descriptorに持たせる。

- `PRINTED`: `cardInstanceId + cardMasterId + abilityId`。定義はCardMasterから取得する。
- `RULE`: stableな`ruleAbilityId`とsource Card instance。CardMaster JSONにコピーせず、Rule Ability provider / registryが構造化定義を供給する。Cost / Effect handlerはPRINTEDと共通にする。
- `GRANTED`: discriminantの値と将来の解決境界だけを認識し、provider、lifetime、snapshotをF-5で実装しない。

CardAbility本体へ`source: PRINTED`を全件追加する必要はない。CardMasterから来たdescriptorは黙示的にPRINTEDとし、共通化する候補列挙境界で`source.kind`を付けるのが最小変更である。

## 9. Standard Encore [③]

標準アンコールはRule Ability providerが`CARD_MOVED`を見て、次を満たすときに一つのRULE Pendingを作る。

```text
Event対象がCharacter
AND from.zone == STAGE
AND to.zone == WAITING_ROOM
→ source.kind = RULE
→ ruleAbilityId = STANDARD_ENCORE_3
→ masterPlayerId = そのCharacterをマスターするPlayer
```

Pendingのtrigger payloadに`cardInstanceId`と元Stageの`row / index`が残るため、効果は「同じinstanceが現在Waiting Roomにいる」「元slotへ戻せる」等をplayability / effect時に別々検証できる。使用時はストック3をCOMMIT後に支払い、同じCardをWaiting Roomから元slotへ移しRESTにする。元slotが埋まった場合の正式なルール処理はF-5Dのテストと仕様で固定し、本レビューで予測実装しない。

この例ではEvent snapshot、RULE source、辞退、コスト不足、元slot LKI、再移動Eventをまとめて検証できる。ただし、標準アンコールの導入をEvent / Pending基盤より先にしない。

## 10. Playability

Trigger matchはEvent発行時に一度だけ行う。PlayabilityはPendingを表示する時と「使用する」確定直前に現在GameStateから再評価する。

```js
getPendingAutoPlayability(pendingAuto, playerId) => {
  playable: boolean,
  disabledReason: string | null
}
```

評価順は、Pending / 操作Playerの整合性、ability definitionの解決可否、必要なsource / event targetの現在状態、個別conditions、現在Cost支払可否、将来の禁止/制限とする。Effect解決時条件はそれ自体のhandlerで評価し、playabilityと混ぜない。Costに選択が必要な場合は「候補が最低数存在するか」までをplayabilityで見て、実際の対象はPreparationで決める。

Pendingが1件でも必ずProcessを`WAITING_INPUT`にして表示する。使用不可でもreasonを表示し、ユーザーの了解操作でconsumeする。`enabled` booleanをCard / CardAbility / Pendingへ保存しない。

## 11. Cost Preparation / Back / Commit

### 11.1 推奨Process

```text
PRESENT_AUTO (WAITING_INPUT: use / decline)
  → PREPARE_COST
  → WAIT_FOR_COST_SELECTION_n (WAITING_INPUT)
  → REVIEW_COST (WAITING_INPUT: back / commit)
  → COMMIT_COST                 ── 不可逆境界
  → PAY_COST
  → CHECK_POINT_AFTER_COST
  → RESOLVE_EFFECT ...
```

Process contextは例えば次を持つ。

```js
{
  pendingAuto,
  costStepIndex: 0,
  costSelections: {
    "cost-id-or-index": { cardInstanceIds: [...] }
  },
  committed: false,
  costIndex: 0,
  effectIndex: 0,
  effectResults: {}
}
```

Cost definitionがstable IDを持たない間はindexをkeyにできるが、データ上の並び替え耐性が必要にった時だけCost IDを追加する。selectionはinstance IDと選択に必要な小さな値だけとし、Card objectを保存しない。

### 11.2 Back

COMMIT前のBackはGameState mutationではなくProcess contextのカーソル操作である。`costStepIndex` を1つ戻し、戻り先より後ろのselectionを破棄する。最初のCostから戻ると`PRESENT_AUTO`に戻り、Pending自体は終了しない。「使用しない」だけがPendingをconsumeする。

### 11.3 COMMIT / PAY_COST

COMMIT操作時に全Costと全selectionを現在GameStateに対して再検証する。失敗時は一部支払いをせず、reasonを示してPreparation / Reviewに留まる。成功したら`committed = true`とし、以後Backを拒否する。`PAY_COST`で記載順にまとめてmutationし、個々のCost間にCheck Pointを挿入しない。全支払完了後にだけCheck Pointを行い、その後Effectを開始する。Undo / rollbackは行わない。

JavaScriptのmutation中に予期せぬ例外が起き部分支払になることを避けるため、handlerは`validateDefinition`、`getDisabledReason`、`getSelectionSpec / validateSelection`、`pay`の境界を持ち、`pay`は検証済みcontextで例外にならない小さなmutationにする。トランザクションやGameState cloneは作らない。

### 11.4 ACTとの共通化

共通化すべきものはCost definition / handler、非mutation照会、selection spec / validation、commit後のpayment runnerである。AUTOのPending選択、辞退、master player順序は共通Cost層へ入れない。ACTのMAIN timingもCost層へ入れない。

- F-5B: Cost Resolverを変更しない。
- F-5C: 入力不要CostでAUTO Processを成立させるに必要な最小共通インターフェースだけ切り出す。
- F-5D: 標準アンコールの`PAY_STOCK 3`は既存handler / runnerを再利用する。
- 初めて入力必要Costを実装するPhaseでPreparation / Back / Reviewを正式実装し、その時点でACTも同じcoordinatorへ移行する。標準アンコールのために入力必要Cost全体を先行実装しない。

したがって、F-5開始時の大規模なACT_ABILITY / Cost Resolver書き換えは非推奨である。

## 12. UI Responsibility

AUTO用には既存Modalの見た目とCard detail表示を再利用できるが、Rule / Process責務はRendererへ入れない。

- Engine Query: Player順を適用済みのPending一覧、選択中のAbility / source / Cost、動的playabilityとdisabled reasonを返す。
- Renderer: Pendingが1件でもModalを表示し、一覧、Card / Ability detail、Cost、reason、「使用しない」/「使用する」を描画する。使用不可時は理由を表示したうえで了解/終了を可能にする。
- Controller: Pending ID選択、use / decline、Cost対象選択、back、commitをEngineへ渡す。プレイ可否を自前判定しない。
- `CardSelectionView`: 選択表示の視覚的componentとして再利用する。Costルール、候補生成、selectionの正本は持たせない。
- Process context: 現在のCost step、selection、commit可否を保持し、render後やchild Process / Rule interrupt後もresumeできるようにする。

「使用しない」とCost入力の「戻る」は別Engine commandとしてモデル化する。Modalを閉じる操作が暗黙の辞退にならないようにする。

## 13. Phase Independence

Trigger Detector、Event dispatcher、Pending queue、Check Point coordinator、AUTO Processの起動条件に`phase === MAIN`を入れない。phaseを見るのは`PHASE_STARTED / PHASE_ENDED`のtrigger filter、または個別Abilityの明示条件だけである。現在の`PHASE_ORDER`にATTACK等があってもそのフローは未実装であるため、`ATTACK_DECLARED`等をF-5で先行定義しない。将来はEvent typeと限定matcherを追加し、同じPending / Check Pointへ流す。

## 14. Risks / Technical Debt

### BLOCKER（各該Phaseの実装をmergeする前に必須）

1. **F-5B Event契約**: typeごとのpayload、発行後の状態、1 mutation = 1 event、同値position非発行を固定する。
2. **F-5B Zone/LKI invariant**: collectionを正本とし、`from`をmutation前、`to`をmutation完了後にsnapshotする。`moveTo()`の途中発行を禁止する。
3. **F-5B Trigger schema validation**: 対応Event / subject / zone / position / phase以外をLoader境界でfail-fastし、実行範囲と受理範囲を一致させる。
4. **F-5C Check Point優先順位**: Rule Checkの安定化後にTurn Player → Non-Turn Player AUTOとし、既存Refresh / Penalty / Level Up / Defeatの回帰テストを維持する。
5. **F-5C Pendingのconsume契約**: 同一Abilityの複数誘発を保持し、Process開始/辞退/使用不可で一度だけ終了させる。

### SHOULD BEFORE RELEVANT FEATURE

1. 入力必要Costの最初の実例前に、selection spec、Backの後続selection破棄、commit直前再検証、commit後Back拒否を共通Cost境界として実装する。
2. 標準アンコール実装前に、Rule Ability provider、元slotが使用不可な場合、対象CardがWaiting Roomを離れた場合のplayabilityを固定する。
3. OTHER trigger実装前に、owner / controller / master playerのF-5時点の対応をテストし、両Playerの候補を取りこぼさない。
4. PHASE trigger実装前に、`PHASE_ENDED`の解決が完了するまでphaseを進めない契約をテストする。
5. sourceが移動するACT / AUTO Effect前に、Stage固定のACT source再取得を共通locator / immutable ability descriptorに寄せるか再評価する。

### DEFER

- GRANTED Abilityのprovider / lifetime / definition snapshot。
- CONTINUOUS Ability、禁止/制限効果の汎用framework。playabilityに将来の評価境界だけ残す。
- AND / OR / NOT、任意predicate、テキスト解析を含む巨大Trigger / Effect DSL。
- ATTACK / Damage / Battle系EventとAttack Phase実装。
- Event永久履歴、Replay / network protocol、GameState Undo / rollback。
- 性能計測で必要と判明するまでの全Card所在index。
- Pendingの全ライフサイクルstatusと完了履歴。
- 既存F-4C-1のEffect dispatcher、nested group、静的Effect Result検証の技術的負債。AUTOの最小実装と混ぜない。

## 15. Recommended F-5 Milestones

現行案は概ね妥当であり、Phaseを追加分割する必要はない。依存関係を明確にするため以下の最小な調整を推奨する。

| Phase | 推奨scope / 完了条件 |
| --- | --- |
| F-5A | 本レビューで契約とリスクを合意。実装なし |
| F-5B | 5 Eventの型/発行境界、限定activationTrigger validation / detection、PRINTED / RULE候補descriptor、Pending生成まで。**AUTO解決はしない** |
| F-5C | `pendingAutos`、Check Point coordinator、Turn / Non-Turn順、必ず提示するAUTO Process、decline / unplayable / use、入力不要CostとEffectまで。既存Check Pointの呼出し統合はここで行う |
| F-5D | RULE providerの標準アンコール[③]、元Stage slot LKI、辞退、Cost不足、Waiting Room → Stage / RESTを検証 |
| F-5E | 実在PRINTED SELF `CARD_MOVED`で入場時/離場時のtrigger-aware active zoneを検証 |
| F-5F | 実在OTHER `CARD_POSITION_CHANGED`とPHASE event、両Player source列挙を検証。このPhaseまでに必要な入力Costが実在例に含まれる場合だけ共通Preparation / Back / Commitを導入 |
| F-5G | カードID hard-codeがないこと、Event coverage、重複Pending、Rule優先順位、interrupt / resume、Phase非依存、ACT回帰を実装レビュー |

F-5BのRULE対応はprovider境界とsource descriptorまでとし、標準アンコール本体はF-5Dまで実装しない。F-5Cは複雑な入力Costを完成条件にせず、後の実在要件で拡張できるProcess step / context / commit境界を用意する。

## 16. F-5B開始時のチェックリスト

1. Event / subject / ability sourceの定数と大文字・小文字の実装表現を一つに決める。Zone値は既存`ZONE`を使い、新しい別表現を作らない。
2. Event dispatcherの戻り値と、発行中の新しいEventの扱いを固定する。F-5ではDetectionがmutationしないため、基本は同期的な1 Event単位でよい。
3. 対象フローごとに「mutation完了後に1回」をテストし、発行漏れを同一Phaseで無理に全て解消しない。
4. SELFのEvent subject候補とOTHER / PHASEの`activeZones`候補列挙を別ルートで得た後、共通matcher / Pending factoryへ流す。
5. PendingにCard object / GameState cloneを入れず、同一Abilityの2回matchが2件になるテストを先に書く。

## 17. Review Verification

レビュー時点の既存ベースラインは`62 tests / 62 pass / 0 fail`である。JavaScript構文検査と`git diff --check`も完了報告時に再実行する。本変更はこのレビュー文書のみであり、`client/js`、`client/css`、`client/data`、`client/index.html`、`client/tests`は変更しない。
