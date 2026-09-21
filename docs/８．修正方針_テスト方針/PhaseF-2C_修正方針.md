# PhaseF-2C 修正方針

対象：Stage Move・Swap

出典：Codexタスク「Phase D共通ルールチェック設計」（ID: 01a00a4d-c312-7680-917e-75f38686b7e9）。

2026-09-21に取得できた会話記録から作成。本文は当時の依頼・完了報告を原文中心に収録しています。記載されたテスト・コミット・push・作業ツリー状態は当時の報告であり、今回再実行・再検証した結果ではありません。パス・リンク・NEXTも当時の表記を保持しており、現在と異なる場合があります。

---

## 依頼・追加方針（2026-09-14 00:35 JST）

出典ターン：01a09b68-f2a7-74a2-8ec4-a6325148aafe

# 依頼：Phase F-2C Stage → Stage Move / Swap

Phase F-2B「Character Hand → Stage」は完了済みです。

現在、

・Hand Characterの選択
・Play条件判定
・Hand → Stage
・Replacement
・PLAY_CHARACTER Process
・Level / Color / Cost / Stock支払い
・test-cards.json

まで実装されています。

次はPhase F-2Cとして、

Stage上の自分Characterを選択し、
別の自分Stage slotへ

・空きslotならMove
・使用中slotならSwap

できるようにしてください。


==================================================
■ 1. 今回の目的
==================================================

MAIN Phase中に、

自分Stage Character
↓
別の自分Stage slot

への移動を実装します。


Destinationが空きの場合：

Stage → Stage Move


DestinationにCharacterがある場合：

Stage Character同士をSwap


重要：

これはCharacter Playではありません。


そのため、

・Level条件
・Color条件
・Play Cost
・Stock支払い

は発生しません。


==================================================
■ 2. 現在のF-2Bとの違い
==================================================

現在のHand → Stageは、

PLAY_CHARACTER

として実装されています。


今回のStage → Stageは別Actionとして扱ってください。


Hand → Stage
→ PLAY_CHARACTER


Stage → empty Stage
→ MOVE_STAGE


Stage → occupied Stage
→ SWAP_STAGE


PLAY_CHARACTERへ統合しないでください。


==================================================
■ 3. MAIN Phase前提
==================================================

Stageカードを操作可能なのは、

・自分ターン
・Phase === MAIN
・現在Processが MAIN_PHASE
・MAIN_STEP === WAITING_INPUT

の場合だけです。


相手StageカードはF-2Cでは操作対象にしません。


==================================================
■ 4. Stage Card Selection
==================================================

MAIN Phase中、
自分Stage上のCharacterをクリックすると選択できるようにしてください。


選択対象：

・owner === current turn player
・zone === STAGE
・Character
・MAIN_PHASE / WAITING_INPUT


選択されたStageカードは、
Hand選択と同じように視覚的に明確にしてください。


既存の `.is-selected` 等を再利用できる場合は再利用してください。


==================================================
■ 5. Hand Selectionとの排他
==================================================

MAIN Phaseで選択中のCardは、
原則1枚だけにしてください。


Stageカードを選択した場合：

・既存Hand selectionを解除
・Stage cardをselectionへ設定


Handカードを選択した場合：

・既存Stage selectionを解除
・Hand cardをselectionへ設定


GameStateには未確定Selectionを保存しないでください。


Selectionは引き続きController / UI local stateとしてください。


==================================================
■ 6. Selection State設計
==================================================

現在MainPhaseControllerに、

selectedCard
selectedHandIndex

等がある場合、
Stage Selectionも自然に扱えるよう整理してください。


必要であれば、

selectedSource
selectedZone
selectedStageRow
selectedStageIndex

等を導入して構いません。


ただし、
大規模なSelection frameworkの抽象化は不要です。


F-2Cで必要な範囲の最小変更にしてください。


==================================================
■ 7. Stage Destination Candidate
==================================================

Stage Characterを選択した場合、

自分Stage 5slotのうち、

「現在いるslot以外」

をDestination候補としてください。


例：

front index 1にいるCharacterを選択

候補：

front 2
front 3
back 1
back 2


現在slot自身はDestinationにしないでください。


==================================================
■ 8. GameEngine Query API
==================================================

Stage Move / Swapの可否判定は、
ControllerではなくGameEngine側へ置いてください。


現在構造に合わせて、
例えば以下のようなQuery APIを検討してください。


