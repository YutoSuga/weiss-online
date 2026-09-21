# PhaseF-2A 修正方針

対象：MAINカード選択・Destination UI

出典：Codexタスク「Phase D共通ルールチェック設計」（ID: 01a00a4d-c312-7680-917e-75f38686b7e9）。

2026-09-21に取得できた会話記録から作成。本文は当時の依頼・完了報告を原文中心に収録しています。記載されたテスト・コミット・push・作業ツリー状態は当時の報告であり、今回再実行・再検証した結果ではありません。パス・リンク・NEXTも当時の表記を保持しており、現在と異なる場合があります。

---

## 依頼・追加方針（2026-09-11 22:31 JST）

出典ターン：01a090aa-4178-7040-adde-ddf4efb9da45

# 依頼：Phase F-2A MAINカード選択 / Destination UI 基盤実装

現在、ヴァイスシュヴァルツ風Webカードゲームの実装を進めています。

Phase F-1として、

MAIN_PHASE
START
→ WAITING_INPUT
→ END_MAIN
→ COMPLETE

の基盤実装は完了済みです。

今回は次工程である、

Phase F-2A
「MAINカード選択 / Destination UI」

のみを実装してください。

今回はまだ実際のカード移動・Play Cost支払い・Replacement・Swap等は行いません。

==================================================
■ 今回の目的
==================================================

MAIN_PHASE / WAITING_INPUT中に、

自分の手札のCharacterをクリック / タップ
↓
カードを選択状態にする
↓
右サイドバーのカード詳細に選択カードを表示
↓
配置候補となる自分のStage slotをDestinationとして青表示
↓
選択解除 / 選択切替

までを実装します。

今回のゴールは、

「MAINでカードを選び、どこへ置けるかUI上で分かる」

状態を作ることです。

カードそのものはまだ移動させません。


==================================================
■ 1. 事前確認
==================================================

実装前に、現在のコードと以下の設計書を確認してください。

・README.md
・docs/main-phase.md
・docs/card-ability.md
・docs/ui-rules.md

特に確認するもの：

・GameEngine
・GameState
・ProcessManager
・MAIN_PHASE
・MAIN_STEP
・MainPhaseController
・Renderer
・Card
・Player
・ZONE
・cardTypeの現在の持ち方
・Stage slotのHTML / data属性
・Hand cardのHTML / data属性
・既存のselected / selectable / disabled等のCSS
・MulliganやLEVEL_UPで使っているカード選択UI

既存のUIクラス・data属性・Controller構造をできるだけ再利用してください。

既存実装と設計書に差異がある場合、
大規模な作り直しはせず、
現在の実装と最新設計の整合が取れる最小変更にしてください。


==================================================
■ 2. F-2AのScope
==================================================

今回実装するもの：

1.
MAIN_PHASE / WAITING_INPUT中の
自分Hand Characterの選択

2.
選択中カードのUI表示

3.
右側カード詳細パネルへの選択カード表示

4.
自分StageのDestination候補表示

5.
別カードクリックによる選択切替

6.
空白クリックによる選択解除

7.
「選択を解除」ボタン

8.
MAIN終了時などにSelection UIをクリア


今回実装しないもの：

・Hand → Stageの実移動
・Stage → Stageの実移動
・Replacement
・Swap
・Play Cost支払い
・Level条件
・Color条件
・Stock条件
・CardMaster
・CardAbility
・ACT Ability
・AUTO Ability
・CONTINUOUS Ability
・Effect Executor
・Global Card Inspection


==================================================
■ 3. Selection Stateの責務
==================================================

今回のSelectionは、

「まだ確定していないユーザー操作状態」

です。

以下のような状態をGameStateへ保存しないでください。

selectedCard
candidateDestination
confirmationState

これらはController / UIローカル状態として扱ってください。


ただし、

「カードが選択可能か」
「どのDestinationが候補になり得るか」

のGame Rule判断をControllerへ大量に埋め込まないでください。

責務の基本方針：

GameEngine
→ Game Rule上の可否判断

Controller
→ User Input
→ 現在のUI Selection状態

