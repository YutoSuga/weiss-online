# JavaScriptモデル仕様

## ディレクトリ

```text
client/js/
├── constants/
│   ├── phase.js
│   └── zone.js
├── models/
│   ├── card.js
│   ├── cardMaster.js
│   ├── cardMasterRegistry.js
│   ├── deck.js
│   ├── player.js
│   └── gameState.js
├── core/
└── ui/
```

- `models`: 対戦データを表すクラス
- `constants`: 複数のモデルや将来のゲーム処理で共有する定数
- `core`: 将来のGameEngine、Rendererなど
- `ui`: 将来の画面操作、カード詳細表示など

## 基本方針

モデルを対戦状態の正本とし、DOMを状態の正本にはしません。
将来のRendererはモデルの状態をHTMLへ反映し、GameEngineはルールに従ってモデルを更新します。

```text
ユーザー操作
  → GameEngine
  → GameState / Player / Card
  → Renderer
  → HTML
```

## import例

```js
import { PHASE } from "./client/js/constants/phase.js";
import { ZONE } from "./client/js/constants/zone.js";
import { Card, FACE, POSITION } from "./client/js/models/card.js";
import { Deck } from "./client/js/models/deck.js";
import { Player } from "./client/js/models/player.js";
import { GameState } from "./client/js/models/gameState.js";
```

## Card（F-2時点の旧構造）

F-2時点ではカード1枚の固定情報と現在状態を同居させていました。

- 固定情報: `id`, `name`, `cardType`, `level`, `cost`, `color`,
  `basePower`, `baseSoul`, `trigger`, `traits`, `text`
- 現在状態: `owner`, `zone`, `row`, `index`, `face`, `position`,
  `currentPower`, `currentSoul`

`trigger` と `traits` は外部配列から独立させるため、コンストラクタと
`toJSON()` の両方でコピーします。

F-3Aで固定情報をCardMasterへ分離済みです。現在の実装仕様は本書末尾と[CardMaster / CardAbility設計](カードデータモデル.md)を参照します。

## Deck

`cards[0]` を山札の一番上として扱います。

- `draw()`
- `shuffle()`
- `peek()`
- `addTop()`
- `addBottom()`

## Player

プレイヤー情報、`Deck`、各ゾーンのカード配列を保持します。
ゾーン配列は実際にカードが置かれた順を維持し、後から置かれたカードほど
配列の後ろへ追加する方針です。描画時の重なり順はRendererがこの順序から決定します。

## GameState

対戦全体の状態を保持します。

- `players`: `{ self, opponent }`
- `room`: `{ id, name, host, guest, status }`
- `turn`: `{ player, number }`
- `phase`
- `log`: `{ time, player, message }[]`
- `effectQueue`: 将来の解決待ち効果用（現時点ではTODO）

`self` と `opponent` は画面上の役割です。通信時に各ユーザーから見た役割へ
変換する処理は、将来の通信・ゲーム進行層で担当します。

## CardMaster / CardAbility / CardMasterRegistry / Card（F-3B実装）

`CardMaster`は`id`, `cardNumber`, `name`, `cardType`, `color`, `imageUrl`, `level`, `cost`,
`basePower`, `baseSoul`, `triggerIcons`, `traits`, legacy / transitionalな`text`, `abilities`を保持する。配列をコピーしてfreezeし、本体もfreezeする。`abilities`省略時は空配列で、plain objectは`CardAbility`へfail-fastに変換する。同一master内のability ID重複は拒否する。

`CardMasterRegistry`はメモリ上だけのlookupであり、`register(master)`, `get(masterId)`,
`has(masterId)`, `getAll()`を提供する。重複登録と未登録IDの取得はErrorとし、`getAll()`は
freezeした新しい配列を返す。fetchや永続化は担当しない。

`Card` constructorは`instanceId`, `masterId`, `masterRegistry`を明示的に受け、生成時に
Masterをfail-fastで解決する。`id`は`instanceId`の互換getterである。固定情報は
`cardNumber`, `name`, `cardType`, `color`, `imageUrl`, `level`, `cost`, `basePower`, `baseSoul`,
`triggerIcons`, 互換用`triggers` / `trigger`, `traits`, `text`, `abilities`のgetterで提供する。`currentPower` / `currentSoul`は
未指定時だけMasterの基本値で初期化し、明示値`0`や`null`を保持する。

`toJSON()`はMaster固定情報を含めず、instance ID、master ID、owner、zone、row、index、
face、position、currentPower、currentSoul、visibilityOverrideのみを返す。`fromJSON(data,
masterRegistry)`は注入されたRegistryからMasterを解決する。

`imageUrl`は空でないstringまたは`null`であり、Card JSONには保存しない。Rendererの詳細表示はCardだけを入口にし、Power/Soulのcurrent値、triggerIcons、traits、`CardAbility.type/text`を表示する。Registryの直接参照、CardMaster.textによる能力表示、構造化Abilityデータの解釈は行わない。


### CardAbility

`ABILITY_TYPE`は`client/js/constants/ability.js`に`CONTINUOUS` / `AUTO` / `ACT`を定義し、未知値を拒否する。`CardAbility`は`id`, `type`, `keywords`, `text`, `activationTrigger`, `conditions`, `costs`, `effects`を保持する。`text`は人間向けの表示原文で、残る4フィールドは後続Phaseの処理用構造化データである。F-3Bはschema列挙や実行処理を実装しない。

入力したplain object / arrayは再帰的にcopyしてfreezeし、元データ変更の影響とnested変更を防ぐ。本体もfreezeする。能力には`used`等のruntime状態を置かない。`activationTrigger`は能力発動契機で、カード印刷上の`CardMaster.triggerIcons`とは別概念である。同種処理の共通化はCardAbility object共有ではなく、F-4以降に処理タイプと実行処理で行う。`Card.toJSON()`には能力固定情報を含めず、復元後にRegistryのmasterから参照する。

## CardMasterLoader / DeckDefinition（F-3C実装）

`constants/triggerIcon.js`の`TRIGGER_ICON`が正式なトリガー値を列挙する。`CardMaster`は各`triggerIcons`を検証し、空配列と同値の複数要素を許可する。

`data/cardMasterLoader.js`はCardMaster plain object配列の取得・必須項目と重複IDの検証・`CardMasterRegistry`構築を担当する。`models/deckDefinition.js`は`id`, `name`, `{ masterId, count }[]`を入力から独立させてfreezeする。枚数などの構築ルールは持たない。`data/deckDefinitionLoader.js`はJSON取得と、Definition + Registryから`Card[]`を生成する。未知masterは拒否し、同じmasterのcopyおよびself/opponentには重複しない`instanceId`を割り当てる。
