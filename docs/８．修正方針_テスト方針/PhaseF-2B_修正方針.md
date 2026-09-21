# PhaseF-2B 修正方針

対象：Character HandからStageへのPlay

出典：Codexタスク「Phase D共通ルールチェック設計」（ID: 01a00a4d-c312-7680-917e-75f38686b7e9）。

2026-09-21に取得できた会話記録から作成。本文は当時の依頼・完了報告を原文中心に収録しています。記載されたテスト・コミット・push・作業ツリー状態は当時の報告であり、今回再実行・再検証した結果ではありません。パス・リンク・NEXTも当時の表記を保持しており、現在と異なる場合があります。

---

## 依頼・追加方針（2026-09-13 22:56 JST）

出典ターン：01a09b0d-deba-7f40-a448-0e9d78b8dcdb

# 依頼：Phase F-2B Character Hand → Stage 実装

Phase F-2A「MAINカード選択 / Destination UI」と各Follow-upは完了済みです。

今回は次工程として、
Phase F-2B「Character Hand → Stage」を実装してください。

目的は、

MAIN_PHASE / WAITING_INPUT中に
自分の手札のCharacterを選択し、
プレイ条件を満たす場合に、
自分のStageへ実際にプレイできるようにする

ことです。

今回は、

・Hand → Stage
・Play条件
・Play Cost
・Replacement
・PLAY_CHARACTER Process

までを実装対象とします。

Stage → StageのMove / Swapはまだ実装しません。
これはF-2Cで対応します。


==================================================
■ 0. 現在の前提
==================================================

現在以下は実装済みです。

Phase F-1
MAIN_PHASE基盤

Phase F-2A
MAINカード選択 / Destination UI

F-2A Follow-up
・DEV Panel改善
・相手CLOCKスキップ
・相手MAIN終了
・自分山札TOP→Stock
・Stock表示改善


F-2A現在仕様：

・MAIN_PHASE / WAITING_INPUT中のみ操作
・自分HandのCharacterを選択可能
・Selection StateはMainPhaseControllerローカル
・GameStateにはSelectionを保存しない
・選択カードにはselected表示
・Stage 5slotをDestination表示
・カード詳細は右カード説明へ表示
・「選択を解除」あり
・空白クリックでSelection解除
・Destinationクリックではまだ移動しない
・MAIN終了時にSelection UIを解除
・MAIN_PHASE stepは選択中もWAITING_INPUTのまま


今回F-2Bでは、
このF-2A UIを土台として実際のCharacter Playを追加します。


==================================================
■ 1. まず既存実装を確認
==================================================

変更前に以下を確認してください。

・MAIN_PHASE Process
・MAIN_STEP
・MainPhaseController
・GameEngine.canSelectCardForMain()
・GameEngine.getMainDestinationCandidates()
・RendererのMAIN selection / destination表示
・Card.moveTo()
・Player.hand
・Player.stage
・Player.level
・Player.clock
・Player.stock
・Player.waitingRoom
・Stage slotのrow/index表現
・Stock TOPの配列方向
・Waiting Room TOPの配列方向
・Card.position
・Card.face
・PROCESS_TYPE
・PROCESS_STATUS
・ProcessManager
・completeCurrentProcess()
・resolveRuleCheck()
・現在のRule Check return値


既存設計を優先し、
必要以上に新しい仕組みを増やさないでください。


==================================================
■ 2. 今回の対象Action
==================================================

今回対象とするのは、

自分の手札のCharacter
→
自分のStage slotへプレイ

です。


対象外：

・Event使用
・Climax使用
・Stage → Stage移動
・Stage → Stage Swap
・ACT Ability
・AUTO
・CONTINUOUS
・CardMaster
・CardAbility


==================================================
■ 3. プレイ不可Characterも選択可能
==================================================

F-2Bでも、
手札のCharacter自体はプレイ可否に関係なく選択可能としてください。


例：

・Level条件NG
・Color条件NG
・Stock不足

であっても、

カードクリック
→ selected
→ 右カード説明表示

までは可能です。


ただしプレイできない場合は、

・Stage Destinationを表示しない
・右カード説明内にプレイ不可理由を表示

としてください。


例：

「プレイできません」
「レベル条件を満たしていません」

「プレイできません」
「必要な色条件を満たしていません」

「プレイできません」
「ストックが不足しています」


文言は現在のUIに合わせて自然に調整して構いません。


==================================================
■ 4. プレイ条件
==================================================

