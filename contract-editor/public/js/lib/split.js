// 條文切分：把 Word 轉出的 HTML 依「第○條」、標題、附件與簽署欄切成條文。
import { sanitize, squash, textOf } from "../core/sanitize.js";

export const CLAUSE_RE = /^[\s　]*第[\s　]*[一二三四五六七八九十百千零〇兩\d０-９]+[\s　]*條/;
export const TITLE_RE = /契約|契約|協議|同意書|備忘錄|承諾書|採購|案$/;
export function stripLeading(el, n) {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node; while (n > 0 && (node = w.nextNode())) { const k = Math.min(n, node.data.length); node.data = node.data.slice(k); n -= k; }
}
export const hasContent = (el) => squash(el.textContent) || el.querySelector("img");
export function splitRich(html, fallbackTitle) {
  const dom = new DOMParser().parseFromString(sanitize(html), "text/html");
  const els = [...dom.body.children];
  const isHead = (el) => /^H[1-6]$/.test(el.tagName);
  const hasCl = els.some((el) => el.tagName !== "TABLE" && CLAUSE_RE.test(el.textContent));
  const hasH = els.filter((el) => isHead(el) && squash(el.textContent)).length > 1;
  // 附件一：…、立約人：… also open their own section, so annexes and the signature block are not glued to the last clause.
  const ANNEX_RE = /^[\s　]*(附件|附表)[一二三四五六七八九十\d]+[\s　]*[：:、]/;
  const SIGN_RE = /^[\s　]*(立約人|立契約人|立契約書人|立約書人)[\s　]*[：:]?[\s　]*$/;
  const special = (el) => { const t = el.textContent || ""; return squash(t).length <= 40 && (ANNEX_RE.test(t) || SIGN_RE.test(t)); };
  const isStart = (el) => squash(el.textContent) && el.tagName !== "TABLE" && (special(el) || (hasCl ? CLAUSE_RE.test(el.textContent) : hasH ? isHead(el) : false));
  let title = fallbackTitle, i = els.findIndex(hasContent);
  if (i >= 0 && !isStart(els[i]) && !els[i].querySelector("img")) {
    const t = squash(els[i].textContent);
    if (t.length <= 30 && (isHead(els[i]) || TITLE_RE.test(t))) { title = t.replace(/\s+/g, ""); i++; }
  }
  const clauses = []; let cur = { title: "", parts: [] }, annex = "";
  const flush = () => {
    if (annex && cur.title && CLAUSE_RE.test(cur.title) && !cur.title.startsWith(annex)) cur.title = `${annex}　${cur.title.replace(/[　\s]+$/, "")}`;
    const body = cur.parts.join("");
    if (!cur.title && !textOf(body) && !/<img/i.test(body)) return;
    const txt = textOf(body);
    clauses.push({ title: cur.title || (clauses.length ? "其他約定" : /立契約書人|立合約書人/.test(txt) ? "立契約書人" : "前言"), html: body });
  };
  for (const el of els.slice(Math.max(i, 0))) {
    if (isStart(el) && special(el) && (clauses.length || cur.title)) {
      flush();
      const raw = squash(el.textContent);
      const am = raw.match(/^(附件|附表)[一二三四五六七八九十\d]+/);
      annex = am ? am[0] : "";
      cur = { title: am ? raw.replace(/[：:]$/, "") : "立契約人（簽署）", parts: [] };
      continue;
    }
    if (isStart(el) && !special(el)) {
      flush();
      const raw = el.textContent;
      const mt = raw.match(CLAUSE_RE), restT = mt ? raw.slice(mt[0].length) : raw;
      const whole = restT.match(/^[\s　：:]*([^，。；：:\n]{0,24})[\s　：:]*$/);
      if (squash(raw).length <= 40 && (whole || !/[：:][\s　]*\S/.test(raw))) { cur = { title: whole && mt ? (squash(mt[0]).replace(/\s+/g, "") + (whole[1].trim() ? "　" + whole[1].trim() : "")) : squash(raw).replace(/[：:]$/, ""), parts: [] }; continue; }
      const m = raw.match(CLAUSE_RE);
      let end = m ? m[0].length : 0, t = m ? squash(m[0]).replace(/\s+/g, "") : "";
      const m2 = raw.slice(end).match(/^[\s　]*([^：:\n。]{1,15})[：:]/);
      if (m2) { t += "　" + m2[1].trim(); end += m2[0].length; }
      else { const m3 = raw.slice(end).match(/^[\s　、.．：:]*/); end += m3[0].length; }
      stripLeading(el, end);
      cur = { title: t || squash(raw).slice(0, 20), parts: hasContent(el) ? [el.outerHTML] : [] };
    } else if (isStart(el)) cur.parts.push(el.outerHTML);
    else if (hasContent(el) || el.tagName === "TABLE") cur.parts.push(el.outerHTML);
  }
  flush();
  return { title, clauses, split: hasCl ? "clause" : hasH ? "heading" : "none" };
}
export function splitByHeadings(html) {
  const dom = new DOMParser().parseFromString(sanitize(html), "text/html");
  const h2 = [...dom.body.children].filter((el) => el.tagName === "H2");
  if (!h2.length) return splitRich(html, "").clauses;
  const out = []; let cur = null;
  for (const el of [...dom.body.children]) {
    if (el.tagName === "H2") { cur = { title: (el.textContent || "").replace(/[ \t\r\n\u00a0]+/g, " ").trim(), parts: [] }; out.push(cur); }
    else if (cur && (hasContent(el) || el.tagName === "TABLE")) cur.parts.push(el.outerHTML);
  }
  return out.map((c) => ({ title: c.title, html: c.parts.join("") }));
}
