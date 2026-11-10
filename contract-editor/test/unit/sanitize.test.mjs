// 內容過濾：保留契約需要的格式（合併儲存格、縮排），並補齊表格欄數。
import "../setup.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

test("過濾內容時保留合併儲存格（colspan／rowspan）", async () => {
  const { sanitize } = await import("../../public/js/core/sanitize.js");
  const html = '<table><tbody><tr><td colspan="6"><p>交付方：甲方</p></td><td><p>簽收方：乙方</p></td></tr><tr><td rowspan="2">a</td><td>b</td></tr></tbody></table>';
  const out = sanitize(html);
  assert.match(out, /colspan="6"/);
  assert.match(out, /rowspan="2"/);
});

test("欄數不足的列，最後一格延伸到整列寬度", async () => {
  const { balanceTables } = await import("../../public/js/core/sanitize.js");
  const out = balanceTables("<table><tbody><tr><td>交付方</td><td>簽收方</td></tr><tr><td></td><td>1</td><td>2</td><td>3</td></tr></tbody></table>");
  assert.match(out, /<td colspan="3">簽收方<\/td>/);
});
