// 內容清理：所有條文都是他人輸入，顯示前一律經 DOMPurify 過濾。
import { esc } from "./dom.js";

const PURIFY = {
  ALLOWED_TAGS: ["p", "div", "br", "span", "strong", "b", "em", "i", "u", "s", "sub", "sup", "ol", "ul", "li", "table", "thead", "tbody", "tr", "td", "th", "h1", "h2", "h3", "h4", "h5", "h6", "img", "blockquote"],
  ALLOWED_ATTR: ["colspan", "rowspan", "src", "alt", "data-i"],
  ALLOWED_URI_REGEXP: /^(?:\/img\/|data:image\/(?:png|jpe?g|gif|webp);)/i
};
export function sanitize(html) {
  if (window.DOMPurify) return window.DOMPurify.sanitize(html || "", PURIFY);
  const d = document.createElement("div");
  d.textContent = new DOMParser().parseFromString(html || "", "text/html").body.textContent || "";
  return d.innerHTML.replace(/\n/g, "<br>");
}
export const plainToHtml = (t) => (t || "").split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
export const normalize = (html) => sanitize(html).replace(/<(p|div)><br><\/\1>\s*$/g, "").replace(/(<br>)+$/, "").trim();
export const textOf = (html) => (new DOMParser().parseFromString(html || "", "text/html").body.textContent || "").replace(/\s+/g, " ").trim();
export const squash = (s) => (s || "").replace(/[\s ]+/g, " ").trim();