Hand → StageのCharacter Playでは、
以下を確認してください。


--------------------------------------------------
■ 4-1. Card Type
--------------------------------------------------

CharacterのみStageへプレイ可能です。

cardType === "character"

現在cardTypeは文字列比較のため、
今回は既存方式を維持してください。

CardMaster /定数化はF-3以降です。


--------------------------------------------------
■ 4-2. Level条件
--------------------------------------------------

プレイヤーLevelは、

player.level.length

で判定してください。


条件：

card.level <= player.level.length


例：

Player Level 0
→ Level 0 Characterのみ

Player Level 1
→ Level 0 / 1 Character

Player Level 2
→ Level 0 / 1 / 2 Character


==================================================
■ 5. Color条件
==================================================

Level 1以上のCharacterは、
Color条件を確認してください。


Level 0 Character
→ Color条件なし


Level 1以上
→ そのCharacterのcolorが、

自分のLEVEL
または
自分のCLOCK

のどこかに存在すること


概念：

hasColor =
player.level.some(card => card.color === targetColor)
||
player.clock.some(card => card.color === targetColor)


Level 1以上でhasColor === falseの場合、
プレイ不可です。


今回はCharacterのみ対象ですが、
将来的にEvent / Climaxでも同様のColor条件を利用する可能性があります。

ただし今回は汎用ルールエンジン化しすぎないでください。


==================================================
■ 6. Cost条件
==================================================

Characterの基本Play Costは、
現在Cardが持っているcostを使用してください。


条件：

player.stock.length >= card.cost


Stock不足ならプレイ不可です。


Cost 0
→ そのままプレイ可能


==================================================
■ 7. Play可否Query
==================================================

既存のF-2A Query APIを必要に応じて拡張してください。


現在：

canSelectCardForMain(card, playerId)

getMainDestinationCandidates(card, playerId)


が存在します。


F-2Bでは、

・カードは選択可能
・しかしプレイ可能とは限らない

という区別が必要です。


必要であればGameEngineへ、

canPlayCharacterToStage(card, playerId)

getCharacterPlayDisabledReason(card, playerId)

等のQueryを追加して構いません。


重要：

ルール判定はControllerへ書かず、
GameEngine側へ寄せてください。


Controllerは、

・入力
・UI-local Selection
・確認UI

を担当し、

プレイ可能かどうかのルールはGameEngineで判定してください。


==================================================
■ 8. Destination表示
==================================================

選択中Characterがプレイ可能な場合のみ、

自分Stage 5slotをDestinationとして表示してください。


対象：

・front 3slot
・back 2slot


Destinationは、

empty slot
cardありslot

の両方を候補としてください。


プレイ不可Characterの場合は、
Stage Destinationを表示しないでください。


==================================================
■ 9. empty / cardありslot
==================================================

Stage Destinationには2種類あります。


### empty slot

カードが置かれていないStage slot。


### cardありslot

すでにCharacterが置かれているStage slot。


今回は「occupied」という英語をUI文言では無理に使わず、
コード上必要なら既存命名に合わせてください。


==================================================
■ 10. empty Stageへのプレイ
==================================================

選択中Characterがプレイ可能で、

empty Stage slotをクリックした場合、

そのDestinationを確定し、
Character Play Actionを開始してください。


概念：

Hand Character
↓
PLAY_CHARACTER Process
↓
Stage


==================================================
■ 11. cardありStageへのプレイ
==================================================

選択中Hand CharacterのDestinationとして、
すでにCharacterが置かれているStage slotをクリックした場合、

すぐに置き換えないでください。


盤面UI内に、
小さな確認パネル / 確認ウインドウを表示してください。


ブラウザ標準のconfirm()は使用しないでください。


==================================================
■ 12. Replacement確認UI
==================================================

確認UIは概念的に以下です。

「この場所にはカードがあります」

[置き換える]
[このカードを選択]
[戻る]


--------------------------------------------------
■ 12-1. 置き換える
--------------------------------------------------

現在選択中のHand Characterを
そのStage slotへプレイします。


既存Stage CharacterはWaiting Roomへ送ります。


--------------------------------------------------
■ 12-2. このカードを選択
--------------------------------------------------

現在のHand Character Selectionを解除し、

クリックしたStage Characterを
今後のStage操作対象として選択する方向です。


ただし、

Stage → Stage操作そのものはF-2Cです。


F-2Bでは、
このボタンを押した際に、

