// 契約欄位：勾選框、日期、空格的偵測、修改，以及「僅顯示已勾選」。
import "../setup.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
const { Fields } = await import("../../public/js/lib/fields.js");

const html = '<p data-i="5">甲方提供□技術：<u>        </u>（預計交付日期為<u>   </u>年<u>  </u>月<u>  </u>日）</p>'
  + '<p data-i="5">        □材料：<u>        </u></p>'
  + '<p>乙方提供□經費：<u>    </u></p>';

test("偵測勾選框、日期與底線空格", () => {
  const types = Fields.scan(Fields.parse(html)).map((f) => f.type);
  assert.deepEqual(types, ["box", "blank", "date", "box", "blank", "box", "blank"]);
});

test("點選勾選框會在 □ 與 ☑ 之間切換", () => {
  const once = Fields.apply(html, 0);
  assert.match(once, /甲方提供☑技術/);
  assert.match(Fields.apply(once, 0), /甲方提供□技術/);
});

test("日期以民國年寫入，空格寫入文字", () => {
  let h = Fields.apply(html, 2, { y: 115, m: 12, d: 31 });
  assert.match(h, /115年12月31日/);
  h = Fields.apply(h, 1, "量子演算法");
  assert.match(Fields.parse(h).textContent, /技術：量子演算法/);
});

test("僅顯示已勾選：未勾選的項目移除，標題「甲方提供」移到下一個已勾選的項目", () => {
  const h = Fields.apply(html, 3); // 勾選「材料」
  const text = Fields.parse(Fields.hideUncheckedHtml(h)).textContent.replace(/\s+/g, "");
  assert.ok(!text.includes("技術"));
  assert.ok(text.includes("甲方提供☑材料"));
  assert.ok(!text.includes("乙方提供"));
});

test("未勾選的選項標題會一併隱藏其下所屬段落與表格", () => {
  const block = '<p>□定期支付，條件如下：</p><p data-i="4">（一）第一期款</p><table><tr><td>表</td></tr></table><p>註：匯款方式</p>';
  const text = Fields.parse(Fields.hideUncheckedHtml(block)).textContent;
  assert.ok(!text.includes("第一期款") && !text.includes("表"));
  assert.ok(text.includes("註：匯款方式"));
});