canSelectStageCardForMain(card, playerId)

getMainStageMoveDestinations(card, playerId)

canMoveStageCard(card, destination, playerId)


名称は既存命名規則に合わせて調整して構いません。


重要：

Controllerがルールを直接判定しないでください。


==================================================
■ 9. Empty Destination → Move
==================================================

Destinationが空きの場合、

選択Characterをそのslotへ移動してください。


移動前：

source row/index


移動後：

zone     = STAGE
row      = destination row
index    = destination index


以下の状態は保持してください。


position

例：

STAND
→ STAND

REST
→ REST

REVERSE
→ REVERSE


faceも不要に変更しないでください。


通常Stage上では現在の値を保持してください。


==================================================
■ 10. Occupied Destination → Swap
==================================================

DestinationにCharacterが存在する場合、

ReplacementではなくSwapです。


例：

A
front / index1

B
back / index2


Swap後：


A
back / index2


B
front / index1


どちらのカードもWaiting Roomへ送りません。


Costも発生しません。


positionは双方とも保持してください。


例：

A = REST
B = STAND

Swap後も、

A = REST
B = STAND


のままです。


==================================================
■ 11. Occupied Destination確認UI
==================================================

使用中slotをクリックした場合は、
即Swapしないでください。


F-2B Replacement確認と同様に、
小さな独自確認UIを表示してください。


ブラウザ標準 confirm() は使わないでください。


表示内容：

この場所にはカードがあります


[入れ替える]

[このカードを選択]

[戻る]


==================================================
■ 12. 「入れ替える」
==================================================

「入れ替える」を押した場合、

Stage Character同士をSwapしてください。


成功後：

・selection解除
・Destination highlight解除
・確認UIを閉じる
・MAIN_PHASE / WAITING_INPUTへ戻る


==================================================
■ 13. 「このカードを選択」
==================================================

今回はF-2Cなので、
このボタンを正式に実装してください。


Destination側のStage Characterを
新しいselectedCardへ切り替えてください。


例：

Aを選択
↓
Bがいるslotクリック
↓
確認UI
↓
「このカードを選択」
↓
Bがselected
↓
Aはselected解除
↓
Bから見たDestination候補を表示


SwapやMoveは実行しません。


確認UIは閉じてください。


==================================================
■ 14. 「戻る」
==================================================

確認UIだけ閉じてください。


元のStage Selectionは維持してください。


Destination highlightも維持してください。


==================================================
■ 15. Action Process
==================================================

Stage → Stageも、
GameEngineのAction Processとして実装してください。


推奨：


MOVE_STAGE

VALIDATE
→ MOVE
→ CHECK_POINT
→ COMPLETE


SWAP_STAGE

VALIDATE
→ SWAP
→ CHECK_POINT
→ COMPLETE


現在のProcess設計と整合するなら、
共通Process + actionTypeでも構いませんが、
無理に抽象化しないでください。


PLAY_CHARACTERとは分離してください。


==================================================
■ 16. Validation
==================================================

Move / Swap実行直前に
GameEngineで必ず再検証してください。


確認項目：

・MAIN Phase
・MAIN_PHASE / WAITING_INPUT
・turn player
・source cardがまだStageにいる
・ownerが正しい
・source row/indexが一致
・destinationが自分Stage slot
・sourceとdestinationが同一でない
・Swapならdestination cardがまだそのslotにいる


UI Queryだけを信用しないでください。


Validation失敗時：

・盤面変更なし
・部分的Moveなし
・部分的Swapなし


==================================================
■ 17. MOVE_STAGE Process
==================================================

概念：


MAIN_PHASE / WAITING_INPUT
↓
MOVE_STAGE push
↓
VALIDATE
↓
MOVE
↓
CHECK_POINT
↓
COMPLETE
↓
pop
↓
MAIN_PHASE / WAITING_INPUT


MOVEでは、

source slotを空ける
↓
card.row/indexをdestinationへ変更

してください。


Player.stageの現在データ構造に合わせて、
Stage slot管理も正しく更新してください。


DOMだけ変更しないでください。


==================================================
■ 18. SWAP_STAGE Process
==================================================

概念：


MAIN_PHASE / WAITING_INPUT
↓
SWAP_STAGE push
↓
VALIDATE
↓
SWAP
↓
CHECK_POINT
↓
COMPLETE
↓
pop
↓
MAIN_PHASE / WAITING_INPUT


