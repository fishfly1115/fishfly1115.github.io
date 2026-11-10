// 「匯出」頁：選擇格式（PDF 定稿本／Word），可只保留已勾選的選項。
import { Fields } from "../../../../lib/fields.js";
import { icon } from "../../../../ui/icons.js";
import { S } from "../../context.js";

export function exportHtml() {
  if (!S.clauses.length) return `<div class="empty card"><p>尚無條文可匯出</p><button class="btn" data-act="nav" data-v="content">前往契約內容</button></div>`;
  const open = S.revs.filter((r) => r.status === "pending").length;
  const hasBoxes = S.clauses.some((c) => Fields.hasBoxes(c.html));
  const pdf = S.exportFmt === "pdf";
  return `<section class="card page-card" aria-label="匯出">
    <h2 class="pc-h">檔案格式</h2>
    <div class="tplgrid">
      <label class="tpl"><input type="radio" name="efmt" value="pdf" ${pdf ? "checked" : ""}><span><strong>PDF 定稿本</strong><span class="meta">A4 直式，含案號、頁碼；未定稿時加註「草案」浮水印</span></span></label>
      <label class="tpl"><input type="radio" name="efmt" value="docx" ${pdf ? "" : "checked"}><span><strong>Word（可編輯）</strong><span class="meta">在 Word 整份修訂後，可到「匯入」頁送回逐條比對</span></span></label>
    </div>
    ${hasBoxes ? `<label class="check"><input type="checkbox" id="eonly" ${S.exportOnlyChecked ? "checked" : ""}> 僅保留已勾選的選項</label>` : ""}
    ${open ? `<div class="warnline">尚有 ${open} 處修訂未審閱，匯出內容為目前條文（含未審閱的修訂）</div>` : ""}
    <div class="row"><div class="grow"></div><button class="btn primary lg" data-act="export-go" ${S.exporting ? "disabled" : ""}>${icon("download", { size: 18 })}${S.exporting ? "匯出中…" : pdf ? "匯出 PDF" : "匯出 Word"}</button></div>
  </section>`;
}

