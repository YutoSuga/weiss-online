YutoSuga/weiss-online に Phase F-3D を実装してください。

# Phase名

F-3D: Card表示・詳細表示の正式データモデル対応

F-3AではCardMasterとCardを分離し、
F-3BではCardAbilityデータ構造を導入し、
F-3Cでは正式なCardMaster JSON、CardMasterLoader、CardMasterRegistry、
DeckDefinition、開発用50枚Deckのデータフローを整備しました。

F-3Dでは、これらの正式データモデルを
「対戦画面上のCard表示」と「右上のカード詳細表示」へ正式に反映してください。

ただし、F-3DはAbility実行Phaseではありません。
カードの固定情報・runtime情報・画像・Ability textを正しく表示できる状態を完成させることが目的です。


# 0. 最初に必ず既存実装を確認する

実装前に、少なくとも以下を確認してください。

- README.md
- docs/設計書一覧.md
- docs/１．設計書/カードデータモデル.md
- docs/１．設計書/エンティティ・オブジェクト一覧.md
- docs/１．設計書/アーキテクチャ.md
- docs/１．設計書/JavaScript仕様.md
- docs/１．設計書/UI操作.md
- docs/１．設計書/レイアウト.md

および現在の、

- Card
- CardMaster
- CardMasterRegistry
- CardAbility
- ABILITY_TYPE
- Renderer
- MainPhaseController等のController
- visibility関連実装
- card-masters.json
- CardMasterLoader
- main.dev.js
- 現在の右上カード詳細UI
- 盤面上のCard描画
- F-3A / F-3B / F-3Cのテスト
- その他既存JSテスト

を確認してください。

既存Renderer／詳細UIの実装方法を確認したうえで、
必要以上にDOM構造やCSSを変更しないでください。

既存のゲームロジックや盤面レイアウトを壊さないことを優先してください。


# 1. F-3Dの基本方針

F-3Dでの表示データフローは以下とします。

CardMaster
 ├─ 固定情報
 ├─ imageUrl
 └─ CardAbility[]
       ↓
      Card
 ├─ CardMasterへの委譲getter
 └─ runtime情報
       ↓
    Renderer
       ↓
対戦画面 / 右上カード詳細

重要：

Rendererは基本的にCardだけを受け取る設計を維持してください。

Rendererが、

card.masterId
↓
CardMasterRegistry.get(...)
↓
CardMaster

のようにRegistryを直接引き直す設計にはしないでください。


# 2. RendererのCard参照方針

RendererはCardを入口にしてください。

概念：

renderCard(card)
renderCardDetail(card)

固定情報はCardのCardMaster委譲getterから取得します。

例：

card.name
card.cardType
card.color
card.level
card.cost
card.basePower
card.baseSoul
card.triggerIcons
card.traits
card.abilities
card.imageUrl

runtime情報はCard自身から取得します。

例：

card.currentPower
card.currentSoul
card.position
card.face
card.zone

責務は以下です。

Renderer
→ Cardを知る

Card
→ CardMasterを知る

Renderer
→ CardMasterRegistryを直接知らない

この境界を維持してください。


# 3. CardMaster.imageUrlを追加する

CardMasterの固定情報として、

imageUrl

を追加してください。

imageUrlは、

string URL
または
null

を扱えるようにしてください。

例：

{
  "imageUrl": null
}

または、

{
  "imageUrl": "https://example.com/card.png"
}

CardMasterはF-3A/F-3B/F-3Cで確立したimmutable方針を維持してください。

Card側には、

card.imageUrl

で取得できるCardMaster委譲getterを追加してください。


# 4. imageUrlはruntime serializationへ重複保存しない

imageUrlはCardMasterの固定情報です。

そのため、

Card.toJSON()

のruntime serializationへimageUrlを埋め込まないでください。

既存方針どおり、

Card JSON
→ masterId + runtime state

CardMaster
→ 固定情報

という分離を維持してください。

Card.fromJSON(data, masterRegistry)

で復元したCardは、
Registryから解決したCardMaster経由でimageUrlを参照できる状態にしてください。


# 5. 右上カード詳細の画像表示

F-3Dで画像表示を正式対応する主対象は、

「右上のカード詳細表示」

です。

以下のルールとしてください。

imageUrl === null
→ 共通placeholder表示

imageUrlあり + 正常に読み込める
→ CardMaster.imageUrlの画像を表示

imageUrlあり + 画像ロード失敗
→ 共通placeholderへfallback

placeholderではURLや画像ファイル名を表示しないでください。

例えば、

「画像なし」
または
「No Image」

程度の共通表示で構いません。

placeholderの具体的なデザインは、
既存UIに馴染むシンプルなものにしてください。


# 6. 画像の縦横比

右上カード詳細では、
画像本来の向き・アスペクト比を維持してください。

縦長画像
→ 縦長のまま表示

横長画像
→ 横長のまま表示

固定の縦長比率へ無理に変形しないでください。

object-fit: contain

等を利用し、
詳細表示用の領域内に画像全体が収まるようにしてください。

画像の元解像度によって右上詳細欄全体のレイアウトが大きく変化しないようにしてください。


# 7. 開発用の縦長画像

F-3Cで作成した仮想CardMasterのうち、
CHARACTER等の縦長画像確認用として1種類に以下のimageUrlを設定してください。

https://ws-tcg.com/wordpress/wp-content/images/cardlist/k/kxx_we50/kch_we50_52sp.png

これは開発表示確認用データです。

このURLをRenderer、CSS、Cardクラス等へハードコードしないでください。

card-masters.jsonのCardMasterデータとしてのみ保持してください。


# 8. 開発用の横長画像

横長カード、主にCLIMAXカードの詳細表示確認用として、
適切な仮想CardMaster 1種類に以下のimageUrlを設定してください。

https://ws-tcg.com/wordpress/wp-content/images/cardlist/k/kch_w78/kch_w78_119r.png

右上カード詳細では、
この画像を横長のまま表示してください。

縦長カード用の表示枠へ画像そのものを変形させないでください。

このURLについても、
Renderer等へハードコードせず、
card-masters.jsonのデータとしてのみ保持してください。


