# Phase F-5D-3前 Follow-up 修正方針

## 目的

F-5D-3のPRINTED AUTO②には着手せず、実機確認で判明したResolution一覧画像と標準3コストアンコール後のStage位置の不具合を修正し、ACT集中の実機結果を恒久チェックシートへ反映する。

## 調査・修正方針

- Resolution確認一覧だけを対象に、既存`.card-selection-list .card-slot`へ固定幅、はみ出し抑止、中央寄せ、非反復、`contain`を指定する。Card名fallbackと右側Detailは変えない。
- `Card.index`はStageではslot座標、その他の順序Zoneでは配列順という既存モデルを維持する。共通移動後のsource再採番がStageにも適用されていないかを確認し、Zone責務に沿って修正する。
- アンコール対象以外のCardについて、複数のStage slotで`zone/row/index/position`不変をGame Stateレベルで回帰確認する。
- ACT集中のRefresh割り込み経路を調査し、AUTO②で再利用可能な共通処理と不足を記録する。
- チェックシート運用READMEに従い、ひな形更新後の全量コピーを実施結果にする。

## 対象外

AUTO②のCost/Effect、検索機能、専用Refresh/Level Up、Refresh UI演出、Pending AUTOやStage全体の再設計は行わない。
