// 合約共同編輯器 — Cloudflare edition front end.
// "/" is the owner's admin page (ADMIN_PASSWORD); "/c/<id>#k=<key>" is a contract opened with a party's private link.
(() => {
"use strict";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (t) => t ? new Date(t).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "";
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

const route = location.pathname.match(/^\/c\/([0-9a-f-]{36})\/?$/i);
if (route) contractApp(route[1]); else adminApp();

/* =====================================================================
   Admin page: list and create contracts
   ===================================================================== */
function adminApp() {
  let pw = store.get("ce:admin") || "";
  let list = null, created = null, busy = false, confirmDel = null;
  $("turn").innerHTML = `<div class="stage"><span class="stage-dot"></span><div class="stage-text"><div class="stage-title">合約管理</div><div class="stage-sub">建立合約、取得雙方的專屬連結</div></div></div>`;
  $("lede").textContent = "建立一份合約後，你會拿到自己的擁有者連結；在合約頁面裡可以匯入 Word 檔，並產生給對方的專屬連結。";
  const adminApi = async (path, method = "GET", body) => {
    const res = await fetch("/api/admin/" + path, { method, headers: { "x-admin-password": pw, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.message || "錯誤"), { status: res.status, data });
    return data;
  };
  async function load() {
    try { list = (await adminApi("contracts")).contracts; store.set("ce:admin", pw); }
    catch (e) { list = null; if (e.status === 401) { store.set("ce:admin", null); pw = ""; } toast(e.message); }
    draw();
  }
  function draw() {
    const main = $("main");
    if (!list) {
      main.innerHTML = `<form class="panel" id="login"><h2>輸入管理密碼</h2><p>這是你在 Cloudflare 設定的 ADMIN_PASSWORD，只有你需要它。</p>
        <div class="field"><label for="pw">管理密碼</label><input id="pw" type="password" autocomplete="current-password" required></div>
        <div class="row"><button class="btn primary" type="submit">登入</button></div></form>`;
      $("login").addEventListener("submit", (e) => { e.preventDefault(); pw = $("pw").value; load(); });
      return;
    }
    const st = { editing: "修改中", review: "批改中", reviewed: "待檢視", final: "已定稿" };
    main.innerHTML = `
      <form class="panel" id="create"><h2>建立新合約</h2>
        <div class="row"><div class="field grow"><label for="ntitle">合約名稱（匯入 Word 時可再修改）</label><input id="ntitle" placeholder="例如：房屋租賃契約書" maxlength="200"></div>
        <button class="btn primary" type="submit" ${busy ? "disabled" : ""}>建立</button></div>
        ${created ? `<div class="warnline">已建立「${esc(created.title)}」。下面是你的擁有者連結，請收藏起來；忘記時用這個頁面的「開啟」也能進去。</div><div class="linkbox">${esc(created.link)}</div><div class="row"><button class="btn sm" type="button" data-act="copy-created">複製連結</button><a class="btn sm primary" href="${esc(created.link)}">開啟合約</a></div>` : ""}
      </form>
      <ul class="clist">${list.length ? list.map((c) => `<li><div><div class="t">${esc(c.title)}</div>
        <div class="meta">${fmt(c.createdAt)} 建立 · 第 ${c.handoff?.round || 1} 輪 ${st[c.handoff?.status] || ""} · ${c.participants.filter((p) => p.role !== "owner").map((p) => esc(p.name || p.label)).join("、") || "尚未邀請對方"}</div></div>
        <div class="row">${confirmDel === c.id ? `<span class="meta">確定刪除？條文、紀錄與圖片都會刪除</span><button class="btn sm bad" data-act="del-do" data-id="${c.id}">確定刪除</button><button class="btn sm" data-act="del-cancel">取消</button>`
          : `<a class="btn sm primary" href="/c/${c.id}">開啟</a><button class="btn sm" data-act="del" data-id="${c.id}">刪除</button>`}</div></li>`).join("") : `<li><span class="meta">還沒有合約，從上方建立第一份。</span></li>`}</ul>
      <div class="row" style="margin-bottom:40px"><button class="btn sm" data-act="logout">登出</button></div>`;
    $("create").addEventListener("submit", async (e) => {
      e.preventDefault(); if (busy) return; busy = true; draw();
      try {
        const title = $("ntitle").value.trim() || "合作契約書";
        const r = await adminApi("contracts", "POST", { title });
        store.set("ce:key:" + r.id, r.key);
        created = { title, link: `${location.origin}/c/${r.id}#k=${r.key}` };
        list = (await adminApi("contracts")).contracts;
      } catch (err) { toast(err.message); }
      busy = false; draw();
    });
  }
  document.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-act]"); if (!b) return;
    const a = b.dataset.act;
    if (a === "copy-created") copy(created.link, "已複製擁有者連結");
    if (a === "del") { confirmDel = b.dataset.id; draw(); }
    if (a === "del-cancel") { confirmDel = null; draw(); }
    if (a === "del-do") { try { await adminApi("contracts/" + b.dataset.id, "DELETE"); toast("已刪除"); } catch (e) { toast(e.message); } confirmDel = null; load(); }
    if (a === "logout") { store.set("ce:admin", null); pw = ""; list = null; draw(); }
  });
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
  peopleOpen: false, invited: null, nameOpen: false
};
const who = (id) => {
  if (!id) return "某人";
  if (id === S.uid) return "你";
  const p = S.participants.find((x) => x.id === id);
  return p ? (p.name || p.label || "對方") : "已停用的連結";
};
const roundNo = () => S.handoff?.round || 1;
const status = () => S.handoff?.status || "editing";
const docTitle = () => S.contract?.title || "合作契約書";
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
    if (o && o.status !== r.status && r.by === S.uid && r.reviewedBy !== S.uid) {
      if (r.status === "accepted") toast(`對方接受了你對〈${revTitle(r)}〉的${KIND[r.kind || "edit"]}`);
      if (r.status === "reverted") toast(`對方退回了你對〈${revTitle(r)}〉的${KIND[r.kind || "edit"]}`);
    }
  }
  const h = st.contract.handoff;
  if (h && h.by && h.by !== S.uid && (!S.handoff || h.at !== S.handoff.at)) {
    const m = h.note === "imported" ? "匯入了新的合約" : { review: "把合約交給你批改", reviewed: "批改完成，交回給你檢視", final: "同意定稿", editing: "開始了新一輪修改" }[h.status];
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
  ALLOWED_ATTR: ["colspan", "rowspan", "src", "alt"],
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
const pendingForMe = () => S.revs.filter((r) => r.status === "pending" && r.by !== S.uid);
const isNew = (r) => S.lastSeen != null && r.by !== S.uid && r.at > S.lastSeen;
const decidedNew = (r) => S.lastSeen != null && r.by === S.uid && r.reviewedAt && r.reviewedAt > S.lastSeen && r.reviewedBy !== S.uid;
const revTitle = (r) => r.titleAfter || r.titleBefore || r.clauseTitle || "條款";
const KIND = { edit: "修改", add: "新增條款", delete: "刪除條款", move: "調整位置" };
const canEditDoc = () => S.canWrite && !!S.uid;

/* ---------- render ---------- */
function render() { renderTurn(); renderHeader(); renderPeople(); renderNews(); renderTabs(); renderMain(); }

function renderTurn() {
  const el = $("turn");
  if (S.noAccess) { el.innerHTML = `<div class="stage"><span class="stage-dot"></span><div class="stage-text"><div class="stage-title">無法開啟這份合約</div><div class="stage-sub">${esc(S.noAccess)}</div></div></div>`; return; }
  if (!S.loaded.c) { el.innerHTML = `<div class="stage"><span class="stage-dot"></span><div class="stage-text"><div class="stage-title">${S.slow ? "暫時連不上伺服器" : "正在載入合約…"}</div><div class="stage-sub">${S.slow ? "請檢查網路連線，頁面會自動重試。" : "讀取條文、修改紀錄與目前進度。"}</div></div></div>`; return; }
  const st = status(), by = S.handoff?.by, n = roundNo();
  const todo = pendingForMe().length;
  const mineOpen = S.revs.filter((r) => r.status === "pending" && r.by === S.uid && (r.round || 1) === n).length;
  let title, sub, mine = false, acts = "";
  const copyBtn = `<button class="btn" data-act="copy">複製通知訊息</button>`;
  if (st === "editing") {
    title = `第 ${n} 輪 · 修改中`;
    sub = mineOpen ? `你這輪已改了 ${mineOpen} 處。改完後交給對方批改。` : "任何一方都可以直接修改條文。";
    if (todo) { sub = `對方有 ${todo} 處修改等你批改。`; mine = true; }
    acts = `<button class="btn primary" data-act="handoff-review">我改完了，交給對方批改</button>`;
  } else if (st === "review") {
    if (by === S.uid) { title = `第 ${n} 輪 · 已交給對方批改`; sub = "等待對方批改。每處修改的結果會出現在「修改紀錄」。"; acts = copyBtn; }
    else {
      mine = true;
      title = `輪到你批改：${who(by)} 已完成第 ${n} 輪修改`;
      sub = todo ? `還有 ${todo} 處待批改，逐條按「接受」或「退回」。` : "全部處理完了，可以交回對方檢視。";
      acts = `<button class="btn primary" data-act="handoff-reviewed" ${todo ? "disabled" : ""}>批改完成，交回對方檢視</button>`;
    }
  } else if (st === "reviewed") {
    const rs = S.revs.filter((r) => (r.round || 1) === n && r.by !== by);
    const ok = rs.filter((r) => r.status === "accepted").length, no = rs.filter((r) => r.status === "reverted").length;
    if (by === S.uid) { title = `第 ${n} 輪 · 已交回對方檢視`; sub = `你接受了 ${ok} 處、退回 ${no} 處。等待對方確認。`; acts = copyBtn; }
    else {
      mine = true; title = `${who(by)} 已批改完成，請檢視結果`;
      sub = `你的修改：接受 ${ok} 處、退回 ${no} 處。沒有異議就同意定稿，否則開始下一輪。`;
      acts = `<button class="btn good" data-act="final">同意定稿</button><button class="btn" data-act="next-round">開始下一輪修改</button>`;
    }
  } else {
    title = "雙方已確認定稿"; sub = `第 ${n} 輪定稿 · ${fmt(S.handoff?.at)} · 可以匯出 PDF`;
    acts = `<button class="btn" data-act="next-round">重新開啟修改</button>`;
  }
  el.innerHTML = `
    <div class="stage" data-mine="${mine ? 1 : 0}">
      ${st === "final" ? `<span class="seal" aria-hidden="true">定<br>稿</span>` : `<span class="stage-dot"></span>`}
      <div class="stage-text"><div class="stage-title">${esc(title)}</div><div class="stage-sub">${esc(sub)}</div></div>
    </div>
    <div class="actions">${acts}</div>`;
}

function renderHeader() {
  $("ctitle").textContent = S.loaded.c ? docTitle() : "合約共同編輯器";
  $("csource").textContent = S.contract?.source ? `匯入自 ${S.contract.source} · 雙方共同編輯` : "雙方共同編輯";
  const el = $("exportbar");
  if (!S.loaded.c || S.noAccess) { el.innerHTML = ""; return; }
  const imp = S.isAdmin && !S.importPreview ? `<button class="btn" data-act="import-pick" ${S.importing ? "disabled" : ""}>${S.importing ? "正在讀取 Word…" : "匯入 Word 合約"}</button>` : "";
  const people = !S.importPreview ? `<button class="btn" data-act="people">${S.isAdmin ? "邀請對方／成員" : "成員與我的連結"}</button>` : "";
  if (S.importPreview || !S.clauses.length) { el.innerHTML = imp + people; return; }
  const open = S.revs.filter((r) => r.status === "pending").length;
  const fin = status() === "final";
  if (S.exportAsk) {
    el.innerHTML = `<div class="warnline">還有 ${open} 處修改尚未批改。PDF 會依目前畫面上的條文（含未批改的修改）輸出，不會顯示刪除線或標記。</div>
      <div class="actions"><button class="btn primary" data-act="export-go">仍要匯出</button><button class="btn" data-act="export-cancel">取消</button></div>`;
    return;
  }
  const exp = `<button class="btn ${fin ? "primary" : ""}" data-act="export" ${S.exporting ? "disabled" : ""}>${S.exporting ? "正在產生 PDF…" : "匯出 PDF"}</button>`;
  el.innerHTML = `${exp}${imp}${people}<span class="hint">${fin ? "已定稿，可以匯出正式版本。" : "PDF 為 A4 直式，保留表格與格式，文字可選取與搜尋。"}</span>`;
}

function renderPeople() {
  const el = $("people");
  if (!S.loaded.c || S.noAccess) { el.innerHTML = ""; return; }
  if (S.nameOpen) {
    el.innerHTML = `<form class="panel" id="nameform"><h2>${S.me?.name ? "修改你的名字" : "歡迎！請先輸入你的名字"}</h2>
      <p>對方會在修改紀錄中看到這個名字${S.me?.label ? `（你的身分：${esc(S.me.label)}）` : ""}。</p>
      <div class="row"><div class="field grow"><label for="myname">你的名字或公司</label><input id="myname" maxlength="60" value="${esc(S.me?.name || "")}" required></div>
      <button class="btn primary" type="submit">儲存</button>${S.me?.name ? `<button class="btn" type="button" data-act="name-cancel">取消</button>` : ""}</div></form>`;
    $("nameform").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $("myname").value.trim(); if (!name) return;
      try { await act("me", { name }); S.nameOpen = false; render(); } catch {}
    });
    return;
  }
  if (!S.peopleOpen) { el.innerHTML = ""; return; }
  const ps = S.participants;
  el.innerHTML = `<section class="panel"><h2>成員與連結</h2>
    <ul class="plist2">${ps.map((p) => `<li><span><strong>${esc(p.name || "（尚未填名字）")}</strong> <span class="meta">${esc(p.label || "")}${p.id === S.uid ? " · 你" : ""}${p.lastSeen ? ` · 最後查看 ${fmt(p.lastSeen)}` : " · 尚未開啟"}</span></span>
      ${S.isAdmin && p.role !== "owner" ? `<button class="btn sm bad" data-act="revoke" data-id="${p.id}">停用連結</button>` : ""}</li>`).join("")}</ul>
    ${S.isAdmin ? `<form id="inviteform" class="row"><div class="field grow"><label for="ilabel">邀請誰？（例如：乙方 王小明）</label><input id="ilabel" maxlength="60" placeholder="乙方"></div><button class="btn primary" type="submit">產生專屬連結</button></form>
      ${S.invited ? `<div class="warnline">這是給「${esc(S.invited.label)}」的專屬連結，只會顯示這一次。請用 LINE 或 Email 傳給對方；拿到連結的人就能修改合約。</div><div class="linkbox">${esc(S.invited.link)}</div><div class="row"><button class="btn sm" data-act="copy-invite">複製連結</button></div>` : ""}` : ""}
    ${KEY ? `<div class="field"><label>你自己的專屬連結（換電腦或手機時用，請勿外流）</label><div class="linkbox">${esc(myLink())}</div></div>` : ""}
    <div class="row">${KEY ? `<button class="btn sm" data-act="copy-mine">複製我的連結</button>` : ""}<button class="btn sm" data-act="name-edit">修改我的名字</button><button class="btn sm" data-act="people">關閉</button></div>
  </section>`;
  $("inviteform")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const label = $("ilabel").value.trim() || "對方";
    try { const r = await act("invite", { label }); S.invited = { label, link: `${location.origin}/c/${CID}#k=${r.key}` }; render(); } catch {}
  });
}