Renderer / DOM
→ 表示


F-2AではまだPlay Condition全部を判定しないため、
GameEngine側に必要以上に大きなAction Engineを作る必要はありません。

最小限の判定APIで構いません。


==================================================
■ 4. 選択可能カード
==================================================

F-2Aでは、

MAIN_PHASE
AND
MAIN_STEP.WAITING_INPUT
AND
自分のHand
AND
CHARACTER

のカードを選択対象としてください。


EVENT / CLIMAXは今回のSelection対象外です。


注意：

今回はLevel / Color / Cost条件をまだ判定しません。

それらはF-2Bで実装します。

したがって、

「Characterである」

ところまでをF-2Aの最低条件としてください。


もし現在のcardType定数・値が設計書と異なる場合、
既存実装を確認して合わせてください。


==================================================
■ 5. カードクリック時
==================================================

MAIN_PHASE / WAITING_INPUT中に、
自分Handの選択可能Characterをクリックした場合：

1.
そのカードをselectedCardとしてControllerローカルに保持

2.
そのカードをselected表示

3.
右側カード詳細パネルを更新

4.
Destination候補を表示


別の選択可能Hand Characterをクリックした場合：

現在Selectionを解除
↓
新しいカードをselectedCardにする

としてください。


==================================================
■ 6. Selected表示
==================================================

選択中のカードが視覚的に分かるようにしてください。

既存の、

selected
selectable
selection-disabled

等のUI/CSSが使える場合は再利用してください。


Mulligan / LEVEL_UP等のSelection UIを確認し、
同じ意味の状態に新しい独自CSSを乱立させないでください。


ただし既存Selection UIとMAIN Selectionで
意味が異なる部分は無理に共通化しなくて構いません。


==================================================
■ 7. 右側カード詳細パネル
==================================================

カード選択時、
既存の右サイドバーのカード詳細パネルに
選択カード情報を表示してください。


現在Cardが保持している情報のうち、
既存カード詳細UIで自然に表示できるものを使用してください。

例：

・name
・cardType
・level
・cost
・power
・soul
・traits
・text

等。


ただし現在のCard構造を確認し、
存在しないプロパティを推測で追加しないでください。


CardMasterはまだ導入しません。

現在Cardに存在する情報を使ってください。


==================================================
■ 8. 「選択を解除」ボタン
==================================================

カード選択中は、
右側カード詳細パネル内に、

「選択を解除」

ボタンを表示してください。


これはCard由来Selection Actionなので、

MAIN終了ボタン等のGame / Phase操作領域ではなく、
カード詳細パネル内に配置してください。


クリックすると：

・selectedCardを解除
・selected表示を解除
・Destination表示を解除
・カード詳細パネルを通常状態へ戻す

ようにしてください。


カード未選択時は、
このボタンを表示しない、
または既存UI方針に沿った非表示状態にしてください。


==================================================
■ 9. Destination候補
==================================================

自分HandのCharacterを選択した場合、

自分Stageの5slotをDestination候補として表示してください。


Stage構成：

front 3
back 2


既存HTMLの、

data-owner
data-zone
data-row
data-index

等を利用してください。


F-2Aでは、

空slot
使用中slot

の両方をDestination候補として表示してください。


理由：

F-2Bでは、

空slot
→ 通常配置

使用中slot
→ Replacement

として扱う予定だからです。


Destination候補は、
青枠等で明確に分かる表示にしてください。


既存のselectable系UIが再利用できるなら検討してくださいが、
「Card selectable」と「Destination selectable」が
分かりにくくならないようにしてください。


==================================================
■ 10. Destinationクリック
==================================================

今回はDestinationをクリックしても
カードを移動しないでください。


F-2Aでは、

Destination click
→ 実Actionなし

です。


必要であれば、
将来F-2Bで接続しやすいイベントフックやControllerメソッドを
最小限用意して構いません。


ただし、

Hand → Stage
Waiting Room移動
Stock支払い

等は絶対に実行しないでください。


また、Destinationクリックによって
Selectionを勝手に解除しないでください。

