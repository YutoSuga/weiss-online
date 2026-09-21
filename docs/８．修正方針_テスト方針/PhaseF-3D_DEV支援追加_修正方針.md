YutoSuga/weiss-online に、開発・動作確認用のDEV支援機能として、
「山札から任意のカードを選んで自分の手札へ移動する機能」
を追加してください。

これはPhase F-3D本体やF-4のAbility実装ではなく、
今後のブラウザ確認・カード効果テストを効率化するための小規模なDEV機能です。

F-3Dはすでに以下のコミットで完了しています。

b975acdbda44233238f8d60e647219fc95b31877
feat: implement F-3D card detail rendering

F-4のAbility実装はまだ開始しないでください。


# 1. 最初に既存実装を確認する

実装前に少なくとも以下を確認してください。

- README.md
- 現在のDEVパネルHTML/CSS
- DevController
- main.dev.js
- Card
- CardMaster
- CardMasterRegistry
- Deck
- Player
- GameState
- Renderer
- 既存のDEV操作
- F-3C / F-3Dの開発用CardMaster / DeckDefinition
- 関連テスト

特に、

- Deck内部でTOPをどう表現しているか
- CardをDeckから取り除く既存APIがあるか
- Handへの追加方法
- Cardのzone等のruntime stateを現在どう管理しているか
- DEV操作後にどのようにRendererを更新しているか

を既存コードから確認したうえで実装してください。

既存アーキテクチャを尊重し、
このDEV機能のためだけにGameEngineやDeckの責務を不自然に拡大しないでください。


# 2. 目的

DEVパネルから、

「現在、自分の山札に存在する任意のCardを選択し、
そのCardインスタンスを山札から取り除いて自分の手札へ移動する」

ことを可能にしてください。

主な用途は、

- F-3Dのカード詳細表示確認
- 特定CardMasterの画像確認
- Ability表示確認
- 今後のF-4以降の特定カード動作確認

です。


# 3. 重要：新しいCardを生成しない

このDEV操作では、

CardMasterから新しいCardインスタンスを生成して手札へ追加

してはいけません。

必ず、

現在のself PlayerのDeck内に存在するCardインスタンス

を検索し、

Deck
↓
Hand

へ移動してください。

したがって、この操作によって対戦中のCard総数が増えてはいけません。


# 4. 対象はまずselfのみ

今回のDEV機能では、

「自分の山札 → 自分の手札」

のみ対応してください。

opponent対応は不要です。

将来的に必要なら拡張できる構造であれば問題ありませんが、
今回のためにPlayer選択UI等を追加する必要はありません。


# 5. DEVパネルUI

既存DEVパネルの構造・デザインに合わせて、
カード操作カテゴリ等の適切な位置へ追加してください。

最低限、以下のようなUIで十分です。

カードを手札へ

[ Card選択 select ]

[ 山札 → 手札 ]

大規模な検索UI、モーダル、カード一覧画面等は不要です。

既存DEVパネルのサイズやスクロール構造を壊さないでください。


# 6. selectに表示するCard

selectには、

「現在selfのDeck内に存在するCard」

を選択できるようにしてください。

CardMasterRegistryに登録されているが、
現在のDeckには存在しないCardを選択肢として表示する必要はありません。

表示名には最低限、

card.name

を使用してください。

同じCardMasterのCardが山札に複数枚ある場合は、
Cardインスタンスごとに同じ選択肢を大量表示するのではなく、
可能であればCardMaster単位でまとめてください。

例：

テストキャラクター001
テストキャラクター002
横長CLIMAXテスト
...

さらに実装が自然であれば、

テストキャラクター001（山札: 4枚）

のように、
現在の山札内枚数を表示して構いません。

ただし残数表示のために設計を複雑化する必要はありません。


# 7. 同一CardMasterが複数枚ある場合

同じmasterIdのCardがDeck内に複数存在する場合、
DEVユーザーはCardMasterを1種類選択するだけで構いません。

ボタン押下時に、
そのmasterIdを持つCardインスタンスをDeckから1枚だけ取り出し、
Handへ移動してください。

どのコピーを取るかについて特別なゲーム上の意味はありません。

ただしDeck内の順序を必要以上に壊さない実装にしてください。

例えば、
現在のDeck配列をTOP側から検索して最初に一致した1枚を取り除く、
というような決定的な方法で構いません。


# 8. Deck順序を維持する

対象Card以外のDeck内Cardの相対順序を維持してください。

例：

Deckが、

A
B
TARGET
C
D

なら操作後は、

A
B
C
D

となるイメージです。

TARGET以外のカードをshuffleしたり、
並び替えたりしないでください。


# 9. Handへの追加

取り出したCardは、
既存のHand管理ルールに従ってself.handへ追加してください。

既存実装でHandの末尾追加が通常であれば、
その方式を使用してください。

DEV操作のため、
通常のDRAW Processとして扱う必要はありません。


# 10. DRAW Processを使用しない

この操作はゲームルール上の「ドロー」ではありません。

そのため、

DRAW Process
GameEngineの通常ドロー処理
Rule Check
Refresh
Refresh Penalty
Phase進行

