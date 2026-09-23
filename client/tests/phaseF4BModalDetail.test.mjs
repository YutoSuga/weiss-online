import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('UI layer tokens enforce phase < backdrop < modal', async () => {
  const css = await read('../css/board.css');
  const value = (name) => Number(css.match(new RegExp(`${name}:\\s*(\\d+)`))?.[1]);
  assert.ok(value('--z-phase') < value('--z-modal-backdrop'));
  assert.ok(value('--z-modal-backdrop') < value('--z-modal'));
  assert.match(css, /\.message-overlay[\s\S]*?z-index:\s*var\(--z-phase\)/);
  assert.match(css, /\.card-selection-dialog\s*\{[^}]*z-index:\s*var\(--z-modal-backdrop\)/);
  assert.match(css, /\.card-selection-dialog__panel\s*\{[^}]*z-index:\s*var\(--z-modal\)/);
});

test('ResolutionとDeck SearchはModal内Detailと空状態を持つ', async () => {
  const html = await read('../index.html');
  assert.match(html, /data-deck-search-detail/);
  assert.match(html, /data-resolution-detail/);
  assert.equal((html.match(/カードを選択すると詳細を確認できます。/g) ?? []).length, 2);
});

test('3箇所のCard Detailはcontainer指定可能なRenderer責務を共有する', async () => {
  const [renderer, deckSearch, resolution] = await Promise.all([
    read('../js/core/renderer.js'),
    read('../js/ui/deckSearchController.js'),
    read('../js/ui/resolutionConfirmationController.js'),
  ]);
  assert.match(renderer, /container = null/);
  assert.match(renderer, /const panel = container \?\?/);
  assert.match(deckSearch, /renderCardDetail\?\.\(detailCard, \{ container: this\.detail, allowPrivate: true \}\)/);
  assert.match(resolution, /renderCardDetail\?\.\(card, \{ container: this\.detail \}\)/);
  assert.match(resolution, /selectable: false, selected: false/);
  assert.doesNotMatch(resolution, /toggleSearchDeckSelection/);
});

test('Deck SearchはeligibleだけtoggleしDetail対象をrerender後も保持する', async () => {
  const source = await read('../js/ui/deckSearchController.js');
  assert.match(source, /this\.detailCardId = card\.instanceId/);
  assert.match(source, /if \(slot\.dataset\.selectable === "true"\) this\.gameEngine\.toggleSearchDeckSelection/);
  assert.match(source, /state\.cards\.find\(\(\{ instanceId \}\) => instanceId === this\.detailCardId\)/);
});

test('narrow viewportではカード一覧とDetailを縦配置する', async () => {
  const css = await read('../css/board.css');
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.card-selection-dialog__body\s*\{[\s\S]*?flex-direction:\s*column/);
});
