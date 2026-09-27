# Phase F-5D-3 Follow-up 2 修正結果

## 1. 根本原因

`resolveCheckPoint()`はRule Check安定後、スタック最上段だけを見てPending AUTOの提示可否を決めていた。Refresh penalty自身の`CHECK_POINT`では最上段が`REFRESH_PENALTY`であり、その下に中断中の`AUTO_ABILITY`があっても見落とした。このため、能力解決途中に収集済みPendingを`PENDING_AUTO` Processへ移していた。

## 2. 共通修正

Process stack全体から`ACT_ABILITY` / `AUTO_ABILITY`を検出する共通境界へ変更した。Rule ProcessやSEARCH_DECK等の子Processが最上段でも、親Abilityが残る間はRule Checkだけを安定化し、Pendingを削除せず親Abilityへresumeする。Ability自身が`COMPLETE`でpopされた後のCheck Timingで初めてPendingを提示する。AUTO②固有フラグは追加していない。

## 3. 複合ケース

- Refresh先行: Refresh後はRefresh penaltyとLevel Upを独立候補として順序選択し、全Rule処理後に検索へ復帰する。
- Level Up先行: Level Up後にRefresh、penaltyを処理し、検索へ復帰する。
- Deck 1のみ: Costは一度だけ支払い、Refresh / penalty後に検索へ復帰する。
- Clock 6のみ: Level Up後に検索へ復帰する。
- Effect途中: 最後の検索カードをHandへ移してDeck 0になってもRefresh / penalty後にAUTOへ復帰し、shuffleを行う。

Refresh penaltyはRefresh本体に内包する連続stepではなく、Refresh完了後の再Rule Checkにおける独立Rule候補である。Level Upも成立する場合はプレイヤーが順序を選ぶ（結論B）。採用版は総合ルールver.1.112（2026-08-24）。公式PDFは環境のHTTP 403により本文枝番を再照合できなかったため、保存済み9章要旨を正とし、枝番を推測していない。

## 4. 回帰範囲

ACT集中も同じstack検出を利用するため、Rule Process中に収集されたPendingはACT完了まで提示されない。AUTO①、標準3コストアンコールの生成・playability・consume処理、スマホ検索UI/CSSは変更していない。集中の少数Deck公開と残り1枚検索、AUTO①、アンコールを含む全client testで回帰確認する。

## 5. 文書・実機

詳細設計にCost boundary、Rule候補再列挙、penalty/Level Up関係、interrupt/resume、Ability完了後Check Timingを追記した。ルール参照メモと恒久チェックシートも更新し、実施結果は更新後ひな形の全量コピーから作成した。修正後のブラウザ/スマートフォン実機確認は未実施であり、ユーザー報告済みの修正前結果だけを記録した。