・Hand Selectionを解除
・clicked Stage cardを選択状態へ切り替える

まで実装可能であれば対応してください。


ただしF-2AのSelection構造がHand専用で、
F-2C前にStage Selectionを入れると設計変更が大きくなる場合は、

F-2Bではこのボタンを非表示 / disabled / 「F-2Cで対応」とするのではなく、

実装前に既存構造を確認し、
最小変更で自然にStageカード選択へ切替可能か判断してください。


もしStage Selection導入がF-2C相当の実装を大きく先取りする場合は、
今回無理に実装しないでください。

その場合、
完了報告で理由を明記してください。


--------------------------------------------------
■ 12-3. 戻る
--------------------------------------------------

確認UIを閉じ、

元のHand Character Selectionを維持してください。


==================================================
■ 13. 確認UI state
==================================================

Replacement確認UIの状態は、

GameStateへ保存しないでください。


以下はUI-local / Controller-localで管理してください。

・selected card
・selected hand index
・pending destination
・replacement confirmation open/close


ゲームとして確定したActionのみ、
GameEngineへ渡してください。


==================================================
■ 14. PLAY_CHARACTER Process
==================================================

Hand → Stageは、
同期的な単発GameEngine処理だけで終わらせず、

独立したAction Processとして実装してください。


PROCESS_TYPEは、

PLAY_CHARACTER

または既存命名規則に合う自然な名前を追加してください。


MAIN_PHASEの子Actionとして動作するイメージです。


概念：

MAIN_PHASE
WAITING_INPUT

↓

Character Play確定

↓

PLAY_CHARACTER Process push

↓

完了

↓

MAIN_PHASE / WAITING_INPUTへ復帰


==================================================
■ 15. PLAY_CHARACTER Step
==================================================

以下を基本構造としてください。


VALIDATE
↓
PAY_COST
↓
REMOVE_EXISTING
↓
MOVE_TO_STAGE
↓
CHECK_POINT
↓
COMPLETE


既存のstep定義方式へ合わせてください。


==================================================
■ 16. VALIDATE
==================================================

Action確定時に、
GameEngine側で再検証してください。


UIでプレイ可能と表示されていても、
実行直前に必ず再確認します。


最低限：

・現在MAIN Phaseか
・MAIN_PHASEがWAITING_INPUTか
・turn playerが対象playerか
・cardがまだ対象playerのhandに存在するか
・card.ownerが正しいか
・cardTypeがcharacterか
・destinationが自分Stageの有効slotか
・Level条件
・Color条件
・Stock条件


重要：

UI判定だけを信用しないでください。


==================================================
■ 17. validation failure
==================================================

VALIDATEで失敗した場合、

Cost支払い等を一切行わず、
安全にActionを終了 / Rejectしてください。


既存のEngine error handling方針に合わせてください。


中途半端に、

Stockだけ減った
Stageは変わっていない

という状態にしないでください。


==================================================
■ 18. PAY_COST
==================================================

VALIDATE成功後、
CharacterのPlay Costを支払ってください。


CostはStockから支払います。


現在の仕様：

Stock TOP = 配列末尾


Cost 2の場合：

stock = [A, B, C, D]

D → Waiting Room
C → Waiting Room

残り：

[A, B]


という順です。


Cost支払いはTOPから1枚ずつ行ってください。


==================================================
■ 19. CostでWaiting Roomへ送られるカード
==================================================

StockからCostとしてWaiting Roomへ送るカードは、
既存のCard移動規約へ合わせてください。


概念：

zone     → WAITING_ROOM
row      → null
index    → Waiting Room TOP
position → STAND
face     → null


Waiting Room TOPが配列先頭 / 末尾のどちらかは、
既存実装を確認して従ってください。


==================================================
■ 20. REMOVE_EXISTING
==================================================

Destinationに既存Characterが存在する場合のみ実行します。


empty slotの場合：
→ no-op


cardありslotの場合：

既存Character
→ Waiting Room


概念：

zone     → WAITING_ROOM
row      → null
index    → Waiting Room TOP
position → STAND
face     → null


これはSwapではありません。


Hand → cardありStageは、

Replacement

です。


既存Stage CharacterとHand Characterを
入れ替えるのではありません。


==================================================
■ 21. MOVE_TO_STAGE
==================================================

選択したHand Characterを、
確定Destinationへ移動してください。


移動後：

zone     → STAGE
row      → destination row
index    → destination index
position → STAND
face     → null