F-2BでAction実行を追加するまで、
選択状態を維持してください。


==================================================
■ 11. 空白クリックで選択解除
==================================================

MAIN Selection中に、
カードやDestinationや操作ボタンではない
盤面上の空白部分をクリックした場合、

Selectionを解除してください。


ただし、

・MAIN終了ボタン
・DEV UI
・右カード詳細パネル内操作
・スクロールUI
・他の有効UI

等のクリックを誤って空白クリック扱いしないでください。


イベントバブリングによる誤解除に注意してください。


==================================================
■ 12. MAIN以外でのSelection
==================================================

MAIN Phase以外では、
今回追加するMAIN Selectionを動作させないでください。


例えば、

Mulligan
DRAW
CLOCK
LEVEL_UP

等の既存Selection / UI操作へ影響を与えないでください。


MAIN_PHASEが終了した場合：

selectedCard
Destination表示
選択解除ボタン

等は必ずクリアしてください。


MAIN → CLIMAXへ進んだ後に
Selection表示が残らないことを確認してください。


==================================================
■ 13. MAIN_STEPについて
==================================================

現在MAIN_STEPは、

START
WAITING_INPUT
END_MAIN
COMPLETE

が実装済みです。


docs/main-phase.mdには将来、

CARD_SELECTED
ACTION_SELECT
ACTION_PROCESS

があります。


今回F-2Aで、
これらをProcess stepとして追加する必要はありません。


今回のselectedCardはUIローカル状態です。

MAIN_PHASE Process自体は、

WAITING_INPUT

のまま維持してください。


つまり今回のイメージ：

MAIN_PHASE / WAITING_INPUT
↓
UI上でcard selection
↓
UI上でdestination表示
↓
selection解除
↓
引き続きMAIN_PHASE / WAITING_INPUT


としてください。


==================================================
■ 14. GameEngine側の最小API
==================================================

ControllerがGame Ruleを直接判断しすぎないよう、
必要であればGameEngineへ最小限のQuery APIを追加してください。


例：

canSelectCardForMain(card, playerId)

getMainDestinationCandidates(card, playerId)

等。


ただし名前は既存設計・命名規則に合わせてください。


F-2AではDestinationは
自分Stage 5slot固定なので、
過度なAction Frameworkを作らないでください。


今後F-2B / ACTへ拡張できる程度の
シンプルな責務分離を優先してください。


==================================================
■ 15. Renderer / Controllerの責務
==================================================

Controller：

・クリック / タップ受付
・selectedCardのUIローカル保持
・選択切替
・選択解除
・GameEngine queryの利用


Renderer / 表示層：

・selected表示
・Destination表示
・カード詳細表示


GameEngine：

・MAINで選択可能か等のGame Rule判断


GameState：

・確定した対戦状態のみ


という責務を維持してください。


DOMをGameState代わりに使用しないでください。


==================================================
■ 16. Card DetailとGame Actionの分離
==================================================

既存設計どおり、

カード詳細パネル内：

・選択カード情報
・選択を解除
・将来のACT能力Action

カード詳細パネル外：

・メインフェイズ終了
・Game / Phase単位の操作

としてください。


「選択を解除」を
メインフェイズ終了ボタンの横などへ置かないでください。


==================================================
■ 17. Touch対応
==================================================

操作方針はDrag & Dropではなく、

Click / Tap

です。


既存UIイベント構造でPCクリックと
スマホ / タブレットのTapが自然に動くようにしてください。


新しいDrag & Drop処理は追加しないでください。


==================================================
■ 18. 回帰確認
==================================================

最低限以下を確認してください。

・ゲーム開始
・Mulligan
・DRAW
・CLOCK
・MAIN_PHASE開始
・MAIN_PHASE WAITING_INPUT
・MAIN終了
・CLIMAX遷移
・LEVEL_UP
・REFRESH
・REFRESH_PENALTY
・既存DEV操作


特に、

MAINでカードを選択
↓
選択解除
↓
MAIN終了
↓
CLIMAX

が正常に動くことを確認してください。


また、

CLOCKやMulliganのカードSelection UIを壊していないことを
確認してください。


