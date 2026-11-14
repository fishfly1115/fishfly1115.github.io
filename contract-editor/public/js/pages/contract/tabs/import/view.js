// 「匯入」頁：三種匯入方式各一張卡片；選擇檔案或範本後，改顯示預覽（previews.js）。
import { icon } from "../../../../ui/icons.js";
import { S } from "../../context.js";
import { canEditDoc } from "../../state.js";

export function choicesHtml() {
  const cards = [
    canEditDoc() && S.clauses.length && ["reimport-pick", "upload", "匯入修訂版 Word", "修改後的 Word 匯回比對", "選擇檔案"],
    S.isAdmin && ["tpl-open", "document", "套用範本", "以範本取代目前條文", "選擇範本"],
    S.isAdmin && ["import-pick", "upload", "匯入新契約 Word", "以 Word 取代目前條文", "選擇檔案"]
  ].filter(Boolean);
  if (!cards.length) return `<div class="empty card"><p>目前沒有可用的匯入方式</p></div>`;
  return `<div class="choice-grid">${cards.map(([act, ic, title, desc, btn]) => `<section class="card choice">${icon(ic, { size: 28 })}<h2>${title}</h2><p>${desc}</p><button class="btn ${act === "reimport-pick" || !S.clauses.length ? "primary" : ""}" data-act="${act}">${btn}</button></section>`).join("")}</div>`;
}
