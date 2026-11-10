// 內容清理：所有條文都是他人輸入，顯示前一律經 DOMPurify 過濾。
import { esc } from "./dom.js";

const PURIFY = {
  ALLOWED_TAGS: ["p", "div", "br", "span", "strong", "b", "em", "i", "u", "s", "sub", "sup", "ol", "ul", "li", "table", "thead", "tbody", "tr", "td", "th", "h1", "h2", "h3", "h4", "h5", "h6", "img", "blockquote"],
  ALLOWED_ATTR: ["colspan", "rowspan", "src", "alt", "data-i"],
  // 網址只允許本站圖片；DOMPurify 會用這條規則檢查「非網址安全」的屬性值，
  // 所以合併儲存格的數字要另外標為安全，否則 colspan="6" 會被當成不合格的網址刪掉
  ADD_URI_SAFE_ATTR: ["colspan", "rowspan"],
  ALLOWED_URI_REGEXP: /^(?:\/img\/|data:image\/(?:png|jpe?g|gif|webp);)/i
};
export function sanitize(html) {
  if (window.DOMPurify) return balanceTables(window.DOMPurify.sanitize(html || "", PURIFY));
  const d = document.createElement("div");
  d.textContent = new DOMParser().parseFromString(html || "", "text/html").body.textContent || "";
  return d.innerHTML.replace(/\n/g, "<br>");
}
export const plainToHtml = (t) => (t || "").split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
export const normalize = (html) => sanitize(html).replace(/<(p|div)><br><\/\1>\s*$/g, "").replace(/(<br>)+$/, "").trim();
export const textOf = (html) => (new DOMParser().parseFromString(html || "", "text/html").body.textContent || "").replace(/\s+/g, " ").trim();
export const squash = (s) => (s || "").replace(/[\s ]+/g, " ").trim();

// 表格每一列補齊到相同欄數：先前存入的條文可能少了合併儲存格資訊，
// 欄數不足的列把最後一格延伸到整列寬度，避免表格右側出現缺角。
export function balanceTables(html) {
  if (!html.includes("<table")) return html;
  const box = document.createElement("div");
  box.innerHTML = html;
  let changed = false;
  for (const table of box.querySelectorAll("table")) {
    const rows = [...table.rows];
    const width = (tr) => [...tr.cells].reduce((n, td) => n + (parseInt(td.getAttribute("colspan"), 10) || 1), 0);
    const max = Math.max(0, ...rows.map(width));
    for (const tr of rows) {
      const w = width(tr), last = tr.cells[tr.cells.length - 1];
      if (!last || w >= max || rows.some((r) => [...r.cells].some((c) => c.rowSpan > 1))) continue;
      last.setAttribute("colspan", String((parseInt(last.getAttribute("colspan"), 10) || 1) + max - w));
      changed = true;
    }
  }
  return changed ? box.innerHTML : html;
}
