# PhaseD 修正方針

対象：共通ルールチェック基盤の設計書作成・配置

出典：Codexタスク「Phase D共通ルールチェック設計」（ID: 01a00a4d-c312-7680-917e-75f38686b7e9）。

2026-09-21に取得できた会話記録から作成。本文は当時の依頼・完了報告を原文中心に収録しています。記載されたテスト・コミット・push・作業ツリー状態は当時の報告であり、今回再実行・再検証した結果ではありません。パス・リンク・NEXTも当時の表記を保持しており、現在と異なる場合があります。

---

## 依頼・追加方針（2026-08-16 20:21 JST）

出典ターン：01a00a4d-c4ab-76d0-81bd-f160ab50a084

Continuing from [Webゲーム開発進行中](chatgpt-conversation://6a537502-3084-83ee-852f-58a5210beb79): Phase D『共通ルールチェック基盤』の設計書をMarkdownで作成する。引数なしのrunRuleCheck()でself/opponent両方を同一チェック単位で確認し、defeatCandidatesとinterruptsを判定結果として返す設計。敗北条件は①level>=3かつclock>=7、②deck==0かつwaitingRoom==0。ただし②は他の実行可能な割り込み解決でdeckまたはwaitingRoomが1枚以上になり得る場合は敗北確定を保留。両者同時敗北時はturnPlayerの勝利。Phase Dでは判定基盤中心で、自動Process開始・pendingInterrupts解決・pendingChecks解決・敗北確定処理はまだ実装しない。既存のProcessManager / ruleState / REFRESH / LEVEL_UP設計との関係も記載する。

---

## 依頼・追加方針（2026-08-16 20:46 JST）

出典ターン：01a00a65-2a19-70a2-8fbe-86c1001ff448

上記作成してもらった設計書をvscode上に配置できますでしょうか

