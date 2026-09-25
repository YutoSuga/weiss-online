# AUTO能力

## 1. Phase F-5Bの責務

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
  ↓
F-5Bではここで終了
```

Event発生、AUTO使用可能、AUTO解決は別概念である。

```text
Trigger成立 ≠ Abilityが現在使用可能 ≠ Ability Effectが解決済み
```

F-5Bは提示UI、使用/不使用、順番選択、Playability、Cost Preparation / COMMIT、Effect、標準アンコールの支払いと復帰を実装しない。

## 2. Event

共通部は`id / sequence / type / actorPlayerId / payload`。payloadはCard objectやGame State全体を含まないimmutable snapshotである。

- `CARD_MOVED`: Card instance/master/type/owner、`from/to { ownerId, zone, row, index }`
- `CARD_POSITION_CHANGED`: Card識別情報、現在location、from/to position
- `ATTACK_DECLARED`: attacker識別情報、location、attackType
- `PHASE_STARTED` / `PHASE_ENDED`: phase、turnPlayerId、turnNumber

この5種類だけをF-5Bの正式範囲とする。他Eventは必要になるPhaseで限定schemaとテストを追加する。

## 3. Candidateと照合

PRINTEDはSELF CARD eventならEvent対象instanceのCardMasterから直接取得する。OTHER / Phaseは両Playerの`activeZones`（Stage / Clock / Level / Waiting Room / Hand）だけを列挙する。Deck / Stockは通常探索しない。RULEはEventを受けるRule Ability Providerが候補descriptorを返す。

`SELF`はinstance一致、`OTHER_YOUR_CHARACTER`はsource以外、Event対象ownerとsourceのmaster player一致、Characterであることを要求する。Phaseはphase値を照合する。本文解析、カードID・カード名分岐、任意Condition式は行わない。

## 4. Pending AUTO

Pendingは誘発1回の事実であり、`id / sequence / masterPlayerId / ownerId / controllerId / source / trigger`を持つ。`source`はkind、Card instance/master、Ability IDだけを保持する。同じAbilityが異なるEventで誘発すれば別Pendingとなる。生成後にsourceが移動しても残る。

`gameState.ruleState.pendingAutos`は`pendingChecks`と分離したappend-only queueである。F-5Cでconsume契約とCheck Point coordinatorを追加するまで、Engine / testから内容を確認するだけとする。

## 5. 標準アンコール

`STANDARD_ENCORE_3`はRULE sourceであり、全CardMasterへコピーしない。CharacterのStage → Waiting RoomだけでPendingを生成する。元Stage row/indexはEvent LKIに残す。3 Stock、使用確認、StageへのREST復帰はF-5D以降で実装する。
