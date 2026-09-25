# AUTO能力共通設計

## 1. Phase F-5B / F-5Cの責務

```text
Game State mutation
  ↓ mutation全体の完了
Game Event確定（1つの意味的出来事につき1 Event）
  ↓
AUTO Trigger Detection
  ↓
PRINTED / RULE Ability取得（GRANTEDは識別値のみ予約）
  ↓
activationTrigger照合
  ↓
Pending AUTO生成
  ↓ F-5C
Check Timing（Rule Check安定化）
  ↓ Turn Player / Non-Turn Player
Pending AUTOを1件選択
  ↓ 必要な場合だけ共通Cost Selection
Prepared Cost最終検証
  ↓ 不可逆境界
AUTO_ABILITY Process（Cost mutation → Effect）
```

Event発生、AUTO使用可能、AUTO解決は別概念である。

```text
Trigger成立 ≠ Abilityが現在使用可能 ≠ Ability Effectが解決済み
```

F-5Cはこの移管境界と空Effectの最小Processまでを実装する。標準アンコールのStage復帰、選択対象を持つ実Cost、実カードAUTO Effectの拡張はF-5D以降である。

## 2. 公式ルール根拠

実装基準はヴァイスシュヴァルツ公式総合ルール **Ver.1.112（2026-08-24更新）** の「自動能力」「チェックタイミング」「領域移動」を扱う規定である。確認事項を実装契約へ次のように対応させる。

- 誘発条件を満たした自動能力は待機状態になるため、Event照合時にPendingを生成し、Effectは開始しない。
- Check TimingではRule Checkを先に安定させ、ターンプレイヤーの待機中AUTOを1つ選んでプレイし、再度Check Timingへ戻る。ターンプレイヤー分がなくなってから非ターンプレイヤーを同様に処理する。
- 同じPlayerの複数の待機中AUTOはそのPlayerが1つを選ぶ。`sequence`は監査用でありFIFO順を強制しない。
- 能力解決中の誘発も直ちに待機状態へ加えるが、現在の能力へ割り込ませず、その解決後のCheck Timingで候補にする。
- プレイできない待機中能力はルールに従って待機状態を取り消す。任意Costを支払わない選択とは区別し、AUTO一覧に「AUTO自体を使用しない」は置かない。
- 領域移動誘発は移動前情報を参照し得るため、Eventのimmutableな`from/to`とCard識別子をLKIとしてPendingに残す。

公式ページへのネットワーク接続が実行環境で拒否されたため、版の日付と条文内容はリポジトリでF-4/F-5A時に確認済みのVer.1.112記録とも照合した。後の版へ更新する場合は版番号だけを差し替えず、上記各契約を再照合する。

## 3. Event

共通部は`id / sequence / type / actorPlayerId / payload`。payloadはCard objectやGame State全体を含まないimmutable snapshotである。

- `CARD_MOVED`: Card instance/master/type/owner、`from/to { ownerId, zone, row, index }`
- `CARD_POSITION_CHANGED`: Card識別情報、現在location、from/to position
- `ATTACK_DECLARED`: attacker識別情報、location、attackType
- `PHASE_STARTED` / `PHASE_ENDED`: phase、turnPlayerId、turnNumber

この5種類だけをF-5Bの正式範囲とする。他Eventは必要になるPhaseで限定schemaとテストを追加する。

## 4. Candidateと照合

PRINTEDはSELF CARD eventならEvent対象instanceのCardMasterから直接取得する。OTHER / Phaseは両Playerの`activeZones`（Stage / Clock / Level / Waiting Room / Hand）だけを列挙する。Deck / Stockは通常探索しない。RULEはEventを受けるRule Ability Providerが候補descriptorを返す。

`SELF`はinstance一致、`OTHER_YOUR_CHARACTER`はsource以外、Event対象ownerとsourceのmaster player一致、Characterであることを要求する。Phaseはphase値を照合する。本文解析、カードID・カード名分岐、任意Condition式は行わない。

## 5. Pending AUTO / Collection

Pendingは誘発1回の事実であり、`id / sequence / masterPlayerId / ownerId / controllerId / source / trigger`を持つ。`source`は`kind (PRINTED | RULE)`、Card instance/master、Ability IDだけを保持する。`trigger`はEvent ID/type/actorと限定payloadを含むimmutable snapshotである。同じAbilityが異なるEventで誘発すれば別Pendingとなる。生成後にsourceが移動しても残る。

`gameState.ruleState.pendingAutos`はPlayer別ではない単一`PendingAutoCollection`（array）で、`pendingChecks`と分離する。これはQueueではない。追加時は末尾へ保存するが、選択はID指定であり`sequence`順を強制しない。Check Timingは`masterPlayerId`で候補を抽出する。PendingはAUTO Processへの移管時にだけ1件consumeし、単なるsource移動では削除しない。

## 6. Check Timing / Process

`resolveCheckPoint()`は既存`resolveRuleCheck()`を呼ぶcoordinatorであり、Rule処理を複製しない。Ruleが安定した後、Turn Player、Non-Turn Playerの順に候補の有無を毎回最新Stateから判定し、`PENDING_AUTO / WAITING_INPUT`をpushする。1件でも必ず選択UIを表示する。

選択後は、選択対象が必要なCostだけ`SELECT_COST`へ進む。戻る場合は`preparedCosts`を破棄し、mutationせず、Pendingも消費しない。選択不要なら空Modalを出さず最終再検証へ進む。

```text
PENDING_AUTO: SELECT_AUTO → (必要時 SELECT_COST) → 最終再検証
──────── Pending / reversible ────────
PendingをconsumeしてAUTO_ABILITYへ移管
──────── AUTO / irreversible ────────
AUTO_ABILITY: PAY_COST → RESOLVE_EFFECT → COMPLETE → Check Timing
```

AUTO解決中のEvent dispatcherは停止しない。追加Pendingは単一Collectionへ入る一方、`resolveCheckPoint()`は現在の`AUTO_ABILITY`へ別AUTOを割り込ませない。完了後にB/C/D全体を再提示する。

## 7. 共通Cost Selection / Prepared Cost

`prepareCostSelections()`と`getPreparedCostsDisabledReason()`はACT/AUTO共通のCost Resolverに置く。Prepared項目は最低限`costIndex / costType`とhandler固有の選択値（将来の`selectedCardInstanceIds`等）を持つ。選択はStateを変更しない。確定時と`payCosts()`直前に現在Stateで再検証し、全Cost検証後だけ記載順にmutationする。現行ACT Costは`PAY_STOCK / REST_SELF`だけで、Engineが対象を一意に決められ、ユーザー対象選択はまだない。

## 8. UI責務

RendererはProcessと単一Collectionからカード名、能力本文、keyword、Cost、選択状態を表示するだけで、ControllerはPending ID / Prepared CostをEngineへ渡す。正本はDOMに置かない。AUTO選択には「自動効果を使用しない」を置かず、Cost選択だけ「効果選択に戻る」を提供する。

## 9. 標準アンコール / 将来範囲

`STANDARD_ENCORE_3`はRULE sourceであり、全CardMasterへコピーしない。CharacterのStage → Waiting RoomだけでPendingを生成する。元Stage row/indexはEvent LKIに残す。3 StockとStageへのREST復帰を一体として扱う完全解決はF-5D以降で実装する。GRANTED source、選択Cost handler、大量のAUTO Effect DSLもF-5Cの対象外である。
