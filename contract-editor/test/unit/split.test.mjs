// 條文切分：「第○條」標題、附件、簽署欄。
import "../setup.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
const { splitRich } = await import("../../public/js/lib/split.js");

test("依第○條切分，並辨識標題列、前言、附件與簽署欄", () => {
  const html = "<h1>資助研究計畫契約</h1><p>立契約書人：甲方</p><p>第一條：雙方合意</p><p>內容一</p>"
    + "<p>第二條　租賃期間：自民國115年1月1日起。</p><p>立約人：</p><p>甲方：○○</p>"
    + "<p>附件二：保護約定</p><p>第一條 醫療規劃</p><p>內容</p>";
  const r = splitRich(html, "預設");
  assert.equal(r.title, "資助研究計畫契約");
  assert.deepEqual(r.clauses.map((c) => c.title), ["立契約書人", "第一條　雙方合意", "第二條　租賃期間", "立契約人（簽署）", "附件二：保護約定", "附件二　第一條　醫療規劃"]);
  assert.match(r.clauses[2].html, /自民國115年1月1日起/);
});
