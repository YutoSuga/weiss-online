YutoSuga/weiss-online に、F-3Dブラウザ確認で見つかった以下の修正を実施してください。

今回は新しいPhaseではありません。

主な修正対象は以下の2点です。

1. 右上「カード説明」の画像表示レイアウト改善
2. MAINフェイズにおける「手札Cardの選択」と「Cardをプレイできるか」の責務分離

F-3Dは引き続きCOMPLETE、
F-4 ACT Ability v1はNEXTのままとしてください。

F-4のAbility実行はまだ実装しないでください。


# 1. 最初に既存実装を確認する

実装前に少なくとも以下を確認してください。

- README.md
- client/index.html
- client/css/board.css
- Card
- CardMaster
- CardAbility
- Renderer
- MainPhaseController
- DevController
- GameEngine
- MAIN Phase Process
- canSelectCardForMain
- getMainDestinationCandidates
- canPlayCharacterToStage
- getCharacterPlayDisabledReason
- PLAY_CHARACTER Process
- visibility関連
- F-2A / F-2B / F-2C関連テスト
- F-3D関連テスト
- devDeckToHand関連テスト
- UI操作.md
- JavaScript仕様.md
- 必要に応じてその他関連設計書

特に現在、

「手札Cardを選択できる条件」

と

「選択したCardをStageへプレイできる条件」

がどこで判定されているかを確認してください。

既存責務を把握してから、最小限の修正を行ってください。


# 2. 今回の基本方針

今回、明確に分離したい概念は以下です。

A. Cardを選択して詳細を見ること
B. 選択したCardでゲームアクションを実行できること

この2つは同じではありません。

概念として、

選択できる
≠
プレイできる

としてください。


# 3. MAINフェイズ中の手札Card選択条件

今回変更するのは、

「MAINフェイズにおける自分の手札Card選択」

です。

MAINフェイズ中では、以下を満たす場合に自分の手札Cardを選択可能としてください。

- 自分のターン
- phase === MAIN
- MAIN ProcessがWAITING_INPUT
- 自分の手札に存在するCard

この条件を満たした場合、

cardTypeに関係なくCardを選択可能

としてください。

つまり、

- CHARACTER
- CLIMAX
- 将来追加されるその他Card Type

について、少なくともMAIN WAITING_INPUT中は
「選択して右上のCard詳細を見る」
こと自体は可能にしてください。


# 4. MAIN WAITING_INPUTという前提条件は残す

重要です。

今回、

「いつでも手札Cardを選択可能にする」

という一般化は行わないでください。

現時点ではMAINフェイズについて、

自分のターン
+
MAIN
+
MAIN Process WAITING_INPUT
+
自分の手札

という既存のタイミング制約を維持してください。

MAIN以外のPhaseや相手ターン中などについて、
Card選択可能タイミングを新たに設計・一般化しないでください。

「ゲーム全体でCard詳細を見るためのSelectionをいつ許可するか」は、
将来別途整理します。


# 5. cardTypeを「選択可能条件」にしない

現在、CHARACTERのみがMAINで選択可能になっている場合は、
その制約を外してください。

例えばCLIMAXでも、

MAIN WAITING_INPUT
+
自分の手札

なら選択可能です。

これにより、

CLIMAXをクリック
↓
右上カード詳細を表示

できるようにしてください。


# 6. CHARACTERのプレイ条件は維持する

CHARACTERをStageへプレイできる条件は変更しないでください。

現在の、

- MAIN WAITING_INPUT
- 自分の手札のCHARACTER
- Level条件
- Color条件
- Cost条件

等の既存ルールを維持してください。

つまり、

CHARACTERを選択
↓
詳細表示
↓
プレイ可能条件を別途判定

とします。


# 7. CHARACTERがプレイ条件NGでも選択可能

既存方針を維持してください。

例えば、

Level条件NG
Color条件NG
Cost不足

であっても、

Cardの選択
+
右上詳細表示

は可能です。

そのうえで、

「プレイできません：レベル条件を満たしていません。」

等の既存プレイ不可理由を表示してください。

プレイ不可だからCard自体を選択できない、
という設計にはしないでください。


# 8. CLIMAXをMAINで選択した場合

CLIMAXはMAIN WAITING_INPUT中でも選択可能にしてください。

ただし、今回MAINフェイズでCLIMAXをプレイできるようにはしません。

CLIMAXを選択した場合：

- 右上Card詳細は表示する
- Stage destinationは表示しない
- PLAY_CHARACTERは開始しない
- CHARACTER用のLevel / Color / Costプレイ判定を適用しない
- MAIN中の新しいCLIMAXプレイ処理は追加しない

という状態にしてください。

CLIMAXの正式なプレイ操作は、
将来CLIMAXフェイズ側で別途実装します。


# 9. Main selectionとplayabilityの責務を分離する

可能な限り既存APIの意味を明確にしてください。

例えば現在、

canSelectCardForMain()

が、

「MAINで詳細確認のため選択できるか」

と

「MAINでStageへプレイ候補になれるか」

を同時に表している場合は、
今回の仕様に合わせて責務を整理してください。

期待する概念は、

