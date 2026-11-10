// 匯出 PDF 定稿本／Word。可選擇只保留已勾選的選項。
import { $, saveBlob, toast } from "../../../../core/dom.js";
import { pad2, rocToday } from "../../../../core/format.js";
import { need } from "../../../../core/loader.js";
import { Fields } from "../../../../lib/fields.js";
import { S } from "../../context.js";
import { render } from "../../render.js";
import { caseNo, clauseHtmlOf, docTitle, live, roundNo, status } from "../../state.js";
import { buildPdf } from "../../../../pdf/pdf-export.js";
import { toBlob } from "../../../../word/docx-export.js";

export const exportClauses = (onlyChecked) => live().map((c) => ({ title: c.title, html: onlyChecked ? Fields.hideUncheckedHtml(clauseHtmlOf(c)) : clauseHtmlOf(c) }));

// 例：113年度資訊系統維護採購案契約書_草案第2輪_20261109.pdf
function fileName(ext) {
  const d = new Date(), stamp = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
  const kind = status() === "final" ? "定稿本" : `草案第${roundNo()}輪`;
  return `${docTitle().replace(/[\\/:*?"<>|]/g, "")}_${kind}_${stamp}.${ext}`;
}

async function run(task) {
  if (S.exporting) return;
  S.exporting = true; render();
  try { await task(); } finally { S.exporting = false; render(); }
}

export const exportWord = (onlyChecked) => run(async () => {
  try {
    await need("docx");
    const fin = status() === "final";
    const blob = await toBlob({ title: docTitle(), caseNo: caseNo(), status: fin ? `定稿本（第 ${roundNo()} 輪）` : `契約草案（第 ${roundNo()} 輪）`, date: `列印日期：${rocToday()}` }, exportClauses(onlyChecked));
    saveBlob(fileName("docx"), blob);
    toast("已匯出 Word；修訂後可由「匯入 → 匯入修訂版 Word」送回");
  } catch (e) { console.error(e); toast("無法產生 Word 檔，請重新整理頁面後重試"); }
});

export const exportPdf = (onlyChecked) => run(async () => {
  try {
    const meta = { title: docTitle(), caseNo: caseNo(), final: status() === "final", round: roundNo() };
    const { blob, textLayer } = await buildPdf(meta, exportClauses(onlyChecked), $("pdf-stage"));
    saveBlob(fileName("pdf"), blob);
    toast(textLayer ? "PDF 已下載" : "PDF 已下載（未能加入可搜尋的文字層）");
  } catch (e) { console.error(e); toast("PDF 產生失敗，請重新整理頁面後重試"); }
});