face = nullは、
既存のZone visibilityに従う通常表示です。


==================================================
■ 22. CHECK_POINT
==================================================

Character Playの一連処理が成立した後に、
Rule Checkを実行してください。


重要：

PAY_COST
REMOVE_EXISTING
MOVE_TO_STAGE

の途中へ機械的にRule Checkを挟まないでください。


今回のCharacter Playは、

Play Cost支払い
+
Replacement
+
新Character配置

までを一連Actionとして処理した後、

CHECK_POINT

でRule Checkします。


==================================================
■ 23. CHECK_POINTでのProcess保存
==================================================

既存DRAW / CLOCK Processと同じ思想で、

Rule Check前に
PLAY_CHARACTER Processのresume先stepを保存してください。


概念：

MOVE_TO_STAGE
↓
step = COMPLETE を先に保存
↓
resolveRuleCheck()
↓
interruptがあればreturn
↓
interrupt完了後
PLAY_CHARACTER / COMPLETEへ復帰


実際のstep設計に合わせてください。


==================================================
■ 24. Rule Check return値
==================================================

既存の、

CONTINUE
INTERRUPTED
GAME_OVER
WAITING_INTERRUPT_SELECTION

等のreturn値を利用してください。


resolveRuleCheck()がCONTINUE以外なら、
その場で処理を止めてください。


既存Process設計を維持してください。


==================================================
■ 25. COMPLETE
==================================================

PLAY_CHARACTER Process完了後、

completeCurrentProcess()

等の既存正常経路でpopしてください。


その後、

MAIN_PHASE
player = self
step = WAITING_INPUT
status = WAITING_INPUT

へ戻ること。


Characterを1枚出しただけで
MAIN Phaseを終了しないでください。


続けて、

・別Characterを出す
・将来ACTを使う
・MAIN終了

を選べる状態に戻します。


==================================================
■ 26. Selection UI cleanup
==================================================

Character Playが確定・完了したら、

MainPhaseControllerのSelection UIを解除してください。


・selected card
・selected hand index
・destination highlight
・replacement confirmation

をclearしてください。


ただしGameEngineがUI stateを直接触らないでください。


既存Controller / Renderer構造に合わせて、
GameEngine完了後にUI-local stateをcleanupしてください。


==================================================
■ 27. Play不可理由の優先順
==================================================

複数条件を満たさない場合、
最低限1つ理由が分かれば構いません。


優先順の例：

1. Characterではない
2. Level条件
3. Color条件
4. Stock条件


ただしF-2Aでは非Character自体を選択対象外としているため、
実際にはLevel / Color / Stockが中心になる想定です。


複数理由表示を無理に作らなくて構いません。


==================================================
■ 28. 右カード説明
==================================================

選択中Characterがプレイできない場合、

既存カード説明の下部など、
カード由来Actionを表示する領域に
プレイ不可理由を表示してください。


ゲーム全体ボタン領域へは出さないでください。


右サイドバーの意味分け：

カード説明内
→ カード由来情報 / Action

カード説明外
→ MAIN終了等のゲーム全体Action


この方針を維持してください。


==================================================
■ 29. Destinationクリック
==================================================

F-2AではDestinationクリックはno-opでした。


F-2Bからは、

empty slot
→ Character Play開始

cardありslot
→ Replacement確認UI

へ変更してください。


Destination以外のStage slotクリック等で
意図しないPlayが発生しないようにしてください。


==================================================
■ 30. Stage card selection
==================================================

F-2CではStage → Stage Move / Swapを実装予定です。


今回F-2BでStage card selectionを最小限入れる場合でも、

Stage移動
Swap

は実装しないでください。


F-2Cの責務を先取りしすぎないようにしてください。


==================================================
■ 31. Log
==================================================

既存GameState.log / addLog()の方式に合わせて、

CharacterをStageへプレイしたことが分かるログを追加して構いません。


例：

「あなた ○○ を舞台に出しました。」

Replacement時の既存Character移動やCost支払いを
細かく全件ログに出すかは、
既存ログ粒度へ合わせてください。


不要に大量ログを増やさないでください。


==================================================
■ 32. F-2A互換
==================================================

以下を維持してください。


・Character選択
・別CharacterへのSelection切替
・選択解除
・空白クリック解除
・カード詳細表示
・MAIN以外で選択不可
・MAIN終了でSelection cleanup
・Destination専用class
・Mulligan / CLOCK / LEVEL_UPの選択UI


