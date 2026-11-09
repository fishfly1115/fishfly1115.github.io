import { adminApi } from "../api/client.js";
import { $, esc, toast } from "../core/dom.js";
import { fmt } from "../core/format.js";
import { store } from "../core/storage.js";
import { loadTemplates } from "../lib/templates.js";
import { tplPicker } from "../ui/template-picker.js";

/**
 * 首頁「契約案件」
 * 頁面目的：管理所有契約案，進入要處理的契約
 * 使用者：機關承辦人（持有管理密碼）
 * 主要任務：1. 找到並開啟有待審閱修訂的契約 2. 新增契約
 * 最重要資料：契約案件列表（佔工作區最大面積）
 */
export function startHome() {
  let pw = store.get("ce:admin") || "";
  let tpls = null, list = null, busy = false, creating = false, renaming = null, confirmDel = null, q = "", rowMenu = null;
  let only = store.get("ce:home:filter") || "all";
  const STATUS = { editing: ["修訂中", "plain"], review: ["審閱中", "theirs"], reviewed: ["待確認", "mine"], final: ["已定稿", "ok"] };
  $("csource").textContent = "";
  $("tabs").hidden = true;
  async function load() {
    try { list = (await adminApi(pw, "contracts")).contracts; store.set("ce:admin", pw); }
    catch (e) { if (e.status === 401) { list = null; store.set("ce:admin", null); pw = ""; } toast(e.message); }
    draw();
  }
  function drawTurn() {
    $("turn").innerHTML = list ? `<div class="grow"></div><div class="actions"><button class="btn ghost" data-act="logout">登出</button></div>` : "";
  }
  function drawHeader() {
    document.querySelector("header.top").hidden = !list;
    if (!list) return;
    $("ctitle").textContent = "契約案件";
    const pending = list.filter((c) => c.pendingCount).length;
    $("exportbar").innerHTML = `
      <div class="seg" role="group" aria-label="篩選">
        <button data-act="filter" data-v="all" aria-pressed="${only === "all"}">全部 <span class="n">${list.length}</span></button>
        <button data-act="filter" data-v="pending" aria-pressed="${only === "pending"}">有待審閱 <span class="n">${pending}</span></button>
      </div>
      ${list.length > 4 ? `<input id="q" class="inp search" type="search" value="${esc(q)}" placeholder="搜尋契約名稱、案號或他方" aria-label="搜尋契約">` : ""}
      <div class="grow"></div>
      <button class="btn primary" data-act="new">新增契約</button>`;
  }
  function row(c) {
    const [st, cls] = STATUS[c.handoff?.status] || STATUS.editing;
    const others = c.participants.filter((p) => p.role !== "owner").map((p) => p.name || p.label);
    if (renaming === c.id) return `<tr class="editing"><td colspan="6"><form class="row" data-form="rename" data-id="${c.id}">
        <div class="field grow"><label for="rn-${c.id}">契約名稱</label><input id="rn-${c.id}" maxlength="200" value="${esc(c.title)}" required></div>
        <div class="field" style="flex:0 1 200px"><label for="rc-${c.id}">案號</label><input id="rc-${c.id}" maxlength="100" value="${esc(c.caseNo || "")}"></div>
        <div class="row" style="align-self:end"><button class="btn" type="button" data-act="rename-cancel">取消</button><button class="btn primary" type="submit" ${busy ? "disabled" : ""}>儲存</button></div></form></td></tr>`;
    if (confirmDel === c.id) return `<tr class="editing danger"><td colspan="6"><div class="row">
        <div class="grow"><strong>刪除「${esc(c.title)}」？</strong><div class="meta-s">條文、修訂紀錄與圖片都會刪除，無法復原</div></div>
        <button class="btn" data-act="del-cancel">取消</button><button class="btn danger" data-act="del-do" data-id="${c.id}">刪除</button></div></td></tr>`;
    return `<tr>
      <td class="c-title"><a class="t" href="/c/${c.id}">${esc(c.title)}</a><div class="meta-s">${c.caseNo ? `案號 ${esc(c.caseNo)} · ` : ""}${c.clauseCount ? `${c.clauseCount} 條` : "尚無條文"}</div></td>
      <td data-label="狀態"><span class="pill ${cls}">${st}</span><span class="meta-s"> 第 ${c.handoff?.round || 1} 輪</span></td>
      <td data-label="待審閱" class="num">${c.pendingCount ? `<span class="pill theirs">${c.pendingCount} 處</span>` : `<span class="meta-s">—</span>`}</td>
      <td data-label="他方" class="c-other">${others.length ? esc(others.join("、")) : `<span class="meta-s">尚未邀請</span>`}</td>
      <td data-label="更新時間" class="num"><span class="meta-s">${fmt(c.updatedAt)}</span></td>
      <td class="c-act"><div class="menu-wrap"><button class="btn icon ghost" data-act="row-menu" data-id="${c.id}" aria-label="更多動作" aria-haspopup="menu" aria-expanded="${rowMenu === c.id}">⋯</button>
        ${rowMenu === c.id ? `<div class="menu" role="menu"><button role="menuitem" data-act="rename" data-id="${c.id}"><strong>編輯名稱與案號</strong></button><button role="menuitem" class="danger" data-act="del" data-id="${c.id}"><strong>刪除契約</strong></button></div>` : ""}</div></td>
    </tr>`;
  }
  // 範本在使用者輸入時才載入完成：重畫表單但保留已輸入的內容
  function redrawKeepingInput() {
    const keep = ["ntitle", "ncase", "nrole"].map((id) => [id, $(id)?.value]);
    const focused = document.activeElement?.id;
    draw();
    keep.forEach(([id, v]) => { if (v != null && $(id)) $(id).value = v; });
    if (focused && $(focused)) $(focused).focus();
  }
  function draw() {
    drawTurn();
    drawHeader();
    const main = $("main");
    if (!list) {
      main.innerHTML = `<form class="login" data-form="login">
        <div class="brand big"><span class="brand-mark" aria-hidden="true">約</span><span class="brand-name">合約共同編輯器</span></div>
        <p>機關與廠商共同修訂採購契約。他方以專屬連結進入契約，不需要密碼。</p>
        <div class="field"><label for="pw">管理密碼</label><input id="pw" type="password" autocomplete="current-password" required></div>
        <button class="btn primary block" type="submit">登入</button></form>`;
      $("pw").focus();
      return;
    }
    const kw = q.trim().toLowerCase();
    const shown = list.filter((c) => (only !== "pending" || c.pendingCount)
      && (!kw || c.title.toLowerCase().includes(kw) || (c.caseNo || "").toLowerCase().includes(kw) || c.participants.some((p) => (p.name || p.label || "").toLowerCase().includes(kw))));
    const empty = !list.length
      ? `<div class="empty"><p>尚無契約案件</p><button class="btn primary" data-act="new">新增契約</button></div>`
      : `<div class="empty"><p>沒有符合條件的契約</p><button class="btn" data-act="clear-filter">清除篩選</button></div>`;
    main.innerHTML = `
      ${creating ? `<form class="panel" data-form="create"><div class="row"><h2>新增契約</h2><div class="grow"></div><button class="btn icon ghost" type="button" data-act="new-cancel" aria-label="關閉">✕</button></div>
        <div class="field"><label>契約範本</label>${tpls ? tplPicker(tpls, "blank") : `<span class="skel" style="height:64px"></span>`}<p class="meta-s" id="tplnotice" hidden>${esc(tpls?.notice || "")}範本中【　】為待填欄位。</p></div>
        <div class="field"><label for="ntitle">契約名稱（案名）</label><input id="ntitle" maxlength="200" placeholder="例如：115 年度資訊系統維護採購案" required></div>
        <div class="row"><div class="field grow"><label for="ncase">案號</label><input id="ncase" maxlength="100" placeholder="例如：115-A-001（選填）"></div>
        <div class="field grow"><label for="nrole">本方身分</label><select id="nrole" class="inp"><option>機關（甲方）</option><option>廠商（乙方）</option></select></div></div>
        <div class="row"><div class="grow"></div><button class="btn" type="button" data-act="new-cancel">取消</button><button class="btn primary" type="submit" ${busy ? "disabled" : ""}>${busy ? "建立中…" : "建立並開啟"}</button></div></form>` : ""}
      ${shown.length ? `<div class="card table-card"><table class="ctable">
        <thead><tr><th>契約名稱</th><th>狀態</th><th class="num">待審閱</th><th>他方</th><th class="num">更新時間</th><th><span class="sr">動作</span></th></tr></thead>
        <tbody>${shown.map(row).join("")}</tbody></table></div>` : empty}`;
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
        const r = await adminApi(pw, "contracts", "POST", { title, caseNo, ownerLabel });
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
      try { await adminApi(pw, `contracts/${id}/rename`, "POST", { title, caseNo }); renaming = null; toast("已更新"); await load(); } catch (err) { toast(err.message); }
      busy = false; draw();
    }
  });
  document.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-act]");
    if (rowMenu && !ev.target.closest(".menu-wrap")) { rowMenu = null; if (!b) draw(); }
    if (!b) return;
    const a = b.dataset.act;
    if (a === "rename" || a === "del") rowMenu = null;
    if (a === "new" && !tpls) loadTemplates().then((d) => { tpls = d; if (creating) redrawKeepingInput(); }).catch((e) => toast(e.message));
    if (a === "new") { creating = true; renaming = null; confirmDel = null; draw(); }
    if (a === "new-cancel") { creating = false; draw(); }
    if (a === "rename") { renaming = b.dataset.id; confirmDel = null; draw(); }
    if (a === "rename-cancel") { renaming = null; draw(); }
    if (a === "del") { confirmDel = b.dataset.id; renaming = null; draw(); }
    if (a === "del-cancel") { confirmDel = null; draw(); }
    if (a === "del-do") { try { await adminApi(pw, "contracts/" + b.dataset.id, "DELETE"); toast("已刪除契約"); } catch (e) { toast(e.message); } confirmDel = null; load(); }
    if (a === "row-menu") { rowMenu = rowMenu === b.dataset.id ? null : b.dataset.id; draw(); return; }
    if (a === "filter") { only = b.dataset.v; store.set("ce:home:filter", only === "all" ? null : only); draw(); }
    if (a === "clear-filter") { only = "all"; q = ""; store.set("ce:home:filter", null); draw(); }
    if (a === "logout") { store.set("ce:admin", null); pw = ""; list = null; creating = false; draw(); }
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && list) load(); });
  pw ? load() : draw();
}
