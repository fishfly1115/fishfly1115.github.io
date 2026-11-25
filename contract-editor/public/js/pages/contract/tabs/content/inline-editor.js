// 直接在契約紙張上修訂條文（像 Word）：點條文就能輸入，停止輸入約 1 秒自動儲存；
// 同一人連續的修改由伺服器合併為一筆修訂。點條文以外的地方或按 Esc 結束編輯。
// 格式按鈕在上方工具列（toolbar.js 的 .ribbon），由 runCommand() 套用到編輯中的條文。
import { copy, esc, toast } from "../../../../core/dom.js";
import { normalize, plainToHtml, sanitize } from "../../../../core/sanitize.js";
import { S, api } from "../../context.js";
import { render } from "../../render.js";
import { clauseHtmlOf, who } from "../../state.js";
import { act, fail, refresh, uploadImage } from "../../sync.js";

const SAVE_DELAY = 1000;

/**
 * 編輯中的條文（同一時間只有一條）
 * @type {null | { id: string, rev: number, el: HTMLElement, title: HTMLElement, body: HTMLElement, savedTitle: string, savedHtml: string,
 *   timer: number, queue: Promise<void>, saved: boolean, conflict: boolean, range: Range|null }}
 */
let session = null;

// ── 開始與結束 ───────────────────────────────────────────

/** 開始編輯一條條文；where 為點擊位置（游標放在點到的字旁）或 "title"（選取標題） */
export function beginEdit(id, where) {
  if (S.editing === id) return;
  const c = S.clauses.find((x) => x.id === id); if (!c) return;
  const offset = where && where !== "title" ? textOffsetAt(id, where) : null;
  if (S.editing) finishEdit();
  Object.assign(S, { editing: id, confirm: null });
  render();
  if (!session) return;
  if (where === "title") { session.title.focus(); selectAll(session.title); }
  else { session.body.focus(); placeCaret(session.body, offset); }
}

/** 結束編輯：先送出尚未儲存的內容，再顯示修訂標示 */
export async function finishEdit() {
  const s = session; if (!s) return;
  clearTimeout(s.timer);
  const done = s.queue.then(() => save(s));
  session = null; S.editing = null; S.tableMenu = false;
  render();
  await done;
  if (s.saved) await refresh();
}

// 新增條文：立即建立一條空白條文並開始編輯標題
export async function addClause(afterId) {
  if (S.busy) return;
  if (S.editing) await finishEdit();
  S.busy = true;
  try {
    const r = await act("clauses/add", { afterId: afterId || null, title: "新條文", html: "<p><br></p>" });
    S.busy = false;
    if (r?.id) beginEdit(r.id, "title");
  } catch { S.busy = false; }
}

// 有未儲存的修改（離開頁面前提醒）
export const hasUnsaved = () => !!session && (session.timer || dirty(session));

// ── 編輯區元素（重繪時沿用同一個，保留游標與輸入中的內容）──────────

export function editorFor(c) {
  if (session?.id === c.id) return session.el;
  const el = document.createElement("div");
  el.className = "ie"; el.id = "ie-" + c.id;
  el.innerHTML = `<h3 class="ie-title" contenteditable="true" spellcheck="false" aria-label="條文標題">${esc(c.title)}</h3>
    <div class="rich ie-body" contenteditable="true" role="textbox" aria-multiline="true" aria-label="條文內容">${clauseHtmlOf(c) || "<p><br></p>"}</div>
    <div class="warn ie-warn" hidden></div>
    <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden>`;
  const title = el.querySelector(".ie-title"), body = el.querySelector(".ie-body");
  // 以剛放進編輯區的內容為基準：只點進來、沒有輸入就不會存出一筆修訂
  session = { id: c.id, rev: c.rev, el, title, body, savedTitle: titleOf(title), savedHtml: normalize(body.innerHTML), timer: 0, queue: Promise.resolve(), saved: false, conflict: false, range: null };
  bind(session, el.querySelector("input[type=file]"));
  return el;
}