==================================================
■ 19. F-2Aの確認ケース
==================================================

以下を確認してください。


ケース1：

MAIN_PHASE / WAITING_INPUT
↓
自分Hand Characterクリック

期待：

・そのカードがselected表示
・カード詳細更新
・自分Stage 5slotがDestination表示
・MAIN_PHASEはWAITING_INPUTのまま


ケース2：

Character A選択
↓
Character Bクリック

期待：

・Aのselected解除
・Bがselected
・Bのカード詳細表示


ケース3：

Character選択
↓
「選択を解除」

期待：

・Selection解除
・Destination解除
・カード詳細が通常状態へ戻る


ケース4：

Character選択
↓
盤面空白クリック

期待：

・Selection解除


ケース5：

Character選択
↓
Destinationクリック

期待：

・カードは移動しない
・Stockは減らない
・Waiting Roomも変化しない
・Selectionは維持


ケース6：

Character選択
↓
メインフェイズ終了

期待：

・Selection UIをクリア
・MAIN_PHASE完了
・CLIMAXへ進む


ケース7：

MAIN以外でHand Cardクリック

期待：

今回追加したMAIN Selection処理は発動しない


==================================================
■ 20. 今回変更しない設計
==================================================

以下は今の実装を維持してください。

・GameEngine中心のGame Rule
・ProcessManagerによるprocessStack管理
・MAIN_PHASE WAITING_INPUTの保持
・resolveRuleCheck()
・completeCurrentProcess()
・REFRESH / REFRESH_PENALTY
・LEVEL_UP
・DRAW_PHASE
・CLOCK_PHASE
・face / visibility設計


今回のUI実装のために、
既存Process基盤をリファクタリングしないでください。


==================================================
■ 21. README / docs
==================================================

今回の実装完了後、

README.mdの現在地点 / ロードマップ / NEXTを
実装結果に合わせて更新してください。


想定：

Phase F-2A
→ 完了

NEXT
→ Phase F-2B Character Hand → Stage


ただし、
実装が完了していない場合はチェック済みにしないでください。


docs/main-phase.md等について、
今回の実装で設計との差異が発生した場合のみ
必要最小限の更新を行ってください。

差異がなければ無理に変更しないでください。


==================================================
■ 完了条件
==================================================

以下を満たしたらF-2A完了です。

1.
MAIN_PHASE / WAITING_INPUT中に
自分Hand Characterを選択できる

2.
選択カードが視覚的に分かる

3.
右カード詳細パネルへ選択カードを表示できる

4.
自分Stage 5slotがDestination候補として表示される

5.
空slot / 使用中slotの両方が候補になる

6.
別CharacterクリックでSelectionを切り替えられる

7.
「選択を解除」で解除できる

8.
空白クリックで解除できる

9.
Destinationクリックではまだカードが移動しない

10.
Selection状態をGameStateへ保存していない

11.
MAIN_PHASEはSelection中もWAITING_INPUTのまま

12.
MAIN終了時にSelection UIが残らない

13.
Mulligan / CLOCK / LEVEL_UP等の既存操作を壊していない

14.
F-2BのPlay処理を実装していない

15.
READMEのロードマップが実装結果と一致している


==================================================
■ 作業完了時の報告
==================================================

完了後、以下を報告してください。

・変更したファイル
・Selection Stateをどこに保持したか
・カードクリックからSelection表示までの処理経路
・GameEngineへ追加したQuery API
・Destination候補の判定方法
・Destination表示に使用したCSS / data属性
・カード詳細パネルの更新方法
・「選択を解除」の実装方法
・空白クリック判定の方法
・MAIN終了時のSelection cleanup方法
・既存Mulligan / LEVEL_UP等とのUI競合対策
・実施した確認ケースと結果
・README更新内容
・F-2Bとして意図的に未実装にした内容
・気付いた設計上の懸念

もし既存コード上、
この依頼どおりに実装すると既存Selection UIと衝突する場合は、
無理に実装せず、
既存構造を優先した最小変更にして、
完了報告で理由を説明してください。

