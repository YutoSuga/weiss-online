# Phase F-5B AUTO基盤 修正結果

## 実装結果

Game Event dispatcher、限定Trigger matcher、collectionを読む`locateCard()`、PRINTED / RULE候補、Pending AUTO queueを追加した。Event/PendingはCard参照を含まないdeep-frozen snapshotである。標準アンコールはRule Ability Providerから供給し、Stage → Waiting RoomのCharacterだけでRULE Pendingになる。

Engineには移動・position変更・Attack宣言の確定境界APIを追加し、Phase遷移では終了Eventを更新前、開始Eventを更新後かつ固有Process開始前に発行する。既存Character PlayのStock支払い、replacement、Hand → Stageにも移動Eventを接続した。AUTO検出はMAIN / WAITING_INPUTに依存しない。

## 確認結果

- CARD_MOVED / SELF、CARD_POSITION_CHANGED / OTHER、ATTACK_DECLARED、PHASE_STARTED / ENDEDを確認
- 標準アンコールのStage正例とHand / Deck / Clock負例を確認
- 同値position非発行、異なるEventによる同一Abilityの複数Pendingを確認
- mutation完了後のcollection所在とfrom/to LKI、source後続移動後のPending保持を確認
- 既存ACT、集中、Refresh、Deck Search、MAINを含む全Node testを確認

## 持ち越し

F-5CへPending提示、使用/不使用、Turn / Non-Turn順、Playability、`resolveCheckPoint()`統合を残す。Cost Preparation / Back / COMMIT、AUTO Effectと標準アンコールの支払い・復帰、GRANTED付与はそれ以降へ残す。
