import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Renderer } from "../js/core/renderer.js";

const readBoardCss = () => readFile(
  new URL("../css/board.css", import.meta.url),
  "utf8",
);

test("Stage Cardのposition表示はSTAND 0度・REST 左90度・REVERSE 180度である", async () => {
  const css = await readBoardCss();

  assert.match(css, /\.stage-slot\[data-position="stand"\]\s*\{\s*transform:\s*rotate\(0deg\);\s*\}/);
  assert.match(css, /\.stage-slot\[data-position="rest"\]\s*\{\s*transform:\s*rotate\(-90deg\);\s*\}/);
  assert.match(css, /\.stage-slot\[data-position="reverse"\]\s*\{\s*transform:\s*rotate\(180deg\);\s*\}/);
});

test("REST表示はownerやCard typeで分岐せず詳細画像へ適用しない", async () => {
  const css = await readBoardCss();
  const restRules = [...css.matchAll(/([^{}]+data-position="rest"[^{}]*)\{([^}]*)\}/g)];

  assert.equal(restRules.length, 1);
  assert.equal(restRules[0][1].trim(), ".stage-slot[data-position=\"rest\"]");
  assert.doesNotMatch(restRules[0][1], /data-owner|card-detail|card-type/);
});

test("Stock表示は相手を下端、自分を上端から積み上げる", () => {
  const OriginalHTMLElement = globalThis.HTMLElement;
  class TestElement {}
  globalThis.HTMLElement = TestElement;

  const makeFixture = (owner) => {
    const slots = [1, 2, 3].map((index) => ({
      dataset: { index: String(index) },
      style: { top: "stale", bottom: "stale" },
      getBoundingClientRect: () => ({ height: 90 }),
    }));
    const container = Object.assign(new TestElement(), {
      clientHeight: 180,
      dataset: {},
      ownerDocument: {
        defaultView: {
          getComputedStyle: () => ({
            getPropertyValue: () => "18",
          }),
        },
      },
      querySelectorAll: () => slots,
      style: { setProperty() {} },
    });
    const renderer = new Renderer({ querySelector: () => container });
    renderer.updateStockStackLayout(owner);
    return slots;
  };

  try {
    assert.deepEqual(
      makeFixture("opponent").map(({ style }) => [style.top, style.bottom]),
      [["", "0px"], ["", "18px"], ["", "36px"]],
    );
    assert.deepEqual(
      makeFixture("self").map(({ style }) => [style.top, style.bottom]),
      [["0px", ""], ["18px", ""], ["36px", ""]],
    );
  } finally {
    globalThis.HTMLElement = OriginalHTMLElement;
  }
});
