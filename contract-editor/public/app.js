// 合約共同編輯器 — Cloudflare edition front end.
// "/" is the owner's admin page (ADMIN_PASSWORD); "/c/<id>#k=<key>" is a contract opened with a party's private link.
(() => {
"use strict";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad2 = (n) => String(n).padStart(2, "0");
const fmt = (t) => { if (!t) return ""; const d = new Date(t); return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const rocToday = () => { const d = new Date(); return `中華民國 ${d.getFullYear() - 1911} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`; };
// Word paragraph indents come in as data-i (half-em units); one rule per step.
(() => {
  const st = document.createElement("style");
  const rules = (f) => Array.from({ length: 60 }, (_, i) => `.rich [data-i="${i + 1}"]{padding-left:${f(i + 1)}em}`).join("");
  // on phones keep the hierarchy but compress it, so deep clauses still have room for text
  st.textContent = rules((n) => n * 0.5) + `@media (max-width:640px){${rules((n) => Math.min(n * 0.2, 3))}}`;
  document.head.appendChild(st);
})();
const LIB = {
  jszip: "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
  mammoth: "https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js",
  docx: "https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js"
};
async function need(...names) {
  for (const n of names) {
    if (n === "jszip" && !window.JSZip) await loadScript(LIB.jszip);
    if (n === "mammoth" && !window.mammoth) await loadScript(LIB.mammoth);
    if (n === "docx" && !window.docx) await loadScript(LIB.docx);
    if (n === "prep" && !window.DocxPrep) await loadScript("/docx-prep.js");
    if (n === "export" && !window.DocxExport) await loadScript("/docx-export.js");
  }
}
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} }
};
let toastT;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 4200); }
async function copy(text, done) {
  try { await navigator.clipboard.writeText(text); toast(done || "已複製"); }
  catch { toast("無法自動複製，請手動選取文字複製"); }
}
function saveBlob(filename, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
const loadScript = (src) => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("load " + src)); document.head.appendChild(s); });

let TEMPLATES = null;
async function loadTemplates() {
  if (!TEMPLATES) { const r = await fetch("/templates.json"); if (!r.ok) throw new Error("範本載入失敗"); TEMPLATES = await r.json(); }
  return TEMPLATES;
}
const tplPicker = (data, chosen) => `<div class="tplgrid" role="radiogroup" aria-label="範本">${data.templates.map((t) => `<label class="tpl"><input type="radio" name="tpl" value="${esc(t.id)}" ${chosen === t.id ? "checked" : ""}><span><strong>${esc(t.name)}</strong><span class="meta">${esc(t.description)}${t.clauses.length ? `（${t.clauses.length} 段）` : ""}</span></span></label>`).join("")}</div>`;

const route = location.pathname.match(/^\/c\/([0-9a-f-]{36})\/?$/i);
if (route) contractApp(route[1]); else adminApp();

/* =====================================================================
   Home: my contracts (create, rename, delete, open)
   ===================================================================== */
function adminApp() {
  let pw = store.get("ce:admin") || "";
  let tpls = null, list = null, busy = false, creating = false, renaming = null, confirmDel = null, q = "";
  const STATUS = { editing: ["修訂中", "plain"], review: ["審閱中", "theirs"], reviewed: ["待檢視", "mine"], final: ["已定稿", "ok"] };
  $("lede").textContent = "各契約案分別管理：新增契約後進入該案，即可匯入契約草案（Word）、邀請他方，並進行條文修訂與審閱。";
  $("ctitle").textContent = "契約案件";
  $("tabs").hidden = true;
  $("csource").textContent = "合約共同編輯器";
  const adminApi = async (path, method = "GET", body) => {
    const res = await fetch("/api/admin/" + path, { method, headers: { "x-admin-password": pw, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.message || "連線失敗"), { status: res.status, data });
    return data;
  };
  async function load() {
    try { list = (await adminApi("contracts")).contracts; store.set("ce:admin", pw); }
    catch (e) { if (e.status === 401) { list = null; store.set("ce:admin", null); pw = ""; } toast(e.message); }
    draw();
  }
  function drawTurn() {
    $("turn").innerHTML = list
      ? `<div class="stage"><span class="stage-dot"></span><div class="stage-text"><div class="stage-title">契約案件 · 共 ${list.length} 件</div><div class="stage-sub">${list.filter((c) => c.pendingCount).length ? `${list.filter((c) => c.pendingCount).length} 件有待審閱的修訂` : "請選擇契約案件進入"}</div></div></div>
         <div class="actions"><button class="btn primary" data-act="new">＋ 新增契約</button><button class="btn" data-act="logout">登出</button></div>`
      : `<div class="stage"><span class="stage-dot"></span><div class="stage-text"><div class="stage-title">合約共同編輯器</div><div class="stage-sub">請先登入</div></div></div>`;
  }
  function card(c) {
    const [st, cls] = STATUS[c.handoff?.status] || STATUS.editing;
    const others = c.participants.filter((p) => p.role !== "owner").map((p) => p.name || p.label);
    if (renaming === c.id) return `<li><form class="row grow" data-form="rename" data-id="${c.id}" style="width:100%">
        <div class="field grow"><label for="rn-${c.id}">契約名稱</label><input id="rn-${c.id}" maxlength="200" value="${esc(c.title)}" required></div>
        <div class="field" style="flex:0 1 200px"><label for="rc-${c.id}">案號</label><input id="rc-${c.id}" maxlength="100" value="${esc(c.caseNo || "")}"></div>
        <button class="btn primary" type="submit" ${busy ? "disabled" : ""}>儲存</button><button class="btn" type="button" data-act="rename-cancel">取消</button></form></li>`;
    return `<li>
      <div style="min-width:0;flex:1 1 280px">
        <a class="t" href="/c/${c.id}" style="color:inherit;text-decoration:none">${esc(c.title)}</a>${c.caseNo ? `<div class="meta">案號：${esc(c.caseNo)}</div>` : ""}
        <div class="row" style="margin-top:4px;gap:6px">
          <span class="pill ${cls}">第 ${c.handoff?.round || 1} 輪 · ${st}</span>
          ${c.pendingCount ? `<span class="pill theirs">${c.pendingCount} 處待審閱</span>` : ""}
          <span class="meta">${c.clauseCount ? `${c.clauseCount} 條` : "尚未匯入條文"} · ${others.length ? "他方：" + esc(others.join("、")) : "尚未邀請他方"} · 更新於 ${fmt(c.updatedAt)}</span>
        </div>
      </div>
      <div class="row">${confirmDel === c.id
        ? `<span class="meta">刪除後條文、紀錄與圖片都無法復原</span><button class="btn sm bad" data-act="del-do" data-id="${c.id}">確定刪除</button><button class="btn sm" data-act="del-cancel">取消</button>`
        : `<a class="btn sm primary" href="/c/${c.id}">開啟</a><button class="btn sm" data-act="rename" data-id="${c.id}">編輯名稱／案號</button><button class="btn sm" data-act="del" data-id="${c.id}">刪除</button>`}</div>
    </li>`;
  }
  function draw() {
    drawTurn();
    const main = $("main");
    if (!list) {
      main.innerHTML = `<form class="panel" data-form="login"><h2>輸入管理密碼</h2><p>這是您在 Cloudflare 設定的 ADMIN_PASSWORD。只有您需要它，他方用專屬連結進入契約，不需要密碼。</p>
        <div class="field"><label for="pw">管理密碼</label><input id="pw" type="password" autocomplete="current-password" required></div>
        <div class="row"><button class="btn primary" type="submit">登入</button></div></form>`;
      $("pw").focus();
      return;
    }
    const shown = list.filter((c) => !q || c.title.toLowerCase().includes(q.toLowerCase()) || c.participants.some((p) => (p.name || p.label || "").includes(q)));
    main.innerHTML = `
      ${creating ? `<form class="panel" data-form="create"><h2>新增契約</h2><p>建立後將直接進入該契約，可匯入契約草案（Word）或逐條新增條文。</p>
        <div class="field"><label>契約範本</label>${tpls ? tplPicker(tpls, "blank") : `<span class="meta">正在載入範本…</span>`}<p class="meta" id="tplnotice" hidden>${esc(tpls?.notice || "")}範本中【　】為待填欄位。</p></div>
        <div class="field"><label for="ntitle">契約名稱（案名）</label><input id="ntitle" maxlength="200" placeholder="例如：○○年度○○系統建置維護採購案契約書" required></div>
        <div class="row"><div class="field grow"><label for="ncase">案號（選填）</label><input id="ncase" maxlength="100" placeholder="例如：○○○-○○-○○○"></div>
        <div class="field grow"><label for="nrole">本方身分</label><select id="nrole" style="width:100%;border:1px solid var(--line);border-radius:6px;padding:8px 10px;background:var(--paper);font:inherit;color:inherit"><option>機關（甲方）</option><option>廠商（乙方）</option></select></div></div>
        <div class="row"><button class="btn primary" type="submit" ${busy ? "disabled" : ""}>${busy ? "建立中…" : "建立並進入"}</button><button class="btn" type="button" data-act="new-cancel">取消</button></div></form>` : ""}
      ${list.length > 4 ? `<div class="field" style="margin-top:14px"><label for="q">搜尋契約名稱或他方名字</label><input id="q" value="${esc(q)}" placeholder="輸入關鍵字"></div>` : ""}
      <ul class="clist">${list.length
        ? (shown.length ? shown.map(card).join("") : `<li><span class="meta">找不到符合「${esc(q)}」的契約。</span></li>`)
        : `<li style="display:grid;justify-items:center;gap:10px;padding:32px 16px"><span class="meta">目前尚無契約案件。</span><button class="btn primary" data-act="new">＋ 新增第一件契約</button></li>`}</ul>`;
    if (creating) {
      $("ntitle").focus();
      let lastAuto = "";
      document.querySelectorAll("input[name=tpl]").forEach((r) => r.addEventListener("change", () => {
        const t = tpls.templates.find((x) => x.id === r.value), el = $("ntitle");
        if (!el.value.trim() || el.value === lastAuto) { el.value = t.title; lastAuto = t.title; }
        $("tplnotice").hidden = !t.clauses.length;
      }));
    }
    if (renaming) $("rn-" + renaming)?.focus();
    $("q")?.addEventListener("input", (e) => { q = e.target.value; const pos = e.target.selectionStart; draw(); const el = $("q"); el.focus(); el.setSelectionRange(pos, pos); });
  }
  document.addEventListener("submit", async (e) => {
    const f = e.target.closest("[data-form]"); if (!f) return;
    e.preventDefault();
    if (f.dataset.form === "login") { pw = $("pw").value; load(); return; }
    if (busy) return;
    if (f.dataset.form === "create") {
      const title = $("ntitle").value.trim(), caseNo = $("ncase").value.trim(), ownerLabel = $("nrole").value; if (!title) return;
      const tpl = tpls?.templates.find((t) => t.id === document.querySelector("input[name=tpl]:checked")?.value);
      busy = true; draw();
      try {
        const r = await adminApi("contracts", "POST", { title, caseNo, ownerLabel });
        store.set("ce:key:" + r.id, r.key);
        if (tpl && tpl.clauses.length) {
          const res = await fetch(`/api/c/${r.id}/import`, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + r.key }, body: JSON.stringify({ title, source: `範本：${tpl.name}`, clauses: tpl.clauses }) });
          if (!res.ok) toast("契約已建立，但範本套用失敗，請進入契約後按「套用範本」重試");
        }
        location.href = "/c/" + r.id;
        return;
      } catch (err) { toast(err.message); }
      busy = false; draw();
    }
    if (f.dataset.form === "rename") {
      const id = f.dataset.id, title = $("rn-" + id).value.trim(), caseNo = $("rc-" + id).value.trim(); if (!title) return;
      busy = true; draw();
      try { await adminApi(`contracts/${id}/rename`, "POST", { title, caseNo }); renaming = null; toast("已更新"); await load(); } catch (err) { toast(err.message); }
      busy = false; draw();
    }
  });
  document.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-act]"); if (!b) return;
    const a = b.dataset.act;
    if (a === "new" && !tpls) loadTemplates().then((d) => { tpls = d; if (creating) draw(); }).catch((e) => toast(e.message));
    if (a === "new") { creating = true; renaming = null; confirmDel = null; draw(); }
    if (a === "new-cancel") { creating = false; draw(); }
    if (a === "rename") { renaming = b.dataset.id; confirmDel = null; draw(); }
    if (a === "rename-cancel") { renaming = null; draw(); }
    if (a === "del") { confirmDel = b.dataset.id; renaming = null; draw(); }
    if (a === "del-cancel") { confirmDel = null; draw(); }
    if (a === "del-do") { try { await adminApi("contracts/" + b.dataset.id, "DELETE"); toast("已刪除"); } catch (e) { toast(e.message); } confirmDel = null; load(); }
    if (a === "logout") { store.set("ce:admin", null); pw = ""; list = null; creating = false; draw(); }
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && list) load(); });
  pw ? load() : draw();
}

