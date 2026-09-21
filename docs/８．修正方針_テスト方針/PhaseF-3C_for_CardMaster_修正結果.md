Summary
正式なCardMasterデータとして、レベル・コスト・色・トリガーアイコンを分散させた12種類の仮想カードを追加し、旧test-cards.jsonとtestCardLoaderを廃止しました。

CardMasterLoaderを追加し、データ取得、必須フィールド・重複ID検証、CardMaster生成、CardMasterRegistry構築を独立したデータ供給境界へ整理しました。

TRIGGER_ICONに13種類の正式値を定義し、NONEを設けず、CardMaster生成時には未知の値をfail-fastするようにしました。

入力配列やentry objectから独立したimmutableなDeckDefinitionを追加しました。50枚などのデッキ構築ルール判定は持たせていません。

開発用test-decks.jsonとLoaderを追加し、masterId + countをRegistryで解決して、ownerごとに一意なinstanceIdを持つ独立したCard instanceへ展開できるようにしました。

開発起動処理を正式なCardMaster／DeckDefinitionフローへ切り替え、selfとopponentそれぞれに独立した50枚のDeckを生成するようにしました。

トリガー定数、Loader、CardAbility変換、DeckDefinitionのimmutable性、未知Master、instance共有防止、開発用50枚Deckを網羅するF-3C専用テストを追加しました。

READMEをF-3C完了／F-3D NEXTへ更新し、設計書にはJSON → Loader → Registry → DeckDefinition → Card → Deck → Player → GameStateの完成時データフローを追記しました。

変更はコミット0884913としてコミットし、PR「Phase F-3C: CardMaster正式データ化とDeckDefinition基盤を導入」を作成しました。

Testing

✅ node --test client/tests/*.test.mjs — 14 tests passed

✅ node --check client/js/main.dev.js

✅ node --check client/js/core/gameEngine.js

✅ git diff --check

✅ rg -n 'F-3Bまで|次PhaseはF-3C|test-cards|testCardLoader|暫定.*カード' README.md docs client || true — 廃止対象への残存参照なし

✅ git status --short — コミット後の作業ツリーはクリーンです。
