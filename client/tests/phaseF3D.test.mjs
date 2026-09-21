import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { ABILITY_TYPE } from "../js/constants/ability.js";
import { CardMaster } from "../js/models/cardMaster.js";
import { CardMasterRegistry } from "../js/models/cardMasterRegistry.js";
import { Card } from "../js/models/card.js";
import { Renderer, formatAbility, formatCurrentValue } from "../js/core/renderer.js";

function create(imageUrl = null, abilities = []) {
  const master = new CardMaster({
    id: "display-master", cardNumber: "T/001", name: "表示テスト", cardType: "CHARACTER",
    color: "RED", imageUrl, level: 0, cost: 0, basePower: 1500, baseSoul: 1,
    triggerIcons: ["SOUL"], traits: ["テスト"], text: "legacy text", abilities,
  });
  const registry = new CardMasterRegistry();
  registry.register(master);
  return { master, registry, card: new Card({
    instanceId: "display-1", masterId: master.id, masterRegistry: registry, owner: "self", zone: "hand",
  }) };
}

test("imageUrlはstring/nullのimmutableな固定情報でCard getterから参照できる", () => {
  const url = "https://example.com/card.png";
  const { master, card } = create(url);
  assert.equal(master.imageUrl, url);
  assert.equal(card.imageUrl, url);
  assert.ok(Object.isFrozen(master));
  assert.throws(() => { master.imageUrl = null; }, TypeError);
  assert.equal(create(null).card.imageUrl, null);
  assert.throws(() => create(123), /imageUrl/);
  assert.throws(() => create("card.png"), /absolute URL/);
});

test("runtime serializationにimageUrlを含めず復元後はRegistryのmasterから参照する", () => {
  const { registry, card } = create("https://example.com/card.png");
  const json = card.toJSON();
  assert.equal(Object.hasOwn(json, "imageUrl"), false);
  assert.equal(Card.fromJSON(json, registry).imageUrl, "https://example.com/card.png");
});

test("Power/Soulは現在値を主表示し差がある場合だけ元値を併記する", () => {
  assert.equal(formatCurrentValue(1500, 1500), "1500");
  assert.equal(formatCurrentValue(2000, 1500), "2000（元1500）");
  assert.equal(formatCurrentValue(1, 1), "1");
  assert.equal(formatCurrentValue(2, 1), "2（元1）");
});

test("Ability表示はtype labelとCardAbility.textだけを使用し0件・複数件を扱う", () => {
  const inputs = [
    { id: "c", type: ABILITY_TYPE.CONTINUOUS, text: "能力1" },
    { id: "a", type: ABILITY_TYPE.AUTO, text: "能力2" },
    { id: "x", type: ABILITY_TYPE.ACT, text: "能力3" },
  ];
  const { card } = create(null, inputs);
  assert.deepEqual(card.abilities.map(formatAbility), ["【永】能力1", "【自】能力2", "【起】能力3"]);
  assert.deepEqual(create().card.abilities, []);
});

test("詳細と盤面のvisibility判定は非公開Cardの固定情報を許可しない", () => {
  const renderer = new Renderer(null, { viewerId: "self" });
  const { card } = create("https://example.com/private.png");
  card.owner = "opponent";
  assert.equal(renderer.canViewerSeeCard(card, "opponent", card.getEffectiveVisibility()), false);
  card.owner = "self";
  assert.equal(renderer.canViewerSeeCard(card, "self", card.getEffectiveVisibility()), true);
  card.setVisibilityOverride("hidden");
  assert.equal(renderer.canViewerSeeCard(card, "self", card.getEffectiveVisibility()), false);
});

test("詳細画像はURLをimgへ設定しnull・ロード失敗で共通placeholderへ戻す", () => {
  const OriginalHTMLElement = globalThis.HTMLElement;
  const OriginalHTMLImageElement = globalThis.HTMLImageElement;
  class FakeElement { constructor() { this.hidden = false; } }
  class FakeImage extends FakeElement {
    set src(value) { this.source = value; }
    removeAttribute(name) { if (name === "src") this.source = undefined; }
  }
  globalThis.HTMLElement = FakeElement;
  globalThis.HTMLImageElement = FakeImage;
  try {
    const image = new FakeImage();
    const placeholder = new FakeElement();
    const panel = { querySelector(selector) {
      return selector === "[data-card-detail-image]" ? image : placeholder;
    } };
    const renderer = new Renderer(null);
    renderer.renderCardDetailImage(panel, "https://example.com/card.png");
    assert.equal(image.source, "https://example.com/card.png");
    assert.equal(image.hidden, false);
    assert.equal(placeholder.hidden, true);
    image.onerror();
    assert.equal(image.source, undefined);
    assert.equal(image.hidden, true);
    assert.equal(placeholder.hidden, false);
    renderer.renderCardDetailImage(panel, null);
    assert.equal(placeholder.hidden, false);
  } finally {
    globalThis.HTMLElement = OriginalHTMLElement;
    globalThis.HTMLImageElement = OriginalHTMLImageElement;
  }
});

test("開発データに縦長・横長・null画像の3パターンがある", async () => {
  const data = JSON.parse(await readFile(new URL("../data/card-masters.json", import.meta.url), "utf8"));
  assert.equal(data[0].imageUrl, "https://ws-tcg.com/wordpress/wp-content/images/cardlist/k/kxx_we50/kch_we50_52sp.png");
  assert.ok(data.some((master) => master.cardType === "CLIMAX" && master.imageUrl === "https://ws-tcg.com/wordpress/wp-content/images/cardlist/k/kch_w78/kch_w78_119r.png"));
  assert.ok(data.some((master) => master.imageUrl === null));
});

test("右上詳細画像は見出し列を持たず、固定高さでcropしない", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../css/board.css", import.meta.url), "utf8");
  const imageBlock = html.match(/<div class="card-detail-image-frame">[\s\S]*?<\/div>/)?.[0];
  assert.ok(imageBlock);
  assert.doesNotMatch(imageBlock, /<dt>画像<\/dt>/);
  assert.match(imageBlock, /data-card-detail-image/);
  assert.match(imageBlock, /data-card-detail-image-placeholder>画像なし/);
  assert.match(css, /\.card-detail-image-frame img\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*100%;[^}]*height:\s*auto;/s);
  assert.doesNotMatch(css, /\.card-detail-image-frame img\s*\{[^}]*height:\s*100%/s);
});