/* =====================================================================
   Contract page
   ===================================================================== */
function contractApp(CID) {
const hashKey = new URLSearchParams(location.hash.slice(1)).get("k");
if (hashKey) { store.set("ce:key:" + CID, hashKey); history.replaceState(null, "", location.pathname); }
const KEY = store.get("ce:key:" + CID);
const ADMIN = store.get("ce:admin");

const S = {
  uid: null, me: null, canWrite: true, isAdmin: false, noAccess: null, slow: false,
  clauses: [], revs: [], handoff: null, contract: null, participants: [], lastSeen: null, version: 0,
  loaded: { c: false, r: false, h: false },
  view: "contract", filter: "todo", editing: null, editBase: null, adding: null,
  confirm: null, plainView: new Set(), expanded: new Set(), busy: false,
  exporting: false, exportAsk: false, importing: false, importPreview: null,
  peopleOpen: false, invited: null, nameOpen: false, menu: null, exportOpen: false, exportFmt: "pdf", exportOnlyChecked: true,
  reimport: null, reimportAll: false, onlyChecked: store.get("ce:only:" + CID) === "1"
};
const SIDE = { A: "甲方", B: "乙方" };
const ROLES = ["承辦人", "法務", "主管", "採購人員", "財務", "技術人員"];
const pById = (id) => S.participants.find((x) => x.id === id);
const mySide = () => S.me?.side || "A";
const sideOfId = (id) => (pById(id) || (id === S.uid ? S.me : null))?.side || null;
const sameSide = (id) => sideOfId(id) === mySide();
const who = (id) => {
  if (!id) return "某人";
  if (id === S.uid) return "您";
  const p = pById(id);
  return p ? (p.name || p.label || SIDE[p.side] || "他方") : "已停用的成員";
};
// name with side and role, for the revision log
const whoFull = (id) => {
  const p = pById(id); if (!p) return who(id);
  const tag = [SIDE[p.side], p.title].filter(Boolean).join("・");
  return `${id === S.uid ? "您" : (p.name || p.label || "")}${tag ? `（${tag}）` : ""}`;
};
const roundNo = () => S.handoff?.round || 1;
const status = () => S.handoff?.status || "editing";
const docTitle = () => S.contract?.title || "採購契約書";
const caseNo = () => S.contract?.caseNo || "";
const otherLabel = () => mySide() === "B" ? "機關（甲方）" : "廠商（乙方）";
const myLink = () => KEY ? `${location.origin}/c/${CID}#k=${KEY}` : "";

/* ---------- API ---------- */
async function api(path, body) {
  const headers = {};
  if (KEY) headers.authorization = "Bearer " + KEY;
  if (ADMIN) headers["x-admin-password"] = ADMIN;
  let payload;
  if (body instanceof Blob) { payload = body; headers["content-type"] = body.type; }
  else if (body !== undefined) { payload = JSON.stringify(body); headers["content-type"] = "application/json"; }
  const res = await fetch(`/api/c/${CID}/${path}`, { method: body === undefined ? "GET" : "POST", headers, body: payload });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message || "連線失敗"), { status: res.status, code: data.code, data });
  return data;
}
let first = true;
async function refresh() {
  let st;
  try { st = await api("state"); }
  catch (e) {
    if (e.status === 401 || e.status === 404) { S.noAccess = e.message; render(); stopPolling(); return; }
    S.slow = true; render(); return;
  }
  S.slow = false;
  if (!first) announce(st);
  S.me = st.me; S.uid = st.me.id; S.isAdmin = st.me.role === "owner";
  S.contract = st.contract; S.handoff = st.contract.handoff; S.version = st.contract.version;
  S.participants = st.participants; S.clauses = st.clauses; S.revs = st.revisions;
  if (first) { S.lastSeen = st.me.lastSeen || 0; if (!st.me.name) S.nameOpen = true; }
  S.loaded = { c: true, r: true, h: true };
  first = false;
  document.title = `${docTitle()} · 合約共同編輯器`;
  render();
}
function announce(st) {
  const old = new Map(S.revs.map((r) => [r.id, r]));
  for (const r of st.revisions) {
    const o = old.get(r.id);
    if (!o && r.by !== S.uid) toast(`${who(r.by)} 剛${KIND[r.kind || "edit"]}〈${revTitle(r)}〉`);
    if (o && o.status !== r.status && sameSide(r.by) && !sameSide(r.reviewedBy)) {
      if (r.status === "accepted") toast(`他方接受了您對〈${revTitle(r)}〉的${KIND[r.kind || "edit"]}`);
      if (r.status === "reverted") toast(`他方退回了您對〈${revTitle(r)}〉的${KIND[r.kind || "edit"]}`);
    }
  }
  const h = st.contract.handoff;
  if (h && h.by && !sameSide(h.by) && (!S.handoff || h.at !== S.handoff.at)) {
    const m = h.note === "imported" ? "匯入了新的契約" : { review: "把契約交給您審閱", reviewed: "審閱完成，交回給您檢視", final: "同意定稿", editing: "開始了新一輪修訂" }[h.status];
    if (m) toast(`${who(h.by)} ${m}`);
  }
}
let pollT = null;
async function poll() {
  if (document.hidden || S.noAccess) return;
  try { const v = await api("version"); if (v.version !== S.version) await refresh(); S.slow = false; }
  catch (e) { if (e.status === 401 || e.status === 404) { S.noAccess = e.message; render(); stopPolling(); } else if (!S.slow) { S.slow = true; render(); } }
}
function startPolling() { stopPolling(); pollT = setInterval(poll, 4000); }
function stopPolling() { clearInterval(pollT); pollT = null; }
document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); });
async function act(path, body, okMsg) {
  try { const r = await api(path, body); if (okMsg) toast(okMsg); await refresh(); return r; }
  catch (e) { fail(e); throw e; }
}
function fail(e) {
  console.error(e);
  if (e.status === 401) { S.noAccess = e.message; render(); }
  else if (e.status === 409) toast(e.message);
  else toast(e.message || "儲存失敗，請檢查網路後再試一次。");
}

/* ---------- sanitizing: everything stored is other people's input ---------- */
const PURIFY = {
  ALLOWED_TAGS: ["p", "div", "br", "span", "strong", "b", "em", "i", "u", "s", "sub", "sup", "ol", "ul", "li", "table", "thead", "tbody", "tr", "td", "th", "h1", "h2", "h3", "h4", "h5", "h6", "img", "blockquote"],
  ALLOWED_ATTR: ["colspan", "rowspan", "src", "alt", "data-i"],
  ALLOWED_URI_REGEXP: /^(?:\/img\/|data:image\/(?:png|jpe?g|gif|webp);)/i
};
function sanitize(html) {
  if (window.DOMPurify) return window.DOMPurify.sanitize(html || "", PURIFY);
  const d = document.createElement("div");
  d.textContent = new DOMParser().parseFromString(html || "", "text/html").body.textContent || "";
  return d.innerHTML.replace(/\n/g, "<br>");
}
const plainToHtml = (t) => (t || "").split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
const clauseHtmlOf = (c) => sanitize(c.html ?? plainToHtml(c.body));
const revHtml = (r, side) => sanitize(r.fmt === "html" ? r[side] : plainToHtml(r[side]));
const normalize = (html) => sanitize(html).replace(/<(p|div)><br><\/\1>\s*$/g, "").replace(/(<br>)+$/, "").trim();
const textOf = (html) => (new DOMParser().parseFromString(html || "", "text/html").body.textContent || "").replace(/\s+/g, " ").trim();

