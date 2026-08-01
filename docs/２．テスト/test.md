# test.md

# テスト方法備忘
chromeのconsoleを開発者ツールで開く

画面を再描画する場合は、以下を入力
renderer.render(gameState);

手札にcard1を追加する場合は、以下を入力
gameState.players.self.hand.push(card1);
renderer.render(gameState);