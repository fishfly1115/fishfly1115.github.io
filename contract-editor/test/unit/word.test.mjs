// Word 往返：匯出 .docx 後再匯入，條文文字完全相同；自動編號轉為文字。
import "../setup.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import mammoth from "mammoth";
const { toBlob } = await import("../../public/js/word/docx-export.js");
const { prepare, post } = await import("../../public/js/word/docx-prep.js");
const { compareRevision } = await import("../../public/js/lib/compare.js");
const { splitByHeadings } = await import("../../public/js/lib/split.js");

window.docx.Packer.toBlob = (doc) => window.docx.Packer.toBuffer(doc); // Node 沒有 Blob 下載
const clauses = [
  { id: "a", order: 0, title: "第一條　契約標的", html: '<p>甲方委託乙方辦理<strong>系統維運</strong>。</p><p data-i="4">（一）每月維護一次。</p>' },
  { id: "b", order: 1, title: "第二條　契約價金", html: "<p>新臺幣壹佰萬元整。</p><table><tbody><tr><td><p>第一期</p></td><td><p>50%</p></td></tr></tbody></table>" }
];
const roundTrip = async (cls, edit = (x) => x) => {
  const buf = await toBlob({ title: "測試契約", caseNo: "A-1", status: "契約草案（第 1 輪）", date: "" }, cls);
  const zip = await window.JSZip.loadAsync(buf);
  zip.file("word/document.xml", edit(await zip.file("word/document.xml").async("string")));
  const edited = await zip.generateAsync({ type: "arraybuffer" });
  const res = await mammoth.convertToHtml({ buffer: Buffer.from(await prepare(edited)) }, { styleMap: ["u => u", "strike => s"] });
  return splitByHeadings(post(res.value));
};

test("匯出後原樣匯入：每條都判定為未變更", async () => {
  const back = await roundTrip(clauses);
  assert.deepEqual(back.map((c) => c.title), clauses.map((c) => c.title));
  assert.equal(compareRevision(back, clauses).counts.same, 2);
});

test("在 Word 中修改文字：只有該條判定為修訂", async () => {
  const back = await roundTrip(clauses, (xml) => xml.replace("壹佰萬", "壹佰貳拾萬"));
  const r = compareRevision(back, clauses);
  assert.deepEqual(r.counts, { edit: 1, add: 0, delete: 0, same: 1 });
  assert.equal(r.items.find((i) => i.type === "edit").clause.id, "b");
});
