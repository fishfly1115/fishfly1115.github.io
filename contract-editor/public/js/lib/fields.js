// 契約欄位：勾選框（□ ☑）、日期（○年○月○日）、填寫空格（底線、【　】、空白表格儲存格）。
// 同一套偵測邏輯同時用於「畫面上可點選」與「修改儲存的 HTML」，因此第 k 個欄位在兩邊一定指向同一處。
// 另提供「僅顯示已勾選項目」的轉換，供畫面檢視與匯出 PDF／Word 使用。

const UNCHECKED = "□☐";
const CHECKED = "☑☒";
const BOXES = UNCHECKED + CHECKED;
const BLOCKS = new Set(["P", "LI", "TD", "TH", "H1", "H2", "H3", "H4", "H5", "H6", "DIV", "BLOCKQUOTE"]);
const B = "[ _＿\\u3000\\u00a0]";
const DATE_RE = new RegExp(`(?:(\\d{2,4})|${B}{1,8}|【${B}*】)年(?:(\\d{1,2})|${B}{1,6}|【${B}*】)月(?:(\\d{1,2})|${B}{1,6}|【${B}*】)日`, "g");
const UNDERSCORE_RE = /[_＿]{3,}/g;
const BRACKET_RE = /【[^】\n]{0,16}】/g;

const isBlock = (n) => n.nodeType === 1 && BLOCKS.has(n.tagName);
// A leaf block is a block element with no block element inside it (a <p>, or a <td> without <p>).
function leafBlocks(root) {
  const out = [];
  (function walk(n) {
    for (const c of n.childNodes) {
      if (c.nodeType !== 1) continue;
      if (isBlock(c)) {
        const hasInner = [...c.querySelectorAll("*")].some(isBlock);
        if (hasInner) walk(c); else out.push(c);
      } else walk(c);
    }
  })(root);
  return out;
}
function textMap(block) {
  const nodes = [];
  let s = "";
  const w = block.ownerDocument.createTreeWalker(block, 4 /* SHOW_TEXT */);
  let n;
  while ((n = w.nextNode())) { nodes.push({ node: n, start: s.length }); s += n.data; }
  return { s, nodes };
}
function locate(map, off) {
  for (let i = map.nodes.length - 1; i >= 0; i--) {
    const it = map.nodes[i];
    if (off >= it.start) return { node: it.node, offset: Math.min(off - it.start, it.node.data.length) };
  }
  return null;
}
function rangeFor(block, map, a, b) {
  const r = block.ownerDocument.createRange();
  const s = locate(map, a), e = locate(map, b);
  if (!s || !e) return null;
  r.setStart(s.node, s.offset); r.setEnd(e.node, e.offset);
  return r;
}
const inUnderline = (node) => { for (let p = node.parentNode; p && !isBlock(p); p = p.parentNode) if (p.tagName === "U") return true; return false; };
const inTable = (el) => !!el.closest("td,th");

// All fillable fields in document order.
function scan(root) {
  const out = [];
  for (const block of leafBlocks(root)) {
    const map = textMap(block);
    const found = [];
    if (!map.s.replace(/[\s　]/g, "") && inTable(block)) { out.push({ type: "cell", block, map, a: 0, b: map.s.length }); continue; }
    let m;
    DATE_RE.lastIndex = 0;
    while ((m = DATE_RE.exec(map.s))) found.push({ type: "date", a: m.index, b: m.index + m[0].length, y: m[1], mo: m[2], d: m[3] });
    for (let i = 0; i < map.s.length; i++) if (BOXES.includes(map.s[i])) found.push({ type: "box", a: i, b: i + 1, checked: CHECKED.includes(map.s[i]) });
    UNDERSCORE_RE.lastIndex = 0;
    while ((m = UNDERSCORE_RE.exec(map.s))) found.push({ type: "blank", a: m.index, b: m.index + m[0].length });
    BRACKET_RE.lastIndex = 0;
    while ((m = BRACKET_RE.exec(map.s))) found.push({ type: "blank", a: m.index, b: m.index + m[0].length, bracket: true });
    // underlined runs of spaces are the usual Word "fill-in line"
    for (const it of map.nodes) {
      if (!inUnderline(it.node)) continue;
      const re = /[ 　 ]{2,}/g;
      while ((m = re.exec(it.node.data))) found.push({ type: "blank", a: it.start + m.index, b: it.start + m.index + m[0].length, underline: true });
    }
    const pri = { date: 0, box: 1, blank: 2 };
    found.sort((x, y) => x.a - y.a || pri[x.type] - pri[y.type]);
    let end = -1;
    for (const f of found) { if (f.a < end) continue; out.push({ ...f, block, map }); end = f.b; }
  }
  return out;
}

