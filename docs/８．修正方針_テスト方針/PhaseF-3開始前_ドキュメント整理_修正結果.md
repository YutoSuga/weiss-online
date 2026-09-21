# PhaseF-3開始前_ドキュメント整理 修正結果

対象：README・設計書構成・カードデータ設計の整理

出典：Codexタスク「Phase D共通ルールチェック設計」（ID: 01a00a4d-c312-7680-917e-75f38686b7e9）。

2026-09-21に取得できた会話記録から作成。本文は当時の依頼・完了報告を原文中心に収録しています。記載されたテスト・コミット・push・作業ツリー状態は当時の報告であり、今回再実行・再検証した結果ではありません。パス・リンク・NEXTも当時の表記を保持しており、現在と異なる場合があります。

---

## 完了報告（2026-09-14 23:21 JST）

出典ターン：01a0a04b-31aa-75e0-8d5d-cccec0c7ebf0

F-3開始前のドキュメント整理が完了しました。CardMasterなどのコード実装には着手していません。変更は未コミットです。

【既存docs調査】

既存の設計書は以下の9件でした。

- CardMaster / CardAbility
- GameEngine
- HTML
- JavaScriptモデル
- レイアウト
- MAIN Phase
- Process
- Rule Check
- UI操作

確認した課題：

- READMEのリンクが旧フォルダ名のままで切れていた
- READMEの現在地点がF-2Aのままだった
- 通常Play／舞台移動を未実装とする古い記述が残っていた
- F-3が単一Phaseとして記載されていた
- Architectureの説明がREADME、MAIN、JS仕様などへ分散していた
- Application Flow／DeckDefinitionの正本がなかった
- `Process.md`のProcess一覧が古かった
- `GameEngin.md`にファイル名の誤記があった
- `main-phase.md`に古いフォルダパス表記が残っていた
- `docs/９．テスト/sample_*`は汎用サンプルであり、製品仕様と混同しやすい状態だった

【変更したdocs構成】

変更前：

```text
docs/
├── １．設計書/
│   ├── GameEngin.md
│   ├── Process.md
│   ├── RuleCheck.md
│   ├── card-ability.md
│   ├── html-spec.md
│   ├── js-spec.md
│   ├── layout.md
│   ├── main-phase.md
│   └── ui-rules.md
└── ９．テスト/
```

変更後：

```text
docs/
├── README.md
├── １．設計書/
│   ├── architecture.md
│   ├── application-flow.md
│   ├── card-ability.md
│   ├── game-engine.md
│   └── 既存設計書
└── ９．テスト/
```

文書数がまだ少ないため、大分類フォルダへの全面移動は行っていません。代わりに[設計書ガイド](C:/Users/sugay/git/weiss-online/weiss-online/docs/README.md)で各領域の正本を明示しました。

`GameEngin.md`は`game-engine.md`へ名称変更しています。

【README】

[README.md](C:/Users/sugay/git/weiss-online/weiss-online/README.md)を以下の状態へ更新しました。

- F-2C完了
- NEXTはF-3A
- F-3A：CardMaster導入・Cardとの分離
- F-3B：CardAbilityデータ構造
- F-3C：CardMaster JSON化・実カード数枚投入
- F-3D：Renderer／カード詳細をMaster参照へ統一
- 旧フォルダを参照していた設計書リンクを全修正

【Card Data Model】

[card-ability.md](C:/Users/sugay/git/weiss-online/weiss-online/docs/１．設計書/card-ability.md)をカードデータモデルの正本として整理しました。

- CardMaster：そのカードが何であるか
- CardAbility：そのカードに何が書かれているか
- Card：対戦中の物理的な1枚が現在どうなっているか

Mermaidによる関係図も追加しています。

F-3Aでは次の互換方針としました。

- `Card.instanceId`を対戦中の一意IDとする
- `Card.masterId`でCardMasterを識別する
- 既存の`card.id`は`instanceId`を返す互換getterとする
- `card.name`、`level`、`cost`、`color`などもCardMaster参照のgetterとして維持する
- GameEngineがCardMasterの保存形式へ直接依存しない

【Application Flow】

新規の[application-flow.md](C:/Users/sugay/git/weiss-online/weiss-online/docs/１．設計書/application-flow.md)に以下を整理しました。

```text
デッキ構築
→ 対戦準備
→ 対戦
→ 対戦結果
```

DeckDefinitionはCardMaster全文ではなく、`masterId + count`を保持します。

```js
DeckDefinition {
  id,
  name,
  cards: [
    { masterId, count },
  ],
}
```

対戦開始時は以下の流れです。

```text
DeckDefinition + CardMaster registry
→ Card instance生成
→ Deck
→ GameState
```

【test-cards.json】

現在の`test-cards.json`はF-2用暫定データとして維持します。

F-3CでCardMaster JSON schemaへ移行し、最終的にはテスト用と本番用で同じschema・ローダー境界を利用する方針です。

【外部データ】

外部サイトのschemaを内部schemaとして直接採用しない方針を明記しました。

```text
外部カード／デッキデータ
→ Import / Convert
→ weiss-online CardMaster / DeckDefinition
→ 対戦エンジン
```

外部仕様変更がGameEngineやCardへ波及しない境界にします。

【確認結果】

- ローカルMarkdownリンクはすべて解決
- 旧フォルダ名への参照なし
- `GameEngin.md`への旧参照なし
- `git diff --check`異常なし
- JavaScript／HTML／CSSなどの実装コード変更なし

【F-3A準備】

F-3Aへ進める状態です。実装時に最終決定が必要な事項は以下です。

- CardMaster registryの所有者と依存注入方法
- CardMasterのimmutable方針
- `Card.toJSON()`／`fromJSON()`でMaster参照を復元する方法
- 現行`trigger`と将来の`triggers`の移行
- 現行`text`と`flavorText`の扱い
- CardMaster重複IDや未登録`masterId`のエラー方針

---

## 後続のコミット・push報告（2026-09-14 23:38 JST）

出典ターン：01a0a05b-54ec-7eb3-8938-d6fc6b09c2f3

コミット・push完了しました。

- ブランチ: `main`
- コミット: `9c23118 docs: prepare architecture for phase F-3`
- リモート: `origin/main`
- 作業ツリー: クリーンです。

※上記本文の「未コミット」は各完了報告時点の状態です。後続の状態はこのコミット・push報告を参照してください。