# 9. imageUrl=nullのCardMasterも残す

すべてのCardMasterへ画像URLを設定しないでください。

開発用CardMasterには、

- 縦長画像あり
- 横長画像あり
- imageUrl=null

の3パターンが存在する状態にしてください。

これによって同じ開発環境で、

1. 縦長画像表示
2. 横長画像表示
3. placeholder表示

を確認できるようにしてください。

また、自動テスト等で可能であれば、

4. URLありだが画像ロード失敗 → placeholder

も確認してください。


# 10. 盤面・手札等のカード画像方向制御は今回やらない

重要なNon-goalです。

今回決める、

縦長画像
→ 縦長表示

横長画像
→ 横長表示

という仕様は、
「右上カード詳細表示」に対する仕様です。

手札や盤面等については、
将来的に、

- Cardの元画像方向
- zone
- self / opponent
- STAND
- REST
- REVERSE

等を考慮して表示方向を設計する予定です。

F-3Dではこの問題を先取りしないでください。

特に、

card.cardType === "CLIMAX"
だから盤面上で自動的に回転する

等の新しい盤面方向制御は実装しないでください。

既存の盤面／手札表示挙動を維持してください。


# 11. 右上カード詳細に表示する情報

右上のカード詳細は、
対戦中にユーザーが必要とする情報を中心にしてください。

基本的に以下を表示してください。

- カード画像
- カード名
- カード種類
- 色
- Level
- Cost
- Power
- Soul
- Trigger Icons
- Traits
- Abilities

既存UIの構造・デザインを尊重しつつ、
見やすく整理してください。


# 12. cardNumberは表示しない

CardMaster.cardNumberは正式データとして保持しますが、
対戦中の右上カード詳細には表示しないでください。

同様に、

masterId
instanceId

等の内部識別子も通常のカード詳細には表示しないでください。

DEV UIで必要になる場合は別責務です。


# 13. Power表示

Powerは現在値を主として表示してください。

CardMaster：

basePower

Card runtime：

currentPower

という意味の違いを維持します。

currentPower === basePower

の場合：

1500

のように現在値のみ表示してください。

currentPower !== basePower

の場合：

2000（元1500）

のように、

現在値（元の印刷値）

が分かる形式で表示してください。

例えば、

basePower = 1500
currentPower = 2000

なら、

2000（元1500）

です。

将来のPower増減能力へそのまま利用できる表示構造にしてください。


# 14. Soul表示

SoulもPowerと同じ考え方としてください。

baseSoul
→ CardMasterの印刷値

currentSoul
→ Cardの現在値

currentSoul === baseSoul

なら、

1

currentSoul !== baseSoul

なら、

2（元1）

のように表示してください。

F-3DではSoulを変更する能力そのものは実装しません。


# 15. abilitiesを正式にカード詳細へ表示する

F-3Bで導入した、

card.abilities

を右上カード詳細へ表示してください。

F-3Dでは「表示のみ」です。

CardAbility.typeとCardAbility.textを利用し、

CONTINUOUS
→ 【永】

AUTO
→ 【自】

ACT
→ 【起】

のように表示してください。

例：

【永】能力テキスト...

【自】能力テキスト...

【起】能力テキスト...

能力の人間向け表示には、

CardAbility.text

を使用してください。


# 16. RendererはAbilityの構造化データを解釈しない

Rendererが以下を解析して、
能力テキストを再構築する設計にはしないでください。

- activationTrigger
- conditions
- costs
- effects

F-3DのRendererに必要なのは基本的に、

ability.type
ability.text

です。

conditions/costs/effects等は、
F-4以降のゲームロジック用構造化データです。


# 17. 複数Abilityへ対応する

CardMaster.abilitiesは配列なので、

0件
1件
複数件

すべて自然に表示できるようにしてください。

例：

【永】能力1...

【自】能力2...

【起】能力3...

abilities=[]の場合もUIが壊れないようにしてください。

必要であれば開発表示確認用の仮想CardMaster 1種類に、
F-3BのCardAbility schemaに従った表示確認用Abilityを追加して構いません。

ただし能力を実行可能にする必要はありません。

表示確認用Abilityを追加する場合も、
conditions/costs/effectsの実行処理は追加しないでください。


# 18. CardMaster.textは対戦詳細表示に使用しない

既存の、

CardMaster.text

はlegacy / transitional fieldとして残っています。

F-3Dの対戦用カード詳細では、
CardMaster.textを能力表示に使用しないでください。

能力表示の正式経路は、

CardMaster
↓
abilities[]
↓
CardAbility.text

です。

ただしF-3Dでは、

CardMaster.textの削除
flavorTextへの改名
意味の再定義

等は行わないでください。

既存compatibilityを維持してください。


# 19. visibilityを必ず維持する

既存のvisibilityルールを維持してください。

現在の、

VISIBILITY.PUBLIC
VISIBILITY.OWNER_ONLY
VISIBILITY.OPPONENT_ONLY
VISIBILITY.HIDDEN

およびzoneごとのvisibilityルールを確認してください。

画像対応によって、

「本来非公開のCardなのに、画像やカード詳細から内容が分かる」

という情報漏れを発生させないでください。

Rendererは既存visibility判定を尊重し、
閲覧者に公開してよいCardに対してのみ、

- imageUrl
- name
- level
- cost
- power
- soul
- triggerIcons
- traits
- abilities

等の内容を表示してください。

非公開CardではCardMaster由来の実画像を表示しないでください。


# 20. 盤面上のCard表示を大規模変更しない

F-3Dの名称には「Card表示」も含まれますが、
今回の中心は正式データモデルへの対応と右上カード詳細です。

盤面上のCardについては、
既存レイアウト・既存visibility・既存状態表示を壊さないことを優先してください。

画像対応のために、

- Stage
- Hand
- Clock
- Level
- Climax
- Stock
- Waiting Room
- Memory
- Deck

等のレイアウトを大規模に作り直さないでください。

盤面・手札等での画像方向制御は別途設計します。


# 21. F-3DではAbilityを実行しない

F-3Dは、

CardAbility
↓
Card
↓
Renderer
↓
Ability text表示

までです。

