# Phase F-4B「人気アイドル 西森 柚咲」集中 修正方針

## 目的

F-4AのACT Ability v1を拡張し、`Kch/W78-001S` の【起】集中をCardMasterからCost、解決領域、山札検索、手札追加、シャッフルまでProcessとして一貫して解決する。カード固有分岐ではなく、次の集中・山札検索へ再利用できる最小構造とする。

## 実装方針

- `BRAINSTORM` keywordと、ID付きEffect、`EFFECT_RESULT`参照、最小の`EFFECT_GROUP`条件をLoader境界でfail-fast検証する。
- `Player.resolution`と公開Zone `RESOLUTION`を追加し、集中で移動したinstanceだけを追跡する。
- `BRAINSTORM_REVEAL`はACT contextに進捗と`effectResults`を保持し、既存`REFRESH` / `REFRESH_PENALTY`へ割り込み、復帰後に残数を処理する。
- `SEARCH_DECK`を独立Processとし、選択状態・上下限・eligible判定をcontextに保持する。
- `ADD_TO_HAND`はinstanceを維持して移動し、`SHUFFLE_DECK`はGroup内で1回だけ実行する。
- Card一覧選択表示は`CardSelectionView`へ安全な範囲で共通化し、Mulliganのルール処理は変更しない。
- AUTO、effectQueue、汎用条件DSL、汎用Shuffle eventは追加しない。

## UI方針

- Resolutionはカードがある間だけDeck / Memory付近に枠なしで表示する。
- Deck SearchはDeckのTOPからBOTTOMを左から右へ全件表示し、eligibleだけをtoggle選択可能にする。ineligibleもCard Detailで確認できる。
- `minSelect=0`を許容し、`0 / N`から確定可能にする。

## テスト方針

- Loaderのkeyword、Effect ID重複、各Effect・参照・条件・filterの正常系と異常系。
- CostのStock + RESTと事前検証による非部分mutation。
- CX 0 / 1 / 複数、Resolution経由、instance同一性、Group skip、検索・手札追加・Shuffle回数。
- Deck残り2枚から既存Refresh / Penaltyへ割り込み、ACTへ復帰して計4枚を処理する経路。
- SEARCH_DECKのpush、入力待ち、toggle、上下限・filter検証、confirm、pop、ACT復帰。
- Resolution / Deck Search / Card Detail / CardSelectionViewとMulligan回帰。
- 全既存test、全JS/MJS syntax check、`git diff --check`を実行する。

## 文書更新

`集中.md`を新設し、設計書一覧、カード能力、Process、GameEngine、Entity、JavaScript、HTML、UI、Layout、READMEを現在仕様へ更新する。完了後に修正結果と修正記録一覧を更新する。
