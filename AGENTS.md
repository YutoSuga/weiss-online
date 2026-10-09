# Coding agent向け作業ガイド

## 1. 作業開始と資料の役割

- 開始時に `git status --short` と差分を確認し、既存変更を勝手に破棄しない。依頼の範囲を守り、タスク外の変更を混ぜない。
- [README](README.md)で概要・現在地点・ロードマップを確認し、[設計書一覧](docs/設計書一覧.md)から変更対象の正本を読む。進捗表記は実装・テストとも照合する。
- このファイルは作業時の恒久ルールと参照先を案内する。詳細仕様は `docs/１．設計書/` を現在仕様の正本とし、ここへ転載しない。
- `docs/８．修正方針_テスト方針/` と `docs/Phase*.md` は背景・経緯の履歴資料。古い修正記録を現在仕様より優先しない。設計とコードの不一致は明示し、推測で仕様を決めたり依頼外の修正をしない。
- 実装は `client/js/`（`models/`、`core/`、`ui/`、`abilities/`、`data/`、`constants/`）、画面は `client/index.html` と `client/css/`、開発用データは `client/data/`、自動テストは `client/tests/*.test.mjs` にある。

## 2. 変更対象から読む正本

| 変更対象 | 先に読む資料 |
| --- | --- |
| 全体の責務・依存方向 | [アーキテクチャ](docs/１．設計書/システム共通/アーキテクチャ.md) |
| Deck供給・画面フロー・外部データ境界 | [アプリケーションフロー](docs/１．設計書/システム共通/アプリケーションフロー.md) |
| モデル・CardMaster / Card / CardAbility | [カードデータモデル](docs/１．設計書/システム共通/カードデータモデル.md)、[JavaScript仕様](docs/１．設計書/システム共通/JavaScript仕様.md)、[エンティティ・オブジェクト一覧](docs/１．設計書/システム共通/エンティティ・オブジェクト一覧.md) |
| GameEngine・フェイズ進行 | [ゲームエンジン](docs/１．設計書/システム共通/ゲームエンジン.md)。MAINのPlay / Replacement / Move / Swapは[メインフェイズ](docs/１．設計書/対戦画面/フェイズ/メインフェイズ.md) |
| Process Stack・入力待ち・中断 / 再開 | [プロセス](docs/１．設計書/システム共通/プロセス.md) |
| Rule Check・Refresh / Penalty / Level Up・敗北 | [ルールチェック](docs/１．設計書/システム共通/ルールチェック.md) |
| CardAbility schema・Cost / Condition / Effect・Ability ProcessとRule Processの接続 | [カード能力共通](docs/１．設計書/対戦画面/カード能力/カード能力共通.md) |
| ACTのQuery・タイミング・Process | [ACT能力共通](docs/１．設計書/対戦画面/カード能力/起動効果/ACT能力共通.md) |
| AUTOのEvent / Trigger・Pending AUTO・Check Timing・Process | [AUTO能力共通](docs/１．設計書/対戦画面/カード能力/自動効果/AUTO能力共通.md) |
| 個別キーワード・処理パターン | [集中](docs/１．設計書/対戦画面/カード能力/起動効果/キーワード能力/集中.md)、[アンコール](docs/１．設計書/対戦画面/カード能力/自動効果/キーワード能力/アンコール.md)、[複合コスト・山札検索AUTO](docs/１．設計書/対戦画面/カード能力/自動効果/処理パターン/複合コスト・山札検索AUTO.md) |
| DOM・入力 / 選択・表示配置 | [HTML仕様](docs/１．設計書/対戦画面/HTML仕様.md)、[UI操作](docs/１．設計書/対戦画面/UI操作.md)、[レイアウト](docs/１．設計書/対戦画面/レイアウト.md) |

カード能力の変更では、必ずカード能力共通と該当Ability Typeの設計を先に読む。`activationTrigger`、Condition、Cost availability、Effect availability、Pending生成 / 提示 / 解決を混同しない。定義を保持できることと実行対応済みであることも区別する。新しいCost / Effect Typeはデータだけで先行追加せず、共通設計の追加規則に従う。

## 3. 責務境界と重要な不変条件

