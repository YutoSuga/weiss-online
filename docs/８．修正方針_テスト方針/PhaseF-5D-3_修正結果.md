# Phase F-5D-3 修正結果

## 実装

CHA/W40-026SPのAUTO②をCardMaster上の実行可能な複合Cost・Effect列として完成した。CostはStock 1枚、Deck top 1枚のClock移動を記載順に行い、Cost完了境界で共通Rule Checkへ入る。AUTO ProcessはCost/Effect indexと次stepを先に保存するため、Refresh、Refresh penalty、Level Upから同じ位置へ復帰して完了済み処理を繰り返さない。

Effectは既存SEARCH_DECK ProcessをACT/AUTO共用に拡張した。検索条件はCharacterかつLevel 1以下、選択数は0～1枚である。結果を親AUTOへ返した後、選択CardをHandへ移し、公開をゲームログへ記録してRule Checkする。割り込み解消後に山札をshuffleし、AUTO完了時の共通Check Timingへ進む。0枚選択でもshuffleする。

## 共通基盤と影響

Rule処理は既存`resolveCheckPoint()`、Process stack、Refresh、penalty、Level Upをそのまま利用する。複数事象は`pendingInterrupts`へ保持し、選択した共通Processを開始するAPIを追加した。ACT集中のSEARCH_DECK形式とtrait filterは維持し、任意の`maxLevel`条件だけを最小拡張した。AUTO①、標準3コストアンコール、Stage slot処理および既存画像UIは変更していない。

## 公開と技術的負債

汎用の対戦相手別Reveal配送機構はまだ存在しない。この段階では選択Card名を「相手に公開」と明記したゲームログへ残す最小実装とした。将来の通信対戦対応時に汎用公開Eventへ置換する必要がある。

## 確認

`client/tests/phaseF5D3.test.mjs`へ複合Cost、検索filter、0/1枚、Hand追加、公開ログ、shuffle、同時Rule処理、Cost/Effect途中Refreshとresumeを追加した。全既存NodeテストでACT集中、AUTO①、アンコール、Stage slot、Refresh/Level Upを回帰確認した。ブラウザ実機確認は実施していない。
