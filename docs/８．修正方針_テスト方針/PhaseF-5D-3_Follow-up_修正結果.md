# Phase F-5D-3 Follow-up 修正結果

## 原因と修正

- 複合Costの境界がコード上で暗黙的で、進捗をProcess contextに保持していなかった。AUTO contextへ`costIndex / costPaymentInProgress`を追加し、全項目を順番に払い終えるまでCheck Pointへ戻さない契約を明示した。
- Deck 1 / Waiting Room 0ではCost後のRefresh自体は可能だが、1枚だけのRefresh deckをpenaltyが空にした時点で、保存中AUTOより先に空Deck/Waiting Room敗北を確定していた。解決中能力を保留理由に含め、保存stepへ復帰してから再評価する。
- Deck 0 / Clock 7では`pendingInterrupts`は作られる一方、通常画面に選択Controller/DOMがなく操作不能だった。共通順序選択UIを追加した。
- スマホ山札検索はpanel全体をスクロールさせ、長いカード/詳細領域が決定ボタンを画面外へ押し出した。カード領域をflex内スクロール、詳細を28vh、選択数/決定を非収縮footerとした。PCのgridとResolution selectorは変更していない。

## 検証範囲

F-5D-3のケースA/B/C、0枚検索、ACT集中、AUTO①、アンコール、Stage slot、画像、Refresh/penalty/Level Up、resumeを全テストで回帰する。ブラウザ実機再確認は未実施で、ユーザー提供の修正前結果をチェックシートへ転記した。
