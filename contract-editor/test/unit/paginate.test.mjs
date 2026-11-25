// 分頁：畫面的紙張檢視與 PDF 共用，確保兩邊在同樣位置換頁。
import { test } from "node:test";
import assert from "node:assert/strict";
const { paginate, pageCount, PAGE_CONTENT } = await import("../../public/js/lib/paginate.js");

test("放得下就接著放，放不下的段落整段移到下一頁", () => {
  const s = paginate([{ h: 600, cuts: [] }, { h: 500, cuts: [] }, { h: 300, cuts: [] }], 1000);
  assert.deepEqual(s.map((x) => [x.block, x.page, x.y]), [[0, 0, 0], [1, 1, 0], [2, 1, 500]]);
  assert.equal(pageCount(s), 2);
});

test("一頁放不下的長條文，只在段落之間換頁", () => {
  const s = paginate([{ h: 200, cuts: [] }, { h: 1500, cuts: [300, 700, 900, 1200] }], 1000);
  // 第一頁剩 800：切在 700（900 已超過）；第二頁從 700 開始，剩下 800 放得下
  assert.deepEqual(s.map((x) => [x.block, x.page, x.y, x.from, x.to]), [[0, 0, 0, 0, 200], [1, 0, 200, 0, 700], [1, 1, 0, 700, 1500]]);
});

test("本頁剩下太少時直接換頁再開始放長條文", () => {
  const s = paginate([{ h: 900, cuts: [] }, { h: 1500, cuts: [400, 800, 1200] }], 1000);
  assert.equal(s[1].page, 1);
  assert.equal(s[1].y, 0);
});

test("一頁內文高度約等於 A4 扣掉上下邊界", () => {
  assert.ok(PAGE_CONTENT > 1200 && PAGE_CONTENT < 1220);
});

test("標題區不放「定稿」印章圖樣，定稿只以文字標示", async () => {
  const { headHtml } = await import("../../public/js/lib/paginate.js");
  const html = headHtml({ title: "採購契約", caseNo: "555", final: true, round: 1 });
  assert.doesNotMatch(html, /seal|定<br>稿/);
  assert.match(html, /定稿本（第 1 輪）/);
});