canSelectCardForMain
→ MAIN WAITING_INPUT中に手札Cardとして選択可能か

canPlayCharacterToStage
→ CHARACTERをStageへプレイ可能か

getCharacterPlayDisabledReason
→ CHARACTERをStageへプレイできない理由

getMainDestinationCandidates
→ 選択Cardに対して現在実行可能なMAIN Actionのdestination

です。

実際の関数名・構造は既存コードに合わせて構いませんが、

「選択可能」
と
「プレイ可能」

を同じ判定に戻さないでください。


# 10. Stage Card選択は今回変更しない

F-2Cで実装済みの、

- own Stage Character selection
- Stage → empty Stage Move
- Stage → occupied Stage Swap
- replacement確認
- Stage selection切替

等は今回の修正対象ではありません。

手札選択条件の修正によって、
Stage Move / Swap / Replacementを壊さないでください。


# 11. 右上カード詳細の画像レイアウト

F-3Dで追加した右上「カード説明」の画像表示を改善してください。

現在は、

「画像」という見出し列
+
大きな固定画像枠

のようなレイアウトになっています。

これを見直してください。


# 12. 「画像」という見出しを削除する

右上カード詳細の画像について、

画像 | [画像領域]

のような表形式にする必要はありません。

「画像」という左側見出しは削除してください。

画像はCard詳細の先頭に置く独立した1ブロックとして扱ってください。

イメージ：

カード説明

┌─────────────────────┐
│                     │
│      Card Image     │
│                     │
└─────────────────────┘

名前   ...
種類   ...
色     ...
...

既存サイドバーの横幅を有効に使ってください。


# 13. 画像ありの場合はCard全体を表示する

現在、縦長Card画像の下側が見切れる状態を確認しています。

これは修正してください。

imageUrlが正常に読み込めた場合は、

「Card画像全体が見えること」

を優先してください。

縦長Card：

- 縦長のまま
- 上端から下端まで全体を表示
- cropしない

横長Card：

- 横長のまま
- 左端から右端まで全体を表示
- cropしない

どちらも元画像のアスペクト比を維持してください。


# 14. 固定高さによるcropを避ける

画像全体を表示するために、

固定heightによって画像の一部を切る設計は避けてください。

既存CSSを確認し、
今回の右上詳細には、

width: 100%
height: auto
max-width: 100%

等を基本とした、
画像全体を表示できる方法を採用してください。

必要であればobject-fit: containを使用して構いませんが、

「固定高さの大きな枠に押し込める」

こと自体を目的にしないでください。

縦長画像・横長画像のどちらでも、
Card全体が確認できることを優先してください。


# 15. imageUrl=null時は大きな画像枠を確保しない

imageUrl === nullの場合、
現在のような大きな空画像領域は不要です。

大きな画像枠を確保せず、

「画像なし」

という1行程度のplaceholderだけ表示してください。

イメージ：

カード説明

画像なし

名前   青の守護者
種類   CHARACTER
...

程度で構いません。


# 16. image load errorも同じplaceholder

imageUrlは存在するが、

- 404
- 読み込み失敗
- その他img error

となった場合も、

imageUrl === null

と同様のコンパクトな、

「画像なし」

placeholderへfallbackしてください。

URLや画像ファイル名は表示しないでください。


# 17. placeholderと画像ありのレイアウトを分ける

画像ありの場合に必要な表示高さを、
画像なしの場合にも予約し続けないでください。

つまり、

画像あり
→ Card画像全体に必要な高さを使用

画像なし
→ 「画像なし」1行程度

としてください。

画像ロード失敗後も、
大きな空枠が残らないようにしてください。


# 18. 横長CLIMAX画像の確認を可能にする

F-3Dでは横長CLIMAX CardMasterにテスト画像を設定済みです。

今回、

CLIMAXもMAIN WAITING_INPUT中に選択可能

になるため、

DEVパネル
↓
横長CLIMAXを山札→手札
↓
手札でCLIMAXを選択
↓
右上詳細
↓
横長画像全体を表示

という確認が可能になります。

横長画像を縦向きへ回転しないでください。


# 19. 盤面・手札の画像方向は変更しない

今回の画像レイアウト変更対象は、

右上カード詳細

のみです。

以下は変更しないでください。

- Hand上のCard画像方向
- Stage上のCard画像方向
- Clock
- Level
- Climax zone
- Waiting Room
- Memory
- その他盤面上のCard

Card Typeによる自動回転も追加しないでください。

盤面上の画像方向ルールは将来別途設計します。


# 20. 右上の固定情報は今回は残す

現在の右上詳細に表示している、

- 名前
- 種類
- 色
- Level
- Cost
- Power
- Soul
- Trigger Icons
- Traits
- Abilities

は今回削除しないでください。

将来的には、

画像から確認できる固定情報
→ 表示省略候補

Power / Soul等のruntimeで変化し得る情報
→ テキスト表示を維持

Abilities
→ テキスト表示を維持

等のUI整理を検討する可能性があります。

ただし現在は開発中であり、

CardMaster
→ Card
→ Renderer

のデータ確認にも有用なので、
F-3Dで追加した固定情報表示は維持してください。


