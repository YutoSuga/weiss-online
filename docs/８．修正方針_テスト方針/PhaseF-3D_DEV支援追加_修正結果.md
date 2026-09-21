実装概要
DEVパネルに「カードを手札へ」カテゴリを追加し、現在の自分の山札に存在するカードを選択して「山札 → 手札」で移動できるようにしました。通常対戦UIには追加していません。

選択肢は山札内の Card から masterId と name を取得し、CardMaster単位で集約して「カード名（山札: N枚）」と表示します。CardMasterRegistry はDEV UIから参照していません。

同一CardMasterが複数ある場合は、山札配列のTOP側から最初に一致した1枚だけを移動します。

Deck.remove(card) を最小限の汎用コレクションAPIとして追加しました。indexOf と splice により対象Cardだけを取り除くため、ほかのカードの相対順序は維持されます。

取り除いた既存Card instanceに moveTo({ zone: ZONE.HAND }) を適用し、その同じ参照を player.hand の末尾へ追加します。新しいCardは生成されないため、対戦中のCard総数も変化しません。

移動後は既存の gameEngine.render() を呼び、Rendererの通常描画と既存のrender listener経由で盤面・山札枚数・手札・selectを同期します。Renderer自体への変更はありません。

対象が操作直前になくなっていた場合は何も変更せず警告のみとし、空山札の場合はselectとボタンをdisabledにして「山札にカードがありません」と表示します。

DEVパネルの既存スクロール構造を維持したまま、select、ボタン、disabled状態のスタイルを追加しました。

ルール処理への影響
DRAW Process、Rule Check、Refresh、Refresh Penalty、Phase進行は一切呼び出していません。DEV helperがPlayerとDeckを直接操作する構成です。

GameEngine へDEV専用APIは追加していません。

Renderer および main.dev.js に変更はありません。

F-3Dのカード詳細表示仕様には変更を加えていません。

F-4、Ability実行、AbilityEngine、effectQueue関連の実装は行っていません。

READMEには利用可能なDEV操作のみ追記し、ロードマップのF-3D COMPLETE / F-4 NEXTは維持しています。

テスト
新規テストでは、同一instanceの移動、Card総数の維持、同一masterIdから1枚だけの移動、残るDeck順序、存在しないmasterId、空山札、選択肢集約、process・rule state・phaseが変化しないことを確認しています。

✅ node --test client/tests/devDeckToHand.test.mjs — 4件成功

✅ node --test client/tests/*.test.mjs — 全25件成功

✅ find client -type f -name '*.js' -print0 | sort -z | xargs -0 -n1 node --check

✅ ! rg -n 'moveAnyCardFromDeckToHand|moveDeckCardToHandByMasterId' client/js/core/gameEngine.js

✅ ! rg -n 'CardMasterRegistry|cardMasterRegistry' client/js/core/renderer.js

✅ rg -n 'new Card' client/js/ui/devController.js || true — Card生成なし

✅ git diff --check

✅ git status --short — 出力なし、working tree clean

⚠️ ブラウザ実行・スクリーンショット — 利用可能なChromium/Chrome実行環境が存在しなかったため未実施

ユーザー側でのブラウザ確認項目
DEVパネルのselectに現在の自分の山札のカードだけが表示されること。

同一CardMasterが「カード名（山札: N枚）」の1選択肢に集約されること。

移動後、手札と山札枚数が更新され、残数または選択肢が更新されること。

縦長画像Card、横長CLIMAX、imageUrl=null Card、表示確認用Ability Cardをそれぞれ取り出せること。

手札へ移したCardを選択し、右上詳細の画像、画像なしplaceholder、Ability表示を確認できること。

山札が空になった場合にselectとボタンがdisabledになること。
