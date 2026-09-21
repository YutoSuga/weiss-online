実装概要
MAINフェイズの手札選択条件からcardType === CHARACTER制約を除外し、以下を満たす自分の手札Cardを詳細確認目的で選択可能にしました。

自分のターン

phase === MAIN

MAIN_PHASE / WAITING_INPUT

自分のHandに存在し、owner・zoneが一致するCard
canSelectCardForMain()はLevel・Color・Cost・cardTypeを判定しません。

CHARACTERのStage play可否は、従来どおりgetCharacterPlayDisabledReason()／canPlayCharacterToStage()で別途判定します。Level・Color・Cost条件NGのCHARACTERも選択・詳細表示は可能ですが、Stage destinationは表示されず、既存のプレイ不可理由が表示されます。

CLIMAXもMAIN WAITING_INPUT中に選択して詳細を確認できます。一方、getMainDestinationCandidates()は非CHARACTERに空配列を返すため、Stage destinationを表示せず、PLAY_CHARACTERも開始しません。CLIMAXのプレイ処理は追加していません。

Stage Cardの選択・Move・Swap・Replacement処理には変更を加えていません。Controllerでは従来どおりStage選択時にStage用Destination Queryを使用しています。

右上カード詳細の「画像」見出しを削除し、画像を詳細先頭の独立ブロックに変更しました。名前・種類・色・Level・Cost・Power・Soul・Trigger・Traits・Abilitiesは維持しています。

詳細画像はwidth: 100%、max-width: 100%、height: auto、object-fit: containとし、縦長・横長とも回転やcropをせず、元のアスペクト比のまま全体表示できるようにしました。盤面・手札側の画像CSSや方向制御は変更していません。

imageUrl === nullとロードエラーでは同じ「画像なし」placeholderへフォールバックします。画像のsrcを削除して実画像を非表示にするため、失敗後にも画像用の大きな固定枠は残りません。

Rendererのvisibility判定、Power/Soulのcurrent/base表記、Abilityの​:codex-terminal-citation[codex-terminal-citation]{line_range_start=192 line_range_end=247 terminal_chunk_id=永】【自】【起】表示経路は変更していません。CardMasterRegistry依存もRendererへ追加していません。【F:client/js/core/renderer.js}

READMEと設計書に「選択可能」と「プレイ可能」が別判定であること、CLIMAXは詳細確認のみ可能であること、画像表示とコンパクトplaceholderの仕様を追記しました。

READMEの進捗は引き続きF-3D COMPLETE / F-4 NEXTです。Ability実行、AbilityEngine、effectQueue連携は追加していません。

変更ファイル
README.md

client/index.html

client/css/board.css

client/js/core/gameEngine.js

client/js/ui/mainPhaseController.js

client/tests/phaseF3D.test.mjs

docs/１．設計書/UI操作.md

docs/１．設計書/JavaScript仕様.md

docs/１．設計書/メインフェイズ.md

新規: client/tests/mainHandSelection.test.mjs

削除: なし

テスト内容
MAIN WAITING_INPUTにおけるCHARACTER・CLIMAX・Level NG・Color NG・Cost NG Cardの選択を検証しました。

CLIMAXのDestinationが空であり、PLAY_CHARACTER Processが積まれないことを検証しました。

相手ターン、WAITING_INPUT以外、MAIN以外、自分のHand以外では選択できないことを検証しました。

null画像、ロード失敗、visibility、縦長・横長テストデータ、および固定高さを使わないHTML/CSS構造を検証しました。

Testing

✅ node --test client/tests/mainHandSelection.test.mjs client/tests/phaseF3D.test.mjs — 11件成功

✅ node --test client/tests/*.test.mjs — 全29件成功

✅ find client -type f \( -name '*.js' -o -name '*.mjs' \) -print0 | xargs -0 -n1 node --check

✅ git diff --check

✅ rg -n "CardMasterRegistry" client/js/core/renderer.js — Rendererへの依存追加なし

⚠️ ブラウザ自動操作・スクリーンショット用ツールが環境に存在しなかったため、ブラウザ目視確認は未実施です。ユーザー側では、縦長画像全体、横長CLIMAX画像全体、null／404時のコンパクトplaceholder、CLIMAX選択時にDestinationが出ないこと、およびStage Move／Swap／Replacementの実操作をご確認ください。

✅ git status --short — 出力なし、working tree clean

Commit / PR
Commit: 081543b8822f4e8208d08ae6a0cd2aac7f70eef1

Commit message: fix: refine card detail image and main hand selection

PR title: fix: refine card detail image and main hand selection

PR: make_prでタイトル・本文を作成済みです。