==================================================
■ 33. Stock UI互換
==================================================

直前のFollow-upで改善したStock表示を壊さないでください。


・self/opponent Stock Zone高さ
・全Stockカード表示
・通常offset
・必要時のみ動的圧縮


Cost支払いによってStock枚数が減った際も、
Rendererが正常に再表示されることを確認してください。


==================================================
■ 34. DEV Panel互換
==================================================

以下の既存DEV Actionを壊さないでください。


・次フェイズ
・自分1枚ドロー
・相手1枚ドロー
・再描画
・Stack確認
・Refresh
・手札→Clock
・山札→Clock
・Level Up
・共通チェック
・Rule Check解決
・相手Clockスキップ
・相手MAIN終了
・自分山札TOP→Stock


DEV Panel折りたたみ / scrollも維持してください。


==================================================
■ 35. 今回変更しないもの
==================================================

以下は今回実装しないでください。


・Stage → Stage
・Stage Move
・Stage Swap
・F-2C
・ACT Ability
・AUTO Ability
・CONTINUOUS Ability
・CardMaster
・CardAbility
・カード画像
・Event使用
・Climax使用
・Ability Cost
・Brainstorm
・オンライン対戦
・CPU


==================================================
■ 36. README / docs
==================================================

F-2B実装完了後、

READMEのロードマップを更新してください。


F-2B
Character Hand → Stage
→ 完了


NEXT：

Phase F-2C Stage → Stage


docs/１．対戦画面設計書/main-phase.md

について、
実装と既存設計に差分があれば必要最小限更新してください。


特に以下が明確になっていること：

・Play条件
・Replacement
・PLAY_CHARACTER Process
・Play Cost
・Rule Check point


大規模な設計書書き直しは不要です。


==================================================
■ 37. 確認ケース
==================================================

最低限以下を確認してください。


--------------------------------------------------
【A：Level 0 / Cost 0 / empty Stage】
--------------------------------------------------

Player Level 0
Hand Level 0 Character
Cost 0
empty Stage

期待：

Destination表示
↓
click
↓
PLAY_CHARACTER
↓
Stageへ配置
↓
MAIN WAITING_INPUTへ戻る


--------------------------------------------------
【B：Level条件NG】
--------------------------------------------------

Player Level 0
Hand Level 1 Character

期待：

Characterは選択できる
カード詳細は表示される
Destinationは表示されない
プレイ不可理由表示


--------------------------------------------------
【C：Color条件NG】
--------------------------------------------------

Player Level 1以上
Hand Level 1 Character
LEVEL/CLOCKに対象colorなし

期待：

選択可能
Destinationなし
Color条件理由表示


--------------------------------------------------
【D：Color条件OK】
--------------------------------------------------

LEVELまたはCLOCKに同色あり

期待：

他条件もOKならDestination表示


--------------------------------------------------
【E：Stock不足】
--------------------------------------------------

Cost 2
Stock 1

期待：

選択可能
Destinationなし
Stock不足理由


--------------------------------------------------
【F：Cost支払い】
--------------------------------------------------

Cost 2
Stock = [A, B, C, D]

TOP = D

期待：

D → Waiting Room
C → Waiting Room

Stock残り：

[A, B]

その後Character Stage配置


--------------------------------------------------
【G：empty slot】
--------------------------------------------------

Stage empty

期待：

Replacementなし
Hand CharacterのみStageへ


--------------------------------------------------
【H：cardありslot】
--------------------------------------------------

Stageに既存Characterあり

期待：

Destinationクリック
↓
確認UI表示

即時置換しない


--------------------------------------------------
【I：置き換える】
--------------------------------------------------

確認UI
↓
「置き換える」

期待：

既存Stage Character
→ Waiting Room

Hand Character
→ 同じStage slot

MAINへ復帰


--------------------------------------------------
【J：戻る】
--------------------------------------------------

確認UI
↓
「戻る」

期待：

確認UIのみ閉じる
元Hand Character Selection維持
ゲーム状態変更なし


--------------------------------------------------
【K：validation再確認】
--------------------------------------------------

Action確定直前に、
card/destination/条件を再検証

期待：

失敗時Cost未払い
ゲーム状態半端にならない


--------------------------------------------------
【L：Rule Check】
--------------------------------------------------

Character Play完了後

期待：

CHECK_POINT
↓
既存resolveRuleCheck()
↓
問題なければCOMPLETE
↓
MAIN WAITING_INPUT