function renderNews() {
  const el = $("news");
  if (S.lastSeen == null || !S.loaded.r || S.importPreview || S.noAccess) { el.innerHTML = ""; return; }
  const newRevs = S.revs.filter(isNew), decided = S.revs.filter(decidedNew);
  const hand = S.handoff && S.handoff.by && S.handoff.by !== S.uid && S.handoff.at > S.lastSeen;
  if (!newRevs.length && !decided.length && !hand) { el.innerHTML = ""; return; }
  const items = [];
  if (hand) {
    const m = S.handoff.note === "imported" ? `匯入了新的合約「${docTitle()}」` : { review: "把合約交給你批改", reviewed: "批改完成，交回給你檢視", final: "同意定稿", editing: "開始了新一輪修改" }[S.handoff.status] || "更新了進度";
    items.push(`${esc(who(S.handoff.by))} ${esc(m)}（${fmt(S.handoff.at)}）`);
  }
  if (newRevs.length) {
    const titles = [...new Set(newRevs.map(revTitle))];
    items.push(`對方改動了 ${newRevs.length} 處：${esc(titles.slice(0, 4).join("、"))}${titles.length > 4 ? " 等" : ""}`);
  }
  if (decided.length) {
    const ok = decided.filter((r) => r.status === "accepted").length, no = decided.filter((r) => r.status === "reverted").length;
    items.push(`你的修改有結果了：${ok ? `接受 ${ok} 處` : ""}${ok && no ? "、" : ""}${no ? `退回 ${no} 處` : ""}`);
  }
  el.innerHTML = `<section class="news" aria-label="自上次查看後的更新">
    <div class="row"><h2>自你上次查看（${fmt(S.lastSeen) || "首次開啟"}）後</h2>
    <div class="actions"><button class="btn sm" data-act="see-log">查看修改紀錄</button><button class="btn sm" data-act="mark-seen">標為已讀</button></div></div>
    <ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul></section>`;
}