/* ---------- redline diff over HTML tokens (tags stay whole, text is per character) ---------- */
const tokenize = (h) => h.match(/<[^>]+>|&[a-zA-Z0-9#]+;|[\s\S]/g) || [];
const isTag = (t) => t[0] === "<";
const isImg = (t) => /^<img/i.test(t);
function diffTokens(A0, B0) {
  let p = 0; while (p < A0.length && p < B0.length && A0[p] === B0[p]) p++;
  let s = 0; while (s < A0.length - p && s < B0.length - p && A0[A0.length - 1 - s] === B0[B0.length - 1 - s]) s++;
  const A = A0.slice(p, A0.length - s), B = B0.slice(p, B0.length - s);
  let mid = [];
  const push = (arr, t, tok) => { const l = arr[arr.length - 1]; if (l && l[0] === t) l[1].push(tok); else arr.push([t, [tok]]); };
  if (!A.length && B.length) mid = [["+", B]];
  else if (A.length && !B.length) mid = [["-", A]];
  else if (A.length * B.length > 4e6) mid = [["-", A], ["+", B]];
  else if (A.length) {
    const n = A.length, m = B.length, W = m + 1, L = new Uint16Array((n + 1) * W);
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
      L[i * W + j] = A[i] === B[j] ? L[(i + 1) * W + j + 1] + 1 : Math.max(L[(i + 1) * W + j], L[i * W + j + 1]);
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { push(mid, "=", A[i]); i++; j++; }
      else if (L[(i + 1) * W + j] >= L[i * W + j + 1]) push(mid, "-", A[i++]);
      else push(mid, "+", B[j++]);
    }
    while (i < n) push(mid, "-", A[i++]);
    while (j < m) push(mid, "+", B[j++]);
    for (let k = 1; k < mid.length - 1; k++) {
      const seg = mid[k];
      if (seg[0] === "=" && seg[1].length <= 2 && !seg[1].some(isTag) && mid[k - 1][0] !== "=" && mid[k + 1][0] !== "=")
        mid.splice(k, 1, ["-", seg[1].slice()], ["+", seg[1].slice()]);
    }
    const merged = [];
    for (const seg of mid) {
      const grp = merged[merged.length - 1];
      if (seg[0] !== "=" && grp && grp.t === "x") grp[seg[0]].push(...seg[1]);
      else if (seg[0] === "=") merged.push({ t: "=", toks: seg[1] });
      else merged.push({ t: "x", "-": seg[0] === "-" ? [...seg[1]] : [], "+": seg[0] === "+" ? [...seg[1]] : [] });
    }
    mid = [];
    for (const g of merged) {
      if (g.t === "=") mid.push(["=", g.toks]);
      else { if (g["-"].length) mid.push(["-", g["-"]]); if (g["+"].length) mid.push(["+", g["+"]]); }
    }
  }
  const out = [];
  if (p) out.push(["=", A0.slice(0, p)]);
  out.push(...mid);
  if (s) out.push(["=", A0.slice(A0.length - s)]);
  return out;
}
function renderDiff(segs) {
  let html = "";
  for (const [t, toks] of segs) {
    if (t === "=") { html += toks.join(""); continue; }
    const tagName = t === "-" ? "del" : "ins", title = t === "-" ? "原文（已刪除）" : "新增";
    let run = "";
    const flush = () => { if (run) html += `<${tagName} class="d" title="${title}">${run}</${tagName}>`; run = ""; };
    for (const tok of toks) {
      if (isImg(tok)) { flush(); html += `<${tagName} class="d" title="${title}">${tok}</${tagName}>`; }
      else if (isTag(tok)) { flush(); if (t === "+") html += tok; }
      else run += tok;
    }
    flush();
  }
  return html;
}
const diffCache = new Map();
function diffHtml(a, b) {
  const key = a + "\u0000" + b;
  if (diffCache.has(key)) return diffCache.get(key);
  const out = renderDiff(diffTokens(tokenize(a), tokenize(b)));
  if (diffCache.size > 300) diffCache.clear();
  diffCache.set(key, out); return out;
}
const diffText = (a, b) => renderDiff(diffTokens([...(a || "")].map(esc), [...(b || "")].map(esc)));

/* ---------- derived state ---------- */
const sorted = () => [...S.clauses].sort((x, y) => (x.order ?? 0) - (y.order ?? 0));
const pendingOf = (cid) => S.revs.filter((r) => r.clauseId === cid && r.status === "pending").sort((x, y) => x.at - y.at);
const visible = () => sorted().filter((c) => !c.removed || pendingOf(c.id).some((r) => r.kind === "delete"));
const live = () => sorted().filter((c) => !c.removed);
const pendingForMe = () => S.revs.filter((r) => r.status === "pending" && !sameSide(r.by));
const isNew = (r) => S.lastSeen != null && r.by !== S.uid && r.at > S.lastSeen;
const decidedNew = (r) => S.lastSeen != null && sameSide(r.by) && r.reviewedAt && r.reviewedAt > S.lastSeen && !sameSide(r.reviewedBy);
const revTitle = (r) => r.titleAfter || r.titleBefore || r.clauseTitle || "條文";
const KIND = { edit: "修訂", add: "新增條文", delete: "刪除條文", move: "調整位置" };
const canEditDoc = () => S.canWrite && !!S.uid;

/* ---------- render ---------- */
function render() { renderTurn(); renderHeader(); renderPeople(); renderNews(); renderTabs(); renderMain(); }

function renderTurn() {
  const el = $("turn");
  if (S.noAccess) { el.innerHTML = `<div class="stage"><span class="stage-dot"></span><div class="stage-text"><div class="stage-title">無法開啟此契約</div><div class="stage-sub">${esc(S.noAccess)}</div></div></div>`; return; }
  if (!S.loaded.c) {
    el.innerHTML = S.slow
      ? `<div class="stage"><span class="stage-dot"></span><div class="stage-text"><div class="stage-title">暫時無法連線</div><div class="stage-sub">請確認網路連線後重試</div></div></div><div class="actions"><button class="btn" data-act="retry">重試</button></div>`
      : `<div class="stage"><span class="skel" style="width:220px;height:18px"></span></div>`;
    return;
  }
  const st = status(), by = S.handoff?.by, n = roundNo();
  const byUs = by && sameSide(by), side = SIDE[mySide()], other = SIDE[mySide() === "A" ? "B" : "A"];
  const todo = pendingForMe().length;
  const ours = S.revs.filter((r) => r.status === "pending" && sameSide(r.by) && (r.round || 1) === n).length;
  let title, sub, mine = false, acts = "";
  const copyBtn = `<button class="btn" data-act="copy">複製通知內容</button>`;
  if (st === "editing") {
    title = `第 ${n} 輪 · 修訂中`;
    sub = todo ? `${other}提出 ${todo} 處修訂，待您審閱` : ours ? `本方（${side}）本輪已修訂 ${ours} 處` : "雙方均可直接修訂條文";
    mine = !!todo;
    acts = `<button class="btn primary" data-act="handoff-review">修訂完成，送${other}審閱</button>`;
  } else if (st === "review") {
    if (byUs) { title = `第 ${n} 輪 · 已送${other}審閱`; sub = "審閱結果會列在修訂紀錄"; acts = copyBtn; }
    else {
      mine = true; title = `待審閱：${whoFull(by)}已送出第 ${n} 輪修訂`;
      sub = todo ? `尚有 ${todo} 處待審閱，請逐條接受或退回` : `已全部審閱，可送回${other}確認`;
      acts = `<button class="btn primary" data-act="handoff-reviewed" ${todo ? "disabled title=\"尚有修訂未審閱\"" : ""}>審閱完畢，送回${other}</button>`;
    }
  } else if (st === "reviewed") {
    const rs = S.revs.filter((r) => (r.round || 1) === n && !sameSide(r.by) === !!byUs);
    const ok = rs.filter((r) => r.status === "accepted").length, no = rs.filter((r) => r.status === "reverted").length;
    if (byUs) { title = `第 ${n} 輪 · 已送回${other}確認`; sub = `本方接受 ${ok} 處、退回 ${no} 處`; acts = copyBtn; }
    else {
      mine = true; title = `${whoFull(by)}已審閱完畢，請確認結果`;
      sub = `本方修訂：接受 ${ok} 處、退回 ${no} 處`;
      acts = `<button class="btn good" data-act="final">同意定稿</button><button class="btn" data-act="next-round">開始下一輪修訂</button>`;
    }
  } else {
    title = "雙方已確認定稿"; sub = `第 ${n} 輪定稿 · ${fmt(S.handoff?.at)}`;
    acts = `<button class="btn primary" data-act="export-open">匯出定稿本</button><button class="btn" data-act="next-round">重新開啟修訂</button>`;
  }
  el.innerHTML = `
    <div class="stage" data-mine="${mine ? 1 : 0}">
      ${st === "final" ? `<span class="seal" aria-hidden="true">定<br>稿</span>` : `<span class="stage-dot"></span>`}
      <div class="stage-text"><div class="stage-title">${esc(title)}</div><div class="stage-sub">${esc(sub)}</div></div>
    </div>
    <div class="actions">${acts}</div>`;
}

const menuBtn = (id, label, primary) => `<div class="menu-wrap"><button class="btn ${primary ? "primary" : ""}" data-act="menu" data-id="${id}" aria-haspopup="menu" aria-expanded="${S.menu === id}">${label} <span aria-hidden="true">▾</span></button>${S.menu === id ? menuHtml(id) : ""}</div>`;
function menuHtml(id) {
  const items = id === "import" ? [
    canEditDoc() && S.clauses.length && ["reimport-pick", "匯入修訂版 Word", "以匯出的 Word 修訂後匯回，逐條比對差異"],
    S.isAdmin && ["tpl-open", "套用範本", "以範本取代目前條文"],
    S.isAdmin && ["import-pick", "匯入新契約 Word", "以新的 Word 檔取代目前條文"]
  ] : [];
  return `<div class="menu" role="menu">${items.filter(Boolean).map(([act, label, hint]) => `<button role="menuitem" data-act="${act}"><strong>${label}</strong><span>${hint}</span></button>`).join("")}</div>`;
}
function renderHeader() {
  const back = ADMIN ? `<a href="/" class="crumb">契約案件</a><span aria-hidden="true"> / </span>` : "";
  $("csource").innerHTML = back + esc([caseNo() && `案號 ${caseNo()}`, S.contract?.source && (S.contract.source.startsWith("範本：") ? `採用${S.contract.source}` : `匯入自 ${S.contract.source}`)].filter(Boolean).join(" · "));
  $("lede").hidden = true;
  if (S.renaming && $("renameform")) { /* keep what the owner is typing across background refreshes */ }
  else if (S.renaming) {
    $("ctitle").innerHTML = `<form id="renameform" class="row"><input id="rtitle" class="inp" maxlength="200" value="${esc(docTitle())}" aria-label="契約名稱" style="flex:1 1 240px"><input id="rcase" class="inp" maxlength="100" value="${esc(caseNo())}" placeholder="案號" aria-label="案號" style="flex:0 1 180px;font-size:15px"><button class="btn sm primary" type="submit">儲存</button><button class="btn sm" type="button" data-act="rename-cancel">取消</button></form>`;
    $("renameform").addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = $("rtitle").value.trim(); if (!title) return;
      try { await act("rename", { title, caseNo: $("rcase").value.trim() }, "已更新契約名稱"); S.renaming = false; render(); } catch {}
    });
  } else {
    $("ctitle").innerHTML = (S.loaded.c ? esc(docTitle()) : `<span class="skel" style="width:60%;height:30px"></span>`) + (S.isAdmin && S.loaded.c ? ` <button class="btn icon ghost" data-act="rename-open" aria-label="編輯名稱與案號" title="編輯名稱與案號">✎</button>` : "");
  }
  const el = $("exportbar");
  if (!S.loaded.c || S.noAccess || S.importPreview || S.reimport || S.tplPick) { el.innerHTML = ""; return; }
  const hasBoxes = S.clauses.some((c) => Fields.hasBoxes(c.html));
  const toggle = hasBoxes ? `<div class="seg" role="group" aria-label="選項顯示方式"><button data-act="only-checked" data-v="0" aria-pressed="${!S.onlyChecked}">全部選項</button><button data-act="only-checked" data-v="1" aria-pressed="${S.onlyChecked}">僅已勾選</button></div>` : "";
  const fin = status() === "final";
  const imp = (S.isAdmin || (canEditDoc() && S.clauses.length)) ? menuBtn("import", "匯入") : "";
  el.innerHTML = `${toggle}<div class="grow"></div>${imp}${S.clauses.length ? `<button class="btn ${fin ? "" : ""}" data-act="export-open" ${S.exporting ? "disabled" : ""}>${S.exporting ? "匯出中…" : "匯出"}</button>` : ""}<button class="btn" data-act="people">成員${S.participants.filter((p) => !p.revoked).length ? `<span class="count plain">${S.participants.filter((p) => !p.revoked).length}</span>` : ""}</button>`;
  if (S.exportOpen) el.insertAdjacentHTML("beforeend", exportPanelHtml());
}

function exportPanelHtml() {
  const open = S.revs.filter((r) => r.status === "pending").length;
  const hasBoxes = S.clauses.some((c) => Fields.hasBoxes(c.html));
  const pdf = S.exportFmt === "pdf";
  return `<section class="panel export" aria-label="匯出">
    <div class="row"><h2>匯出</h2><div class="grow"></div><button class="btn icon ghost" data-act="export-close" aria-label="關閉">✕</button></div>
    <div class="tplgrid">
      <label class="tpl"><input type="radio" name="efmt" value="pdf" ${pdf ? "checked" : ""}><span><strong>PDF 定稿本</strong><span class="meta">A4 直式，含案號、頁碼；未定稿時加註「草案」浮水印</span></span></label>
      <label class="tpl"><input type="radio" name="efmt" value="docx" ${pdf ? "" : "checked"}><span><strong>Word（可編輯）</strong><span class="meta">可在 Word 整份修訂後，以「匯入 → 匯入修訂版 Word」送回逐條比對</span></span></label>
    </div>
    ${hasBoxes ? `<label class="check"><input type="checkbox" id="eonly" ${S.exportOnlyChecked ? "checked" : ""}> 僅保留已勾選的選項</label>` : ""}
    ${open ? `<div class="warnline">尚有 ${open} 處修訂未審閱，匯出內容為目前條文（含未審閱的修訂）</div>` : ""}
    <div class="row"><div class="grow"></div><button class="btn" data-act="export-close">取消</button><button class="btn primary" data-act="export-go">${pdf ? "匯出 PDF" : "匯出 Word"}</button></div>
  </section>`;
}

