// 修訂標示：逐字比對並保留格式標籤。
import "../setup.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
const { diffHtml } = await import("../../public/js/core/diff.js");

test("只標示真正改動的文字，粗體標籤保留", () => {
  const out = diffHtml("<p>台北市<strong>某路1號3樓</strong></p>", "<p>台北市<strong>某路2號5樓</strong></p>");
  assert.match(out, /<strong>某路<del class="d"[^>]*>1號3<\/del><ins class="d"[^>]*>2號5<\/ins>樓<\/strong>/);
});

test("相同內容不產生標示", () => {
  assert.equal(diffHtml("<p>相同</p>", "<p>相同</p>"), "<p>相同</p>");
});
