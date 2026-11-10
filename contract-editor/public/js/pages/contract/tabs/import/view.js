// 「匯入」頁：三種匯入方式各一張卡片；選擇檔案或範本後，改顯示預覽（previews.js）。
import { icon } from "../../../../ui/icons.js";
import { S } from "../../context.js";
import { canEditDoc } from "../../state.js";

export function choicesHtml() {
  const cards = [
    canEditDoc() && S.clauses.length && ["reimport-pick", "upload", "匯入修訂版 Word", "把「匯出」的 Word 整份修訂後匯回，系統逐條比對，確認後成為待他方審閱的修訂。", "選擇修訂版 Word"],
    S.isAdmin && ["tpl-open", "document", "套用範本", "以範本取代目前條文，套用前會先預覽。", "選擇範本"],
    S.isAdmin && ["import-pick", "upload", "匯入新契約 Word", "以新的 Word 檔取代目前條文，自動保留編號與縮排，匯入前會先預覽。", "選擇 Word 檔"]
  ].filter(Boolean);
  if (!cards.length) return `<div class="empty card"><p>目前沒有可用的匯入方式</p></div>`;
  return `<div class="choice-grid">${cards.map(([act, ic, title, desc, btn]) => `<section class="card choice">${icon(ic, { size: 28 })}<h2>${title}</h2><p>${desc}</p><button class="btn ${act === "reimport-pick" || !S.clauses.length ? "primary" : ""}" data-act="${act}">${btn}</button></section>`).join("")}</div>`;
}