function renderPeople() {
  const el = $("people");
  if (!S.loaded.c || S.noAccess) { el.innerHTML = ""; return; }
  if (S.nameOpen) {
    if ($("nameform")) return; // keep what is being typed during background refreshes
    el.innerHTML = `<form class="panel" id="nameform"><h2>${S.me?.name ? "編輯個人資料" : "請先填寫您的姓名與角色"}</h2>
      <p>${esc(S.me?.label || SIDE[mySide()])}的成員。姓名與角色會顯示在每一筆修訂紀錄。</p>
      <div class="row">
        <div class="field grow"><label for="myname">姓名</label><input id="myname" maxlength="60" value="${esc(S.me?.name || "")}" placeholder="例如：王小明" required></div>
        <div class="field" style="flex:0 1 200px"><label for="mytitle">角色</label><input id="mytitle" maxlength="30" list="roles" value="${esc(S.me?.title || "")}" placeholder="例如：法務"><datalist id="roles">${ROLES.map((r) => `<option value="${r}">`).join("")}</datalist></div>
      </div>
      <div class="row"><div class="grow"></div>${S.me?.name ? `<button class="btn" type="button" data-act="name-cancel">取消</button>` : ""}<button class="btn primary" type="submit">儲存</button></div></form>`;
    $("nameform").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $("myname").value.trim(); if (!name) return;
      try { await act("me", { name, title: $("mytitle").value.trim() }, "已儲存個人資料"); S.nameOpen = false; render(); } catch {}
    });
    return;
  }
  if (!S.peopleOpen) { el.innerHTML = ""; return; }
  // don't wipe what is being typed in the invite form during a background refresh
  const ae = document.activeElement;
  if ($("inviteform") && ae && /^(INPUT|SELECT)$/.test(ae.tagName) && $("people").contains(ae) && !S.forcePeople) return;
  S.forcePeople = false;
  const live = S.participants.filter((p) => !p.revoked);
  const group = (side) => live.filter((p) => p.side === side);
  const row = (p) => `<li><span class="who"><strong>${esc(p.name || "尚未填寫姓名")}</strong>${p.title ? `<span class="chip-o">${esc(p.title)}</span>` : ""}<span class="meta">${p.id === S.uid ? "您 · " : ""}${p.role === "owner" ? "契約建立者 · " : ""}${p.lastSeen ? `最後查看 ${fmt(p.lastSeen)}` : "尚未開啟"}</span></span>
      ${(p.role !== "owner" && p.id !== S.uid && (S.isAdmin || p.side === mySide())) ? `<button class="btn sm ghost" data-act="revoke" data-id="${p.id}">停用連結</button>` : ""}</li>`;
  const sideBlock = (side) => `<div class="side-col"><h3>${SIDE[side]}${side === mySide() ? "（本方）" : ""}</h3><ul class="plist2">${group(side).map(row).join("") || `<li><span class="meta">尚無成員</span></li>`}</ul></div>`;
  const otherSide = mySide() === "A" ? "B" : "A";
  el.innerHTML = `<section class="panel"><div class="row"><h2>成員</h2><div class="grow"></div><button class="btn icon ghost" data-act="people" aria-label="關閉">✕</button></div>
    <div class="sides">${sideBlock(mySide())}${sideBlock(otherSide)}</div>
    <form id="inviteform" class="row">
      <div class="field" style="flex:0 1 160px"><label for="iside">新增至</label><select id="iside" class="inp">${`<option value="${mySide()}">本方（${SIDE[mySide()]}）</option>`}${S.isAdmin ? `<option value="${otherSide}">他方（${SIDE[otherSide]}）</option>` : ""}</select></div>
      <div class="field grow"><label for="ilabel">單位</label><input id="ilabel" class="inp" maxlength="60" placeholder="${esc(S.me?.label || "")}"></div>
      <button class="btn primary" type="submit">產生專屬連結</button>
    </form>
    <p class="meta">取得連結的人自行填寫姓名與角色後即可參與修訂。${S.isAdmin ? "" : "僅可新增本方成員。"}</p>
    ${S.invited ? `<div class="warnline">「${esc(S.invited.label)}」的專屬連結僅顯示一次，請以電子郵件等方式送交；持有連結者即可修訂本契約。</div><div class="linkbox">${esc(S.invited.link)}</div><div class="row"><button class="btn sm" data-act="copy-invite">複製連結</button></div>` : ""}
    <div class="row">${KEY ? `<button class="btn sm" data-act="copy-mine">複製我的連結</button>` : ""}<button class="btn sm" data-act="name-edit">編輯個人資料</button></div>
  </section>`;
  $("iside")?.addEventListener("change", (e) => { $("ilabel").placeholder = e.target.value === mySide() ? (S.me?.label || "") : otherLabel(); });
  $("inviteform")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const side = $("iside").value;
    const label = $("ilabel").value.trim() || (side === mySide() ? (S.me?.label || SIDE[side]) : otherLabel());
    try { const r = await act("invite", { label, side }, "已產生專屬連結"); S.invited = { label, link: `${location.origin}/c/${CID}#k=${r.key}` }; S.forcePeople = true; render(); } catch {}
  });
}

function renderNews() {
  const el = $("news");
  if (S.lastSeen == null || !S.loaded.r || S.importPreview || S.noAccess) { el.innerHTML = ""; return; }
  const newRevs = S.revs.filter(isNew), decided = S.revs.filter(decidedNew);
  const hand = S.handoff && S.handoff.by && !sameSide(S.handoff.by) && S.handoff.at > S.lastSeen;
  if (!newRevs.length && !decided.length && !hand) { el.innerHTML = ""; return; }
  const items = [];
  if (hand) {
    const m = S.handoff.note === "imported" ? `匯入了新的契約「${docTitle()}」` : { review: "把契約交給您審閱", reviewed: "審閱完成，交回給您檢視", final: "同意定稿", editing: "開始了新一輪修訂" }[S.handoff.status] || "更新了進度";
    items.push(`${esc(who(S.handoff.by))} ${esc(m)}（${fmt(S.handoff.at)}）`);
  }
  if (newRevs.length) {
    const titles = [...new Set(newRevs.map(revTitle))];
    items.push(`他方改動了 ${newRevs.length} 處：${esc(titles.slice(0, 4).join("、"))}${titles.length > 4 ? " 等" : ""}`);
  }
  if (decided.length) {
    const ok = decided.filter((r) => r.status === "accepted").length, no = decided.filter((r) => r.status === "reverted").length;
    items.push(`本方修訂有結果了：${ok ? `接受 ${ok} 處` : ""}${ok && no ? "、" : ""}${no ? `退回 ${no} 處` : ""}`);
  }
  el.innerHTML = `<section class="news" aria-label="自上次查看後的更新">
    <div class="row"><h2>自您上次查看（${fmt(S.lastSeen) || "首次開啟"}）後</h2>
    <div class="actions"><button class="btn sm" data-act="see-log">查看修訂紀錄</button><button class="btn sm" data-act="mark-seen">標為已讀</button></div></div>
    <ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul></section>`;
}

function renderTabs() {
  const hide = S.importPreview || S.reimport || S.tplPick || !S.loaded.c || S.noAccess;
  $("tabs").hidden = !!hide;
  if (hide) { $("tabs").innerHTML = ""; return; }
  const todo = pendingForMe().length;
  $("tabs").innerHTML = `
    <button class="tab" role="tab" aria-selected="${S.view === "contract"}" data-view="contract">契約內容</button>
    <button class="tab" role="tab" aria-selected="${S.view === "log"}" data-view="log">修訂紀錄${todo ? `<span class="count" title="待您審閱">${todo}</span>` : ""}</button>`;
}

function renderMain() {
  const main = $("main");
  const key = S.editing || (S.adding ? "new" : null);
  const keep = key ? document.getElementById("editor-" + key) : null;
  if (S.noAccess) { main.innerHTML = `<div class="sheet"><p class="empty">請向契約契約建立者索取您的專屬連結。契約建立者可以在契約頁面按「邀請他方／成員」產生。</p></div>`; return; }
  main.innerHTML = S.tplPick ? tplPickHtml() : S.importPreview ? importHtml() : S.reimport ? reimportHtml() : S.view === "contract" ? contractHtml() : logHtml();
  if (key) {
    const slot = document.getElementById("slot-" + key);
    if (slot) slot.replaceWith(keep || editorEl(key === "new" ? null : S.clauses.find((c) => c.id === key)));
  }
}

function contractHtml() {
  if (!S.loaded.c) return `<div class="sheet">${S.slow ? `<p class="empty">無法載入條文，請確認網路連線<br><button class="btn" data-act="retry">重試</button></p>` : `<div class="skel-block"><span class="skel" style="width:30%"></span><span class="skel"></span><span class="skel"></span><span class="skel" style="width:70%"></span><span class="skel" style="width:30%;margin-top:24px"></span><span class="skel"></span><span class="skel" style="width:85%"></span></div>`}</div>`;
  const vis = visible();
  if (!vis.length && !S.adding) return `<div class="sheet"><div class="empty"><p>尚無條文</p><div class="row" style="justify-content:center">${S.isAdmin ? `<button class="btn primary" data-act="tpl-open">套用範本</button><button class="btn" data-act="import-pick">匯入 Word 契約</button>` : ""}<button class="btn" data-act="add" data-after="">新增條文</button></div></div></div>`;
  const slotNew = `<section class="clause added" data-state="edit"><div id="slot-new"></div></section>`;
  let body = "";
  vis.forEach((c, i) => { body += clauseHtml(c, i, vis); if (S.adding?.afterId === c.id) body += slotNew; });
  if (S.adding && !vis.some((c) => c.id === S.adding.afterId)) body += slotNew;
  const addEnd = canEditDoc() && !S.adding && vis.length ? `<div class="addrow"><button class="btn sm ghost" data-act="add" data-after="${vis[vis.length - 1].id}">＋ 新增條文</button></div>` : "";
  const hint = canEditDoc() && !S.onlyChecked && vis.some((c) => Fields.count(clauseHtmlOf(c))) ? `<span>點選 □ 勾選、點選日期或底線空格直接填寫</span>` : "";
  return `<div class="legend"><span><del class="d">刪除線</del> 刪除的原文</span><span><ins class="d">底線</ins> 新增的文字</span>${hint}</div>
    <article class="sheet">${body}${addEnd}</article>`;
}

const FIELD_LABELS = { checked: "已勾選，點選取消", unchecked: "未勾選，點選勾選", date: "選擇日期", blank: "填寫內容", cell: "填寫" };
function fieldsView(html, interactive) {
  if (S.onlyChecked) return Fields.hideUncheckedHtml(html);
  if (!interactive) return html;
  const root = Fields.parse(html);
  Fields.decorate(root, FIELD_LABELS);
  return root.innerHTML;
}