以下はF-3Dの対象外です。

- AbilityEngine
- AbilityExecutor
- ACT Ability実行
- AUTO Ability実行
- CONTINUOUS Ability実行
- Ability選択UI
- ACTボタン
- Cost支払い
- Effect実行
- activationTrigger評価
- conditions評価
- costs評価／実行
- effects評価／実行
- effectQueue連携
- ProcessManagerとのAbility連携

これらはF-4以降です。


# 22. テスト

F-3D専用テストを追加してください。

最低限、可能な範囲で以下を確認してください。


## CardMaster.imageUrl

- string URLを保持できる
- nullを保持できる
- CardMasterのimmutable性を壊していない
- card.imageUrlでCardMasterのimageUrlを取得できる


## Serialization

- Card.toJSON()へimageUrlを重複保存しない
- Card.fromJSON()後もRegistry経由のCardMasterからimageUrlを取得できる


## Power

- currentPower === basePowerなら現在値のみ
- currentPower !== basePowerなら「2000（元1500）」形式


## Soul

- currentSoul === baseSoulなら現在値のみ
- currentSoul !== baseSoulなら「2（元1）」形式


## Ability表示

- CONTINUOUS → 【永】
- AUTO → 【自】
- ACT → 【起】
- CardAbility.textを表示する
- abilities=[]でも正常
- 複数Abilityでも正常


## Image / Detail

DOMテスト可能な既存基盤がある場合は、

- imageUrlあり → imageを使用
- imageUrl=null → placeholder
- image load error → placeholder
- 縦長画像／横長画像で固定変形しない

を確認してください。

既存テスト基盤でブラウザ画像ロードを自動テストできない場合は、
無理に新しい大規模テストフレームワークを導入しないでください。

その場合は、
unit test可能なロジックをテストし、
画像ロード／レイアウトについては目視確認項目として報告してください。


## Visibility

可能な範囲で、

- 非公開Cardでは実画像を露出しない
- 非公開CardではCardMasterの詳細情報を露出しない

ことを確認してください。


## Regression

F-3A / F-3B / F-3Cおよび既存ゲームテストをすべて実行してください。


# 23. ブラウザ目視確認項目

ブラウザで確認可能な環境がある場合は、
最低限以下を確認してください。

1. 縦長imageUrlを持つCardを選択
   → 右上に縦長のまま表示

2. 横長imageUrlを持つCardを選択
   → 右上に横長のまま表示

3. imageUrl=nullのCardを選択
   → 共通placeholder表示

4. imageUrlありだが読み込み失敗
   → 共通placeholderへfallback

5. 画像の縦横比が崩れていない

6. 画像の解像度によって詳細欄レイアウトが崩れない

7. Card選択を変更すると詳細表示も更新される

8. abilitiesが0件でもUIが崩れない

9. abilitiesがあるCardでは【永】【自】【起】+ textが表示される

10. 非公開Cardの実画像／詳細情報が露出しない

Power/Soulの変更を現在のDEV UIから簡単に作れない場合は、
F-3Dのためだけに大規模なDEV操作を追加しないでください。
その場合はunit testで担保してください。


# 24. 設計書更新

以下を中心に、実装内容に合わせて設計書を更新してください。

- README.md
- docs/設計書一覧.md
- docs/１．設計書/カードデータモデル.md
- docs/１．設計書/エンティティ・オブジェクト一覧.md
- docs/１．設計書/アーキテクチャ.md
- docs/１．設計書/JavaScript仕様.md
- docs/１．設計書/UI操作.md

必要に応じてレイアウト.md等も更新してください。


# 25. 設計書に表示データフローを明記する

F-3D完成時の表示データフローとして、
適切な設計書へ以下の考え方を明記してください。

CardMaster
 ├─ 固定情報
 ├─ imageUrl
 └─ CardAbility[]
       ↓
      Card
 ├─ CardMasterへの委譲getter
 └─ runtime情報
       ↓
    Renderer
       ↓
対戦画面 / 右上カード詳細

特に以下を文章または図で明記してください。

Renderer
→ 基本的にCardだけを受け取る

Renderer
→ CardMasterRegistryを直接参照しない

固定情報
→ CardのCardMaster委譲getterから取得

runtime情報
→ Card自身から取得

画像
→ CardMaster.imageUrl
→ Card.imageUrl
→ Renderer

能力表示
→ CardMaster.abilities
→ Card.abilities
→ CardAbility.type / text
→ Renderer

Power/Soul
→ current値を主表示
→ base値と異なる場合のみ元値も表示


# 26. 画像方向のスコープも設計書へ明記する

今回の画像方向対応は、

「右上カード詳細表示」

のみであることを明記してください。

右上詳細：

縦長画像
→ 縦長のまま

横長画像
→ 横長のまま

画像なし／ロード失敗
→ placeholder

一方、

- 手札
- Stage
- Clock
- Level
- Climax置場
- Waiting Room
- その他盤面上のCard

での画像方向／回転ルールは、
F-3Dでは設計・実装しないことも明記してください。

将来別途整理する予定です。


# 27. READMEのPhase更新

README上で、

F-3D
Card表示・詳細表示の正式データモデル対応
→ COMPLETE

次Phase：

F-4
ACT Ability v1 + 代表的な実カード

と分かるように更新してください。

F-4の具体的Ability実装はF-3Dで先取りしないでください。


# 28. Non-goals

以下はF-3Dでは実装しないでください。

- ACT Ability実行
- AUTO Ability実行
- CONTINUOUS Ability実行
- AbilityEngine / AbilityExecutor
- Ability用Process
- effectQueue連携
- ProcessManagerとのAbility連携
- Ability使用UI

- 大量の実カード登録
- カード画像自動取得
- 画像ダウンロード機構
- 画像DB
- 外部カードサイトとの連携
- ws-tcg.com固有ロジック

- CardMaster.textの削除／再定義
- cardNumberの対戦詳細表示
- masterId / instanceIdの通常詳細表示

- 盤面／手札等での新しい画像方向制御
- CLIMAXだから盤面上で自動回転、等のロジック
- 盤面レイアウトの大規模変更

- F-4の先取り


# 29. Acceptance Criteria

