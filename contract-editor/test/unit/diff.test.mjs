// 修訂標示：逐字比對並保留格式標籤。
import "../setup.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
const { diffHtml, changeList } = await import("../../public/js/core/diff.js");

test("只標示真正改動的文字，粗體標籤保留", () => {
  const out = diffHtml("<p>台北市<strong>某路1號3樓</strong></p>", "<p>台北市<strong>某路2號5樓</strong></p>");
  assert.match(out, /<strong>某路<del class="d"[^>]*>1號3<\/del><ins class="d"[^>]*>2號5<\/ins>樓<\/strong>/);
});

test("相同內容不產生標示", () => {
  assert.equal(diffHtml("<p>相同</p>", "<p>相同</p>"), "<p>相同</p>");
});

test("修訂摘要列出每處改動與其前文", () => {
  const a = "甲方提供 □ 技術：＿＿（預計交付日期為 ＿年＿月＿日）";
  const b = "甲方提供 ☑ 技術：量子演算法（預計交付日期為 115年12月31日）";
  const { items, more } = changeList(a, b);
  assert.deepEqual(items.map((x) => [x.from, x.to]), [["□", "☑"], ["＿＿", "量子演算法"], ["＿年＿月＿日", "115年12月31日"]]);
  assert.equal(items[0].ctx, "甲方提供");
  assert.equal(more, 0);
  assert.equal(changeList("abc", "abc").items.length, 0);
});

test("修訂摘要延伸到完整的數字", () => {
  const { items } = changeList("研究經費新臺幣 1,000,000 元整", "研究經費新臺幣 1,200,000 元整");
  assert.deepEqual(items, [{ ctx: "研究經費新臺幣", from: "1,000,000", to: "1,200,000" }]);
});