function clauseHtml(c, idx, vis) {
  if (S.editing === c.id) return `<section class="clause" data-state="edit"><div id="slot-${c.id}"></div></section>`;
  const pend = pendingOf(c.id);
  const theirs = pend.filter((r) => !sameSide(r.by)), ours = pend.filter((r) => sameSide(r.by));
  const kinds = new Set(pend.map((r) => r.kind || "edit"));
  const state = theirs.length ? "theirs" : ours.length ? "mine" : "clean";
  // 他方的修訂預設標出差異；本方的修訂預設可繼續填寫，需要時再切換顯示差異
  const flip = S.plainView.has(c.id), plain = theirs.length ? flip : !flip;
  const cur = clauseHtmlOf(c);
  const firstEdit = pend.find((r) => (r.kind || "edit") === "edit");
  const isAdd = kinds.has("add"), isDel = kinds.has("delete");
  const showDiff = firstEdit && !plain && !isAdd && !isDel && !S.onlyChecked;
  const titleHtml = showDiff && firstEdit.titleBefore !== c.title ? diffText(firstEdit.titleBefore, c.title) : esc(c.title);
  const bodyHtml = showDiff ? diffHtml(revHtml(firstEdit, "before"), cur) : fieldsView(cur, canEditDoc() && !isDel);
  const authors = [...new Set(pend.map((r) => whoFull(r.by)))].join("、");
  const what = [...kinds].map((k) => KIND[k]).join("、");
  let pill = "";
  if (theirs.length) pill = `<span class="pill theirs">待您審閱</span>`;
  else if (ours.length) pill = `<span class="pill mine">待${SIDE[mySide() === "A" ? "B" : "A"]}審閱</span>`;
  if (isAdd) pill += `<span class="pill ok">新增條文</span>`;
  if (isDel) pill += `<span class="pill no">提議刪除</span>`;
  if (kinds.has("move")) pill += `<span class="pill plain">已調整位置</span>`;
  const fresh = pend.some(isNew) ? `<span class="newdot" title="新的修訂"></span> ` : "";
  let review = "";
  if (S.confirm?.id === c.id) {
    const k = S.confirm.kind;
    const msg = k === "delete" ? "他方接受後才會刪除，在此之前條文以刪除線顯示"
      : theirs.length ? "條文恢復為修訂前內容，紀錄會保留" : "條文恢復為修訂前內容";
    const label = k === "delete" ? "提議刪除此條？" : theirs.length ? "退回此條修訂？" : "撤回本方修訂？";
    const verb = k === "delete" ? "提議刪除" : theirs.length ? "退回" : "撤回";
    review = `<div class="confirm"><label for="reason-${c.id}"><strong>${label}</strong>${msg}</label>
      ${k === "delete" ? "" : `<input id="reason-${c.id}" class="inp" maxlength="500" placeholder="${theirs.length ? "退回理由（他方可見，選填）" : "撤回原因（選填）"}">`}
      <div class="actions"><button class="btn" data-act="confirm-cancel">取消</button><button class="btn bad" data-act="${k === "delete" ? "delete-do" : "revert-do"}" data-id="${c.id}">${verb}</button></div></div>`;
  } else if (pend.length) {
    review = `<div class="review">
      <span class="note">${esc(authors)} · ${fmt(pend[pend.length - 1].at)} · ${esc(what)}${pend.length > 1 ? ` ${pend.length} 次` : ""}</span>
      ${firstEdit && !isAdd && !isDel ? `<button class="linkbtn" data-act="toggle-plain" data-id="${c.id}">${plain ? "顯示修訂處" : "只看修訂後"}</button>` : ""}
      ${theirs.length ? `<button class="btn sm bad" data-act="revert-open" data-id="${c.id}">退回</button><button class="btn sm good" data-act="accept" data-id="${c.id}">接受</button>` : ""}
      ${!theirs.length && ours.length ? `<button class="btn sm" data-act="revert-open" data-id="${c.id}">撤回</button>` : ""}
    </div>`;
  }
  const tools = canEditDoc() && !isDel ? `<div class="tools">
      <button class="btn sm" data-act="edit" data-id="${c.id}">修訂</button>
      <button class="btn icon ghost" data-act="up" data-id="${c.id}" title="上移" aria-label="上移" ${idx === 0 ? "disabled" : ""}>↑</button>
      <button class="btn icon ghost" data-act="down" data-id="${c.id}" title="下移" aria-label="下移" ${idx === vis.length - 1 ? "disabled" : ""}>↓</button>
      <button class="btn icon ghost" data-act="add" data-after="${c.id}" title="在下方新增條文" aria-label="在下方新增條文">＋</button>
      <button class="btn icon ghost" data-act="delete-open" data-id="${c.id}" title="提議刪除" aria-label="提議刪除">✕</button></div>` : "";
  const last = c.updatedAt ? `${whoFull(c.updatedBy)} · ${fmt(c.updatedAt)}` : "";
  return `<section class="clause ${isAdd ? "added" : ""} ${isDel ? "deleted" : ""}" data-state="${state}" id="c-${c.id}" data-cid="${c.id}">
    <div class="clause-head"><h3>${fresh}${titleHtml}</h3><div class="actions">${pill}${tools}</div></div>
    ${review}
    <div class="rich">${bodyHtml || `<p style="color:var(--muted)">（無內文）</p>`}</div>
    ${last ? `<div class="meta">最後修訂 ${esc(last)}</div>` : ""}
  </section>`;
}

/* ---------- 直接填寫：勾選框、日期、空格 ---------- */
const fieldQueue = new Map();
function fieldChange(cid, k, value) {
  const c = S.clauses.find((x) => x.id === cid); if (!c) return;
  const before = clauseHtmlOf(c), after = Fields.apply(before, k, value);
  if (after === before) return;
  c.html = after; render();
  const prev = fieldQueue.get(cid) || Promise.resolve();
  const next = prev.then(async () => {
    const r = await api(`clauses/${cid}/edit`, { title: c.title, html: c.html, baseRev: c.rev, merge: true });
    if (r.rev) c.rev = r.rev;
  }).catch((e) => { fail(e); }).finally(() => { if (fieldQueue.get(cid) === next) { fieldQueue.delete(cid); refresh(); } });
  fieldQueue.set(cid, next);
}
function closePop() { $("pop")?.remove(); }
function openPop(btn, cid, k) {
  closePop();
  const c = S.clauses.find((x) => x.id === cid); if (!c) return;
  const inf = Fields.info(clauseHtmlOf(c), k); if (!inf) return;
  const pop = document.createElement("div");
  pop.id = "pop"; pop.className = "pop"; pop.setAttribute("role", "dialog");
  if (inf.type === "date") {
    const y = inf.y ? (+inf.y < 1000 ? +inf.y + 1911 : +inf.y) : "", iso = y && inf.mo && inf.d ? `${y}-${pad2(inf.mo)}-${pad2(inf.d)}` : "";
    pop.innerHTML = `<label for="pop-in">日期（存為民國年）</label><input id="pop-in" class="inp" type="date" value="${iso}">
      <div class="row"><button class="btn sm ghost" data-pop="clear">清除</button><div class="grow"></div><button class="btn sm" data-pop="close">取消</button><button class="btn sm primary" data-pop="ok">套用</button></div>`;
  } else {
    const blank = /^[\s　_＿【】]*$/.test(inf.text || "");
    pop.innerHTML = `<label for="pop-in">${inf.type === "cell" ? "儲存格內容" : "填寫內容"}</label><input id="pop-in" class="inp" maxlength="200" value="${blank ? "" : esc((inf.text || "").replace(/^【|】$/g, "").trim())}">
      <div class="row"><div class="grow"></div><button class="btn sm" data-pop="close">取消</button><button class="btn sm primary" data-pop="ok">套用</button></div>`;
  }
  document.body.appendChild(pop);
  const r = btn.getBoundingClientRect();
  pop.style.top = `${window.scrollY + r.bottom + 6}px`;
  pop.style.left = `${Math.max(8, Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - pop.offsetWidth - 8))}px`;
  const input = $("pop-in"); input.focus();
  const done = (v) => { closePop(); btn.focus(); if (v !== undefined) fieldChange(cid, k, v); };
  const ok = () => {
    if (inf.type === "date") { if (!input.value) return done(null); const [yy, mm, dd] = input.value.split("-").map(Number); return done({ y: yy - 1911, m: mm, d: dd }); }
    done(input.value.trim());
  };
  pop.addEventListener("click", (e) => { const a = e.target.closest("[data-pop]")?.dataset.pop; if (a === "ok") ok(); if (a === "close") done(); if (a === "clear") done(null); });
  pop.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); ok(); } if (e.key === "Escape") done(); });
}
document.addEventListener("click", (e) => {
  const fx = e.target.closest(".fx");
  if (fx) {
    e.preventDefault();
    const cid = fx.closest("[data-cid]")?.dataset.cid, k = +fx.dataset.fx;
    if (!cid) return;
    if (fx.dataset.kind === "box") { closePop(); fieldChange(cid, k); }
    else openPop(fx, cid, k);
    return;
  }
  if ($("pop") && !e.target.closest("#pop")) closePop();
  if (S.menu && !e.target.closest(".menu-wrap")) { S.menu = null; renderHeader(); }
}, true);

/* ---------- 匯入修訂版 Word：逐條比對 ---------- */
async function readDocx(file) {
  await need("jszip", "prep", "mammoth");
  const prepped = await window.DocxPrep.prepare(await file.arrayBuffer());
  let imgFail = 0;
  const res = await window.mammoth.convertToHtml({ arrayBuffer: prepped }, {
    styleMap: ["u => u", "strike => s"],
    convertImage: window.mammoth.images.imgElement(async (image) => {
      if (/^image\/(png|jpe?g|gif|webp)$/.test(image.contentType)) {
        try { return { src: await uploadImage(b64ToBlob(await image.read("base64"), image.contentType)) }; } catch (e) { console.warn(e); }
      }
      imgFail++; return { src: "", alt: "（圖片未能匯入）" };
    })
  });
  return { html: window.DocxPrep.post(res.value), imgFail };
}
// Our Word export puts each clause title in "Heading 2"; fall back to 第○條 detection for other files.
function splitByHeadings(html) {
  const dom = new DOMParser().parseFromString(sanitize(html), "text/html");
  const h2 = [...dom.body.children].filter((el) => el.tagName === "H2");
  if (!h2.length) return splitRich(html, "").clauses;
  const out = []; let cur = null;
  for (const el of [...dom.body.children]) {
    if (el.tagName === "H2") { cur = { title: squash(el.textContent), parts: [] }; out.push(cur); }
    else if (cur && (hasContent(el) || el.tagName === "TABLE")) cur.parts.push(el.outerHTML);
  }
  return out.map((c) => ({ title: c.title, html: c.parts.join("") }));
}
const canon = (html) => textOf(html) + "|" + ((html || "").match(/<img/gi) || []).length;
const titleKey = (t) => (t || "").replace(/[\s　：:、，,.。]/g, "");
function compareRevision(imported) {
  const cur = live();
  const used = new Set(), items = [];
  let prev = null, pendingAdds = [];
  const flushAdds = (nextClause) => {
    const a = prev ? prev.order : (nextClause ? nextClause.order - pendingAdds.length - 1 : 0);
    const b = nextClause ? nextClause.order : a + pendingAdds.length + 1;
    pendingAdds.forEach((it, i) => { it.order = a + ((b - a) * (i + 1)) / (pendingAdds.length + 1); });
    pendingAdds = [];
  };
  for (const im of imported) {
    const m = cur.find((c) => !used.has(c.id) && titleKey(c.title) === titleKey(im.title));
    if (!m) { const it = { type: "add", title: im.title, html: normalize(im.html) }; items.push(it); pendingAdds.push(it); continue; }
    used.add(m.id); flushAdds(m); prev = m;
    const html = normalize(im.html);
    const same = canon(clauseHtmlOf(m)) === canon(html) && squash(m.title) === squash(im.title);
    items.push({ type: same ? "same" : "edit", clause: m, title: im.title, html });
  }
  flushAdds(null);
  cur.filter((c) => !used.has(c.id)).forEach((c) => items.push({ type: "delete", clause: c, title: c.title }));
  const n = (t) => items.filter((i) => i.type === t).length;
  return { items, counts: { edit: n("edit"), add: n("add"), delete: n("delete"), same: n("same") } };
}
async function pickRevised(file) {
  if (!file) return;
  if (!/\.docx$/i.test(file.name)) { toast(/\.doc$/i.test(file.name) ? "舊版 .doc 檔請先以 Word「另存新檔」為 .docx 再匯入" : "請選擇 .docx 檔"); return; }
  S.importing = true; S.menu = null; render();
  try {
    const { html, imgFail } = await readDocx(file);
    const imported = splitByHeadings(html);
    if (!imported.length) toast("檔案中沒有可比對的條文");
    else { S.reimport = { ...compareRevision(imported), source: file.name, imgFail }; S.reimportAll = false; S.view = "contract"; }
  } catch (e) { console.error(e); toast("無法讀取此 Word 檔，請確認為未加密的 .docx 檔"); }
  S.importing = false; render(); window.scrollTo({ top: 0 });
}
function reimportHtml() {
  const R = S.reimport, c = R.counts, total = c.edit + c.add + c.delete;
  const list = R.items.filter((i) => S.reimportAll || i.type !== "same");
  const item = (i) => {
    if (i.type === "same") return `<section class="clause cmp-same"><div class="clause-head"><h3>${esc(i.title)}</h3><span class="pill plain">未變更</span></div></section>`;
    if (i.type === "add") return `<section class="clause added"><div class="clause-head"><h3>${esc(i.title)}</h3><span class="pill ok">新增</span></div><div class="rich">${sanitize(i.html)}</div></section>`;
    if (i.type === "delete") return `<section class="clause deleted"><div class="clause-head"><h3>${esc(i.title)}</h3><span class="pill no">刪除</span></div><div class="rich">${clauseHtmlOf(i.clause)}</div></section>`;
    const tDiff = squash(i.clause.title) !== squash(i.title) ? diffText(i.clause.title, i.title) : esc(i.title);
    return `<section class="clause" data-state="mine"><div class="clause-head"><h3>${tDiff}</h3><span class="pill mine">修訂</span></div><div class="rich">${diffHtml(clauseHtmlOf(i.clause), sanitize(i.html))}</div></section>`;
  };
  return `<div class="sheet"><div class="import-panel">
    <div class="row"><h2 style="margin:0;font-size:18px">比對結果：${esc(R.source)}</h2></div>
    <div class="row stats"><span class="pill mine">修訂 ${c.edit} 條</span><span class="pill ok">新增 ${c.add} 條</span><span class="pill no">刪除 ${c.delete} 條</span><span class="pill plain">未變更 ${c.same} 條</span><div class="grow"></div>
      <label class="check"><input type="checkbox" data-act="reimport-all" ${S.reimportAll ? "checked" : ""}> 顯示未變更的條文</label></div>
    ${R.imgFail ? `<div class="warnline">${R.imgFail} 張圖片無法匯入（例如 EMF 向量圖），送出後可於條文中重新加入</div>` : ""}
    ${total ? `<p class="lead">送出後，每處變更都會成為一筆修訂，由他方逐條接受或退回。</p>` : `<p class="lead">與目前條文相同，沒有需要送出的修訂。</p>`}
  </div>
  ${list.map(item).join("")}
  <div class="row" style="padding:20px 0"><div class="grow"></div><button class="btn" data-act="reimport-cancel">取消</button>${total ? `<button class="btn primary" data-act="reimport-go" ${S.busy ? "disabled" : ""}>${S.busy ? "送出中…" : `送出 ${total} 處修訂`}</button>` : ""}</div></div>`;
}
async function doReimport() {
  const R = S.reimport; if (!R || S.busy) return;
  const changes = R.items.filter((i) => i.type !== "same").map((i) =>
    i.type === "edit" ? { type: "edit", clauseId: i.clause.id, baseRev: i.clause.rev, title: i.title, html: i.html }
      : i.type === "delete" ? { type: "delete", clauseId: i.clause.id, baseRev: i.clause.rev, title: i.title }
        : { type: "add", title: i.title, html: i.html, order: i.order });
  S.busy = true; render();
  try { await act("bulk", { changes }, `已送出 ${changes.length} 處修訂`); S.reimport = null; }
  catch (e) { if (e.status === 409) toast(e.message); }
  S.busy = false; render();
}