function bind(s, fileIn) {
  const later = () => { clearTimeout(s.timer); s.timer = setTimeout(() => { s.timer = 0; s.queue = s.queue.then(() => save(s)); }, SAVE_DELAY); setState("編輯中"); };
  s.title.addEventListener("input", later);
  s.body.addEventListener("input", later);
  // 標題只放文字：Enter 跳到內文、貼上只取文字
  s.title.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); s.body.focus(); placeCaret(s.body, 0); } });
  s.title.addEventListener("paste", (e) => { e.preventDefault(); document.execCommand("insertText", false, (e.clipboardData?.getData("text/plain") || "").replace(/\s+/g, " ")); });
  const keep = () => { const sel = getSelection(); if (sel.rangeCount && s.body.contains(sel.anchorNode)) s.range = sel.getRangeAt(0).cloneRange(); };
  s.body.addEventListener("keyup", keep); s.body.addEventListener("mouseup", keep);
  s.body.addEventListener("paste", (e) => {
    const files = [...(e.clipboardData?.files || [])].filter((f) => /^image\/(png|jpe?g|gif|webp)$/.test(f.type));
    if (files.length) { e.preventDefault(); keep(); files.forEach((f) => insertImage(s, f)); return; }
    const html = e.clipboardData?.getData("text/html"), text = e.clipboardData?.getData("text/plain");
    e.preventDefault();
    document.execCommand("insertHTML", false, html ? sanitize(html.replace(/<!--[\s\S]*?-->/g, "")) : plainToHtml(text || ""));
  });
  fileIn.addEventListener("change", () => { if (fileIn.files[0]) insertImage(s, fileIn.files[0]); fileIn.value = ""; });
}

// ── 儲存 ─────────────────────────────────────────────────

// 標題只去掉換行與頭尾的半形空白；全形空白（「第三條　…」）是標題的一部分，不能動
const titleOf = (el) => el.textContent.replace(/[\r\n\t]+/g, "").replace(/\u00a0/g, " ").replace(/^ +| +$/g, "");
const current = (s) => ({ title: titleOf(s.title), html: normalize(s.body.innerHTML) });
const dirty = (s) => { const v = current(s); return v.title !== s.savedTitle || v.html !== s.savedHtml; };

async function save(s) {
  if (s.conflict || !dirty(s)) return;
  const c = S.clauses.find((x) => x.id === s.id); if (!c) return;
  const { html } = current(s), title = current(s).title || c.title;
  if (session === s) setState("儲存中…");
  try {
    const r = await api(`clauses/${s.id}/edit`, { title, html, baseRev: s.rev, merge: true });
    Object.assign(s, { savedTitle: title, savedHtml: html, saved: true });
    if (r.rev) { s.rev = r.rev; c.rev = r.rev; }
    Object.assign(c, { title, html });
    if (session === s) setState("已儲存");
  } catch (e) {
    if (e.status === 409) { s.conflict = true; showConflict(s, e.data?.clause?.updatedBy); }
    else { fail(e); if (session === s) setState("未儲存"); }
  }
}

// 他方在編輯期間也改了這一條：不覆蓋，讓使用者複製自己的內容後載入最新版本
function showConflict(s, by) {
  const w = s.el.querySelector(".ie-warn");
  w.hidden = false;
  w.innerHTML = `<span>${esc(who(by))} 剛改了這一條，您的修改未儲存。</span><button class="btn sm" data-act="ie-copy">複製我的內容</button><button class="btn sm" data-act="ie-reload">載入最新版本</button>`;
  setState("未儲存");
}

export const conflictActions = {
  "ie-copy": () => { if (session) copy(session.body.innerText, "已複製您的內容"); },
  "ie-reload": () => { if (session) clearTimeout(session.timer); session = null; S.editing = null; refresh(); }
};

function setState(text) { const el = document.getElementById("save-state"); if (el) el.textContent = text; }

// ── 格式按鈕（上方工具列）────────────────────────────────