Swapは、
source / destination双方のrow/indexを
安全に入れ替えてください。


一時変数を使い、

sourceだけ先に上書きしてdestination位置を失う

等が起きないようにしてください。


==================================================
■ 19. Rule Check
==================================================

Move / Swapを一連Actionとして完了した後に
Rule Checkしてください。


MOVE：

MOVE
↓
CHECK_POINT
↓
resume step = COMPLETE
↓
resolveRuleCheck()


SWAP：

SWAP
↓
CHECK_POINT
↓
resume step = COMPLETE
↓
resolveRuleCheck()


resolveRuleCheck() が CONTINUE 以外の場合は停止し、
割り込み完了後にCOMPLETEへ復帰できるようにしてください。


F-2BのPLAY_CHARACTERと同じ思想です。


==================================================
■ 20. Position保持
==================================================

今回かなり重要です。


Stage Move / Swapでは、

position

を変更しないでください。


STAND
REST
REVERSE

すべて保持してください。


Hand → Stage PlayではSTAND配置ですが、
Stage → Stageでは既存状態維持です。


==================================================
■ 21. Face保持
==================================================

Stage Move / Swapでは、
faceを不要に変更しないでください。


face = null

ならnullのまま。


明示的なFACE.UP / FACE.DOWNが将来存在する場合も、
Move / Swapだけを理由に書き換えない設計にしてください。


==================================================
■ 22. Selection解除
==================================================

Move成功後：

・selectedCard解除
・source/destination highlight解除


Swap成功後：

・selectedCard解除
・source/destination highlight解除
・confirmation UI解除


「このカードを選択」の場合：

・destination cardへselection切替


「戻る」の場合：

・元selection維持


==================================================
■ 23. Blank Click
==================================================

既存F-2A/F-2Bと同様、

盤面の空白クリックでSelection解除

が正しく動くようにしてください。


ただし、
確認UI内部クリックがBlank Clickとして扱われないよう注意してください。


==================================================
■ 24. MAIN終了
==================================================

「メインフェイズ終了」を押した場合、

Hand Selection
Stage Selection
Destination highlight
Swap confirmation

をすべて解除してください。


UI local stateを残さないでください。


==================================================
■ 25. Card Detail
==================================================

Stage Characterを選択した場合も、
右カード詳細へそのカード情報を表示してください。


既存のカード詳細機構を可能な限り再利用してください。


Stage Selection専用の別カード詳細UIは作らないでください。


==================================================
■ 26. Hand → occupied Stageとの共存
==================================================

既存F-2Bでは、


Hand Character
↓
occupied Stage

はReplacementです。


今回追加する、


Stage Character
↓
occupied Stage

はSwapです。


この2つを混同しないでください。


Selection source zoneに応じて処理を分けてください。


HAND
→ PLAY / REPLACEMENT


STAGE
→ MOVE / SWAP


==================================================
■ 27. Replacement確認UIとの共存
==================================================

F-2BのReplacement確認UIを壊さないでください。


可能であれば同じ確認パネル構造を再利用して構いません。


ただし表示内容とActionは明確に分けてください。


Hand → occupied Stage：

[置き換える]
[このカードを選択] ※現在実装状況に応じて
[戻る]


Stage → occupied Stage：

[入れ替える]
[このカードを選択]
[戻る]


==================================================
■ 28. F-2B Replacement「このカードを選択」
==================================================

F-2Bでは、
Replacement確認からのStageカード選択切替を
F-2Cへ持ち越していました。


今回Stage Selectionが正式導入されるため、
可能であればF-2B Replacement確認側にも

「このカードを選択」

を実装してください。


動作：


Hand Card selected
↓
occupied Stage click
↓
Replacement confirmation
↓
「このカードを選択」
↓
Stage側Characterをselectedへ切替
↓
Hand selection解除
↓
Stage Move Destinationを表示


Replacementは実行しません。


現在のUI構造から自然に対応できる場合に実装してください。


==================================================
■ 29. DEV / Test Data
==================================================

既存のtest-cards.jsonをそのまま利用してください。


Stage Move / Swap確認用に、
CardMasterや追加JSON schemaを導入しないでください。


必要なら既存DEV Actionで
StageにCharacterを複数配置してテストしてください。


大規模なDEV機能追加は不要です。


==================================================
■ 30. UI Visual
==================================================

Stage選択時、

selected card
Destination candidate

が区別できるようにしてください。


例：

selected
→ 既存selected style