function renderTabs() {
  if (S.importPreview || !S.loaded.c || S.noAccess) { $("tabs").innerHTML = ""; return; }
  const todo = pendingForMe().length;
  $("tabs").innerHTML = `
    <button class="tab" role="tab" aria-selected="${S.view === "contract"}" data-view="contract">合約內容</button>
    <button class="tab" role="tab" aria-selected="${S.view === "log"}" data-view="log">修改紀錄${todo ? `<span class="count" title="待你批改">${todo}</span>` : ""}</button>`;
}

function renderMain() {
  const main = $("main");
  const key = S.editing || (S.adding ? "new" : null);
  const keep = key ? document.getElementById("editor-" + key) : null;
  if (S.noAccess) { main.innerHTML = `<div class="sheet"><p class="empty">請向合約擁有者索取你的專屬連結。擁有者可以在合約頁面按「邀請對方／成員」產生。</p></div>`; return; }
  main.innerHTML = S.importPreview ? importHtml() : S.view === "contract" ? contractHtml() : logHtml();
  if (key) {
    const slot = document.getElementById("slot-" + key);
    if (slot) slot.replaceWith(keep || editorEl(key === "new" ? null : S.clauses.find((c) => c.id === key)));
  }
}

function contractHtml() {
  if (!S.loaded.c) return `<div class="sheet"><p class="empty">${S.slow ? "暫時讀不到條文，連線恢復後會自動顯示。" : "正在載入條文…"}</p></div>`;
  const vis = visible();
  if (!vis.length && !S.adding) return `<div class="sheet"><p class="empty">還沒有合約條文。${S.isAdmin ? "按上方「匯入 Word 合約」選擇 .docx 檔開始，或" : "可以"}<button class="linkbtn" data-act="add" data-after="">直接新增第一條</button>。</p></div>`;
  const slotNew = `<section class="clause added" data-state="edit"><div id="slot-new"></div></section>`;
  let body = "";
  vis.forEach((c, i) => { body += clauseHtml(c, i, vis); if (S.adding?.afterId === c.id) body += slotNew; });
  if (S.adding && !vis.some((c) => c.id === S.adding.afterId)) body += slotNew;
  const addEnd = canEditDoc() && !S.adding && vis.length ? `<div class="addrow"><button class="btn sm" data-act="add" data-after="${vis[vis.length - 1].id}">＋ 在最後新增條款</button></div>` : "";
  return `<div class="legend" style="margin-top:14px"><span><del class="d">刪除線</del> = 被刪掉的原文</span><span><ins class="d">底線</ins> = 新增的文字</span></div>
    <article class="sheet">${body}${addEnd}</article>`;
}