// Row / column tools for the table under the cursor in the editor.
function tableOp(ed, op) {
  const n = getSelection().anchorNode;
  const td = n && (n.nodeType === 1 ? n : n.parentElement).closest("td,th");
  if (!td || !ed.contains(td)) { toast("請先將游標放在表格的儲存格內"); return; }
  const tr = td.parentElement, table = td.closest("table"), idx = [...tr.children].indexOf(td);
  const blankCell = (tag) => { const c = document.createElement(tag || "TD"); c.innerHTML = "<p>　</p>"; return c; };
  if (op === "row+") { const nr = document.createElement("tr"); [...tr.children].forEach((c) => { const nc = blankCell(c.tagName); if (c.colSpan > 1) nc.colSpan = c.colSpan; nr.appendChild(nc); }); tr.after(nr); }
  if (op === "row-") { if (table.querySelectorAll("tr").length > 1) tr.remove(); else toast("表格至少需保留一列"); }
  if (op === "col+") table.querySelectorAll("tr").forEach((r) => { const c = r.children[Math.min(idx, r.children.length - 1)]; c ? c.after(blankCell(c.tagName)) : r.appendChild(blankCell()); });
  if (op === "col-") { if (tr.children.length > 1) table.querySelectorAll("tr").forEach((r) => { const c = r.children[Math.min(idx, r.children.length - 1)]; if (c && r.children.length > 1) c.remove(); }); else toast("表格至少需保留一欄"); }
}
async function uploadImage(blob) {
  const r = await api("images", blob);
  return r.url;
}
function editorEl(c) {
  const key = c ? c.id : "new";
  const box = document.createElement("div");
  box.className = "editor"; box.id = "editor-" + key;
  box.innerHTML = `
    <label class="hint" for="et-${key}">${c ? "條文標題" : "新條文標題"}</label>
    <input id="et-${key}" maxlength="200" value="${esc(c ? c.title : "")}" placeholder="例如：第十條　其他約定">
    <div>
      <div class="toolbar" role="toolbar" aria-label="格式">
        <button type="button" data-cmd="bold" title="粗體"><b>B</b></button>
        <button type="button" data-cmd="italic" title="斜體"><i>I</i></button>
        <button type="button" data-cmd="underline" title="底線"><u>U</u></button>
        <button type="button" data-cmd="strikeThrough" title="刪除線"><s>S</s></button>
        <button type="button" data-cmd="insertOrderedList" title="編號清單">1.</button>
        <button type="button" data-cmd="insertUnorderedList" title="項目清單">•</button>
        <button type="button" data-cmd="indent" title="增加縮排">→</button>
        <button type="button" data-cmd="outdent" title="減少縮排">←</button>
        <button type="button" data-cmd="table" title="插入表格">表格</button>
        <button type="button" data-cmd="row+" title="在下方插入列">＋列</button>
        <button type="button" data-cmd="row-" title="刪除此列">－列</button>
        <button type="button" data-cmd="col+" title="在右側插入欄">＋欄</button>
        <button type="button" data-cmd="col-" title="刪除此欄">－欄</button>
        <button type="button" data-cmd="image" title="插入圖片">圖片</button>
        <button type="button" data-cmd="removeFormat" title="清除格式">清除格式</button>
      </div>
      <div class="editable rich" id="eb-${key}" contenteditable="true" role="textbox" aria-multiline="true" aria-label="條文內容">${c ? clauseHtmlOf(c) : "<p><br></p>"}</div>
    </div>
    <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden>
    <div class="hint">可直接貼上 Word 內容，格式會保留。儲存後他方會看到您改了哪裡，原文也會保留。</div>
    <div class="warn" id="ew-${key}" hidden></div>
    <div class="actions"><button class="btn primary" data-act="save" data-id="${key}">${c ? "儲存修訂" : "新增條文"}</button><button class="btn" data-act="cancel">取消</button></div>`;
  const ed = box.querySelector(".editable"), fileIn = box.querySelector("input[type=file]");
  let range = null;
  const keepRange = () => { const s = getSelection(); if (s.rangeCount && ed.contains(s.anchorNode)) range = s.getRangeAt(0).cloneRange(); };
  ed.addEventListener("keyup", keepRange); ed.addEventListener("mouseup", keepRange);
  const insertImage = async (file) => {
    try {
      toast("正在上傳圖片…");
      const url = await uploadImage(file);
      ed.focus(); if (range) { const s = getSelection(); s.removeAllRanges(); s.addRange(range); }
      document.execCommand("insertHTML", false, `<img src="${esc(url)}" alt="">`);
    } catch (e) { fail(e); }
  };
  ed.addEventListener("paste", (e) => {
    const files = [...(e.clipboardData?.files || [])].filter((f) => /^image\/(png|jpe?g|gif|webp)$/.test(f.type));
    if (files.length) { e.preventDefault(); keepRange(); files.forEach(insertImage); return; }
    const html = e.clipboardData?.getData("text/html"), text = e.clipboardData?.getData("text/plain");
    e.preventDefault();
    document.execCommand("insertHTML", false, html ? sanitize(html.replace(/<!--[\s\S]*?-->/g, "")) : plainToHtml(text || ""));
  });
  fileIn.addEventListener("change", () => { if (fileIn.files[0]) insertImage(fileIn.files[0]); fileIn.value = ""; });
  const tb = box.querySelector(".toolbar");
  tb.addEventListener("mousedown", (e) => e.preventDefault());
  tb.addEventListener("click", (e) => {
    const b = e.target.closest("[data-cmd]"); if (!b) return;
    ed.focus();
    if (b.dataset.cmd === "table") document.execCommand("insertHTML", false, "<table><tbody><tr><td>　</td><td>　</td><td>　</td></tr><tr><td>　</td><td>　</td><td>　</td></tr></tbody></table><p><br></p>");
    else if (/^(row|col)[+-]$/.test(b.dataset.cmd)) tableOp(ed, b.dataset.cmd);
    else if (b.dataset.cmd === "image") { keepRange(); fileIn.click(); }
    else document.execCommand(b.dataset.cmd, false, null);
  });
  return box;
}

function logHtml() {
  const f = S.filter;
  const filters = [["todo", "待您審閱"], ["mine", "本方修訂"], ["all", "全部"], ["accepted", "已接受"], ["reverted", "已退回／撤回"]];
  let list = S.revs;
  if (f === "todo") list = list.filter((r) => r.status === "pending" && !sameSide(r.by));
  if (f === "mine") list = list.filter((r) => sameSide(r.by));
  if (f === "accepted") list = list.filter((r) => r.status === "accepted");
  if (f === "reverted") list = list.filter((r) => r.status === "reverted" || r.status === "withdrawn");
  const empty = { todo: "沒有待您審閱的修訂。", mine: "本方尚未修訂條文。", all: "還沒有任何修訂。到「契約內容」點「修訂」開始。", accepted: "還沒有被接受的修訂。", reverted: "沒有被退回或撤回的修訂。" }[f];
  return `<div class="filters" role="group" aria-label="篩選">${filters.map(([k, l]) => `<button class="chip" aria-pressed="${f === k}" data-filter="${k}">${l}</button>`).join("")}</div>
    <div class="log">${list.length ? list.map(entryHtml).join("") : `<p class="empty">${empty}</p>`}</div>`;
}