--------------------------------------------------
【M：Selection cleanup】
--------------------------------------------------

Play完了

期待：

selected card解除
Destination解除
確認UI解除


--------------------------------------------------
【N：複数回Play】
--------------------------------------------------

Character 1枚Play
↓
MAINへ復帰
↓
別Character選択
↓
再度Play

期待：

MAINを終了せず複数回操作可能


--------------------------------------------------
【O：F-2A回帰】
--------------------------------------------------

・Selection切替
・選択解除
・空白解除
・MAIN終了
・カード詳細

正常


--------------------------------------------------
【P：既存Process回帰】
--------------------------------------------------

・DRAW
・CLOCK
・REFRESH
・REFRESH_PENALTY
・LEVEL_UP

正常


==================================================
■ 38. 完了条件
==================================================

以下を満たしたら完了です。


1.
Hand CharacterをStageへ実際にプレイできる

2.
Play不可Characterも選択可能

3.
Level条件がある

4.
Level 1以上のColor条件がある

5.
Stock Cost条件がある

6.
プレイ不可理由が右カード説明内に表示される

7.
プレイ可能時のみStage 5slotがDestinationになる

8.
empty Stageへ配置できる

9.
cardありStageでReplacement確認UIが出る

10.
Replacementで既存CharacterがWaiting Roomへ行く

11.
PLAY_CHARACTER Processを使用している

12.
stepが基本的に
VALIDATE
PAY_COST
REMOVE_EXISTING
MOVE_TO_STAGE
CHECK_POINT
COMPLETE
となっている

13.
実行直前にGameEngineで再validationする

14.
CostをStock TOPから支払う

15.
途中validation failureで部分支払いしない

16.
Character Play完了後にRule Checkする

17.
完了後MAIN_PHASE / WAITING_INPUTへ戻る

18.
Play後Selection UIをclearする

19.
Stage → Stageはまだ実装していない

20.
既存F-2A / DEV / Stock UI / Rule Processを壊していない

21.
READMEのNEXTがF-2Cになっている


==================================================
■ 39. 作業完了時の報告
==================================================

完了後、以下を報告してください。


【変更ファイル】

・変更したファイル一覧


【GameEngine】

・追加したQuery API
・Play可否判定
・Level判定
・Color判定
・Cost判定
・validation方法


【PLAY_CHARACTER】

・PROCESS_TYPE
・step一覧
・各stepの責務
・Process push / pop
・MAINへの復帰方法


【Cost】

・Stock TOP定義
・Cost支払い方法
・Waiting Room TOP定義


【Replacement】

・empty slot時
・cardありslot時
・既存Characterの移動状態
・新CharacterのStage状態


【UI】

・プレイ不可理由
・Destination
・Replacement確認UI
・Selection cleanup


【Rule Check】

・CHECK_POINTの位置
・resolveRuleCheck()との接続
・Interrupt時のresume step


【確認結果】

・Level条件
・Color条件
・Cost条件
・Cost支払い
・empty placement
・Replacement
・複数回Play
・F-2A回帰
・DRAW/CLOCK/REFRESH/LEVEL_UP回帰


【設計上の留意点】

・F-2Cへ持ち越したStage Selection / Move / Swap
・CardMaster導入時に移行が必要な文字列比較
・その他気付いた懸念

---

## 依頼・追加方針（2026-09-13 22:59 JST）

出典ターン：01a09b11-19f8-79b2-a021-5ee8d2a2a9e6

確認ありがとうございます。

記載いただいた前提・方針で問題ありません。
その内容でPhase F-2B本体の実装を進めてください。

特に以下はその方針でお願いします。

・MAIN\_PHASE / WAITING\_INPUT を親として PLAY\_CHARACTER Process を積む
・Stock TOP / Waiting Room TOP は配列末尾
・Replacement確認状態は MainPhaseController ローカル
・Stageカード選択はF-2Cへ持ち越し
・F-2BではStage→Stage Move / Swapを実装しない
・必要な PROCESS\_TYPE / 専用step / GameEngine Query・実行APIを追加
・プレイ不可理由表示、Replacement確認UIを実装
・実装完了後にREADMEとmain-phase.mdを必要最小限更新

前回依頼した完了条件・確認ケースに沿って、
実装、回帰確認まで続けてください。

実装完了後に、
変更ファイル、Process構造、Play条件、Cost、Replacement、Rule Check、
確認結果、F-2Cへの持ち越し事項を報告してください。