以下をすべて満たした場合のみF-3D完了としてください。

1. CardMasterにimageUrlが正式追加されている
2. imageUrlはstring URLまたはnullを扱える
3. Cardからcard.imageUrlで参照できる
4. Card runtime serializationへimageUrlを重複保存していない
5. RendererがCardMasterRegistryを直接参照していない
6. Rendererは基本的にCardを入口にしている
7. 右上カード詳細でimageUrlありの画像を表示できる
8. imageUrl=nullでは共通placeholderを表示する
9. 画像ロード失敗時も共通placeholderへfallbackする
10. placeholderにURLや画像ファイル名を表示しない
11. 縦長画像を縦長のまま表示できる
12. 横長画像を横長のまま表示できる
13. 画像のアスペクト比を維持する
14. 縦長実画像テストデータが1件存在する
15. 横長実画像テストデータが1件存在する
16. imageUrl=nullのテストデータも存在する
17. 実画像URLをRenderer/CSSへハードコードしていない
18. 右上詳細にカード名を表示する
19. カード種類を表示する
20. 色を表示する
21. Levelを表示する
22. Costを表示する
23. PowerをcurrentPower基準で表示する
24. currentPowerがbasePowerと異なる場合「2000（元1500）」形式で表示する
25. SoulをcurrentSoul基準で表示する
26. currentSoulがbaseSoulと異なる場合「2（元1）」形式で表示する
27. Trigger Iconsを表示する
28. Traitsを表示する
29. Abilitiesを表示する
30. CONTINUOUS → 【永】で表示する
31. AUTO → 【自】で表示する
32. ACT → 【起】で表示する
33. Ability本文はCardAbility.textを使用する
34. Rendererがconditions/costs/effectsからAbility本文を生成していない
35. abilities=[]でも詳細UIが壊れない
36. 複数Abilityを表示可能
37. CardMaster.textを対戦用能力表示に使用していない
38. cardNumberを右上詳細へ表示していない
39. masterId / instanceIdを通常詳細へ表示していない
40. 既存visibilityを維持している
41. 非公開Cardの実画像を露出しない
42. 非公開Cardの詳細情報を露出しない
43. 盤面／手札等の画像方向制御を新規実装していない
44. 既存盤面レイアウトを不要に変更していない
45. Ability実行処理を追加していない
46. F-3A/F-3B/F-3C compatibilityを壊していない
47. F-3D専用テストが成功する
48. 既存テストが成功する
49. 設計書が実装と一致している
50. 表示データフローが設計書に明記されている
51. 右上詳細のみが今回の画像方向対応範囲であることが設計書に明記されている
52. READMEでF-3D COMPLETE / F-4 NEXTが明記されている
53. working treeがcleanである


# 30. 実装後の確認

実装完了後、可能な範囲ですべて実施してください。

- F-3D専用テスト
- F-3A/F-3B/F-3Cテスト
- 全既存JSテスト
- syntax check
- git diff --check
- 廃止／禁止した旧参照や不要なRegistry直接参照の検索
- git status --short

ブラウザ自動テスト環境が存在しない場合は、
その旨を明記してください。

画像表示／アスペクト比等について、
Codex環境でブラウザ目視確認できない場合も明記し、
ユーザー側で確認すべき項目を具体的に報告してください。


# 31. Git / Commit

変更内容を1つのまとまりとしてコミットしてください。

例：

feat: implement F-3D card detail rendering

既存ブランチ／PR運用に合わせてください。

F-4等の別Phaseの変更を同じコミットへ混ぜないでください。


# 32. 完了報告

完了時には最低限以下を報告してください。

1. F-3Dを完了扱いにしたか
2. 新規作成ファイル
3. 変更ファイル
4. 削除ファイル
5. CardMaster.imageUrlの最終仕様
6. Card.imageUrl getterの実装
7. serializationへの影響
8. RendererがCardMaster情報を取得する経路
9. RendererがRegistryを直接参照していないこと
10. placeholderの実装方法
11. imageUrl=null時の挙動
12. image load error時のfallback
13. 縦長画像の表示方法
14. 横長画像の表示方法
15. 縦長テスト用CardMaster
16. 横長テスト用CardMaster
17. imageUrl=nullのテストCardMaster
18. Power表示の実装
19. Soul表示の実装
20. Ability type → 【永】【自】【起】の表示方法
21. 複数Ability / abilities=[]の表示
22. CardMaster.textを使用していないこと
23. cardNumber等を表示していないこと
24. visibility維持方法
25. 非公開Cardからの画像／詳細漏洩防止
26. 盤面／手札の画像方向制御を変更していないこと
27. 既存盤面レイアウトへの影響
28. 追加／更新したテスト
29. 全テスト結果
30. syntax check結果
31. git diff --check結果
32. ブラウザ確認の実施可否と結果
33. ユーザー側で目視確認すべき項目
34. 設計書の更新内容
35. 表示データフローをどの設計書へどう記載したか
36. READMEのPhase更新内容
37. commit hash / commit message
38. PR情報
39. 最終git status

設計判断が必要になった場合は、
F-3A〜F-3Cで確立した責務分離を優先してください。

特に、

CardMaster
= カードの固定定義

CardAbility
= CardMasterに記載された能力定義

Card
= 対戦中のruntime instance + CardMasterへの表示窓口

Renderer
= Cardを受け取り表示する。RegistryからCardMasterを再解決しない

という境界を崩さないでください。

F-3Dは「正式データモデルを正しく画面へ見せるPhase」です。

F-4の「能力を実際に動かすPhase」を先取りせず、
カード詳細表示・画像表示・Power/Soul現在値・Ability text表示を完成させることに集中してください。YutoSuga/weiss-online に Phase F-3D を実装してください。

\# Phase名

F-3D: Card表示・詳細表示の正式データモデル対応

F-3AではCardMasterとCardを分離し、
F-3BではCardAbilityデータ構造を導入し、
F-3Cでは正式なCardMaster JSON、CardMasterLoader、CardMasterRegistry、
DeckDefinition、開発用50枚Deckのデータフローを整備しました。

F-3Dでは、これらの正式データモデルを
「対戦画面上のCard表示」と「右上のカード詳細表示」へ正式に反映してください。