- GameState / Modelは確定した対戦状態を保持し、DOMを操作しない。DOMを状態の正本にしない。
- GameEngineはルール判定・確定Action・状態更新・Process開始 / 再開を担当し、DOM操作はRendererへ委譲する。
- ProcessManagerは `gameState.ruleState.processStack` のpush / popとstep / status更新を担当し、ルールや優先順位を判断しない。
- Rendererは表示責務、Controllerは入力と未確定UI状態の責務を守る。ゲームルールを追加しない。確定操作はGameEngineへ委譲し、Rendererから対戦状態を変更しない。
- 固定情報はimmutableなCardMaster / CardAbility、対戦中の1枚はCard instance。Zone移動で同じCard object / `instanceId`を維持し、同じmasterの複数枚や異なるowner間でinstanceを共有しない。表示はCardの公開APIを入口にする。
- Deck TOPは `deck.cards[0]`、Stock TOPとWaiting Room TOPは配列末尾。見た目の回転・重なり方向でcollection順序を変えない。
- Stageは `front` の1～3、`back` の1～2のslot座標。`row / index`をStage配列の並び順と混同せず、削除後にslotを詰めない。DOMの `data-index` は1始まり、JS配列添字とは区別する。
- Card所在の正本はPlayer / Deckのcollection membershipで、所在は一意にする。Zone移動は既存Engineの移動経路に従い、collection・metadata・reindexを完了してからGame Eventを発行する。直接配列操作だけで通常Actionを実装しない。
- Processの `step` は次に実行する処理。Check Pointへ入る前に再開位置を保存し、Cost / Effectを二重実行しない。`pendingChecks`、`pendingInterrupts`、`pendingAutos`は別の責務を持ち、流用しない。詳細は上記Process・Rule Check・能力設計を読む。

## 4. 変更方針・結果の記録

正本は[修正記録の運用](docs/８．修正方針_テスト方針/README.md)と[修正記録一覧](docs/８．修正方針_テスト方針/修正記録一覧.md)。意味のある既存実装修正・不具合対応・Follow-upでは、修正方針を実装前に作成し、実装・検証後に修正結果と一覧を更新する。挙動変更は現在仕様の設計書にも反映する。

記録要否は運用READMEの対象に従う。新機能も追跡価値のある実装・挙動変更として確認し、新規機能だけの別運用を推測で作らない。単純な誤字等は既存運用との整合を確認して省略できる。変更範囲が資料更新を許可しない場合は、その制約を守って必要な更新を完了報告に残す。

## 5. テストとブラウザ確認

- 自動テストはリポジトリルートから `node --test client/tests/*.test.mjs`。まず関連テストを実行し、共通基盤や複数領域へ影響する変更・最終回帰確認では全体を実行する。件数は現在のHEADを正とし、固定しない。
- 結合・実機確認の正本は[テスト運用](docs/９．テスト/README.md)と[チェックシートひな形](docs/９．テスト/チェックシート_ひな形.md)。自動テスト成功だけで実機確認OKにせず、実施していない確認やユーザー実機結果を推測でOKにしない。確認手段・実施者・結果を区別する。
- 実施結果は必要な観点をひな形へ追加した後、その時点のひな形を全量コピーして作成する。未確認項目を削除せず、既存チェックIDを不必要に変更・詰め直ししない。
- `割愛`は確認可能だが今回未実施、`対象外`はその確認方法が適用されない場合。自動確認の`済`は今回実行して成功した項目だけに付ける。
- ブラウザ確認が必要な変更では、ページロード、JavaScript error、対象操作、必要なUI状態を実際に確認する。結合確認の準備はDEVパネルまたはGameEngineの正規操作を優先する。
- 起動方法はREADMEや利用可能な環境手順を確認する。正式な起動手順が見つからない場合、一時的な静的HTTPサーバーでの確認条件を報告し、その方法を正式仕様と扱わない。外部カード画像はネットワーク・証明書・外部URL要因を含め別途取得 / 表示を確認する。

## 6. 公式ルールの参照

[公式ルール参照版の管理](docs/ルール参照/README.md)に記載された採用版と参照メモを確認する。採用版の値をこのファイルへ重複保持せず、最新公式URLへ自動追随しない。

新版は差分確認・影響調査を行い、影響があれば設計・チェックシート・実装・回帰テストを含む別タスク / PRで扱う。影響がない場合も参照版・確認記録を更新する。条文番号や仕様を推測しない。公式サイト / PDFへアクセスできないときは保存済み同版記録と未照合範囲を明示し、未確認の本文を補完しない。公式PDF全文はGitへ保存しない。

## 7. 完了前の確認とGit運用

- `git diff --check`、必要なテスト、`git status --short`を実行する。新規ファイルも内容を確認し、Markdown参照先は日本語パスを含め実在確認する。
- commitする場合は、未ステージ・ステージ済み双方の差分を確認し、依頼対象のファイルだけを含める。commit / push / PRは依頼範囲に従い、他の作業を勝手に含めない。
- 完了報告には変更ファイル、検証コマンドと結果、未実施・未解決事項、commitした場合のhashとmessage、最終作業ツリー状態を記載する。
