# ヴァイスシュヴァルツ総合ルール ver.1.112 参照メモ

- 公式更新日: 2026-08-24
- 公式URL: https://ws-tcg.com/rules/
- 確認日: 2026-09-27
- 用途: F-5D-3 Follow-up（複合Cost、Refresh、Level Up、Rule Check、敗北）
- 注意: 本書は全文転載ではなく、実装で参照した項目の要旨である。

| 条文・項目 | 参照要旨 | プロジェクトでの実装上の意味 | 関連設計 | 関連実装領域 | 確認日 |
| --- | --- | --- | --- | --- | --- |
| 8.4 コスト | 複数のコストは記載順に支払う。コスト支払い開始から全体完了までは、リフレッシュやレベルアップのルール処理を行わない。一部でも支払えないなら全体を支払えない。 | 全Costを事前検証し、handlerを順番に実行する。item間でCheck Pointを呼ばず、全体完了後に一度Rule Checkへ進む。 | [複合コスト・山札検索AUTO](../１．設計書/対戦画面/カード能力/自動効果/処理パターン/複合コスト・山札検索AUTO.md) | `costResolver.js`, `AUTO_ABILITY/PAY_COST` | 2026-09-27 |
| 9章 ルール処理（Refresh） | 山札が0枚なら控え室を山札へ戻してシャッフルし、リフレッシュポイントを処理する。 | 共通`REFRESH`、`REFRESH_PENALTY` Processを能力Process上へ積む。 | 同上、[ルールチェック](../１．設計書/システム共通/ルールチェック.md) | `resolveRuleCheck()`, Refresh Process | 2026-09-27 |
| 9章 ルール処理（Level Up） | Clockが7枚以上ならLevel Upを行う。 | 共通`LEVEL_UP` Processを開始し、選択完了後に再Rule Checkする。 | 同上 | Level Up Process | 2026-09-27 |
| 9章 複数ルール処理 | 同一プレイヤーについて複数の割り込み型ルール処理が同時成立した場合、そのプレイヤーが処理順を選ぶ。各処理後に条件を再確認する。 | 候補を`pendingInterrupts`へ保存しUIで1件を選択、解決後に再列挙する。古い候補を盲目的に続行しない。 | 同上 | `resolveRuleCheck()`, `selectPendingInterrupt()` | 2026-09-27 |
| 9章 敗北条件 | Level/Clockおよび山札/控え室の敗北条件は、同時に成立した解消可能なルール処理との関係を評価する。 | Cost item途中では評価しない。Cost完了後、実行可能なRefresh/Level Upおよび中断中の能力解決を先に安定化し、再Rule Checkで確定する。 | [ルールチェック](../１．設計書/システム共通/ルールチェック.md) | `runRuleCheck()`, `finishGame()` | 2026-09-27 |
| Check Timing / Check Point | Rule処理を必要な限り反復して安定させ、その後に待機中AUTO等へ進む。 | child Process完了時は`completeCurrentProcess()`から再チェックし、安定時だけ親の保存stepへresumeする。 | [AUTO能力共通](../１．設計書/対戦画面/カード能力/自動効果/AUTO能力共通.md) | Process stack, `resolveCheckPoint()` | 2026-09-27 |

公式ページへの自動取得は今回の実行環境から403/401で拒否されたため、公式ページの表示内容として提示された版情報と、既存プロジェクトに記録済みの同版確認内容を照合した。次回アクセス可能な環境ではPDFの該当項番枝番まで再照合し、内容差があれば別PRとする。