# 21. Power / Soul表示を維持する

F-3Dで実装した、

currentPower === basePower
→ 1500

currentPower !== basePower
→ 2000（元1500）

currentSoul === baseSoul
→ 1

currentSoul !== baseSoul
→ 2（元1）

という表示は変更しないでください。


# 22. Ability表示を維持する

F-3Dで実装した、

CONTINUOUS → 【永】
AUTO → 【自】
ACT → 【起】

およびCardAbility.textによる表示を維持してください。

今回の手札選択変更によって、
CLIMAX等でもCardにAbilityが存在すれば詳細表示できる構造を維持してください。

Ability実行は追加しないでください。


# 23. visibilityを維持する

今回の選択条件変更は、

自分のMAIN WAITING_INPUT中の自分の手札

が対象です。

既存visibilityルールを緩めないでください。

特に、

- 相手の非公開手札
- Deck
- Stock
- その他HIDDEN / OWNER_ONLY領域

から詳細情報や画像を露出させないでください。


# 24. テスト

既存テストを更新し、
今回の仕様を明示的にテストしてください。

最低限、以下を確認してください。


## MAIN Hand Selection

- 自分のターン + MAIN + WAITING_INPUT + 自分のHandならCHARACTERを選択可能
- 同条件ならCLIMAXも選択可能
- Level条件NGのCHARACTERも選択可能
- Color条件NGのCHARACTERも選択可能
- Cost不足のCHARACTERも選択可能
- プレイ不可CHARACTERでも詳細表示対象になれる
- CLIMAXは詳細表示対象になれる
- CLIMAX選択時にStage destinationを出さない
- CLIMAX選択時にPLAY_CHARACTERを開始しない


## Timing

- MAIN WAITING_INPUTでない場合は、今回のMain Hand Selection条件では選択不可
- 相手ターンでは選択不可
- 自分のHand以外を「MAINの手札選択」として扱わない

MAIN以外の一般Selection仕様は今回追加しないでください。


## Character Playability

既存の、

- Level
- Color
- Cost
- Character type

によるStage play判定が維持されていること。

つまり、

選択可能になったからプレイ可能になった

というregressionが起きないことを確認してください。


## F-2C Regression

- Stage Move
- Stage Swap
- Hand → occupied Stage Replacement
- selection切替

等を壊していないことを確認してください。


## Card Detail Image

DOMテスト可能な既存基盤があれば、

- 「画像」という見出しが不要になっている
- imageUrlありでは実画像を表示
- imageUrl=nullではコンパクトな「画像なし」
- load errorでもコンパクトな「画像なし」
- error後に大きな空画像枠が残らない

ことを確認してください。

CSSの実レイアウトについてブラウザ自動テスト基盤がない場合は、
大規模な新規テストフレームワークを導入しないでください。


# 25. ブラウザ目視確認項目

ブラウザ環境が利用できる場合は以下を確認してください。

1. imageUrl=null Cardを選択
   → 大きな空画像枠がなく、「画像なし」が1行程度で表示される

2. 「画像」という左側見出しがない

3. 縦長画像Cardを選択
   → Card上端から下端まで全体が見える
   → cropされない
   → アスペクト比が崩れない

4. 横長CLIMAXをDEVパネルから手札へ移動

5. 横長CLIMAXを手札で選択できる

6. 横長CLIMAXの右上詳細が表示される

7. 横長画像が横長のまま全体表示される

8. CLIMAXを選択してもStage destinationが出ない

9. CHARACTERのLevel/Color/Cost NG Cardは引き続き選択できる

10. その場合は既存のプレイ不可理由が表示される

11. プレイ可能CHARACTERは従来どおりStageへプレイできる

12. Stage Move / Swap / Replacementが壊れていない

13. Ability表示が従来どおり表示される


# 26. ドキュメント

必要な範囲で以下を更新してください。

- README.md
- docs/１．設計書/対戦画面/UI操作.md
- docs/１．設計書/システム共通/JavaScript仕様.md
- その他今回の仕様が記載されている設計書

特に、

MAINフェイズにおいて、

「Cardを選択して詳細を見ること」
と
「Cardをプレイできること」

は別判定であることを明記してください。

MAIN WAITING_INPUT中の自分の手札では、
cardTypeに関係なく詳細確認のため選択可能。

CHARACTERのStage play可否は、
その後に別途Level / Color / Cost等で判定。

CLIMAXはMAIN中でも詳細確認のため選択可能だが、
MAINからのプレイ処理はまだ持たない。

という現在仕様を記載してください。


# 27. READMEのPhaseは進めない

今回の修正によってPhaseを進めないでください。

READMEは引き続き、

F-3D COMPLETE
F-4 ACT Ability v1 + 代表的な実カード NEXT

としてください。

今回の修正をF-4として扱わないでください。


# 28. Non-goals

今回実装しないもの：

- F-4
- ACT Ability実行
- AUTO Ability実行
- CONTINUOUS Ability実行
- AbilityEngine
- effectQueue連携

- CLIMAXの正式プレイ処理
- CLIMAX Phaseの実装拡張
- MAINからCLIMAXをプレイする処理