等を発生させないでください。

目的はあくまで、

「テストしたい盤面状態をDEV操作で直接作る」

ことです。


# 11. Rule Checkを発生させない

このDEV操作ではRule Checkを実行しないでください。

山札から直接Cardを取り除いた結果、
山札が0枚になったとしても、

Refresh
Refresh Penalty

等を自動実行しないでください。

DEV操作として状態を直接変更するだけにしてください。


# 12. GameEngineへ通常ルールAPIとして追加しない

例えば、

GameEngine.moveAnyCardFromDeckToHand()

のような、
通常ゲームでも利用できそうなルールAPIとして追加することは避けてください。

この操作はDEV専用です。

可能な限り、

DevController
↓
DEV専用helper
↓
GameState / Player / Deckの既存公開API

という範囲で実装してください。

ただし、Deckに「指定Cardを安全に取り除く」ための適切な既存APIが存在せず、
Deck内部配列をControllerから直接破壊することになる場合は、
既存設計を確認したうえで最小限の汎用Deck APIを追加して構いません。

その場合も、

DEV機能専用の意味をDeckモデルへ持ち込まず、

「指定Cardを取り除く」

程度の一般的なコレクション操作に留めてください。


# 13. CardMasterRegistryをDEV UIの都合で不必要に参照しない

F-3Dで確立した、

Renderer
→ Cardを入口にする

という方針は維持してください。

今回selectに必要な情報は、
基本的に現在Deckに存在するCardから取得できます。

CardMaster名等も、

card.name
card.masterId

等のCard公開APIを優先してください。

DEV UIのためだけにRendererへRegistry依存を追加してはいけません。


# 14. selectの更新

山札からCardを手札へ移動した後、
selectの内容も現在のDeck状態に合わせて更新してください。

例えば、

テストカード001（山札: 1枚）

を手札へ移動して、
Deck内からそのCardMasterが0枚になった場合、

次回のselectではそのCardMasterを選択できない状態にしてください。

残数表示を採用する場合は、
残数も更新してください。


# 15. Deckが空の場合

selfのDeckが空の場合は、
DEVパネルが壊れないようにしてください。

例えば、

- selectをdisabled
- ボタンをdisabled
- 「山札にカードがありません」

等の簡単な表示で構いません。

既存DEV UIのデザインに合わせてください。


# 16. 選択Cardが存在しなくなった場合

UI表示後に状態が変化し、
選択されていたmasterIdのCardがDeckからなくなっている可能性も考慮してください。

ボタン押下時には、
実際の現在Deckを再確認してください。

対象Cardが見つからない場合は、

- stateを破壊しない
- 新規Cardを生成しない
- 例外でDEV UI全体を壊さない

ようにしてください。

必要ならselectを再描画してください。


# 17. Renderer更新

Card移動後は、
既存のDEV操作と同じ方式でRendererを更新してください。

操作後に、

- 山札枚数
- 手札
- Card選択
- 右上カード詳細

等が現在GameStateと矛盾しない状態になるようにしてください。

ただし、
この機能のためにRendererの責務を変更しないでください。


# 18. F-3D確認で使えること

今回の機能によって、
少なくとも以下の確認を簡単に行える状態にしてください。

1. 縦長imageUrlを持つCardMasterのCardを山札から手札へ移動
2. そのCardを選択
3. 右上カード詳細で縦長画像を確認

4. 横長imageUrlを持つCLIMAX CardMasterのCardを山札から手札へ移動
5. そのCardを選択
6. 右上カード詳細で横長画像を確認

7. imageUrl=nullのCardMasterのCardを山札から手札へ移動
8. そのCardを選択
9. 「画像なし」placeholderを確認

表示確認用Abilityを持つCardも同様に取り出せる状態にしてください。


# 19. DEV専用であることを維持する

このUIはDEVパネル内だけに存在してください。

通常の対戦UIには表示しないでください。

本番用のカード検索・デッキ検索・チート操作として一般化しないでください。


# 20. テスト

このDEV機能について、
既存テスト構造に合わせて適切なテストを追加してください。

最低限、可能な範囲で以下を確認してください。

- Deckに存在する指定masterIdのCardを1枚取得できる
- 対象CardだけがDeckから取り除かれる
- Handへ同じCardインスタンスが追加される
- 新しいCardインスタンスを生成していない
- Card総数が変化しない
- 同じmasterIdが複数ある場合でも1枚だけ移動する
- 対象以外のDeck順序が維持される
- 対象masterIdが存在しない場合にstateを破壊しない
- Deckが空でも安全
- DRAW Processを開始しない
- Rule Checkを発生させない
- Refreshを発生させない
- Phaseを変更しない

DOM/UIテストが既存基盤で容易なら、

- selectが現在DeckのCardMasterを反映する
- 移動後に選択肢が更新される
- Deck内0枚になったCardMasterが選択肢から消える

ことも確認してください。

この小規模DEV機能のためだけに、
新しい大規模ブラウザテストフレームワークは導入しないでください。


# 21. 既存テスト

変更後は必ず、