function entryHtml(r) {
  const mine = sameSide(r.by), kind = r.kind || "edit";
  let pill;
  if (r.status === "pending") pill = mine ? `<span class="pill mine">等待他方審閱</span>` : `<span class="pill theirs">待您審閱</span>`;
  else if (r.status === "accepted") pill = `<span class="pill ok">${esc(who(r.reviewedBy))}已接受 · ${fmt(r.reviewedAt)}</span>`;
  else if (r.status === "reverted") pill = `<span class="pill no">${esc(who(r.reviewedBy))}已退回 · ${fmt(r.reviewedAt)}</span>`;
  else pill = `<span class="pill plain">已撤回 · ${fmt(r.reviewedAt)}</span>`;
  const open = S.expanded.has(r.id);
  let title, body = "", canExpand = false;
  if (kind === "edit") {
    title = r.titleBefore !== r.titleAfter ? diffText(r.titleBefore, r.titleAfter) : esc(revTitle(r));
    body = `<div class="rich">${diffHtml(revHtml(r, "before"), revHtml(r, "after"))}</div>`; canExpand = true;
  } else if (kind === "add") { title = `新增條文：${esc(r.titleAfter)}`; body = `<div class="rich">${revHtml(r, "after")}</div>`; }
  else if (kind === "delete") { title = `刪除條文：${esc(r.titleBefore)}`; body = `<div class="rich gone">${revHtml(r, "before")}</div>`; }
  else { title = `調整位置：${esc(revTitle(r))}`; body = `<div class="meta">${r.orderAfter < r.orderBefore ? "往前移" : "往後移"}</div>`; }
  return `<article class="entry">
    <div class="entry-head">${isNew(r) || decidedNew(r) ? `<span class="newdot" title="新的"></span>` : ""}<strong>${title}</strong>${pill}</div>
    <div class="meta">${esc(whoFull(r.by))} ${KIND[kind]}${r.via === "word" ? "（匯入 Word）" : ""} · ${fmt(r.at)} · 第 ${r.round || 1} 輪</div>
    ${r.note ? `<div class="review"><span class="note">${r.status === "withdrawn" ? "撤回原因" : "退回理由"}：${esc(r.note)}</span></div>` : ""}
    ${body}
    <div class="actions">
      ${canExpand ? `<button class="linkbtn" data-act="expand" data-id="${r.id}">${open ? "收起全文對照" : "看修訂前／修訂後全文"}</button>` : ""}
      ${r.status === "pending" && !mine ? `<button class="linkbtn" data-act="goto" data-id="${r.clauseId}">到條文審閱</button>` : ""}
    </div>
    ${open && canExpand ? `<div class="compare"><div><h4>修訂前</h4><div class="rich">${revHtml(r, "before")}</div></div><div><h4>修訂後</h4><div class="rich">${revHtml(r, "after")}</div></div></div>` : ""}
  </article>`;
}

/* ---------- editing actions ---------- */
async function save(key) {
  if (S.busy) return;
  const title = $("et-" + key).value.trim();
  const html = normalize($("eb-" + key).innerHTML);
  const warn = $("ew-" + key);
  if (key === "new") {
    if (!title && !textOf(html) && !/<img/i.test(html)) { S.adding = null; render(); return; }
    S.busy = true;
    try { await act("clauses/add", { afterId: S.adding.afterId || null, title: title || "新條文", html }, "已新增條文，等待他方審閱"); S.adding = null; } catch {}
    S.busy = false; render(); return;
  }
  const c = S.clauses.find((x) => x.id === key); if (!c) return;
  const newTitle = title || c.title;
  if (newTitle === c.title && html === normalize(clauseHtmlOf(c))) { S.editing = null; render(); return; }
  S.busy = true;
  try {
    await api(`clauses/${key}/edit`, { title: newTitle, html, baseRev: S.editBase.rev });
    S.editing = null; toast("已儲存，他方會看到您改了哪裡"); await refresh();
  } catch (e) {
    if (e.status === 409) {
      warn.hidden = false;
      warn.textContent = `${who(e.data?.clause?.updatedBy)} 在您編輯時也改動了這一條。為了不蓋掉他方的內容，這次沒有儲存。請先複製您的草稿，按「取消」後重新點「修訂」。`;
    } else fail(e);
  }
  S.busy = false; render();
}
async function simple(path, body, msg) { if (S.busy) return; S.busy = true; try { await act(path, body, msg); } catch {} S.busy = false; S.confirm = null; render(); }

async function copyMsg() {
  const st = status(), n = roundNo(), name = docTitle();
  const ref = caseNo() ? `（案號：${caseNo()}）` : "";
  const msg = st === "review" ? `「${name}」${ref}契約草案第 ${n} 輪修訂已完成，敬請以專屬連結登入審閱，修訂處均已標示。`
    : st === "reviewed" ? `「${name}」${ref}契約草案第 ${n} 輪修訂已審閱完畢，敬請以專屬連結登入確認審閱結果。`
    : st === "final" ? `「${name}」${ref}契約內容業經雙方確認定稿，敬請以專屬連結登入檢視並下載定稿版本。`
    : `「${name}」${ref}契約草案已有更新，敬請以專屬連結登入檢視。`;
  copy(msg, "已複製通知內容，請以電子郵件等方式送交他方");
}

/* ---------- Word import (keeps bold, italic, underline, lists, tables, images) ---------- */
const CLAUSE_RE = /^[\s　]*第[\s　]*[一二三四五六七八九十百千零〇兩\d０-９]+[\s　]*條/;
const TITLE_RE = /契約|契約|協議|同意書|備忘錄|承諾書|採購|案$/;
const squash = (s) => (s || "").replace(/[\s ]+/g, " ").trim();
function stripLeading(el, n) {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node; while (n > 0 && (node = w.nextNode())) { const k = Math.min(n, node.data.length); node.data = node.data.slice(k); n -= k; }
}
const hasContent = (el) => squash(el.textContent) || el.querySelector("img");
function splitRich(html, fallbackTitle) {
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
function b64ToBlob(b64, type) {
  const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type });
}
async function pickDocx(file) {
  if (!file) return;
  if (!/\.docx$/i.test(file.name)) {
    toast(/\.doc$/i.test(file.name) ? "這是舊版 .doc 檔。請用 Word 開啟後「另存新檔」選 .docx，再匯入一次。" : "請選擇 Word 的 .docx 檔。");
    return;
  }
  S.importing = true; S.menu = null; render();
  try {
    const { html, imgFail } = await readDocx(file);
    const parsed = splitRich(html, file.name.replace(/\.docx$/i, ""));
    if (!parsed.clauses.length) toast("這個 Word 檔裡沒有讀到內容。");
    else { S.importPreview = { ...parsed, source: file.name, imgFail }; S.view = "contract"; }
  } catch (e) { console.error(e); toast("讀不到這個 Word 檔，請確認它是未加密的 .docx 檔。"); }
  S.importing = false; render(); window.scrollTo({ top: 0 });
}
function tplPickHtml() {
  if (!S.tpls) return `<div class="sheet"><p class="empty">正在載入範本…</p></div>`;
  return `<div class="sheet"><div class="import-panel">
    <h2 style="margin:0;font-size:18px">套用範本</h2>
    <p class="lead">選擇範本後會先顯示預覽，確認後才會寫入。${esc(S.tpls.notice)}</p>
    ${tplPicker({ templates: S.tpls.templates.filter((t) => t.clauses.length) }, S.tpls.templates.find((t) => t.clauses.length)?.id)}
    <div class="actions"><button class="btn primary" data-act="tpl-preview">預覽範本</button><button class="btn" data-act="tpl-cancel">取消</button></div>
  </div></div>`;
}
function importHtml() {
  const p = S.importPreview;
  const how = { template: `套用「${esc((p.source || "").replace(/^範本：/, ""))}」範本，共 ${p.clauses.length} 段。範本中【　】為待填欄位，套用後請逐條填寫或修訂。`, clause: `依「第○條」切成 ${p.clauses.length} 個條文。`, heading: `依 Word 標題切成 ${p.clauses.length} 個段落。`, none: "沒有找到「第○條」或 Word 標題，整份會先成為一個條文；匯入後可以用「＋」新增條文，把內容分開。" }[p.split];
  const replacing = S.clauses.length ? `<div class="dangerline">匯入後會取代目前的「${esc(docTitle())}」：現有條文和 ${S.revs.length} 筆修訂紀錄會刪除，進度回到第 1 輪。需要的話請先匯出 PDF 保存。</div>` : "";
  const imgNote = p.imgFail ? `<div class="warnline">有 ${p.imgFail} 張圖片格式或大小無法匯入（例如 Word 的 EMF 向量圖），請匯入後用「修訂」→「圖片」重新加入。</div>` : "";
  return `<div class="sheet"><div class="import-panel">
    <h2 style="margin:0;font-size:18px">${p.split === "template" ? `確認套用範本：${esc(p.source.replace(/^範本：/, ""))}` : `確認匯入：${esc(p.source)}`}</h2>
    <p class="lead">${how}${p.split === "template" ? "" : " 粗體、斜體、底線、清單、表格與圖片會保留。"}</p>
    <div><label for="imp-title">契約名稱</label><input type="text" id="imp-title" maxlength="200" value="${esc(p.title)}"></div>
    <ol class="plist">${p.clauses.map((c) => `<li><span class="pt">${esc(c.title)}</span><span class="pp">${esc(textOf(c.html).slice(0, 80)) || "（無內文）"}</span></li>`).join("")}</ol>
    ${imgNote}${replacing}
    <div class="actions"><button class="btn primary" data-act="import-go" ${S.importing ? "disabled" : ""}>${S.importing ? "匯入中…" : "確認匯入"}</button><button class="btn" data-act="import-cancel">取消</button></div>
  </div></div>`;
}
async function doImport() {
  const p = S.importPreview; if (!p || S.importing) return;
  const title = ($("imp-title")?.value || "").trim() || p.title;
  S.importing = true; render();
  try { await act("import", { title, source: p.source, clauses: p.clauses }, `已匯入「${title}」，共 ${p.clauses.length} 個條文`); S.importPreview = null; } catch {}
  S.importing = false; render();
}

