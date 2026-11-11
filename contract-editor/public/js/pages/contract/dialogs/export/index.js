// 「匯出」視窗（從「契約內容」頁開啟；定稿後也可從總覽開啟）：選擇 PDF 定稿本或 Word，可只保留已勾選的選項。
import { Fields } from "../../../../lib/fields.js";
import { S } from "../../context.js";
import { render } from "../../render.js";
import { exportPdf, exportWord } from "./export.js";

const option = (value, title, desc) => `<label class="tpl"><input type="radio" name="efmt" value="${value}" ${S.exportFmt === value ? "checked" : ""}><span><strong>${title}</strong><span class="meta">${desc}</span></span></label>`;

/** @type {import("../index.js").Dialog} */
export default {
  id: "export",
  title: () => "匯出",
  key: () => `${S.exportFmt}:${S.exporting}`,
  html() {
    const open = S.revs.filter((r) => r.status === "pending").length;
    const hasBoxes = S.clauses.some((c) => Fields.hasBoxes(c.html));
    return `<div class="tplgrid">
      ${option("pdf", "PDF 定稿本", "A4 直式，含案號、頁碼；未定稿時加註「草案」浮水印")}
      ${option("docx", "Word（可編輯）", "在 Word 整份修訂後，可由「更多 → 匯入修訂版 Word」送回逐條比對")}
    </div>
    ${hasBoxes ? `<label class="check"><input type="checkbox" id="eonly" ${S.exportOnlyChecked ? "checked" : ""}> 僅保留已勾選的選項</label>` : ""}
    ${open ? `<div class="warnline">尚有 ${open} 處修訂未審閱，匯出內容為目前條文（含未審閱的修訂）</div>` : ""}`;
  },
  foot: () => `<div class="grow"></div><button class="btn ghost" data-act="dialog-close">取消</button>
    <button class="btn primary" data-act="export-go" ${S.exporting ? "disabled" : ""}>${S.exporting ? "匯出中…" : S.exportFmt === "pdf" ? "匯出 PDF" : "匯出 Word"}</button>`,
  actions: {
    // 匯出完成（已下載或已提示錯誤）就關閉視窗
    "export-go": async () => {
      const only = S.exportOnlyChecked;
      await (S.exportFmt === "pdf" ? exportPdf(only) : exportWord(only));
      if (S.dialog === "export") { S.dialog = null; render(); }
    }
  },
  init() {
    // 切換格式時，PDF 預設只保留已勾選的選項，Word 預設保留全部
    document.addEventListener("change", (e) => {
      if (e.target.name === "efmt") { S.exportFmt = e.target.value; S.exportOnlyChecked = S.exportFmt === "pdf"; S.forceDialog = true; render(); }
      if (e.target.id === "eonly") S.exportOnlyChecked = e.target.checked;
    });
  }
};
