Summary
1. 新規作成したファイル
client/js/models/cardMaster.js

カード種類ごとの固定情報を保持する、immutableなCardMasterを追加しました。

最終構造はid、cardNumber、name、cardType、color、level、cost、basePower、baseSoul、triggers、traits、textです。

triggersとtraitsは外部配列をコピーしてfreezeし、CardMaster本体もfreezeしています。

client/js/models/cardMasterRegistry.js

読み込み済みCardMasterだけを管理するインメモリRegistryを追加しました。

register(master)、get(masterId)、has(masterId)、getAll()を実装しました。

duplicate ID登録とunknown master ID取得を、原因の分かるErrorでfail-fastさせています。

getAll()はfreeze済みの新しい配列を返し、Registry内部のMapを外部から破壊できないようにしました。

client/tests/cardMaster.test.mjs

CardMasterのimmutability、Registry API、Cardのgetter・初期化・fail-fast、serialization、暫定ローダーと100枚のinstance ID一意性を自動確認するテストを追加しました。

2. 変更したファイル
client/js/models/card.js

client/js/data/testCardLoader.js

client/js/main.dev.js

README.md

docs/設計書一覧.md

docs/１．設計書/システム共通/カードデータモデル.md

docs/１．設計書/システム共通/エンティティ・オブジェクト一覧.md

docs/１．設計書/システム共通/アーキテクチャ.md

docs/１．設計書/システム共通/JavaScript仕様.md

client/data/test-cards.jsonは変更しておらず、既存の暫定schemaを維持しています。

3. CardMasterの最終構造
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
idはweiss-online内部のMaster IDです。

cardNumberは実カード番号と区別し、既存暫定データではnullです。

textはlegacy / transitionalな固定情報のまま保持し、flavorTextへ意味変更していません。

abilitiesおよびCardAbility構造はF-3B対象として、今回実装していません。

4. CardMasterRegistryの最終API
register(master)

get(masterId)

has(masterId)

getAll()

RegistryはJSON fetch、localStorage、IndexedDB、API、DBなどを一切担当しません。設計書にも永続ストレージではないこと、duplicate/unknown IDの扱いを明記しました。

5. Cardの変更前後の責務
変更前: 固定情報と対戦中runtime情報を同じCard objectで直接保持。

変更後: CardはinstanceId、masterId、owner・zone・位置・表示状態・現在Power/Soulといった対戦中runtime状態を担当し、固定情報は生成時にRegistryから解決したCardMasterを参照します。

GameEngineとRendererのルールロジックは変更せず、既存のCard APIをgetterで維持しました。

6. instanceId / masterId / card.id
instanceId: 対戦中の物理的な1枚を識別する正式ID。

masterId: 参照先となるCardMaster.id。

card.id: instanceIdを返す既存互換getter。

instanceId、masterId、解決済みmaster参照は生成後に差し替えられないプロパティとして定義しています。

7. compatibility getter一覧
以下をCardMaster参照のgetterとして提供しています。

id

cardNumber

name

cardType

color

level

cost

basePower

baseSoul

triggers

trigger

traits

text

旧名称card.triggerと正式名称card.triggersの両方が、CardMasterのtriggersを返します。

8. currentPower / currentSoulの初期化
未指定の場合だけ、それぞれmaster.basePower、master.baseSoulから初期化します。

明示的に渡された値を優先します。

0やnullをfallback扱いしないよう、=== undefinedで未指定判定しています。

9. 実際のカード生成フロー
test-cards.json
  ↓ fetch・必須項目・definition ID重複validation
testCardLoader
  ↓ trigger → triggersの暫定変換
CardMaster
  ↓ register
CardMasterRegistry
  ↓ Registryを明示注入
self / opponent用Card instances
  ↓
Deck
現行JSONのtriggerをCardMasterのtriggersへadapter変換します。

全定義を1つのRegistryへ登録します。

owner・definition ID・copy番号から一意なinstanceIdを生成し、RegistryをCardへ注入します。

self/opponentはCardMasterを共有しますが、Card instanceはそれぞれ独立しています。

10. serialization仕様
Card.toJSON()は次のruntime情報だけを返します。

instanceId
masterId
owner
zone
row
index
face
position
currentPower
currentSoul
visibilityOverride
CardMaster、カード名、Level、Costなどの固定情報は埋め込みません。

Card.fromJSON(data, masterRegistry)はRegistryを明示的に受け取り、data.masterIdを解決してCardを復元します。

11. fail-fastを入れた箇所
CardMasterRegistryへのCardMaster以外の登録。

同一CardMaster IDの重複登録。

未登録master IDの取得。

Card生成時のRegistry未注入・不正Registry。

Card生成時およびfromJSON()時のunknown master ID。

暫定test-cards定義の不足項目・definition ID重複。

test deck生成時のRegistry未注入。

12–13. テストおよびF-2Cまでの回帰確認
F-3A固有テスト6件はすべて成功しました。CardMaster、Registry、Card getter、0を含むruntime復元、serialization、self/opponentの独立Deckと100個の一意なinstance IDを確認しています。

全JavaScriptファイルの構文チェックに成功しました。

GameEngineやRendererのルールロジックは変更していません。従来参照していたcard.id、card.level、card.cost、card.color、card.cardType、card.nameなどは互換getterで維持しているため、MAIN Play、Replacement、Move / Swap、Rule Check、Process interrupt / resumeの既存呼び出し境界を保持しています。

ブラウザ自動操作基盤がリポジトリ内にないため、画面操作のE2Eテストやスクリーンショットは実施していません。今回の変更は表示変更ではなく内部データモデル変更です。

14. ドキュメント更新
READMEの現在地点をF-3A完了へ進め、ロードマップの次PhaseをF-3Bに更新しました。

暫定JSONからCardMaster・Registry・Card instanceを作る現在のフローをREADMEへ反映しました。

カードデータモデル設計書へ、実装済み構造、immutability、Registry API、serialization、textの暫定的意味を反映しました。

設計書一覧、エンティティ一覧、アーキテクチャ、JavaScript仕様もF-3A実装状態に更新しました。

15–17. Git・Phase状況
コミット: 7ee3c71 feat: separate CardMaster from Card instances

差分概要: 12ファイル、526行追加、291行削除。

最終git status: clean。

指定どおりcommit後にPR情報を作成済みです。

F-3Aは完了扱いに更新しました。

**次PhaseはF-3B「CardAbilityデータ構造」**です。

Testing
✅ node --experimental-default-type=module --test client/tests/cardMaster.test.mjs

✅ for f in $(find client/js -name '*.js' -type f -print); do node --experimental-default-type=module --check "$f" || exit 1; done

✅ git diff --check

✅ git status --short --branch

⚠️ ブラウザE2E操作テスト／スクリーンショット（リポジトリ内にブラウザ自動操作基盤がなく、今回の変更も画面表示ではなく内部データモデル変更のため未実施）