function clauseHtml(c, idx, vis) {
  if (S.editing === c.id) return `<section class="clause" data-state="edit"><div id="slot-${c.id}"></div></section>`;
  const pend = pendingOf(c.id);
  const theirs = pend.filter((r) => r.by !== S.uid), mineP = pend.filter((r) => r.by === S.uid);
  const kinds = new Set(pend.map((r) => r.kind || "edit"));
  const state = theirs.length ? "theirs" : mineP.length ? "mine" : "clean";
  const plain = S.plainView.has(c.id);
  const cur = clauseHtmlOf(c);
  const firstEdit = pend.find((r) => (r.kind || "edit") === "edit");
  const isAdd = kinds.has("add"), isDel = kinds.has("delete");
  const showDiff = firstEdit && !plain && !isAdd && !isDel;
  const titleHtml = showDiff && firstEdit.titleBefore !== c.title ? diffText(firstEdit.titleBefore, c.title) : esc(c.title);
  const bodyHtml = showDiff ? diffHtml(revHtml(firstEdit, "before"), cur) : cur;
  const authors = [...new Set(pend.map((r) => who(r.by)))].join("、");
  const what = [...kinds].map((k) => KIND[k]).join("、");
  let pill = "";
  if (theirs.length) pill = `<span class="pill theirs">待你批改</span>`;
  else if (mineP.length) pill = `<span class="pill mine">等待對方批改</span>`;
  if (isAdd) pill += `<span class="pill ok">新增條款</span>`;
  if (isDel) pill += `<span class="pill no">提議刪除</span>`;
  if (kinds.has("move")) pill += `<span class="pill plain">已調整位置</span>`;
  const fresh = pend.some(isNew) ? `<span class="newdot" title="新的修改"></span> ` : "";
  let review = "";
  if (S.confirm?.id === c.id) {
    const k = S.confirm.kind;
    const msg = k === "delete" ? "提議刪除這一條？對方接受後才會真正刪除，在那之前條文會以刪除線顯示。"
      : theirs.length ? "退回這條的改動：條文會恢復成改動前的樣子，紀錄會保留。" : "撤回你的改動：條文會恢復成改動前的樣子。";
    const label = k === "delete" ? "刪除" : theirs.length ? "退回" : "撤回";
    review = `<div class="confirm"><label for="reason-${c.id}"><strong>${label}</strong>：${msg}</label>
      ${k === "delete" ? "" : `<input id="reason-${c.id}" maxlength="500" placeholder="${theirs.length ? "退回理由（對方會看到，可留空）" : "撤回原因（可留空）"}">`}
      <div class="actions"><button class="btn bad" data-act="${k === "delete" ? "delete-do" : "revert-do"}" data-id="${c.id}">確認${label}</button><button class="btn" data-act="confirm-cancel">取消</button></div></div>`;
  } else if (pend.length) {
    review = `<div class="review">
      <span class="note">${esc(authors)} 於 ${fmt(pend[pend.length - 1].at)} ${esc(what)}${pend.length > 1 ? `（共 ${pend.length} 次）` : ""}。${firstEdit && !isAdd && !isDel ? (plain ? "目前只顯示修改後的條文。" : "下方標出了與原文的差異。") : ""}</span>
      ${firstEdit && !isAdd && !isDel ? `<button class="linkbtn" data-act="toggle-plain" data-id="${c.id}">${plain ? "顯示修改處" : "只看修改後"}</button>` : ""}
      ${theirs.length ? `<button class="btn sm good" data-act="accept" data-id="${c.id}">接受</button><button class="btn sm bad" data-act="revert-open" data-id="${c.id}">退回</button>` : ""}
      ${!theirs.length && mineP.length ? `<button class="btn sm" data-act="revert-open" data-id="${c.id}">撤回</button>` : ""}
    </div>`;
  }
  const tools = canEditDoc() && !isDel ? `<div class="tools">
      <button class="btn sm" data-act="edit" data-id="${c.id}">修改</button>
      <button class="btn icon" data-act="up" data-id="${c.id}" title="上移" aria-label="上移" ${idx === 0 ? "disabled" : ""}>↑</button>
      <button class="btn icon" data-act="down" data-id="${c.id}" title="下移" aria-label="下移" ${idx === vis.length - 1 ? "disabled" : ""}>↓</button>
      <button class="btn icon" data-act="add" data-after="${c.id}" title="在下方新增條款" aria-label="在下方新增條款">＋</button>
      <button class="btn icon" data-act="delete-open" data-id="${c.id}" title="刪除條款" aria-label="刪除條款">✕</button></div>` : "";
  const last = c.updatedAt ? `${who(c.updatedBy)} · ${fmt(c.updatedAt)}` : "";
  return `<section class="clause ${isAdd ? "added" : ""} ${isDel ? "deleted" : ""}" data-state="${state}" id="c-${c.id}">
    <div class="clause-head"><h3>${fresh}${titleHtml}</h3><div class="actions">${pill}${tools}</div></div>
    ${review}
    <div class="rich">${bodyHtml || `<p style="color:var(--muted)">（尚無內文）</p>`}</div>
    ${last ? `<div class="meta">最後修改：${esc(last)}</div>` : ""}
  </section>`;
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
    <label class="hint" for="et-${key}">${c ? "條款標題" : "新條款標題"}</label>
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
        <button type="button" data-cmd="image" title="插入圖片">圖片</button>
        <button type="button" data-cmd="removeFormat" title="清除格式">清除格式</button>
      </div>
      <div class="editable rich" id="eb-${key}" contenteditable="true" role="textbox" aria-multiline="true" aria-label="條文內容">${c ? clauseHtmlOf(c) : "<p><br></p>"}</div>
    </div>
    <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden>
    <div class="hint">可直接貼上 Word 內容，格式會保留。儲存後對方會看到你改了哪裡，原文也會保留。</div>
    <div class="warn" id="ew-${key}" hidden></div>
    <div class="actions"><button class="btn primary" data-act="save" data-id="${key}">${c ? "儲存修改" : "新增條款"}</button><button class="btn" data-act="cancel">取消</button></div>`;
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
    if (b.dataset.cmd === "table") document.execCommand("insertHTML", false, "<table><tbody><tr><td>　</td><td>　</td></tr><tr><td>　</td><td>　</td></tr></tbody></table><p><br></p>");
    else if (b.dataset.cmd === "image") { keepRange(); fileIn.click(); }
    else document.execCommand(b.dataset.cmd, false, null);
  });
  return box;
}

function logHtml() {
  const f = S.filter;
  const filters = [["todo", "待你批改"], ["mine", "我的修改"], ["all", "全部"], ["accepted", "已接受"], ["reverted", "已退回／撤回"]];
  let list = S.revs;
  if (f === "todo") list = list.filter((r) => r.status === "pending" && r.by !== S.uid);
  if (f === "mine") list = list.filter((r) => r.by === S.uid);
  if (f === "accepted") list = list.filter((r) => r.status === "accepted");
  if (f === "reverted") list = list.filter((r) => r.status === "reverted" || r.status === "withdrawn");
  const empty = { todo: "沒有待你批改的修改。", mine: "你還沒有修改過條文。", all: "還沒有任何修改。到「合約內容」點「修改」開始。", accepted: "還沒有被接受的修改。", reverted: "沒有被退回或撤回的修改。" }[f];
  return `<div class="filters" role="group" aria-label="篩選">${filters.map(([k, l]) => `<button class="chip" aria-pressed="${f === k}" data-filter="${k}">${l}</button>`).join("")}</div>
    <div class="log">${list.length ? list.map(entryHtml).join("") : `<p class="empty">${empty}</p>`}</div>`;
}

function entryHtml(r) {
  const mine = r.by === S.uid, kind = r.kind || "edit";
  let pill;
  if (r.status === "pending") pill = mine ? `<span class="pill mine">等待對方批改</span>` : `<span class="pill theirs">待你批改</span>`;
  else if (r.status === "accepted") pill = `<span class="pill ok">${esc(who(r.reviewedBy))}已接受 · ${fmt(r.reviewedAt)}</span>`;
  else if (r.status === "reverted") pill = `<span class="pill no">${esc(who(r.reviewedBy))}已退回 · ${fmt(r.reviewedAt)}</span>`;
  else pill = `<span class="pill plain">已撤回 · ${fmt(r.reviewedAt)}</span>`;
  const open = S.expanded.has(r.id);
  let title, body = "", canExpand = false;
  if (kind === "edit") {
    title = r.titleBefore !== r.titleAfter ? diffText(r.titleBefore, r.titleAfter) : esc(revTitle(r));
    body = `<div class="rich">${diffHtml(revHtml(r, "before"), revHtml(r, "after"))}</div>`; canExpand = true;
  } else if (kind === "add") { title = `新增條款：${esc(r.titleAfter)}`; body = `<div class="rich">${revHtml(r, "after")}</div>`; }
  else if (kind === "delete") { title = `刪除條款：${esc(r.titleBefore)}`; body = `<div class="rich gone">${revHtml(r, "before")}</div>`; }
  else { title = `調整位置：${esc(revTitle(r))}`; body = `<div class="meta">${r.orderAfter < r.orderBefore ? "往前移" : "往後移"}</div>`; }
  return `<article class="entry">
    <div class="entry-head">${isNew(r) || decidedNew(r) ? `<span class="newdot" title="新的"></span>` : ""}<strong>${title}</strong>${pill}</div>
    <div class="meta">${esc(who(r.by))} ${KIND[kind]} · ${fmt(r.at)} · 第 ${r.round || 1} 輪</div>
    ${r.note ? `<div class="review"><span class="note">${r.status === "withdrawn" ? "撤回原因" : "退回理由"}：${esc(r.note)}</span></div>` : ""}
    ${body}
    <div class="actions">
      ${canExpand ? `<button class="linkbtn" data-act="expand" data-id="${r.id}">${open ? "收起全文對照" : "看修改前／修改後全文"}</button>` : ""}
      ${r.status === "pending" && !mine ? `<button class="linkbtn" data-act="goto" data-id="${r.clauseId}">到條文批改</button>` : ""}
    </div>
    ${open && canExpand ? `<div class="compare"><div><h4>修改前</h4><div class="rich">${revHtml(r, "before")}</div></div><div><h4>修改後</h4><div class="rich">${revHtml(r, "after")}</div></div></div>` : ""}
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
    try { await act("clauses/add", { afterId: S.adding.afterId || null, title: title || "新條款", html }, "已新增條款，等待對方批改"); S.adding = null; } catch {}
    S.busy = false; render(); return;
  }
  const c = S.clauses.find((x) => x.id === key); if (!c) return;
  const newTitle = title || c.title;
  if (newTitle === c.title && html === normalize(clauseHtmlOf(c))) { S.editing = null; render(); return; }
  S.busy = true;
  try {
    await api(`clauses/${key}/edit`, { title: newTitle, html, baseRev: S.editBase.rev });
    S.editing = null; toast("已儲存，對方會看到你改了哪裡"); await refresh();
  } catch (e) {
    if (e.status === 409) {
      warn.hidden = false;
      warn.textContent = `${who(e.data?.clause?.updatedBy)} 在你編輯時也改動了這一條。為了不蓋掉對方的內容，這次沒有儲存。請先複製你的草稿，按「取消」後重新點「修改」。`;
    } else fail(e);
  }
  S.busy = false; render();
}
async function simple(path, body, msg) { if (S.busy) return; S.busy = true; try { await act(path, body, msg); } catch {} S.busy = false; S.confirm = null; render(); }