node --test client/tests/*.test.mjs

等の現在の全テストを実行し、

F-3A
F-3B
F-3C
F-3D
MAIN Phase
Rule Process

等の既存動作を壊していないことを確認してください。


# 22. ドキュメント

この変更はPhase F-3D/F-4そのものではないため、
READMEのPhaseを新しいPhaseとして進めないでください。

READMEの現在地点は、

F-3D COMPLETE
F-4 NEXT

のままにしてください。

ただしREADMEやDEV関連ドキュメントに、
現在利用できるDEV操作一覧が記載されている場合は、

「山札から指定カードを自分の手札へ移動」

を追記してください。

必要以上に設計書を変更しないでください。


# 23. Non-goals

今回実装しないもの：

- F-4
- ACT Ability
- AUTO Ability
- CONTINUOUS Ability
- Ability実行処理
- AbilityEngine
- effectQueue連携

- 通常DRAWへの変更
- Rule Check
- Refresh
- Refresh Penalty
- Phase進行

- opponentの山札→手札
- Player選択UI

- CardMasterからの新規Card生成
- Card総数を増やす操作

- 山札検索モーダル
- 大規模カード検索UI
- 画像付きカード一覧
- 複雑なフィルタ
- DEVパネルの大規模再設計

- 盤面/手札の画像方向制御

- F-3Dの仕様変更


# 24. Acceptance Criteria

以下をすべて満たしたら完了としてください。

1. DEVパネルに「山札から任意カードを自分の手札へ移動」するUIがある
2. 現在self Deckに存在するCardを選択できる
3. 同一CardMasterが複数ある場合はCardMaster単位で選択できる
4. ボタン押下で対象Cardを1枚だけDeckから取り除く
5. 同じCardインスタンスをself.handへ追加する
6. 新規Cardを生成しない
7. Card総数が変化しない
8. 対象以外のDeck順序を維持する
9. 操作後にselectが現在Deck状態へ更新される
10. Deck内0枚になったCardMasterを選択できなくなる
11. Deck空でもDEV UIが壊れない
12. 対象Cardが存在しない場合もstateを破壊しない
13. DRAW Processを開始しない
14. Rule Checkを実行しない
15. Refresh / Refresh Penaltyを実行しない
16. Phaseを変更しない
17. Rendererを既存方式で再描画する
18. 通常対戦UIには追加されていない
19. GameEngineへDEV専用ルールAPIを不必要に追加していない
20. RendererへCardMasterRegistry依存を追加していない
21. 縦長画像CardをDEV操作で取り出せる
22. 横長画像CLIMAXをDEV操作で取り出せる
23. imageUrl=null CardをDEV操作で取り出せる
24. 表示確認用Ability CardをDEV操作で取り出せる
25. F-3Dの既存動作を変更していない
26. F-4を先取りしていない
27. DEV機能用テストが成功する
28. 全既存テストが成功する
29. READMEのPhaseはF-3D COMPLETE / F-4 NEXTのまま
30. working treeがcleanである


# 25. 実装後の確認

以下を実行してください。

- DEV機能用テスト
- node --test client/tests/*.test.mjs
- 全JavaScriptのnode --check
- git diff --check
- git status --short

可能であれば、

- CardMasterから新規Cardを生成していないこと
- GameEngineへDEV専用APIを追加していないこと
- RendererへRegistry依存を追加していないこと

も検索等で確認してください。

ブラウザ実行環境がない場合は、
無理にブラウザ確認を行わず、
ユーザー側で確認する項目を報告してください。


# 26. Commit

F-3D本体とは分離した小さなコミットにしてください。

例：

feat: add dev deck-to-hand card selector

F-4の変更は混ぜないでください。


# 27. 完了報告

完了時には以下を報告してください。

1. 実装概要
2. 変更ファイル
3. 新規ファイル
4. DEVパネルへ追加したUI
5. selectのCard一覧生成方法
6. 同一CardMaster複数枚の扱い
7. Deckから対象Cardを取り除く方法
8. Handへ追加する方法
9. 同じCardインスタンスを移動していること
10. Card総数が増えないこと
11. Deck順序の維持方法
12. Deck空時の挙動
13. 対象Card不存在時の挙動
14. 操作後のselect更新方法
15. Renderer更新方法
16. DRAW Processを使用していないこと
17. Rule Checkを発生させていないこと
18. Refreshを発生させていないこと
19. Phaseを変更していないこと
20. GameEngineへの変更有無
21. Deck APIへの変更有無と、その理由
22. Rendererへの変更有無
23. F-3Dへの影響
24. F-4を先取りしていないこと
25. 追加テスト
26. 全テスト結果
27. syntax check結果
28. git diff --check結果
29. ブラウザ確認の実施可否
30. ユーザー側で確認すべき項目
31. README / docs変更内容
32. commit hash / commit message
33. PR情報
34. 最終git status

今回の目的は、
ゲームルールを追加することではなく、

「テストしたいCardを山札からすぐ手札へ持ってこられるDEV支援機能」

を最小限の変更で追加することです。

通常ゲームロジックとDEV操作の境界を維持し、
今後F-4以降でも繰り返し使える開発補助機能にしてください。
