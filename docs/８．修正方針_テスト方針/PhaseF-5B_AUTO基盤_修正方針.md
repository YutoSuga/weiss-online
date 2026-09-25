# Phase F-5B AUTO基盤 修正方針

## 目的

確定済みGame State mutationを5種類のGame Eventへ変換し、構造化`activationTrigger`との照合結果をPending AUTOとして固定する。F-5Aレビューを正とし、ACT ProcessとRule Checkの責務は変更しない。

## 対象

- `CARD_MOVED`、`CARD_POSITION_CHANGED`、`ATTACK_DECLARED`、`PHASE_STARTED`、`PHASE_ENDED`
- PRINTED / RULE候補、GRANTED識別値
- SELF / OTHER / Phase照合、`activeZones`
- `pendingAutos`とimmutable Event snapshot
- Rule Ability Providerによる標準アンコール誘発

## 制約

UI、AUTO Process、Playability、Cost、Effect、解決順、Check Point coordinatorは実装しない。`pendingChecks`、ACT Ability、既存interrupt / resumeを変更しない。Cardへprevious/current locationを追加せず、collection membershipを所在の正本とする。

## テスト方針

5 Event、SELF / OTHER、Phase、標準アンコール正負例、重複Pending、同値position非発行、mutation完了後snapshot、source後続移動、Loader fail-fastを専用テストで確認する。全既存Node test、全JS構文検査、`git diff --check`を回帰確認とする。
