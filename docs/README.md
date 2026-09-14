# 設計書ガイド

## 目的

`docs`は、プロジェクト全体、対戦処理、カードデータ、UIの設計を、正本を重複させず追える状態に保つ。

## 構成

```text
docs/
├── README.md                 # 文書の入口と正本の案内
├── １．設計書/              # 現在の実装と次Phaseの設計
└── ９．テスト/              # 手動確認の備忘・依頼サンプル
```

設計書がまだ少数であるため、現時点では「対戦」「カードデータ」等のフォルダへ再分割しない。文書数が増え、一覧性が下がった時点で大分類を導入する。既存ファイルの大量移動より、正本へのリンクと責務境界を優先する。

## 正本と参照先

| 知りたい内容 | 正本 |
| --- | --- |
| プロジェクト全体の責務・依存方向 | [architecture.md](１．設計書/architecture.md) |
| 画面フロー、DeckDefinition、対戦開始・結果 | [application-flow.md](１．設計書/application-flow.md) |
| CardMaster / CardAbility / Card | [card-ability.md](１．設計書/card-ability.md) |
| MAINのPlay / Replacement / Move / Swap | [main-phase.md](１．設計書/main-phase.md) |
| Process Stackと中断・再開 | [Process.md](１．設計書/Process.md) |
| Rule Checkと敗北・割り込み | [RuleCheck.md](１．設計書/RuleCheck.md) |
| UI操作 | [ui-rules.md](１．設計書/ui-rules.md) |
| JavaScriptモデルの現行仕様 | [js-spec.md](１．設計書/js-spec.md) |
| GameEngineのフェイズ処理詳細 | [game-engine.md](１．設計書/game-engine.md) |
| HTML / レイアウト | [html-spec.md](１．設計書/html-spec.md)、[layout.md](１．設計書/layout.md) |

READMEは現在地点とロードマップ、各設計書は担当領域の詳細を扱う。同じ構造を複数文書へ再定義せず、他領域の詳細は正本へリンクする。

`９．テスト`内の`sample_*`は汎用的な依頼例であり、weiss-onlineの製品・対戦仕様の正本ではない。
