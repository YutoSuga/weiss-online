Summary
F-3Bを完了扱いにしました。 CardAbilityデータ構造の実装・テスト・設計書更新を行い、READMEの現在地点をF-3B完了、次PhaseをF-3Cへ更新しました。

新規作成ファイル

client/js/constants/ability.js

client/js/models/cardAbility.js

client/tests/cardAbility.test.mjs

変更ファイル

client/js/models/cardMaster.js

client/js/models/card.js

client/js/data/testCardLoader.js

client/tests/cardMaster.test.mjs

README.md

docs/設計書一覧.md

docs/１．設計書/システム共通/カードデータモデル.md

docs/１．設計書/システム共通/エンティティ・オブジェクト一覧.md

docs/１．設計書/システム共通/アーキテクチャ.md

docs/１．設計書/システム共通/JavaScript仕様.md

Implementation details
CardAbilityの最終構造

id

type

keywords

text

activationTrigger

conditions

costs

effects

keywords、conditions、costs、effectsは配列として検証され、activationTriggerはデフォルトでnullを許容します。

ABILITY_TYPE

client/js/constants/ability.jsに、freeze済み定数として次の3種類を定義しました。

CONTINUOUS

AUTO

ACT

CardAbility生成時に定義済み値との照合を行い、未知のtypeは受信値を含むRangeErrorでfail-fastします。

Immutability

CardAbility本体はObject.freeze()しています。

plain objectとarrayを再帰的にコピーしてfreezeする、小さな内部ヘルパーを実装しました。これにより、nested object/arrayの変更、循環参照、非plain objectを拒否します。

constructorへ渡した元の配列・objectとは独立したコピーになるため、生成後に入力元を変更しても能力定義へ影響しません。

CardMasterとの所有関係

CardMaster.abilitiesがCardAbility[]を直接包含します。

abilities省略時は空配列になります。

CardAbility instanceはそのまま保持し、plain objectはCardMaster constructor境界でCardAbilityへ変換します。不正なplain objectは配列indexを含むErrorで拒否します。

CardMaster自身やCardAbility自身にはfetch責務を持たせていません。F-3CのJSON loaderからplain objectを渡せる一方、最終状態は必ずCardAbilityになります。

CardAbility.idの一意性

CardMaster生成時にSetでabilities内のIDを検査し、同一CardMaster内の重複をErrorにしています。

Registryやglobal IDは導入していないため、異なるCardMaster間で同じability IDを使用できます。

triggers → triggerIcons

CardMasterの正式フィールドをtriggerIconsへ変更しました。

移行互換としてlegacyなtriggers constructor引数を受け付けますが、triggerIconsとの同時指定は曖昧さを避けるため拒否します。

CardMaster.triggersはdeprecated互換getterとして残しています。

暫定test-cards.jsonは変更せず、既存のtriggerをloaderでtriggerIconsへ変換します。

Card compatibility

正式APIのcard.triggerIconsを追加しました。

既存のcard.triggerとcard.triggersは引き続き同じmaster.triggerIconsを返します。

card.abilitiesはコピーせず、master.abilitiesを直接参照します。

CardMaster.text / CardAbility.text

CardMaster.textはF-3Bでもlegacy / transitionalな固定情報として維持し、flavorTextへの意味変更は行っていません。

CardAbility.textは人間向け表示原文です。GameEngine用の構造化データはactivationTrigger、conditions、costs、effectsへ分離しました。

構造化データの実装範囲

F-3Bでは構造化データをimmutableに保持できるところまで実装しました。

Trigger、Condition、Cost、Effectの具体的なenum、評価器、executor、ability engine、effectQueue接続、ProcessManager連携は実装していません。

Serialization

Card.toJSON()は従来どおりinstance ID、master ID、owner、zone、位置・表示、現在Power/Soulのみを返します。abilitiesや能力構造化データは含めていません。

Card.fromJSON()はRegistryを使ってmasterを再解決するため、復元後も同じmaster.abilitiesを参照できます。

テスト

3種類のability type、unknown type拒否、全フィールド保持、activationTrigger=nullを検証しました。

本体・配列・nested objectのimmutabilityと、constructor入力からの独立性を検証しました。

abilitiesデフォルト、plain object変換、配列freeze、同一master内のID重複拒否、別masterでの同一ID許可を検証しました。

trigger互換getter、card.abilities参照、serialization非包含、復元後のabilities参照を検証しました。

F-3AのRegistry、unknown master、0値復元、serialization、独立Card instanceなど既存テストも引き続き成功しています。

ドキュメント

CardMasterからCardAbilityへの直接包含、immutable境界、IDスコープ、triggerIconsとactivationTriggerの違い、runtime状態を持たない方針、F-4以降への実行処理先送りを設計書へ反映しました。

エンティティ一覧とアーキテクチャ上でもF-3B実装済みとして更新しました。

JavaScript仕様へ実際のconstructor変換、getter、deep-freeze方針を反映しました。

Git / PR

13ファイル、293 insertions、310 deletionsの変更をコミットしました。

Commit: 8643330 Implement Phase F-3B CardAbility data model

最終git status --shortは空で、working treeはcleanです。

Pull request metadataもタイトル “Implement Phase F-3B CardAbility data model” で作成済みです。

Testing
✅ node --test client/tests/*.test.mjs — 10 tests passed、0 failed。F-3B固有テストとF-3A回帰テストを含みます。

✅ find client/js -name '*.js' -print0 | xargs -0 -n1 node --check — 全JavaScriptファイルの構文チェックに成功しました。

✅ git diff --check — whitespace errorはありません。

✅ git status --short — コミット後のworking treeがcleanであることを確認しました。
