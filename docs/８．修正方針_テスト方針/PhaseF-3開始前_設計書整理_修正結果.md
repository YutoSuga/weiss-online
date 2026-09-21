Summary
docs/１．設計書/ 配下の11ファイルを指定どおり日本語名へリネームしました。

architecture.md → アーキテクチャ.md

application-flow.md → アプリケーションフロー.md

card-ability.md → カードデータモデル.md

game-engine.md → ゲームエンジン.md

html-spec.md → HTML仕様.md

js-spec.md → JavaScript仕様.md

layout.md → レイアウト.md

main-phase.md → メインフェイズ.md

process.md → プロセス.md

rule-check.md → ルールチェック.md

ui-rules.md → UI操作.md

docs/README.mdは作業開始時点ですでに存在せず、既存のdocs/設計書一覧.mdを文書入口として更新しました。設計書一覧では、日本語化した全ファイルと新規一覧への参照を統一しています。

ルートREADME.mdの設計書リンクを新しい日本語ファイル名へ更新し、新規のEntity / Object一覧へのリンクも追加しました。

docs/１．設計書/エンティティ・オブジェクト一覧.mdを新規作成しました。CardMaster、CardAbility、Card、DeckDefinition、Deck、Player、GameStateについて、分類、責務、可変性、管理主体、現在の実装状況を整理しています。

Service / ComponentとしてCardMasterRegistry、GameEngine、ProcessManager、Renderer、Controllersを整理し、「実装済み」「概念設計」「F-3A予定」「F-3B予定」「F-3D予定」を明確に区別しました。

CardMasterはimmutableなカード種類、CardAbilityはF-3B予定のimmutableな能力定義、Cardはmutableな対戦中の物理カードinstanceとして責務を分離しました。Mermaid図では、masterId、Registry、DeckDefinition、GameState / Player / Deckとの関係をまとめています。

CardMasterの想定フィールド、内部Master IDであるidと実カード番号cardNumberの違い、Cardのruntimeフィールド、card.id互換getter、固定情報getterを設計書へ明記しました。

CardMasterRegistryの想定API、メモリ上のRegistryであって永続ストレージではないこと、ブラウザ再読み込み時の再構築、JSON / API / DBなどの取得元からCard・GameEngineを分離する方針を明記しました。

将来のオンライン対戦ではサーバー上の確定済みGameStateを正としてruntime状態を復元し、Controllerの未確定なUI-local stateは原則復元しない方針をアーキテクチャ設計書へ追加しました。

今回の整理だけではF-3Aを完了扱いにしないこと、およびCardMaster、CardMasterRegistry、CardAbilityが現時点では未実装であることを明記しています。

JavaScript、HTML、CSSなどの実装コードは変更していません。

コミットee29d4c（docs: F-3A着手前の設計書を整理）を作成し、PRタイトル・本文も登録しました。

最終的なgit status --shortは空で、ワークツリーはクリーンです。コミット概要は、14ファイル、105行追加、34行削除、11件のリネーム、1件の新規Markdown追加。

Testing

✅ python3によるローカルMarkdownリンク検査 — すべてのMarkdownリンク先が存在することを確認。

✅ rg -n '(architecture|application-flow|card-ability|game-engine|html-spec|js-spec|layout|main-phase|process|rule-check|ui-rules)\.md' --glob '!node_modules/**' --glob '!.git/**' . — 旧ファイル名への参照が0件であることを確認。

✅ find 'docs/１．設計書' -maxdepth 1 -type f -printf '%f\n' | sort — 指定された11件の日本語ファイル名と新規一覧ファイルを確認。

✅ [ ! -e docs/README.md ] — 旧docs/README.mdが存在しないことを確認。

✅ git diff --cached --check — 空白エラーなどがないことを確認。

✅ git diff --cached --name-onlyを用いた拡張子検査 — JavaScript / HTML / CSSファイルに変更がないことを確認。

✅ git status --short — コミット後のワークツリーがクリーンであることを確認。

✅ git log -1 --oneline — ee29d4c docs: F-3A着手前の設計書を整理を確認。
