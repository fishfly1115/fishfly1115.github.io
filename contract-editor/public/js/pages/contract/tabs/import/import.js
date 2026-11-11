// 匯入：新契約 Word、範本、修訂版 Word。
import { $, toast } from "../../../../core/dom.js";
import { compareRevision } from "../../../../lib/compare.js";
import { splitByHeadings, splitRich } from "../../../../lib/split.js";
import { uploadImage } from "../../sync.js";
import { S } from "../../context.js";
import { render } from "../../render.js";
import { clauseHtmlOf, live } from "../../state.js";
import { act } from "../../sync.js";
import { readDocx } from "../../../../word/docx-import.js";
import { go } from "../../router.js";

// 讀檔完成：到「匯入」頁顯示預覽或比對結果（可從「契約內容」的「更多」選單直接選檔）
function showPreview() {
  if ((S.importPreview || S.reimport) && S.view !== "import") return go("import");
  render(); window.scrollTo({ top: 0 });
}

export async function pickDocx(file) {
  if (!file) return;
  if (!/\.docx$/i.test(file.name)) {
    toast(/\.doc$/i.test(file.name) ? "這是舊版 .doc 檔。請用 Word 開啟後「另存新檔」選 .docx，再匯入一次。" : "請選擇 Word 的 .docx 檔。");
    return;
  }
  S.importing = true; render();
  try {
    const { html, imgFail } = await readDocx(file, uploadImage);
    const parsed = splitRich(html, file.name.replace(/\.docx$/i, ""));
    if (!parsed.clauses.length) toast("這個 Word 檔裡沒有讀到內容。");
    else S.importPreview = { ...parsed, source: file.name, imgFail };
  } catch (e) { console.error(e); toast("讀不到這個 Word 檔，請確認它是未加密的 .docx 檔。"); }
  S.importing = false; showPreview();
}
export async function doImport() {
  const p = S.importPreview; if (!p || S.importing) return;
  const title = ($("imp-title")?.value || "").trim() || p.title;
  S.importing = true; render();
  try { await act("import", { title, source: p.source, clauses: p.clauses }, `已匯入「${title}」，共 ${p.clauses.length} 個條文`); S.importPreview = null; S.importing = false; go("content"); return; } catch {}
  S.importing = false; render();
}
export async function pickRevised(file) {
  if (!file) return;
  if (!/\.docx$/i.test(file.name)) { toast(/\.doc$/i.test(file.name) ? "舊版 .doc 檔請先以 Word「另存新檔」為 .docx 再匯入" : "請選擇 .docx 檔"); return; }
  S.importing = true; render();
  try {
    const { html, imgFail } = await readDocx(file, uploadImage);
    const imported = splitByHeadings(html);
    if (!imported.length) toast("檔案中沒有可比對的條文");
    else { S.reimport = { ...compareRevision(imported, live(), clauseHtmlOf), source: file.name, imgFail }; S.reimportAll = false; }
  } catch (e) { console.error(e); toast("無法讀取此 Word 檔，請確認為未加密的 .docx 檔"); }
  S.importing = false; showPreview();
}
export async function doReimport() {
  const R = S.reimport; if (!R || S.busy) return;
  const changes = R.items.filter((i) => i.type !== "same").map((i) =>
    i.type === "edit" ? { type: "edit", clauseId: i.clause.id, baseRev: i.clause.rev, title: i.title, html: i.html }
      : i.type === "delete" ? { type: "delete", clauseId: i.clause.id, baseRev: i.clause.rev, title: i.title }
        : { type: "add", title: i.title, html: i.html, order: i.order });
  S.busy = true; render();
  try { await act("bulk", { changes }, `已送出 ${changes.length} 處修訂`); S.reimport = null; S.busy = false; go("overview"); return; }
  catch (e) { if (e.status === 409) toast(e.message); }
  S.busy = false; render();
}

// Row / column tools for the table under the cursor in the editor.