destination
→ 既存blue destination style


F-2A/F-2Bの見た目を可能な限り再利用してください。


新しい色体系は不要です。


==================================================
■ 31. 今回やらないこと
==================================================

以下はF-2Cでは実装しないでください。


・CardMaster
・CardAbility
・ACT
・AUTO
・CONTINUOUS
・Stage Character Play Cost
・Stage Move回数制限
・攻撃処理
・Encore
・Climax Phase
・オンライン同期
・CPU
・カード画像


==================================================
■ 32. 回帰確認
==================================================

最低限以下を確認してください。


F-2A：

・Hand selection
・Destination highlight
・Card detail
・selection解除


F-2B：

・Hand → empty Stage
・Hand → occupied Stage Replacement
・Level条件
・Color条件
・Cost支払い
・PLAY_CHARACTER
・MAINへ復帰


F-2C：

・Stage card selection
・自分slotのみdestination
・同一slotはdestinationにならない
・Stage → empty Stage Move
・Stage → occupied Stage confirmation
・Swap
・「このカードを選択」
・「戻る」
・position保持
・MAINへ復帰


既存：

・Mulligan
・DRAW
・CLOCK
・REFRESH
・REFRESH_PENALTY
・LEVEL_UP
・DEV opponent CLOCK skip
・DEV opponent MAIN end
・Stock表示


==================================================
■ 33. 実地確認ケース
==================================================

以下を確認してください。


Case A

STAND Character
front1
↓
empty front2

期待：

front2へMove
STAND維持


Case B

REST Character
front1
↓
empty back1

期待：

back1へMove
REST維持


Case C

REVERSE Character
front1
↓
empty front3

期待：

front3へMove
REVERSE維持


Case D

A = STAND / front1
B = REST / back1

Aを選択
↓
B slot
↓
入れ替える

期待：

A = back1 / STAND
B = front1 / REST


Case E

Aを選択
↓
B slot
↓
このカードを選択

期待：

B selected
Swapなし


Case F

Aを選択
↓
B slot
↓
戻る

期待：

A selected維持
盤面変更なし


Case G

Hand Character
↓
occupied Stage

期待：

Replacement
Swapにならない


Case H

Stage Character
↓
occupied Stage

期待：

Swap
Replacementにならない


==================================================
■ 34. README / docs
==================================================

F-2C完了後、

READMEの進捗を

F-2C complete

へ更新してください。


NEXTについては、
現在のロードマップに従い、

Phase F-3 CardMaster / CardAbility v1

としてください。


main-phase.mdにも、

・Stage Selection
・MOVE_STAGE
・SWAP_STAGE
・Move / Swap semantics

を必要最小限追記してください。


==================================================
■ 35. 完了条件
==================================================

以下を満たしたら完了です。


1.
Stage Characterを選択できる


2.
Hand selectionとStage selectionが競合しない


3.
現在slot以外の4slotがDestinationになる


4.
空きslotへMoveできる


5.
occupied slotで即Swapされない


6.
独自確認UIが表示される


7.
「入れ替える」でSwapできる


8.
「このカードを選択」でSelection切替できる


9.
「戻る」で元Selectionを維持できる


10.
Move / SwapでCostを払わない


11.
Move / SwapでWaiting Roomへカードを送らない


12.
positionを保持する


13.
faceを不要に変更しない


14.
GameEngineで実行直前Validationを行う


15.
MOVE_STAGE / SWAP_STAGEがProcessとして実行される


16.
CHECK_POINT後MAIN_PHASE / WAITING_INPUTへ復帰する


17.
F-2B Replacementを壊していない


18.
README NEXTがF-3へ更新される


==================================================
■ 36. 作業完了時の報告
==================================================

完了後、以下を報告してください。


【変更ファイル】

追加・変更ファイル一覧


【Selection】

Hand / Stage Selectionの管理方法
排他制御


【Query API】

追加したGameEngine Query


【MOVE_STAGE】

step構造
validation
state更新
rule check


【SWAP_STAGE】

step構造
validation
state更新
rule check


【UI】

Destination
Swap確認
このカードを選択
戻る


【状態保持】

STAND / REST / REVERSE
face


【F-2Bとの共存】

Hand Replacementとの分岐
Replacement確認からStage Selectionへの切替


【確認結果】

Case A〜H
回帰確認結果


【NEXT】

F-3 CardMaster / CardAbility v1へ進める状態か
残課題がある場合はその内容