export function runCommand(cmd) {
  const s = session; if (!s) return;
  if (cmd === "table-menu") { S.tableMenu = !S.tableMenu; render(); return; }
  if (S.tableMenu) { S.tableMenu = false; render(); }
  s.body.focus();
  if (s.range && !s.body.contains(getSelection().anchorNode)) { const sel = getSelection(); sel.removeAllRanges(); sel.addRange(s.range); }
  if (cmd === "table") document.execCommand("insertHTML", false, "<table><tbody><tr><td>　</td><td>　</td><td>　</td></tr><tr><td>　</td><td>　</td><td>　</td></tr></tbody></table><p><br></p>");
  else if (/^(row|col)[+-]$/.test(cmd)) tableOp(s.body, cmd);
  else if (cmd === "image") s.el.querySelector("input[type=file]").click();
  else document.execCommand(cmd, false, null);
  s.body.dispatchEvent(new Event("input"));
}

function tableOp(ed, op) {
  const n = getSelection().anchorNode;
  const td = n && (n.nodeType === 1 ? n : n.parentElement).closest("td,th");
  if (!td || !ed.contains(td)) { toast("請先將游標放在表格內"); return; }
  const tr = td.parentElement, table = td.closest("table"), idx = [...tr.children].indexOf(td);
  const blankCell = (tag) => { const c = document.createElement(tag || "TD"); c.innerHTML = "<p>　</p>"; return c; };
  if (op === "row+") { const nr = document.createElement("tr"); [...tr.children].forEach((c) => { const nc = blankCell(c.tagName); if (c.colSpan > 1) nc.colSpan = c.colSpan; nr.appendChild(nc); }); tr.after(nr); }
  if (op === "row-") { if (table.querySelectorAll("tr").length > 1) tr.remove(); else toast("表格至少要有一列"); }
  if (op === "col+") table.querySelectorAll("tr").forEach((r) => { const c = r.children[Math.min(idx, r.children.length - 1)]; c ? c.after(blankCell(c.tagName)) : r.appendChild(blankCell()); });
  if (op === "col-") { if (tr.children.length > 1) table.querySelectorAll("tr").forEach((r) => { const c = r.children[Math.min(idx, r.children.length - 1)]; if (c && r.children.length > 1) c.remove(); }); else toast("表格至少要有一欄"); }
}

async function insertImage(s, file) {
  try {
    toast("正在上傳圖片…");
    const url = await uploadImage(file);
    s.body.focus();
    if (s.range) { const sel = getSelection(); sel.removeAllRanges(); sel.addRange(s.range); }
    document.execCommand("insertHTML", false, `<img src="${esc(url)}" alt="">`);
  } catch (e) { fail(e); }
}

// ── 重繪時保留游標 ───────────────────────────────────────

/** 重繪前記下游標（節點本身會被沿用，所以直接記節點與位置） */
export function keepSelection() {
  if (!session || !session.el.contains(document.activeElement)) return null;
  const sel = getSelection();
  return { active: document.activeElement, a: sel.anchorNode, ao: sel.anchorOffset, f: sel.focusNode, fo: sel.focusOffset };
}
export function restoreSelection(k) {
  if (!k || !k.active.isConnected) return;
  k.active.focus({ preventScroll: true });
  try { getSelection().setBaseAndExtent(k.a, k.ao, k.f, k.fo); } catch { /* 節點已不在 */ }
}

// ── 點擊位置 ↔ 文字位置 ──────────────────────────────────

// 點擊位置換算成條文內文的第幾個字（重繪後用同一個位置放游標）
function textOffsetAt(id, { x, y }) {
  const body = document.querySelector(`#c-${CSS.escape(id)} .rich`); if (!body) return null;
  let node, off;
  if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); node = r?.startContainer; off = r?.startOffset; }
  else if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); node = p?.offsetNode; off = p?.offset; }
  if (!node || !body.contains(node)) return null;
  const r = document.createRange(); r.setStart(body, 0); r.setEnd(node, off);
  return r.toString().length;
}

function placeCaret(root, offset) {
  const sel = getSelection(), r = document.createRange();
  if (offset == null) { r.selectNodeContents(root); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); return; }
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let left = offset, n;
  while ((n = walk.nextNode())) {
    if (left <= n.length) { r.setStart(n, left); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); return; }
    left -= n.length;
  }
  placeCaret(root, null);
}

function selectAll(el) { const r = document.createRange(); r.selectNodeContents(el); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