async function copyMsg() {
  const st = status(), n = roundNo(), name = docTitle();
  const msg = st === "review" ? `我已完成「${name}」第 ${n} 輪修改，請用你的專屬連結開啟合約批改，改過的地方都有標示。`
    : st === "reviewed" ? `「${name}」第 ${n} 輪已批改完成，請用你的專屬連結開啟合約檢視結果。`
    : `「${name}」有更新，請用你的專屬連結開啟合約查看。`;
  copy(msg, "已複製，貼到 LINE 或 Email 傳給對方");
}

/* ---------- Word import (keeps bold, italic, underline, lists, tables, images) ---------- */
const CLAUSE_RE = /^[\s　]*第[\s　]*[一二三四五六七八九十百千零〇兩\d０-９]+[\s　]*條/;
const TITLE_RE = /契約|合約|協議|同意書|備忘錄|承諾書|合作書/;
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
  const isStart = (el) => squash(el.textContent) && el.tagName !== "TABLE" && (hasCl ? CLAUSE_RE.test(el.textContent) : hasH ? isHead(el) : false);
  let title = fallbackTitle, i = els.findIndex(hasContent);
  if (i >= 0 && !isStart(els[i]) && !els[i].querySelector("img")) {
    const t = squash(els[i].textContent);
    if (t.length <= 30 && (isHead(els[i]) || TITLE_RE.test(t))) { title = t.replace(/\s+/g, ""); i++; }
  }
  const clauses = []; let cur = { title: "", parts: [] };
  const flush = () => {
    const body = cur.parts.join("");
    if (!cur.title && !textOf(body) && !/<img/i.test(body)) return;
    const txt = textOf(body);
    clauses.push({ title: cur.title || (!clauses.length && /立契約書人|立合約書人|甲方|委任人|出租人/.test(txt) ? "立契約書人" : clauses.length ? "其他" : "前言"), html: body });
  };
  for (const el of els.slice(Math.max(i, 0))) {
    if (isStart(el)) {
      flush();
      const raw = el.textContent;
      if (squash(raw).length <= 36 && !/[：:][\s　]*\S/.test(raw)) { cur = { title: squash(raw).replace(/[：:]$/, ""), parts: [] }; continue; }
      const m = raw.match(CLAUSE_RE);
      let end = m ? m[0].length : 0, t = m ? squash(m[0]).replace(/\s+/g, "") : "";
      const m2 = raw.slice(end).match(/^[\s　]*([^：:\n。]{1,15})[：:]/);
      if (m2) { t += "　" + m2[1].trim(); end += m2[0].length; }
      else { const m3 = raw.slice(end).match(/^[\s　、.．：:]*/); end += m3[0].length; }
      stripLeading(el, end);
      cur = { title: t || squash(raw).slice(0, 20), parts: hasContent(el) ? [el.outerHTML] : [] };
    } else if (hasContent(el) || el.tagName === "TABLE") cur.parts.push(el.outerHTML);
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
  S.importing = true; render();
  let imgFail = 0;
  try {
    if (!window.mammoth) await loadScript("https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js");
    const res = await window.mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, {
      styleMap: ["u => u", "strike => s"],
      convertImage: window.mammoth.images.imgElement(async (image) => {
        if (/^image\/(png|jpe?g|gif|webp)$/.test(image.contentType)) {
          try { return { src: await uploadImage(b64ToBlob(await image.read("base64"), image.contentType)) }; } catch (e) { console.warn(e); }
        }
        imgFail++; return { src: "", alt: "（圖片未能匯入）" };
      })
    });
    const parsed = splitRich(res.value, file.name.replace(/\.docx$/i, ""));
    if (!parsed.clauses.length) toast("這個 Word 檔裡沒有讀到內容。");
    else { S.importPreview = { ...parsed, source: file.name, imgFail }; S.view = "contract"; }
  } catch (e) { console.error(e); toast("讀不到這個 Word 檔，請確認它是未加密的 .docx 檔。"); }
  S.importing = false; render(); window.scrollTo({ top: 0 });
}
function importHtml() {
  const p = S.importPreview;
  const how = { clause: `依「第○條」切成 ${p.clauses.length} 個條款。`, heading: `依 Word 標題切成 ${p.clauses.length} 個段落。`, none: "沒有找到「第○條」或 Word 標題，整份會先成為一個條款；匯入後可以用「＋」新增條款，把內容分開。" }[p.split];
  const replacing = S.clauses.length ? `<div class="dangerline">匯入後會取代目前的「${esc(docTitle())}」：現有條款和 ${S.revs.length} 筆修改紀錄會刪除，進度回到第 1 輪。需要的話請先匯出 PDF 保存。</div>` : "";
  const imgNote = p.imgFail ? `<div class="warnline">有 ${p.imgFail} 張圖片格式或大小無法匯入（例如 Word 的 EMF 向量圖），請匯入後用「修改」→「圖片」重新加入。</div>` : "";
  return `<div class="sheet"><div class="import-panel">
    <h2 style="margin:0;font-size:18px">確認匯入：${esc(p.source)}</h2>
    <p class="lead">${how} 粗體、斜體、底線、清單、表格與圖片會保留。</p>
    <div><label for="imp-title">合約名稱</label><input type="text" id="imp-title" maxlength="200" value="${esc(p.title)}"></div>
    <ol class="plist">${p.clauses.map((c) => `<li><span class="pt">${esc(c.title)}</span><span class="pp">${esc(textOf(c.html).slice(0, 80)) || "（無內文）"}</span></li>`).join("")}</ol>
    ${imgNote}${replacing}
    <div class="actions"><button class="btn primary" data-act="import-go" ${S.importing ? "disabled" : ""}>${S.importing ? "匯入中…" : "確認匯入"}</button><button class="btn" data-act="import-cancel">取消</button></div>
  </div></div>`;
}
async function doImport() {
  const p = S.importPreview; if (!p || S.importing) return;
  const title = ($("imp-title")?.value || "").trim() || p.title;
  S.importing = true; render();
  try { await act("import", { title, source: p.source, clauses: p.clauses }, `已匯入「${title}」，共 ${p.clauses.length} 個條款`); S.importPreview = null; } catch {}
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
async function exportPdf() {
  if (S.exporting) return;
  S.exporting = true; S.exportAsk = false; render();
  const stage = $("pdf-stage");
  let textLayer = true;
  try {
    if (!window.html2canvas) await loadScript("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js");
    if (!window.jspdf) await loadScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");
    const fin = status() === "final";
    const today = new Date().toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" });
    stage.innerHTML = `<div class="pb ph">${fin ? `<span class="seal">定<br>稿</span>` : ""}<h2>${esc(docTitle())}</h2><p>${fin ? `第 ${roundNo()} 輪定稿` : `第 ${roundNo()} 輪草稿`} · 匯出日期 ${esc(today)}</p></div>` +
      live().map((c) => `<div class="pb"><h3>${esc(c.title)}</h3><div class="rich">${clauseHtmlOf(c)}</div></div>`).join("");
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
    pdf.setFont("helvetica");
    for (let i = 1; i <= n; i++) { pdf.setPage(i); pdf.setFontSize(9); pdf.setTextColor(120); pdf.text(`${i} / ${n}`, 105, 297 - 10, { align: "center" }); }
    pdf.setProperties({ title: docTitle(), subject: fin ? "定稿" : "草稿" });
    const d = new Date(), stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    saveBlob(`${docTitle().replace(/[\\/:*?"<>|]/g, "")}_${fin ? "定稿" : "草稿"}_${stamp}.pdf`, pdf.output("blob"));
    toast(textLayer ? "PDF 已下載" : "PDF 已下載（這次未能加入可搜尋的文字層）");
  } catch (e) { console.error(e); toast("PDF 產生失敗，請重新整理頁面後再試一次"); }
  stage.innerHTML = ""; S.exporting = false; render();
}

/* ---------- events ---------- */
$("docx-input").addEventListener("change", (e) => pickDocx(e.target.files[0]));
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
    case "delete-do": simple(`clauses/${id}/delete`, {}, "已提議刪除，對方接受後才會正式刪除"); break;
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
    case "handoff-review": simple("handoff", { status: "review", round: roundNo() }, "已交給對方批改。可用「複製通知訊息」告訴對方。"); break;
    case "handoff-reviewed": simple("handoff", { status: "reviewed", round: roundNo() }, "已交回對方檢視。"); break;
    case "final": simple("handoff", { status: "final", round: roundNo() }, "已同意定稿，可以匯出 PDF。"); break;
    case "next-round": simple("handoff", { status: "editing", round: roundNo() + 1 }, "已開始新一輪修改。"); break;
    case "export": if (S.revs.some((r) => r.status === "pending")) { S.exportAsk = true; render(); } else exportPdf(); break;
    case "export-go": exportPdf(); break;
    case "export-cancel": S.exportAsk = false; render(); break;
    case "import-pick": $("docx-input").value = ""; $("docx-input").click(); break;
    case "import-go": doImport(); break;
    case "import-cancel": S.importPreview = null; render(); break;
    case "people": S.peopleOpen = !S.peopleOpen; S.invited = null; render(); break;
    case "copy-invite": copy(S.invited.link, "已複製，請傳給對方"); break;
    case "copy-mine": copy(myLink(), "已複製你的專屬連結"); break;
    case "revoke": simple(`participants/${id}/remove`, {}, "已停用這條連結"); break;
    case "name-edit": S.nameOpen = true; render(); break;
    case "name-cancel": S.nameOpen = false; render(); break;
  }
});
try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch {}

render();
if (!KEY && !ADMIN) { S.noAccess = "這個網址缺少專屬連結的金鑰。請用合約擁有者傳給你的完整連結開啟。"; render(); }
else refresh().then(() => { if (!S.noAccess) { startPolling(); api("seen", {}).catch(() => {}); } });
}
})();