ただし、F-3DはAbility実行Phaseではありません。
カードの固定情報・runtime情報・画像・Ability textを正しく表示できる状態を完成させることが目的です。



\# 0. 最初に必ず既存実装を確認する

実装前に、少なくとも以下を確認してください。

\- README.md
\- docs/設計書一覧.md
\- docs/１．設計書/カードデータモデル.md
\- docs/１．設計書/エンティティ・オブジェクト一覧.md
\- docs/１．設計書/アーキテクチャ.md
\- docs/１．設計書/JavaScript仕様.md
\- docs/１．設計書/UI操作.md
\- docs/１．設計書/レイアウト.md

および現在の、

\- Card
\- CardMaster
\- CardMasterRegistry
\- CardAbility
\- ABILITY_TYPE
\- Renderer
\- MainPhaseController等のController
\- visibility関連実装
\- card-masters.json
\- CardMasterLoader
\- main.dev.js
\- 現在の右上カード詳細UI
\- 盤面上のCard描画
\- F-3A / F-3B / F-3Cのテスト
\- その他既存JSテスト

を確認してください。

既存Renderer／詳細UIの実装方法を確認したうえで、
必要以上にDOM構造やCSSを変更しないでください。

既存のゲームロジックや盤面レイアウトを壊さないことを優先してください。



\# 1. F-3Dの基本方針

F-3Dでの表示データフローは以下とします。

CardMaster
 ├─ 固定情報
 ├─ imageUrl
 └─ CardAbility[]
       ↓
      Card
 ├─ CardMasterへの委譲getter
 └─ runtime情報
       ↓
    Renderer
       ↓
対戦画面 / 右上カード詳細

重要：

Rendererは基本的にCardだけを受け取る設計を維持してください。

Rendererが、

card.masterId
↓
CardMasterRegistry.get(...)
↓
CardMaster

のようにRegistryを直接引き直す設計にはしないでください。



\# 2. RendererのCard参照方針

RendererはCardを入口にしてください。

概念：

renderCard(card)
renderCardDetail(card)

固定情報はCardのCardMaster委譲getterから取得します。

例：

card.name
card.cardType
card.color
card.level
card.cost
card.basePower
card.baseSoul
card.triggerIcons
card.traits
card.abilities
card.imageUrl

runtime情報はCard自身から取得します。

例：

card.currentPower
card.currentSoul
card.position
card.face
card.zone

責務は以下です。

Renderer
→ Cardを知る

Card
→ CardMasterを知る

Renderer
→ CardMasterRegistryを直接知らない

この境界を維持してください。



\# 3. CardMaster.imageUrlを追加する

CardMasterの固定情報として、

imageUrl

を追加してください。

imageUrlは、

string URL
または
null

を扱えるようにしてください。

例：

{
  "imageUrl": null
}

または、

{
  "imageUrl": "[https://example.com/card.png](https://example.com/card.png)"
}

CardMasterはF-3A/F-3B/F-3Cで確立したimmutable方針を維持してください。

Card側には、

card.imageUrl

で取得できるCardMaster委譲getterを追加してください。



\# 4. imageUrlはruntime serializationへ重複保存しない

imageUrlはCardMasterの固定情報です。

そのため、

Card.toJSON()

のruntime serializationへimageUrlを埋め込まないでください。

既存方針どおり、

Card JSON
→ masterId + runtime state

CardMaster
→ 固定情報

という分離を維持してください。

Card.fromJSON(data, masterRegistry)

で復元したCardは、
Registryから解決したCardMaster経由でimageUrlを参照できる状態にしてください。



\# 5. 右上カード詳細の画像表示

F-3Dで画像表示を正式対応する主対象は、

「右上のカード詳細表示」

です。

以下のルールとしてください。

imageUrl === null
→ 共通placeholder表示

imageUrlあり + 正常に読み込める
→ CardMaster.imageUrlの画像を表示

imageUrlあり + 画像ロード失敗
→ 共通placeholderへfallback

placeholderではURLや画像ファイル名を表示しないでください。

例えば、

「画像なし」
または
「No Image」

程度の共通表示で構いません。

placeholderの具体的なデザインは、
既存UIに馴染むシンプルなものにしてください。



\# 6. 画像の縦横比

右上カード詳細では、
画像本来の向き・アスペクト比を維持してください。

縦長画像
→ 縦長のまま表示

横長画像
→ 横長のまま表示

固定の縦長比率へ無理に変形しないでください。

object-fit: contain

等を利用し、
詳細表示用の領域内に画像全体が収まるようにしてください。

画像の元解像度によって右上詳細欄全体のレイアウトが大きく変化しないようにしてください。



\# 7. 開発用の縦長画像

F-3Cで作成した仮想CardMasterのうち、
CHARACTER等の縦長画像確認用として1種類に以下のimageUrlを設定してください。