- MAIN以外のSelection一般化
- 相手ターン中の自分の手札Selection仕様
- 公開zone全体のSelection framework
- Selection systemの大規模再設計

- Stage Move / Swap仕様変更
- Character play条件変更

- 盤面/手札の画像方向制御
- Card Typeによる盤面画像の自動回転

- 右上固定情報の削減
- Card detail全体の大規模UI再設計


# 29. Acceptance Criteria

以下をすべて満たしたら完了としてください。

1. MAIN WAITING_INPUT中の自分の手札CardはcardTypeに関係なく選択可能
2. CHARACTERを選択可能
3. CLIMAXも選択可能
4. プレイ不可CHARACTERも選択可能
5. Level NGでも選択可能
6. Color NGでも選択可能
7. Cost NGでも選択可能
8. CHARACTERのStage play条件自体は変更していない
9. プレイ不可理由表示を維持している
10. CLIMAX選択時に右上詳細を表示できる
11. CLIMAX選択時にStage destinationを表示しない
12. CLIMAX選択時にPLAY_CHARACTERを開始しない
13. MAIN WAITING_INPUTというタイミング制約を維持している
14. MAIN以外のSelectionを一般化していない
15. 相手ターンへ選択可能範囲を広げていない
16. Stage Move / Swap / Replacementを壊していない

17. 右上画像から「画像」という左側見出しを削除している
18. 画像を独立したブロックとして表示している
19. 縦長画像を全体表示できる
20. 縦長画像をcropしない
21. 横長画像を全体表示できる
22. 横長画像を回転しない
23. 画像のアスペクト比を維持している
24. imageUrl=null時に大きな空画像枠を確保しない
25. imageUrl=null時は「画像なし」を1行程度で表示する
26. load error時も同じコンパクトplaceholderへfallbackする
27. placeholderにURLや画像ファイル名を表示しない
28. load error後も大きな空枠が残らない
29. 盤面・手札の画像方向を変更していない

30. 名前/種類/色/Level/Cost/Power/Soul/Trigger/Traits/Abilities表示を維持している
31. Power/Soulのcurrent/base表示仕様を維持している
32. Abilityの【永】【自】【起】表示を維持している
33. visibilityを維持している
34. RendererへCardMasterRegistry依存を追加していない
35. F-4を先取りしていない
36. CLIMAX play処理を追加していない
37. 関連テストが成功する
38. 全既存テストが成功する
39. 設計書が今回の仕様と一致している
40. READMEがF-3D COMPLETE / F-4 NEXTのまま
41. working treeがcleanである


# 30. 実装後の確認

実装後は少なくとも以下を実施してください。

