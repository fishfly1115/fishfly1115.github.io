// 「匯出」視窗（從「契約內容」頁開啟；定稿後也可從總覽開啟）：選擇 PDF 定稿本或 Word。
// 匯出的文件一律只保留已勾選的選項（見 export.js）。
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
    return `<div class="tplgrid">
      ${option("pdf", "PDF 定稿本", "含案號與頁碼")}
      ${option("docx", "Word", "可修改後匯回")}
    </div>
    ${open ? `<div class="warnline">尚有 ${open} 處修訂未審閱</div>` : ""}`;
  },
  foot: () => `<div class="grow"></div><button class="btn ghost" data-act="dialog-close">取消</button>
    <button class="btn primary" data-act="export-go" ${S.exporting ? "disabled" : ""}>${S.exporting ? "匯出中…" : S.exportFmt === "pdf" ? "匯出 PDF" : "匯出 Word"}</button>`,
  actions: {
    // 匯出完成（已下載或已提示錯誤）就關閉視窗
    "export-go": async () => {
      await (S.exportFmt === "pdf" ? exportPdf() : exportWord());
      if (S.dialog === "export") { S.dialog = null; render(); }
    }
  },
  init() {
    document.addEventListener("change", (e) => {
      if (e.target.name === "efmt") { S.exportFmt = e.target.value; S.forceDialog = true; render(); }
    });
  }
};
