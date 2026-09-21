Summary
Phase F-3Dを完了扱いとし、READMEの現在地点をF-3D COMPLETE、次Phaseを「F-4 ACT Ability v1 + 代表的な実カード」に更新しました。F-4の能力実行処理は実装していません。

CardMaster.imageUrlを追加しました。値は絶対URL文字列またはnullで、生成時に検証され、他のCardMaster固定情報とともにimmutableです。

Card.imageUrlをCardMasterへの委譲getterとして追加しました。Rendererはこのgetterを含むCardの公開APIだけを利用し、CardMasterRegistryを直接参照しません。

Card.toJSON()にはimageUrlを追加していません。復元後はRegistryで解決されたCardMasterを通じて取得できることをF-3Dテストで確認しました。

右上カード詳細へ、画像、名前、種類、色、Level、Cost、現在Power、現在Soul、Trigger Icons、Traits、Abilitiesを追加しました。cardNumber、masterId、instanceId、legacyなCardMaster.textは表示していません。

Power/Soulはcurrent値を主表示し、base値と異なる場合のみ2000（元1500）、2（元1）形式で表示します。

Abilityは構造化されたconditions/costs/effectsを解析せず、CardAbility.typeとCardAbility.textのみから、CONTINUOUS → ​:codex-terminal-citation[codex-terminal-citation]{line_range_start=6 line_range_end=19 terminal_chunk_id=永】、AUTO → 【自】、ACT → 【起】として表示します。0件は-、複数件はリスト表示です。【F:client/js/core/renderer.js}

imageUrlがある場合はimg.srcへ設定し、nullまたはロードエラー時はURL・ファイル名を含まない共通の「画像なし」placeholderへ切り替えます。

詳細画像領域を一定の高さに保ち、object-fit: containで縦長・横長のアスペクト比を維持します。盤面・手札等のカード方向や回転ロジックは変更していません。

visibilityを詳細表示にも適用し、非公開Cardでは画像・固定情報・能力を表示しません。また、既存盤面描画でも非公開Cardの名前やtitleを露出しないようにしました。

開発データには、縦長画像付きCardMaster、横長画像付きCLIMAX CardMaster、imageUrl: nullのCardMasterを収録しました。縦長カードには表示確認用の3種類のAbilityも設定しています。

F-3D専用テストでは、imageUrlの型・immutable性・getter・serialization、Power/Soul、3種類のAbility、0件/複数件、visibility、画像ロード失敗fallback、3種類の開発画像データを検証しています。

表示データフローをカードデータモデル設計書へ明記しました。CardMaster → Cardの委譲getter → Renderer → 対戦画面/右上詳細、RendererがRegistryを直接参照しないこと、画像・能力・Power/Soulの取得経路を記載しています。

UI設計書には詳細表示項目、識別子を表示しない方針、Ability表記、placeholder、アスペクト比、visibilityを記載しました。

新規ファイルはclient/tests/phaseF3D.test.mjsです。削除ファイルはありません。

変更ファイルは、モデル・Loader・Renderer・HTML/CSS・開発用CardMasterデータ・F-3C回帰テスト・README、および指定された設計書一式です。

コミットは b975acdbda44233238f8d60e647219fc95b31877 — feat: implement F-3D card detail rendering です。

PR作成ツールへ、タイトル feat: implement F-3D card detail rendering とテスト・ブラウザ確認制約を含む本文を登録しました。ツールからPR番号・URLは返却されませんでした。

最終working treeはcleanです。

Testing
✅ node --test client/tests/phaseF3D.test.mjs — F-3D専用テスト7件すべて成功。

✅ node --test client/tests/*.test.mjs — F-3A/F-3B/F-3Cを含む全21件が成功。

✅ for f in $(rg --files client/js -g '*.js'); do node --check "$f" || exit 1; done — 全JavaScriptファイルのsyntax check成功。

✅ git diff --check — whitespace errorなし。

✅ ! rg -n "CardMasterRegistry|masterRegistry|\.master\b" client/js/core/renderer.js — RendererからRegistryおよびCardMasterへの直接参照なし。

✅ ! rg -n "ws-tcg\.com" client/js client/css --glob '!data/card-masters.json' — 実画像URLはcard-masters.json以外にハードコードされていません。

✅ git status --short — 出力なし、working tree clean。

⚠️ command -v chromium || command -v chromium-browser || command -v google-chrome — 利用可能なブラウザ実行環境がなかったため、スクリーンショットおよび実ブラウザ目視確認は実施できませんでした。

Browserでの追加目視確認項目
ブラウザ環境では、次を最終確認してください。

test-card-001選択時に縦長画像が変形せず表示されること。

横長画像付きCLIMAXカード選択時に横長のまま表示されること。

imageUrl: nullのカードで「画像なし」が表示されること。

無効URLへ一時的に差し替えた場合に同じplaceholderへfallbackすること。

カード選択変更に追従して画像・各固定情報・Ability一覧が更新されること。

Abilityなしカードで詳細欄が崩れないこと。

表示確認用カードで【永】【自】【起】と各Ability textが並ぶこと。

相手の非公開手札、山札、ストックから実画像・名前・能力が露出しないこと。

画像解像度や縦横比によって右サイドバー全体のレイアウトが大きく変化しないこと。