// Wrap every field in a <button> so the page can make it clickable. Works on a detached copy.
function decorate(root, labels) {
  const fields = scan(root);
  for (let k = fields.length - 1; k >= 0; k--) {
    const f = fields[k], doc = root.ownerDocument;
    const btn = doc.createElement("button");
    btn.type = "button"; btn.className = `fx fx-${f.type}`; btn.dataset.fx = String(k); btn.dataset.kind = f.type;
    if (f.type === "cell") { btn.textContent = labels.cell; f.block.textContent = ""; f.block.appendChild(btn); continue; }
    const r = rangeFor(f.block, f.map, f.a, f.b); if (!r) continue;
    btn.appendChild(r.extractContents());
    if (f.type === "box") { btn.setAttribute("role", "checkbox"); btn.setAttribute("aria-checked", f.checked ? "true" : "false"); btn.setAttribute("aria-label", f.checked ? labels.checked : labels.unchecked); btn.textContent = f.checked ? "☑" : "□"; }
    else btn.setAttribute("aria-label", f.type === "date" ? labels.date : labels.blank);
    r.insertNode(btn);
  }
  return fields.length;
}

// Describe field k of an HTML string (type, current value) without changing it.
function info(html, k) {
  const root = parse(html);
  const f = scan(root)[k];
  if (!f) return null;
  const text = f.map.s.slice(f.a, f.b);
  return { type: f.type, checked: f.checked, text, y: f.y, mo: f.mo, d: f.d, bracket: !!f.bracket, underline: !!f.underline };
}

// Return new HTML with field k changed. value: box → toggles; date → {y,m,d} (ROC year) or null to clear; blank/cell → string.
function apply(html, k, value) {
  const root = parse(html);
  const f = scan(root)[k];
  if (!f) return html;
  const doc = root.ownerDocument;
  if (f.type === "cell") { f.block.textContent = value || ""; return root.innerHTML; }
  const r = rangeFor(f.block, f.map, f.a, f.b); if (!r) return html;
  let text;
  if (f.type === "box") text = f.checked ? "□" : "☑";
  else if (f.type === "date") text = value ? `${value.y}年${value.m}月${value.d}日` : "　　年　　月　　日";
  else text = value ? value : (f.bracket ? "【　　】" : "＿＿＿＿");
  r.deleteContents();
  let node = doc.createTextNode(text);
  if (f.type === "blank" && value && !f.underline && !f.bracket) { const u = doc.createElement("u"); u.appendChild(node); node = u; }
  r.insertNode(node);
  root.normalize();
  return root.innerHTML;
}

/* ---------- 僅顯示已勾選項目 ---------- */
const TERMINATORS = /[，。；、）)]/;
// visual indent in half-em units: Word paragraph indent (data-i) plus leading spaces typed in the text
const indentOf = (el) => {
  const base = parseInt(el.getAttribute && el.getAttribute("data-i") || "0", 10) || 0;
  const lead = ((el.textContent || "").match(/^[ \u3000\u00a0]*/) || [""])[0];
  return base + [...lead].reduce((n, c) => n + (c === "\u3000" ? 2 : 1), 0);
};
const firstBox = (s) => { for (let i = 0; i < s.length; i++) if (BOXES.includes(s[i])) return i; return -1; };
const isHeaderOption = (s) => { const t = s.trim(); return BOXES.includes(t[0]) && [...t].filter((c) => BOXES.includes(c)).length === 1 && /[：:]$/.test(t); };

