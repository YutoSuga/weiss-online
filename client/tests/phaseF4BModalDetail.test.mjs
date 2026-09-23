import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Renderer } from '../js/core/renderer.js';
import { MainPhaseController } from '../js/ui/mainPhaseController.js';
import { ResolutionConfirmationController } from '../js/ui/resolutionConfirmationController.js';
import { DeckSearchController } from '../js/ui/deckSearchController.js';

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
  assert.equal((html.match(/data-board-card-detail/g) ?? []).length, 1);
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
  assert.match(renderer, /const panel = container \?\? this\.rootElement\?\.querySelector\("\[data-board-card-detail\]"\)/);
  assert.match(deckSearch, /renderCardDetail\?\.\(detailCard, \{ container: this\.detail, allowPrivate: true \}\)/);
  assert.match(resolution, /renderCardDetail\?\.\(card, \{ container: this\.detail \}\)/);
  assert.match(resolution, /selectable: false, selected: false/);
  assert.doesNotMatch(resolution, /toggleSearchDeckSelection/);
});

test('通常盤面の連続Card clickは明示した右上Detailへ切り替えて描画する', () => {
  const OriginalHTMLElement = globalThis.HTMLElement;
  const OriginalHTMLButtonElement = globalThis.HTMLButtonElement;
  class FakeElement {}
  globalThis.HTMLElement = FakeElement;
  globalThis.HTMLButtonElement = FakeElement;
  try {
    const boardDetail = new FakeElement();
    boardDetail.querySelector = () => null;
    boardDetail.querySelectorAll = () => [];
    const modalDetail = new FakeElement();
    const queried = [];
    const renderer = new Renderer({ querySelector(selector) {
      queried.push(selector);
      return selector === '[data-board-card-detail]' ? boardDetail : modalDetail;
    } });
    const cards = [
      { instanceId: 'normal-1', owner: 'self', zone: 'hand' },
      { instanceId: 'normal-2', owner: 'self', zone: 'hand' },
    ];
    const rendered = [];
    renderer.canViewerSeeCard = () => true;
    renderer.renderCardDetailImage = (_panel, imageUrl) => rendered.push(imageUrl);
    renderer.renderCardDetail(cards[0]);
    renderer.renderCardDetail(cards[1]);

    assert.deepEqual(queried, ['[data-board-card-detail]', '[data-board-card-detail]']);
    assert.deepEqual(rendered, [undefined, undefined]);
    assert.notEqual(boardDetail, modalDetail);
  } finally {
    globalThis.HTMLElement = OriginalHTMLElement;
    globalThis.HTMLButtonElement = OriginalHTMLButtonElement;
  }
});

test('MAINの別Card選択とModal終了後の選択は通常盤面Detail呼び出しを維持する', () => {
  const OriginalHTMLElement = globalThis.HTMLElement;
  class FakeElement {}
  globalThis.HTMLElement = FakeElement;
  try {
    const calls = [];
    const cards = [{ instanceId: 'hand-1', zone: 'hand', cardType: 'EVENT' }, { instanceId: 'hand-2', zone: 'hand', cardType: 'CLIMAX' }];
    const controller = new MainPhaseController({
      gameState: { players: { self: { hand: cards } } },
      gameEngine: {
        canSelectCardForMain: () => true,
        getCharacterPlayDisabledReason: () => null,
        getMainDestinationCandidates: () => [],
      },
      renderer: { renderCardDetail: (...args) => calls.push(args) },
      rootElement: { querySelectorAll: () => [] },
    });
    controller.handleHandCardClick({ dataset: { index: '1' } });
    controller.handleHandCardClick({ dataset: { index: '2' } });
    // Modal Controllerのclose/syncは通常盤面の選択状態を所有しないため、その後も同じ経路を利用できる。
    controller.handleHandCardClick({ dataset: { index: '1' } });

    assert.deepEqual(calls.filter(([card]) => card).map(([card]) => card.instanceId), ['hand-1', 'hand-2', 'hand-1']);
    assert.ok(calls.filter(([card]) => card).every(([, options]) => options.container === undefined));
  } finally {
    globalThis.HTMLElement = OriginalHTMLElement;
  }
});

test('Resolution clickはModal内Detailだけを更新する', () => {
  const OriginalElement = globalThis.Element;
  class FakeElement {}
  globalThis.Element = FakeElement;
  try {
    const detail = { id: 'resolution-detail' };
    const card = { instanceId: 'resolution-card' };
    const calls = [];
    const controller = new ResolutionConfirmationController({
      gameEngine: { getBrainstormConfirmationState: () => ({ cards: [card] }) },
      renderer: { renderCardDetail: (...args) => calls.push(args) },
      rootElement: null,
    });
    controller.detail = detail;
    const slot = { dataset: { cardId: card.instanceId } };
    const target = new FakeElement();
    target.closest = () => slot;
    controller.handleClick({ target });
    assert.deepEqual(calls, [[card, { container: detail }]]);
  } finally {
    globalThis.Element = OriginalElement;
  }
});

test('Deck Searchはeligible/ineligibleともModal Detailを更新しeligibleだけtoggleする', () => {
  const OriginalElement = globalThis.Element;
  class FakeElement {}
  globalThis.Element = FakeElement;
  try {
    const detail = { id: 'deck-detail' };
    const eligible = { instanceId: 'eligible' };
    const ineligible = { instanceId: 'ineligible' };
    const state = { cards: [eligible, ineligible] };
    const toggled = [];
    const calls = [];
    const controller = new DeckSearchController({
      gameEngine: {
        getSearchDeckState: () => state,
        toggleSearchDeckSelection: (id) => toggled.push(id),
      },
      renderer: { renderCardDetail: (...args) => calls.push(args) },
      rootElement: null,
    });
    controller.detail = detail;
    const click = (card, selectable) => {
      const target = new FakeElement();
      target.closest = () => ({ dataset: { cardId: card.instanceId, selectable: String(selectable) } });
      controller.handleClick({ target });
    };
    click(eligible, true);
    click(ineligible, false);

    assert.deepEqual(toggled, ['eligible']);
    assert.deepEqual(calls, [
      [eligible, { container: detail, allowPrivate: true }],
      [ineligible, { container: detail, allowPrivate: true }],
    ]);
  } finally {
    globalThis.Element = OriginalElement;
  }
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