/* ---------- PDF export: page image for fidelity + an invisible text layer so it can be searched and copied ---------- */
let fontB64 = null;
async function loadPdfFont() {
  if (fontB64) return fontB64;
  const res = await fetch("/fonts/NotoSansTC-Regular.ttf");
  if (!res.ok) throw new Error("font " + res.status);
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return (fontB64 = btoa(bin));
}
function textLines(block) {
  const base = block.getBoundingClientRect(), out = [], rg = document.createRange();
  const w = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let node, cur = null;
  while ((node = w.nextNode())) {
    const fs = parseFloat(getComputedStyle(node.parentElement).fontSize) || 16;
    for (let i = 0; i < node.data.length; i++) {
      const ch = node.data[i]; if (ch === "\n" || ch === "\r") continue;
      rg.setStart(node, i); rg.setEnd(node, i + 1);
      const rs = rg.getClientRects(); if (!rs.length) continue;
      const r = rs[rs.length - 1]; if (!r.width && ch.trim()) continue;
      const top = r.top - base.top, left = r.left - base.left, right = r.right - base.left, bottom = r.bottom - base.top;
      if (cur && Math.abs(top - cur.top) < fs * 0.5 && left >= cur.right - 1.5 && left - cur.right < fs * 1.2) { cur.text += ch; cur.right = right; }
      else { if (cur) out.push(cur); cur = { text: ch, left, right, top, bottom, fs }; }
    }
  }
  if (cur) out.push(cur);
  return out.filter((l) => l.text.trim());
}
const exportClauses = (onlyChecked) => live().map((c) => ({ title: c.title, html: onlyChecked ? Fields.hideUncheckedHtml(clauseHtmlOf(c)) : clauseHtmlOf(c) }));
async function exportWord(onlyChecked) {
  if (S.exporting) return;
  S.exporting = true; S.exportOpen = false; render();
  try {
    await need("docx", "export");
    const fin = status() === "final";
    const blob = await window.DocxExport.toBlob({ title: docTitle(), caseNo: caseNo(), status: fin ? `定稿本（第 ${roundNo()} 輪）` : `契約草案（第 ${roundNo()} 輪）`, date: `列印日期：${rocToday()}` }, exportClauses(onlyChecked));
    const d = new Date(), stamp = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
    saveBlob(`${docTitle().replace(/[\\/:*?"<>|]/g, "")}_${fin ? "定稿本" : `草案第${roundNo()}輪`}_${stamp}.docx`, blob);
    toast("已匯出 Word；修訂後可由「匯入 → 匯入修訂版 Word」送回");
  } catch (e) { console.error(e); toast("無法產生 Word 檔，請重新整理頁面後重試"); }
  S.exporting = false; render();
}
async function exportPdf(onlyChecked) {
  if (S.exporting) return;
  S.exporting = true; S.exportOpen = false; render();
  const stage = $("pdf-stage");
  let textLayer = true;
  try {
    if (!window.html2canvas) await loadScript("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js");
    if (!window.jspdf) await loadScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");
    const fin = status() === "final";
    const d0 = new Date(), today = `中華民國 ${d0.getFullYear() - 1911} 年 ${d0.getMonth() + 1} 月 ${d0.getDate()} 日`;
    stage.innerHTML = `<div class="pb ph">${fin ? `<span class="seal">定<br>稿</span>` : ""}<h2>${esc(docTitle())}</h2>${caseNo() ? `<p>案號：${esc(caseNo())}</p>` : ""}<p>${fin ? `定稿本（第 ${roundNo()} 輪）` : `契約草案（第 ${roundNo()} 輪）`}　列印日期：${today}</p></div>` +
      exportClauses(onlyChecked).map((c) => `<div class="pb"><h3>${esc(c.title)}</h3><div class="rich">${c.html}</div></div>`).join("");
    await Promise.all([...stage.querySelectorAll("img")].map((im) => im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; })));
    try { await document.fonts.ready; } catch {}
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
    try { pdf.addFileToVFS("tc.ttf", await loadPdfFont()); pdf.addFont("tc.ttf", "tc", "normal"); pdf.setFont("tc"); }
    catch (e) { console.warn(e); textLayer = false; }
    const M = 20, W = 210 - 2 * M, TOP = 18, BOTTOM = 297 - 20, H = BOTTOM - TOP;
    let y = TOP;
    const newPage = () => { pdf.addPage(); y = TOP; };
    const writeText = (lines, k, yTop, fromCss, toCss) => {
      if (!textLayer) return;
      for (const l of lines) {
        if (l.top < fromCss - 1 || l.top >= toCss - 1) continue;
        pdf.setFontSize((l.fs * k) / 0.3528);
        const natural = pdf.getTextWidth(l.text), target = (l.right - l.left) * k;
        const cs = l.text.length > 1 ? (target - natural) / (l.text.length - 1) : 0;
        pdf.text(l.text, M + l.left * k, yTop + (l.top - fromCss + (l.bottom - l.top) * 0.8) * k, { renderingMode: "invisible", charSpace: cs });
      }
    };
    for (const block of stage.children) {
      const lines = textLines(block);
      const cv = await window.html2canvas(block, { scale: 2, backgroundColor: "#ffffff", logging: false, useCORS: true });
      const cssW = block.offsetWidth, k = W / cssW, pxPerCss = cv.width / cssW;
      const h = (cv.height / pxPerCss) * k;
      if (h <= H) {
        if (y + h > BOTTOM) newPage();
        pdf.addImage(cv.toDataURL("image/jpeg", 0.92), "JPEG", M, y, W, h);
        writeText(lines, k, y, 0, Infinity); y += h;
      } else {
        let sy = 0;
        while (sy < cv.height) {
          if (BOTTOM - y < 30) newPage();
          let sliceH = Math.min(cv.height - sy, Math.floor(((BOTTOM - y) / k) * pxPerCss));
          if (sy + sliceH < cv.height) {
            const cutCss = (sy + sliceH) / pxPerCss;
            const crossing = lines.filter((l) => l.top < cutCss && l.bottom > cutCss);
            if (crossing.length) { const safe = Math.min(...crossing.map((l) => l.top)) - 2; if (safe * pxPerCss > sy + 40) sliceH = Math.floor(safe * pxPerCss - sy); }
          }
          const part = document.createElement("canvas"); part.width = cv.width; part.height = sliceH;
          part.getContext("2d").drawImage(cv, 0, sy, cv.width, sliceH, 0, 0, cv.width, sliceH);
          pdf.addImage(part.toDataURL("image/jpeg", 0.92), "JPEG", M, y, W, (sliceH / pxPerCss) * k);
          writeText(lines, k, y, sy / pxPerCss, (sy + sliceH) / pxPerCss);
          y += (sliceH / pxPerCss) * k; sy += sliceH;
          if (sy < cv.height) newPage();
        }
      }
    }
    const n = pdf.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      pdf.setPage(i);
      if (textLayer) {
        pdf.setFont("tc");
        if (!fin) {
          // light "草案" watermark so a draft is never mistaken for the signed version
          pdf.saveGraphicsState(); pdf.setGState(new pdf.GState({ opacity: 0.07 }));
          pdf.setFontSize(110); pdf.setTextColor(0);
          pdf.text("草案", 105, 160, { align: "center", angle: 30 });
          pdf.restoreGraphicsState();
        }
        pdf.setFontSize(9); pdf.setTextColor(110);
        pdf.text(`第 ${i} 頁，共 ${n} 頁`, 105, 297 - 10, { align: "center" });
        const head = [docTitle(), caseNo() && `案號：${caseNo()}`].filter(Boolean).join("　");
        if (i > 1) pdf.text(head.length > 46 ? head.slice(0, 45) + "…" : head, 105, 11, { align: "center" });
      } else {
        pdf.setFont("helvetica"); pdf.setFontSize(9); pdf.setTextColor(110);
        pdf.text(`${i} / ${n}`, 105, 297 - 10, { align: "center" });
      }
    }
    pdf.setProperties({ title: docTitle(), subject: [caseNo() && `案號 ${caseNo()}`, fin ? "定稿本" : "契約草案"].filter(Boolean).join("　") });
    const d = new Date(), stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    saveBlob(`${docTitle().replace(/[\\/:*?"<>|]/g, "")}_${fin ? "定稿本" : `草案第${roundNo()}輪`}_${stamp}.pdf`, pdf.output("blob"));
    toast(textLayer ? "PDF 已下載" : "PDF 已下載（這次未能加入可搜尋的文字層）");
  } catch (e) { console.error(e); toast("PDF 產生失敗，請重新整理頁面後再試一次"); }
  stage.innerHTML = ""; S.exporting = false; render();
}

/* ---------- events ---------- */
$("docx-input").addEventListener("change", (e) => pickDocx(e.target.files[0]));
$("rev-input").addEventListener("change", (e) => pickRevised(e.target.files[0]));
document.addEventListener("change", (e) => {
  if (e.target.name === "efmt") { S.exportFmt = e.target.value; S.exportOnlyChecked = S.exportFmt === "pdf"; renderHeader(); }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.menu) { S.menu = null; renderHeader(); } });
document.addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-act],[data-view],[data-filter]"); if (!b || b.disabled) return;
  if (b.dataset.view) { S.view = b.dataset.view; render(); return; }
  if (b.dataset.filter) { S.filter = b.dataset.filter; render(); return; }
  const id = b.dataset.id;
  switch (b.dataset.act) {
    case "edit": {
      const c = S.clauses.find((x) => x.id === id);
      S.editing = id; S.adding = null; S.editBase = { rev: c.rev }; S.confirm = null; render();
      $("eb-" + id)?.focus(); break;
    }
    case "add": S.adding = { afterId: b.dataset.after || null }; S.editing = null; S.confirm = null; render(); $("et-new")?.focus(); break;
    case "cancel": S.editing = null; S.adding = null; render(); break;
    case "save": save(id); break;
    case "up": simple(`clauses/${id}/move`, { dir: -1 }); break;
    case "down": simple(`clauses/${id}/move`, { dir: 1 }); break;
    case "delete-open": S.confirm = { id, kind: "delete" }; render(); break;
    case "delete-do": simple(`clauses/${id}/delete`, {}, "已提議刪除，他方接受後才會正式刪除"); break;
    case "accept": simple(`clauses/${id}/accept`, {}, "已接受"); break;
    case "revert-open": S.confirm = { id, kind: "revert" }; render(); $("reason-" + id)?.focus(); break;
    case "confirm-cancel": S.confirm = null; render(); break;
    case "revert-do": simple(`clauses/${id}/revert`, { note: ($("reason-" + id)?.value || "").trim() }, "已恢復成改動前的樣子"); break;
    case "toggle-plain": S.plainView.has(id) ? S.plainView.delete(id) : S.plainView.add(id); render(); break;
    case "expand": S.expanded.has(id) ? S.expanded.delete(id) : S.expanded.add(id); render(); break;
    case "goto": S.view = "contract"; render(); document.getElementById("c-" + id)?.scrollIntoView({ block: "start", behavior: "smooth" }); break;
    case "see-log": S.view = "log"; S.filter = "all"; render(); break;
    case "mark-seen": S.lastSeen = Date.now(); render(); api("seen", {}).catch(() => {}); break;
    case "copy": copyMsg(); break;
    case "handoff-review": simple("handoff", { status: "review", round: roundNo() }, "已交給他方審閱。可用「複製通知訊息」告訴他方。"); break;
    case "handoff-reviewed": simple("handoff", { status: "reviewed", round: roundNo() }, "已交回他方檢視。"); break;
    case "final": simple("handoff", { status: "final", round: roundNo() }, "已同意定稿，可以匯出 PDF。"); break;
    case "next-round": simple("handoff", { status: "editing", round: roundNo() + 1 }, "已開始新一輪修訂。"); break;
    case "export-open": S.exportOpen = true; S.exportOnlyChecked = S.exportFmt === "pdf"; render(); break;
    case "export-close": S.exportOpen = false; render(); break;
    case "export-go": { const only = $("eonly") ? $("eonly").checked : false; S.exportFmt === "pdf" ? exportPdf(only) : exportWord(only); break; }
    case "menu": S.menu = S.menu === id ? null : id; renderHeader(); break;
    case "only-checked": S.onlyChecked = b.dataset.v === "1"; store.set("ce:only:" + CID, S.onlyChecked ? "1" : null); closePop(); render(); break;
    case "reimport-pick": S.menu = null; $("rev-input").value = ""; $("rev-input").click(); break;
    case "reimport-go": doReimport(); break;
    case "reimport-cancel": S.reimport = null; render(); break;
    case "reimport-all": S.reimportAll = b.checked; render(); break;
    case "retry": S.slow = false; render(); refresh(); break;
    case "tpl-open": S.tplPick = true; render(); loadTemplates().then((d) => { S.tpls = d; render(); }).catch((e) => { toast(e.message); S.tplPick = false; render(); }); break;
    case "tpl-cancel": S.tplPick = false; render(); break;
    case "tpl-preview": {
      const t = S.tpls.templates.find((x) => x.id === document.querySelector("input[name=tpl]:checked")?.value); if (!t) break;
      S.tplPick = false;
      S.importPreview = { title: docTitle() === "採購契約書" ? t.title : docTitle(), clauses: t.clauses, source: `範本：${t.name}`, split: "template", imgFail: 0 };
      render(); window.scrollTo({ top: 0 }); break;
    }
    case "import-pick": S.menu = null; $("docx-input").value = ""; $("docx-input").click(); break;
    case "import-go": doImport(); break;
    case "import-cancel": S.importPreview = null; render(); break;
    case "people": S.peopleOpen = !S.peopleOpen; S.invited = null; render(); break;
    case "copy-invite": copy(S.invited.link, "已複製，請傳給他方"); break;
    case "copy-mine": copy(myLink(), "已複製您的專屬連結"); break;
    case "revoke": simple(`participants/${id}/remove`, {}, "已停用這條連結"); break;
    case "name-edit": S.nameOpen = true; render(); break;
    case "name-cancel": S.nameOpen = false; render(); break;
    case "rename-open": S.renaming = true; render(); $("rtitle")?.focus(); break;
    case "rename-cancel": S.renaming = false; render(); break;
  }
});
try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch {}

render();
if (!KEY && !ADMIN) { S.noAccess = "這個網址缺少專屬連結的金鑰。請用契約契約建立者傳給您的完整連結開啟。"; render(); }
else refresh().then(() => { if (!S.noAccess) { startPolling(); api("seen", {}).catch(() => {}); } });
}
})();