[https://ws-tcg.com/wordpress/wp-content/images/cardlist/k/kxx_we50/kch_we50_52sp.png](https://ws-tcg.com/wordpress/wp-content/images/cardlist/k/kxx_we50/kch_we50_52sp.png)

これは開発表示確認用データです。

このURLをRenderer、CSS、Cardクラス等へハードコードしないでください。

card-masters.jsonのCardMasterデータとしてのみ保持してください。



\# 8. 開発用の横長画像

横長カード、主にCLIMAXカードの詳細表示確認用として、
適切な仮想CardMaster 1種類に以下のimageUrlを設定してください。

[https://ws-tcg.com/wordpress/wp-content/images/cardlist/k/kch_w78/kch_w78_119r.png](https://ws-tcg.com/wordpress/wp-content/images/cardlist/k/kch_w78/kch_w78_119r.png)

右上カード詳細では、
この画像を横長のまま表示してください。

縦長カード用の表示枠へ画像そのものを変形させないでください。

このURLについても、
Renderer等へハードコードせず、
card-masters.jsonのデータとしてのみ保持してください。



\# 9. imageUrl=nullのCardMasterも残す

すべてのCardMasterへ画像URLを設定しないでください。

開発用CardMasterには、

\- 縦長画像あり
\- 横長画像あり
\- imageUrl=null

の3パターンが存在する状態にしてください。

これによって同じ開発環境で、

1\. 縦長画像表示
2\. 横長画像表示
3\. placeholder表示

を確認できるようにしてください。

また、自動テスト等で可能であれば、

4\. URLありだが画像ロード失敗 → placeholder

も確認してください。



\# 10. 盤面・手札等のカード画像方向制御は今回やらない

重要なNon-goalです。

今回決める、

縦長画像
→ 縦長表示

横長画像
→ 横長表示

という仕様は、
「右上カード詳細表示」に対する仕様です。

手札や盤面等については、
将来的に、

\- Cardの元画像方向
\- zone
\- self / opponent
\- STAND
\- REST
\- REVERSE

等を考慮して表示方向を設計する予定です。

F-3Dではこの問題を先取りしないでください。

特に、

card.cardType === "CLIMAX"
だから盤面上で自動的に回転する

等の新しい盤面方向制御は実装しないでください。

既存の盤面／手札表示挙動を維持してください。



\# 11. 右上カード詳細に表示する情報

右上のカード詳細は、
対戦中にユーザーが必要とする情報を中心にしてください。

基本的に以下を表示してください。

\- カード画像
\- カード名
\- カード種類
\- 色
\- Level
\- Cost
\- Power
\- Soul
\- Trigger Icons
\- Traits
\- Abilities

既存UIの構造・デザインを尊重しつつ、
見やすく整理してください。



\# 12. cardNumberは表示しない

CardMaster.cardNumberは正式データとして保持しますが、
対戦中の右上カード詳細には表示しないでください。

同様に、

masterId
instanceId

等の内部識別子も通常のカード詳細には表示しないでください。

DEV UIで必要になる場合は別責務です。



\# 13. Power表示

Powerは現在値を主として表示してください。

CardMaster：

basePower

Card runtime：

currentPower

という意味の違いを維持します。

currentPower === basePower

の場合：

1500

のように現在値のみ表示してください。

currentPower !== basePower

の場合：

2000（元1500）

のように、

現在値（元の印刷値）

が分かる形式で表示してください。

例えば、

basePower = 1500
currentPower = 2000

なら、

2000（元1500）

です。

将来のPower増減能力へそのまま利用できる表示構造にしてください。



\# 14. Soul表示

SoulもPowerと同じ考え方としてください。

baseSoul
→ CardMasterの印刷値

currentSoul
→ Cardの現在値

currentSoul === baseSoul

なら、

1

currentSoul !== baseSoul

なら、

2（元1）

のように表示してください。

F-3DではSoulを変更する能力そのものは実装しません。



\# 15. abilitiesを正式にカード詳細へ表示する

F-3Bで導入した、

card.abilities

を右上カード詳細へ表示してください。

F-3Dでは「表示のみ」です。

CardAbility.typeとCardAbility.textを利用し、

CONTINUOUS
→ 【永】

AUTO
→ 【自】

ACT
→ 【起】

のように表示してください。

例：

【永】能力テキスト...

【自】能力テキスト...

【起】能力テキスト...

能力の人間向け表示には、

CardAbility.text

を使用してください。



\# 16. RendererはAbilityの構造化データを解釈しない

Rendererが以下を解析して、
能力テキストを再構築する設計にはしないでください。

\- activationTrigger
\- conditions
\- costs
\- effects

F-3DのRendererに必要なのは基本的に、

ability.type
ability.text

です。

conditions/costs/effects等は、
F-4以降のゲームロジック用構造化データです。



\# 17. 複数Abilityへ対応する

CardMaster.abilitiesは配列なので、

0件
1件
複数件

すべて自然に表示できるようにしてください。

例：

【永】能力1...

【自】能力2...

【起】能力3...

abilities=[]の場合もUIが壊れないようにしてください。

必要であれば開発表示確認用の仮想CardMaster 1種類に、
F-3BのCardAbility schemaに従った表示確認用Abilityを追加して構いません。

ただし能力を実行可能にする必要はありません。

表示確認用Abilityを追加する場合も、
conditions/costs/effectsの実行処理は追加しないでください。



\# 18. CardMaster.textは対戦詳細表示に使用しない

既存の、

CardMaster.text

はlegacy / transitional fieldとして残っています。

F-3Dの対戦用カード詳細では、
CardMaster.textを能力表示に使用しないでください。

能力表示の正式経路は、

CardMaster
↓
abilities[]
↓
CardAbility.text

です。

ただしF-3Dでは、

CardMaster.textの削除
flavorTextへの改名
意味の再定義

等は行わないでください。

既存compatibilityを維持してください。



\# 19. visibilityを必ず維持する

既存のvisibilityルールを維持してください。

現在の、

VISIBILITY.PUBLIC
VISIBILITY.OWNER_ONLY
VISIBILITY.OPPONENT_ONLY
VISIBILITY.HIDDEN

およびzoneごとのvisibilityルールを確認してください。

画像対応によって、

「本来非公開のCardなのに、画像やカード詳細から内容が分かる」

という情報漏れを発生させないでください。

Rendererは既存visibility判定を尊重し、
閲覧者に公開してよいCardに対してのみ、

\- imageUrl
\- name
\- level
\- cost
\- power
\- soul
\- triggerIcons
\- traits
\- abilities

等の内容を表示してください。

非公開CardではCardMaster由来の実画像を表示しないでください。



\# 20. 盤面上のCard表示を大規模変更しない

F-3Dの名称には「Card表示」も含まれますが、
今回の中心は正式データモデルへの対応と右上カード詳細です。

盤面上のCardについては、
既存レイアウト・既存visibility・既存状態表示を壊さないことを優先してください。

画像対応のために、

\- Stage
\- Hand
\- Clock
\- Level
\- Climax
\- Stock
\- Waiting Room
\- Memory
\- Deck

等のレイアウトを大規模に作り直さないでください。

盤面・手札等での画像方向制御は別途設計します。



\# 21. F-3DではAbilityを実行しない

F-3Dは、

CardAbility
↓
Card
↓
Renderer
↓
Ability text表示

までです。

以下はF-3Dの対象外です。

\- AbilityEngine
\- AbilityExecutor
\- ACT Ability実行
\- AUTO Ability実行
\- CONTINUOUS Ability実行
\- Ability選択UI
\- ACTボタン
\- Cost支払い
\- Effect実行
\- activationTrigger評価
\- conditions評価
\- costs評価／実行
\- effects評価／実行
\- effectQueue連携
\- ProcessManagerとのAbility連携

これらはF-4以降です。



\# 22. テスト

F-3D専用テストを追加してください。

最低限、可能な範囲で以下を確認してください。



\## CardMaster.imageUrl

\- string URLを保持できる
\- nullを保持できる
\- CardMasterのimmutable性を壊していない
\- card.imageUrlでCardMasterのimageUrlを取得できる



\## Serialization

\- Card.toJSON()へimageUrlを重複保存しない
\- Card.fromJSON()後もRegistry経由のCardMasterからimageUrlを取得できる



\## Power

\- currentPower === basePowerなら現在値のみ
\- currentPower !== basePowerなら「2000（元1500）」形式



\## Soul

\- currentSoul === baseSoulなら現在値のみ
\- currentSoul !== baseSoulなら「2（元1）」形式



\## Ability表示

\- CONTINUOUS → 【永】
\- AUTO → 【自】
\- ACT → 【起】
\- CardAbility.textを表示する
\- abilities=[]でも正常
\- 複数Abilityでも正常



\## Image / Detail

DOMテスト可能な既存基盤がある場合は、

\- imageUrlあり → imageを使用
\- imageUrl=null → placeholder
\- image load error → placeholder
\- 縦長画像／横長画像で固定変形しない

を確認してください。

既存テスト基盤でブラウザ画像ロードを自動テストできない場合は、
無理に新しい大規模テストフレームワークを導入しないでください。

その場合は、
unit test可能なロジックをテストし、
画像ロード／レイアウトについては目視確認項目として報告してください。



\## Visibility

可能な範囲で、

\- 非公開Cardでは実画像を露出しない
\- 非公開CardではCardMasterの詳細情報を露出しない

ことを確認してください。



\## Regression

F-3A / F-3B / F-3Cおよび既存ゲームテストをすべて実行してください。



\# 23. ブラウザ目視確認項目

ブラウザで確認可能な環境がある場合は、
最低限以下を確認してください。

1\. 縦長imageUrlを持つCardを選択
   → 右上に縦長のまま表示

2\. 横長imageUrlを持つCardを選択
   → 右上に横長のまま表示

3\. imageUrl=nullのCardを選択
   → 共通placeholder表示

4\. imageUrlありだが読み込み失敗
   → 共通placeholderへfallback

5\. 画像の縦横比が崩れていない

6\. 画像の解像度によって詳細欄レイアウトが崩れない

7\. Card選択を変更すると詳細表示も更新される

8\. abilitiesが0件でもUIが崩れない

9\. abilitiesがあるCardでは【永】【自】【起】+ textが表示される

10\. 非公開Cardの実画像／詳細情報が露出しない

Power/Soulの変更を現在のDEV UIから簡単に作れない場合は、
F-3Dのためだけに大規模なDEV操作を追加しないでください。
その場合はunit testで担保してください。



\# 24. 設計書更新

以下を中心に、実装内容に合わせて設計書を更新してください。

\- README.md
\- docs/設計書一覧.md
\- docs/１．設計書/カードデータモデル.md
\- docs/１．設計書/エンティティ・オブジェクト一覧.md
\- docs/１．設計書/アーキテクチャ.md
\- docs/１．設計書/JavaScript仕様.md
\- docs/１．設計書/UI操作.md

必要に応じてレイアウト.md等も更新してください。



\# 25. 設計書に表示データフローを明記する

F-3D完成時の表示データフローとして、
適切な設計書へ以下の考え方を明記してください。

CardMaster
 ├─ 固定情報
 ├─ imageUrl
 └─ CardAbility[]
       ↓
      Card
 ├─ CardMasterへの委譲getter
 └─ runtime情報
       ↓
    Renderer
       ↓
対戦画面 / 右上カード詳細

特に以下を文章または図で明記してください。

Renderer
→ 基本的にCardだけを受け取る

Renderer
→ CardMasterRegistryを直接参照しない

固定情報
→ CardのCardMaster委譲getterから取得

runtime情報
→ Card自身から取得

画像
→ CardMaster.imageUrl
→ Card.imageUrl
→ Renderer

能力表示
→ CardMaster.abilities
→ Card.abilities
→ CardAbility.type / text
→ Renderer

Power/Soul
→ current値を主表示
→ base値と異なる場合のみ元値も表示



\# 26. 画像方向のスコープも設計書へ明記する

今回の画像方向対応は、

「右上カード詳細表示」

のみであることを明記してください。

右上詳細：

縦長画像
→ 縦長のまま

横長画像
→ 横長のまま

画像なし／ロード失敗
→ placeholder

一方、

\- 手札
\- Stage
\- Clock
\- Level
\- Climax置場
\- Waiting Room
\- その他盤面上のCard

での画像方向／回転ルールは、
F-3Dでは設計・実装しないことも明記してください。

将来別途整理する予定です。



\# 27. READMEのPhase更新

README上で、

F-3D
Card表示・詳細表示の正式データモデル対応
→ COMPLETE

次Phase：

F-4
ACT Ability v1 + 代表的な実カード

と分かるように更新してください。

F-4の具体的Ability実装はF-3Dで先取りしないでください。



\# 28. Non-goals

以下はF-3Dでは実装しないでください。

\- ACT Ability実行
\- AUTO Ability実行
\- CONTINUOUS Ability実行
\- AbilityEngine / AbilityExecutor
\- Ability用Process
\- effectQueue連携
\- ProcessManagerとのAbility連携
\- Ability使用UI

\- 大量の実カード登録
\- カード画像自動取得
\- 画像ダウンロード機構
\- 画像DB
\- 外部カードサイトとの連携
\- ws-tcg.com固有ロジック

\- CardMaster.textの削除／再定義
\- cardNumberの対戦詳細表示
\- masterId / instanceIdの通常詳細表示

\- 盤面／手札等での新しい画像方向制御
\- CLIMAXだから盤面上で自動回転、等のロジック
\- 盤面レイアウトの大規模変更

\- F-4の先取り



\# 29. Acceptance Criteria

以下をすべて満たした場合のみF-3D完了としてください。

1\. CardMasterにimageUrlが正式追加されている
2\. imageUrlはstring URLまたはnullを扱える
3\. Cardからcard.imageUrlで参照できる
4\. Card runtime serializationへimageUrlを重複保存していない
5\. RendererがCardMasterRegistryを直接参照していない
6\. Rendererは基本的にCardを入口にしている
7\. 右上カード詳細でimageUrlありの画像を表示できる
8\. imageUrl=nullでは共通placeholderを表示する
9\. 画像ロード失敗時も共通placeholderへfallbackする
10\. placeholderにURLや画像ファイル名を表示しない
11\. 縦長画像を縦長のまま表示できる
12\. 横長画像を横長のまま表示できる
13\. 画像のアスペクト比を維持する
14\. 縦長実画像テストデータが1件存在する
15\. 横長実画像テストデータが1件存在する
16\. imageUrl=nullのテストデータも存在する
17\. 実画像URLをRenderer/CSSへハードコードしていない
18\. 右上詳細にカード名を表示する
19\. カード種類を表示する
20\. 色を表示する
21\. Levelを表示する
22\. Costを表示する
23\. PowerをcurrentPower基準で表示する
24\. currentPowerがbasePowerと異なる場合「2000（元1500）」形式で表示する
25\. SoulをcurrentSoul基準で表示する
26\. currentSoulがbaseSoulと異なる場合「2（元1）」形式で表示する
27\. Trigger Iconsを表示する
28\. Traitsを表示する
29\. Abilitiesを表示する
30\. CONTINUOUS → 【永】で表示する
31\. AUTO → 【自】で表示する
32\. ACT → 【起】で表示する
33\. Ability本文はCardAbility.textを使用する
34\. Rendererがconditions/costs/effectsからAbility本文を生成していない
35\. abilities=[]でも詳細UIが壊れない
36\. 複数Abilityを表示可能
37\. CardMaster.textを対戦用能力表示に使用していない
38\. cardNumberを右上詳細へ表示していない
39\. masterId / instanceIdを通常詳細へ表示していない
40\. 既存visibilityを維持している
41\. 非公開Cardの実画像を露出しない
42\. 非公開Cardの詳細情報を露出しない
43\. 盤面／手札等の画像方向制御を新規実装していない
44\. 既存盤面レイアウトを不要に変更していない
45\. Ability実行処理を追加していない
46\. F-3A/F-3B/F-3C compatibilityを壊していない
47\. F-3D専用テストが成功する
48\. 既存テストが成功する
49\. 設計書が実装と一致している
50\. 表示データフローが設計書に明記されている
51\. 右上詳細のみが今回の画像方向対応範囲であることが設計書に明記されている
52\. READMEでF-3D COMPLETE / F-4 NEXTが明記されている
53\. working treeがcleanである



\# 30. 実装後の確認

実装完了後、可能な範囲ですべて実施してください。

\- F-3D専用テスト
\- F-3A/F-3B/F-3Cテスト
\- 全既存JSテスト
\- syntax check
\- git diff --check
\- 廃止／禁止した旧参照や不要なRegistry直接参照の検索
\- git status --short

ブラウザ自動テスト環境が存在しない場合は、
その旨を明記してください。

画像表示／アスペクト比等について、
Codex環境でブラウザ目視確認できない場合も明記し、
ユーザー側で確認すべき項目を具体的に報告してください。



\# 31. Git / Commit

変更内容を1つのまとまりとしてコミットしてください。

例：

feat: implement F-3D card detail rendering

既存ブランチ／PR運用に合わせてください。

F-4等の別Phaseの変更を同じコミットへ混ぜないでください。



\# 32. 完了報告

完了時には最低限以下を報告してください。

1\. F-3Dを完了扱いにしたか
2\. 新規作成ファイル
3\. 変更ファイル
4\. 削除ファイル
5\. CardMaster.imageUrlの最終仕様
6\. Card.imageUrl getterの実装
7\. serializationへの影響
8\. RendererがCardMaster情報を取得する経路
9\. RendererがRegistryを直接参照していないこと
10\. placeholderの実装方法
11\. imageUrl=null時の挙動
12\. image load error時のfallback
13\. 縦長画像の表示方法
14\. 横長画像の表示方法
15\. 縦長テスト用CardMaster
16\. 横長テスト用CardMaster
17\. imageUrl=nullのテストCardMaster
18\. Power表示の実装
19\. Soul表示の実装
20\. Ability type → 【永】【自】【起】の表示方法
21\. 複数Ability / abilities=[]の表示
22\. CardMaster.textを使用していないこと
23\. cardNumber等を表示していないこと
24\. visibility維持方法
25\. 非公開Cardからの画像／詳細漏洩防止
26\. 盤面／手札の画像方向制御を変更していないこと
27\. 既存盤面レイアウトへの影響
28\. 追加／更新したテスト
29\. 全テスト結果
30\. syntax check結果
31\. git diff --check結果
32\. ブラウザ確認の実施可否と結果
33\. ユーザー側で目視確認すべき項目
34\. 設計書の更新内容
35\. 表示データフローをどの設計書へどう記載したか
36\. READMEのPhase更新内容
37\. commit hash / commit message
38\. PR情報
39\. 最終git status

設計判断が必要になった場合は、
F-3A〜F-3Cで確立した責務分離を優先してください。

特に、

CardMaster
\= カードの固定定義

CardAbility
\= CardMasterに記載された能力定義

Card
\= 対戦中のruntime instance + CardMasterへの表示窓口

Renderer
\= Cardを受け取り表示する。RegistryからCardMasterを再解決しない

という境界を崩さないでください。

F-3Dは「正式データモデルを正しく画面へ見せるPhase」です。

F-4の「能力を実際に動かすPhase」を先取りせず、
カード詳細表示・画像表示・Power/Soul現在値・Ability text表示を完成させることに集中してください。