- 今回追加/更新したテスト
- node --test client/tests/*.test.mjs
- 全JavaScriptのnode --check
- git diff --check
- git status --short

必要に応じて検索し、

- RendererへCardMasterRegistry依存が入っていない
- CLIMAX play処理を誤って追加していない
- F-4 Ability実行を追加していない

ことも確認してください。

ブラウザ実行環境がない場合は、
その旨を完了報告に記載し、
上記の目視確認項目をユーザー側確認事項として残してください。


# 31. Commit

今回の修正はF-3D本体やDEV山札→手札機能とは分けた、
独立した小さなコミットにしてください。

例：

fix: refine card detail image and main hand selection

F-4の変更を同じコミットへ混ぜないでください。


# 32. 完了報告

完了時には以下を報告してください。

1. 実装概要
2. 変更ファイル
3. 新規/削除ファイル
4. MAIN Hand Cardの新しい選択条件
5. canSelectCardForMain等の変更内容
6. 「選択可能」と「プレイ可能」をどう分離したか
7. CHARACTER play条件を維持していること
8. Level/Color/Cost NG時の挙動
9. CLIMAX選択時の挙動
10. CLIMAXでStage destinationが出ないこと
11. CLIMAX play処理を追加していないこと
12. MAIN WAITING_INPUT制約を維持していること
13. MAIN以外へSelectionを広げていないこと
14. Stage Move/Swap/Replacementへの影響
15. 右上画像レイアウトの変更内容
16. 「画像」見出しの削除
17. 縦長画像の表示方法
18. 横長画像の表示方法
19. imageUrl=null時の表示
20. load error時のfallback
21. アスペクト比維持方法
22. 右上固定情報を維持していること
23. Power/Soul表示への影響
24. Ability表示への影響
25. visibilityへの影響
26. 盤面/手札画像方向を変更していないこと
27. 追加/更新テスト
28. 全テスト結果
29. syntax check結果
30. git diff --check結果
31. ブラウザ確認の実施可否
32. ユーザー側で確認すべき項目
33. README/docs更新内容
34. commit hash / commit message
35. PR情報
36. 最終git status

今回の修正の中心は、

「Cardを選択して詳細を見ること」
と
「Cardをプレイできること」

を明確に分離すること、

および、

「右上Card詳細では縦長・横長を問わずCard画像全体を自然に表示し、
画像がない場合は不要な大きな領域を使わないこと」

です。

新しいゲームルールを追加するのではなく、
既存F-2/F-3の責務を整理しながらUIを改善してください。YutoSuga/weiss-online に、F-3Dブラウザ確認で見つかった以下の修正を実施してください。

今回は新しいPhaseではありません。

主な修正対象は以下の2点です。

1. 右上「カード説明」の画像表示レイアウト改善
2. MAINフェイズにおける「手札Cardの選択」と「Cardをプレイできるか」の責務分離

F-3Dは引き続きCOMPLETE、
F-4 ACT Ability v1はNEXTのままとしてください。

F-4のAbility実行はまだ実装しないでください。


# 1. 最初に既存実装を確認する

実装前に少なくとも以下を確認してください。

- README.md
- client/index.html
- client/css/board.css
- Card
- CardMaster
- CardAbility
- Renderer
- MainPhaseController
- DevController
- GameEngine
- MAIN Phase Process
- canSelectCardForMain
- getMainDestinationCandidates
- canPlayCharacterToStage
- getCharacterPlayDisabledReason
- PLAY_CHARACTER Process
- visibility関連
- F-2A / F-2B / F-2C関連テスト
- F-3D関連テスト
- devDeckToHand関連テスト
- UI操作.md
- JavaScript仕様.md
- 必要に応じてその他関連設計書

特に現在、

「手札Cardを選択できる条件」

と

「選択したCardをStageへプレイできる条件」

がどこで判定されているかを確認してください。

既存責務を把握してから、最小限の修正を行ってください。


# 2. 今回の基本方針

今回、明確に分離したい概念は以下です。

A. Cardを選択して詳細を見ること
B. 選択したCardでゲームアクションを実行できること

この2つは同じではありません。

概念として、

選択できる
≠
プレイできる

としてください。


# 3. MAINフェイズ中の手札Card選択条件

今回変更するのは、

「MAINフェイズにおける自分の手札Card選択」

です。

MAINフェイズ中では、以下を満たす場合に自分の手札Cardを選択可能としてください。

- 自分のターン
- phase === MAIN
- MAIN ProcessがWAITING_INPUT
- 自分の手札に存在するCard

この条件を満たした場合、

cardTypeに関係なくCardを選択可能

としてください。

つまり、

- CHARACTER
- CLIMAX
- 将来追加されるその他Card Type

について、少なくともMAIN WAITING_INPUT中は
「選択して右上のCard詳細を見る」
こと自体は可能にしてください。


# 4. MAIN WAITING_INPUTという前提条件は残す

重要です。

今回、

「いつでも手札Cardを選択可能にする」

という一般化は行わないでください。

現時点ではMAINフェイズについて、

自分のターン
+
MAIN
+
MAIN Process WAITING_INPUT
+
自分の手札

という既存のタイミング制約を維持してください。

MAIN以外のPhaseや相手ターン中などについて、
Card選択可能タイミングを新たに設計・一般化しないでください。

「ゲーム全体でCard詳細を見るためのSelectionをいつ許可するか」は、
将来別途整理します。


# 5. cardTypeを「選択可能条件」にしない

現在、CHARACTERのみがMAINで選択可能になっている場合は、
その制約を外してください。

例えばCLIMAXでも、

MAIN WAITING_INPUT
+
自分の手札

なら選択可能です。

これにより、

CLIMAXをクリック
↓
右上カード詳細を表示

できるようにしてください。


# 6. CHARACTERのプレイ条件は維持する

CHARACTERをStageへプレイできる条件は変更しないでください。

現在の、

- MAIN WAITING_INPUT
- 自分の手札のCHARACTER
- Level条件
- Color条件
- Cost条件

等の既存ルールを維持してください。

つまり、

CHARACTERを選択
↓
詳細表示
↓
プレイ可能条件を別途判定

とします。


# 7. CHARACTERがプレイ条件NGでも選択可能

既存方針を維持してください。

例えば、

Level条件NG
Color条件NG
Cost不足

であっても、

Cardの選択
+
右上詳細表示

は可能です。

そのうえで、

「プレイできません：レベル条件を満たしていません。」

等の既存プレイ不可理由を表示してください。

プレイ不可だからCard自体を選択できない、
という設計にはしないでください。


# 8. CLIMAXをMAINで選択した場合

CLIMAXはMAIN WAITING_INPUT中でも選択可能にしてください。

ただし、今回MAINフェイズでCLIMAXをプレイできるようにはしません。

CLIMAXを選択した場合：

- 右上Card詳細は表示する
- Stage destinationは表示しない
- PLAY_CHARACTERは開始しない
- CHARACTER用のLevel / Color / Costプレイ判定を適用しない
- MAIN中の新しいCLIMAXプレイ処理は追加しない

という状態にしてください。

CLIMAXの正式なプレイ操作は、
将来CLIMAXフェイズ側で別途実装します。


# 9. Main selectionとplayabilityの責務を分離する

可能な限り既存APIの意味を明確にしてください。

例えば現在、

canSelectCardForMain()

が、

「MAINで詳細確認のため選択できるか」

と

「MAINでStageへプレイ候補になれるか」

を同時に表している場合は、
今回の仕様に合わせて責務を整理してください。

期待する概念は、

canSelectCardForMain
→ MAIN WAITING_INPUT中に手札Cardとして選択可能か

canPlayCharacterToStage
→ CHARACTERをStageへプレイ可能か

getCharacterPlayDisabledReason
→ CHARACTERをStageへプレイできない理由

getMainDestinationCandidates
→ 選択Cardに対して現在実行可能なMAIN Actionのdestination

です。

実際の関数名・構造は既存コードに合わせて構いませんが、

「選択可能」
と
「プレイ可能」

を同じ判定に戻さないでください。


# 10. Stage Card選択は今回変更しない

F-2Cで実装済みの、

- own Stage Character selection
- Stage → empty Stage Move
- Stage → occupied Stage Swap
- replacement確認
- Stage selection切替

等は今回の修正対象ではありません。

手札選択条件の修正によって、
Stage Move / Swap / Replacementを壊さないでください。


# 11. 右上カード詳細の画像レイアウト

F-3Dで追加した右上「カード説明」の画像表示を改善してください。

現在は、

「画像」という見出し列
+
大きな固定画像枠

のようなレイアウトになっています。

これを見直してください。


# 12. 「画像」という見出しを削除する

右上カード詳細の画像について、

画像 | [画像領域]

のような表形式にする必要はありません。

「画像」という左側見出しは削除してください。

画像はCard詳細の先頭に置く独立した1ブロックとして扱ってください。

イメージ：

カード説明

┌─────────────────────┐
│                     │
│      Card Image     │
│                     │
└─────────────────────┘

名前   ...
種類   ...
色     ...
...

既存サイドバーの横幅を有効に使ってください。


# 13. 画像ありの場合はCard全体を表示する

現在、縦長Card画像の下側が見切れる状態を確認しています。

これは修正してください。

imageUrlが正常に読み込めた場合は、

「Card画像全体が見えること」

を優先してください。

縦長Card：

- 縦長のまま
- 上端から下端まで全体を表示
- cropしない

横長Card：

- 横長のまま
- 左端から右端まで全体を表示
- cropしない

どちらも元画像のアスペクト比を維持してください。


# 14. 固定高さによるcropを避ける

画像全体を表示するために、

固定heightによって画像の一部を切る設計は避けてください。

既存CSSを確認し、
今回の右上詳細には、

width: 100%
height: auto
max-width: 100%

等を基本とした、
画像全体を表示できる方法を採用してください。

必要であればobject-fit: containを使用して構いませんが、

「固定高さの大きな枠に押し込める」

こと自体を目的にしないでください。

縦長画像・横長画像のどちらでも、
Card全体が確認できることを優先してください。


# 15. imageUrl=null時は大きな画像枠を確保しない

imageUrl === nullの場合、
現在のような大きな空画像領域は不要です。

大きな画像枠を確保せず、

「画像なし」

という1行程度のplaceholderだけ表示してください。

イメージ：

カード説明

画像なし

名前   青の守護者
種類   CHARACTER
...

程度で構いません。


# 16. image load errorも同じplaceholder

imageUrlは存在するが、

- 404
- 読み込み失敗
- その他img error

となった場合も、

imageUrl === null

と同様のコンパクトな、

「画像なし」

placeholderへfallbackしてください。

URLや画像ファイル名は表示しないでください。


# 17. placeholderと画像ありのレイアウトを分ける

画像ありの場合に必要な表示高さを、
画像なしの場合にも予約し続けないでください。

つまり、

画像あり
→ Card画像全体に必要な高さを使用

画像なし
→ 「画像なし」1行程度

としてください。

画像ロード失敗後も、
大きな空枠が残らないようにしてください。


# 18. 横長CLIMAX画像の確認を可能にする

F-3Dでは横長CLIMAX CardMasterにテスト画像を設定済みです。

今回、

CLIMAXもMAIN WAITING_INPUT中に選択可能

になるため、

DEVパネル
↓
横長CLIMAXを山札→手札
↓
手札でCLIMAXを選択
↓
右上詳細
↓
横長画像全体を表示

という確認が可能になります。

横長画像を縦向きへ回転しないでください。


# 19. 盤面・手札の画像方向は変更しない

今回の画像レイアウト変更対象は、

右上カード詳細

のみです。

以下は変更しないでください。

- Hand上のCard画像方向
- Stage上のCard画像方向
- Clock
- Level
- Climax zone
- Waiting Room
- Memory
- その他盤面上のCard

Card Typeによる自動回転も追加しないでください。

盤面上の画像方向ルールは将来別途設計します。


# 20. 右上の固定情報は今回は残す

現在の右上詳細に表示している、

- 名前
- 種類
- 色
- Level
- Cost
- Power
- Soul
- Trigger Icons
- Traits
- Abilities

は今回削除しないでください。

将来的には、

画像から確認できる固定情報
→ 表示省略候補

Power / Soul等のruntimeで変化し得る情報
→ テキスト表示を維持

Abilities
→ テキスト表示を維持

等のUI整理を検討する可能性があります。

ただし現在は開発中であり、

CardMaster
→ Card
→ Renderer

のデータ確認にも有用なので、
F-3Dで追加した固定情報表示は維持してください。


# 21. Power / Soul表示を維持する

F-3Dで実装した、

currentPower === basePower
→ 1500

currentPower !== basePower
→ 2000（元1500）

currentSoul === baseSoul
→ 1

currentSoul !== baseSoul
→ 2（元1）

という表示は変更しないでください。


# 22. Ability表示を維持する

F-3Dで実装した、

CONTINUOUS → 【永】
AUTO → 【自】
ACT → 【起】

およびCardAbility.textによる表示を維持してください。

今回の手札選択変更によって、
CLIMAX等でもCardにAbilityが存在すれば詳細表示できる構造を維持してください。

Ability実行は追加しないでください。


# 23. visibilityを維持する

今回の選択条件変更は、

自分のMAIN WAITING_INPUT中の自分の手札

が対象です。

既存visibilityルールを緩めないでください。

特に、

- 相手の非公開手札
- Deck
- Stock
- その他HIDDEN / OWNER_ONLY領域

から詳細情報や画像を露出させないでください。


# 24. テスト

既存テストを更新し、
今回の仕様を明示的にテストしてください。

最低限、以下を確認してください。


## MAIN Hand Selection

- 自分のターン + MAIN + WAITING_INPUT + 自分のHandならCHARACTERを選択可能
- 同条件ならCLIMAXも選択可能
- Level条件NGのCHARACTERも選択可能
- Color条件NGのCHARACTERも選択可能
- Cost不足のCHARACTERも選択可能
- プレイ不可CHARACTERでも詳細表示対象になれる
- CLIMAXは詳細表示対象になれる
- CLIMAX選択時にStage destinationを出さない
- CLIMAX選択時にPLAY_CHARACTERを開始しない


## Timing

- MAIN WAITING_INPUTでない場合は、今回のMain Hand Selection条件では選択不可
- 相手ターンでは選択不可
- 自分のHand以外を「MAINの手札選択」として扱わない

MAIN以外の一般Selection仕様は今回追加しないでください。


## Character Playability

既存の、

- Level
- Color
- Cost
- Character type

によるStage play判定が維持されていること。

つまり、

選択可能になったからプレイ可能になった

というregressionが起きないことを確認してください。


## F-2C Regression

- Stage Move
- Stage Swap
- Hand → occupied Stage Replacement
- selection切替

等を壊していないことを確認してください。


## Card Detail Image

DOMテスト可能な既存基盤があれば、

- 「画像」という見出しが不要になっている
- imageUrlありでは実画像を表示
- imageUrl=nullではコンパクトな「画像なし」
- load errorでもコンパクトな「画像なし」
- error後に大きな空画像枠が残らない

ことを確認してください。

CSSの実レイアウトについてブラウザ自動テスト基盤がない場合は、
大規模な新規テストフレームワークを導入しないでください。


# 25. ブラウザ目視確認項目

ブラウザ環境が利用できる場合は以下を確認してください。

1. imageUrl=null Cardを選択
   → 大きな空画像枠がなく、「画像なし」が1行程度で表示される

2. 「画像」という左側見出しがない

3. 縦長画像Cardを選択
   → Card上端から下端まで全体が見える
   → cropされない
   → アスペクト比が崩れない

4. 横長CLIMAXをDEVパネルから手札へ移動

5. 横長CLIMAXを手札で選択できる

6. 横長CLIMAXの右上詳細が表示される

7. 横長画像が横長のまま全体表示される

8. CLIMAXを選択してもStage destinationが出ない

9. CHARACTERのLevel/Color/Cost NG Cardは引き続き選択できる

10. その場合は既存のプレイ不可理由が表示される

11. プレイ可能CHARACTERは従来どおりStageへプレイできる

12. Stage Move / Swap / Replacementが壊れていない

13. Ability表示が従来どおり表示される


# 26. ドキュメント

必要な範囲で以下を更新してください。

- README.md
- docs/１．設計書/対戦画面/UI操作.md
- docs/１．設計書/システム共通/JavaScript仕様.md
- その他今回の仕様が記載されている設計書

特に、

MAINフェイズにおいて、

「Cardを選択して詳細を見ること」
と
「Cardをプレイできること」

は別判定であることを明記してください。

MAIN WAITING_INPUT中の自分の手札では、
cardTypeに関係なく詳細確認のため選択可能。

CHARACTERのStage play可否は、
その後に別途Level / Color / Cost等で判定。

CLIMAXはMAIN中でも詳細確認のため選択可能だが、
MAINからのプレイ処理はまだ持たない。

という現在仕様を記載してください。


# 27. READMEのPhaseは進めない

今回の修正によってPhaseを進めないでください。

READMEは引き続き、

F-3D COMPLETE
F-4 ACT Ability v1 + 代表的な実カード NEXT

としてください。

今回の修正をF-4として扱わないでください。


# 28. Non-goals

今回実装しないもの：

- F-4
- ACT Ability実行
- AUTO Ability実行
- CONTINUOUS Ability実行
- AbilityEngine
- effectQueue連携

- CLIMAXの正式プレイ処理
- CLIMAX Phaseの実装拡張
- MAINからCLIMAXをプレイする処理

- MAIN以外のSelection一般化
- 相手ターン中の自分の手札Selection仕様
- 公開zone全体のSelection framework
- Selection systemの大規模再設計

- Stage Move / Swap仕様変更
- Character play条件変更

- 盤面/手札の画像方向制御
- Card Typeによる盤面画像の自動回転

- 右上固定情報の削減
- Card detail全体の大規模UI再設計


# 29. Acceptance Criteria

以下をすべて満たしたら完了としてください。

1. MAIN WAITING_INPUT中の自分の手札CardはcardTypeに関係なく選択可能
2. CHARACTERを選択可能
3. CLIMAXも選択可能
4. プレイ不可CHARACTERも選択可能
5. Level NGでも選択可能
6. Color NGでも選択可能
7. Cost NGでも選択可能
8. CHARACTERのStage play条件自体は変更していない
9. プレイ不可理由表示を維持している
10. CLIMAX選択時に右上詳細を表示できる
11. CLIMAX選択時にStage destinationを表示しない
12. CLIMAX選択時にPLAY_CHARACTERを開始しない
13. MAIN WAITING_INPUTというタイミング制約を維持している
14. MAIN以外のSelectionを一般化していない
15. 相手ターンへ選択可能範囲を広げていない
16. Stage Move / Swap / Replacementを壊していない

17. 右上画像から「画像」という左側見出しを削除している
18. 画像を独立したブロックとして表示している
19. 縦長画像を全体表示できる
20. 縦長画像をcropしない
21. 横長画像を全体表示できる
22. 横長画像を回転しない
23. 画像のアスペクト比を維持している
24. imageUrl=null時に大きな空画像枠を確保しない
25. imageUrl=null時は「画像なし」を1行程度で表示する
26. load error時も同じコンパクトplaceholderへfallbackする
27. placeholderにURLや画像ファイル名を表示しない
28. load error後も大きな空枠が残らない
29. 盤面・手札の画像方向を変更していない

30. 名前/種類/色/Level/Cost/Power/Soul/Trigger/Traits/Abilities表示を維持している
31. Power/Soulのcurrent/base表示仕様を維持している
32. Abilityの【永】【自】【起】表示を維持している
33. visibilityを維持している
34. RendererへCardMasterRegistry依存を追加していない
35. F-4を先取りしていない
36. CLIMAX play処理を追加していない
37. 関連テストが成功する
38. 全既存テストが成功する
39. 設計書が今回の仕様と一致している
40. READMEがF-3D COMPLETE / F-4 NEXTのまま
41. working treeがcleanである


# 30. 実装後の確認

実装後は少なくとも以下を実施してください。

- 今回追加/更新したテスト
- node --test client/tests/*.test.mjs
- 全JavaScriptのnode --check
- git diff --check
- git status --short

必要に応じて検索し、

- RendererへCardMasterRegistry依存が入っていない
- CLIMAX play処理を誤って追加していない
- F-4 Ability実行を追加していない

ことも確認してください。

ブラウザ実行環境がない場合は、
その旨を完了報告に記載し、
上記の目視確認項目をユーザー側確認事項として残してください。


# 31. Commit

今回の修正はF-3D本体やDEV山札→手札機能とは分けた、
独立した小さなコミットにしてください。

例：

fix: refine card detail image and main hand selection

F-4の変更を同じコミットへ混ぜないでください。


# 32. 完了報告

完了時には以下を報告してください。

1. 実装概要
2. 変更ファイル
3. 新規/削除ファイル
4. MAIN Hand Cardの新しい選択条件
5. canSelectCardForMain等の変更内容
6. 「選択可能」と「プレイ可能」をどう分離したか
7. CHARACTER play条件を維持していること
8. Level/Color/Cost NG時の挙動
9. CLIMAX選択時の挙動
10. CLIMAXでStage destinationが出ないこと
11. CLIMAX play処理を追加していないこと
12. MAIN WAITING_INPUT制約を維持していること
13. MAIN以外へSelectionを広げていないこと
14. Stage Move/Swap/Replacementへの影響
15. 右上画像レイアウトの変更内容
16. 「画像」見出しの削除
17. 縦長画像の表示方法
18. 横長画像の表示方法
19. imageUrl=null時の表示
20. load error時のfallback
21. アスペクト比維持方法
22. 右上固定情報を維持していること
23. Power/Soul表示への影響
24. Ability表示への影響
25. visibilityへの影響
26. 盤面/手札画像方向を変更していないこと
27. 追加/更新テスト
28. 全テスト結果
29. syntax check結果
30. git diff --check結果
31. ブラウザ確認の実施可否
32. ユーザー側で確認すべき項目
33. README/docs更新内容
34. commit hash / commit message
35. PR情報
36. 最終git status

今回の修正の中心は、

「Cardを選択して詳細を見ること」
と
「Cardをプレイできること」

を明確に分離すること、

および、

「右上Card詳細では縦長・横長を問わずCard画像全体を自然に表示し、
画像がない場合は不要な大きな領域を使わないこと」

です。

新しいゲームルールを追加するのではなく、
既存F-2/F-3の責務を整理しながらUIを改善してください。