function hideUnchecked(root) {
  // 1) A paragraph like "□本成果為甲方所有者：" governs the paragraphs and tables under it.
  const tops = [...root.children];
  for (let i = 0; i < tops.length; i++) {
    const el = tops[i];
    if (!el.isConnected || el.tagName === "TABLE") continue;
    const s = el.textContent || "";
    if (!isHeaderOption(s)) continue;
    const checked = CHECKED.includes(s.trim()[0]);
    if (checked) continue;
    const level = indentOf(el);
    const anyIndent = tops.some((x) => x.hasAttribute && x.hasAttribute("data-i"));
    const remove = [el];
    for (let j = i + 1; j < tops.length; j++) {
      const nx = tops[j], t = (nx.textContent || "").trim();
      if (nx.tagName === "TABLE" || nx.tagName === "OL" || nx.tagName === "UL") { remove.push(nx); continue; }
      if (BOXES.includes(t[0]) || !t || /^(註|第.{1,4}條)/.test(t)) break;
      if (anyIndent && indentOf(nx) <= level) break;
      remove.push(nx);
    }
    remove.forEach((x) => x.remove());
  }
  // 2) Options inside a paragraph.
  let carryLabel = "";
  for (const block of leafBlocks(root)) {
    const map = textMap(block);
    const s = map.s;
    const fb = firstBox(s);
    if (fb < 0) { carryLabel = ""; continue; }
    const label = s.slice(0, fb);
    const labelTrim = label.replace(/[\s　]/g, "");
    const lineMode = labelTrim.length <= 8 && !/[，。；]/.test(labelTrim);
    const cuts = [];
    if (!labelTrim) {
      // the first box decides the whole line; later boxes are inline sub-choices
      if (UNCHECKED.includes(s[fb])) {
        const fbAll = block.closest("li") || block;
        if (block.tagName === "TD" || block.tagName === "TH" || block.closest("td,th")) { const r = rangeFor(block, map, 0, s.length); r && r.deleteContents(); }
        else fbAll.remove();
        continue;
      }
    }
    const boxes = [];
    for (let i = fb; i < s.length; i++) if (BOXES.includes(s[i])) boxes.push(i);
    boxes.forEach((pos, idx) => {
      if (!labelTrim && idx === 0) return;
      if (!UNCHECKED.includes(s[pos])) return;
      const next = boxes[idx + 1] ?? s.length;
      let end = next;
      if (!lineMode || !labelTrim) { const t = s.slice(pos + 1, next).search(TERMINATORS); if (t >= 0 && idx === boxes.length - 1) end = pos + 1 + t; }
      cuts.push([pos, end]);
    });
    const allOff = boxes.every((p, idx) => (!labelTrim && idx === 0) ? false : UNCHECKED.includes(s[p]));
    if (lineMode && labelTrim && allOff) {
      // e.g. "甲方提供□技術…" with nothing ticked on this line: drop the line, keep the label for the next ticked line
      carryLabel = carryLabel || label;
      (block.closest("li") || block).remove();
      continue;
    }
    for (const [a, b] of cuts.reverse()) { const r = rangeFor(block, map, a, b); r && r.deleteContents(); }
    if (carryLabel && lineMode && !labelTrim) {
      block.insertBefore(block.ownerDocument.createTextNode(carryLabel.replace(/^[\s　]+/, "")), block.firstChild);
      carryLabel = "";
    } else if (labelTrim) carryLabel = "";
    // tidy separators left behind by removed inline options
    const w = block.ownerDocument.createTreeWalker(block, 4); let n;
    while ((n = w.nextNode())) n.data = n.data.replace(/([（(])\s*[；、，]\s*/g, "$1").replace(/[；、，]\s*([）)])/g, "$1").replace(/([；、])\s*[；、]/g, "$1");
  }
  return root;
}

function parse(html) {
  const doc = document.implementation.createHTMLDocument("");
  const root = doc.createElement("div");
  root.innerHTML = html || "";
  doc.body.appendChild(root);
  return root;
}
const hideUncheckedHtml = (html) => hideUnchecked(parse(html)).innerHTML;
const count = (html) => scan(parse(html)).length;
const hasBoxes = (html) => /[□☐☑☒]/.test(html || "");

export const Fields = { scan, decorate, info, apply, hideUnchecked, hideUncheckedHtml, parse, count, hasBoxes };
