// 首頁「契約案件」：登入管理密碼、新增／編輯名稱／刪除契約。
import { adminApi } from "../api/client.js";
import { $, esc, toast } from "../core/dom.js";
import { fmt } from "../core/format.js";
import { store } from "../core/storage.js";
import { loadTemplates } from "../lib/templates.js";
import { tplPicker } from "../ui/template-picker.js";

export function startHome() {
  let pw = store.get("ce:admin") || "";
  let tpls = null, list = null, busy = false, creating = false, renaming = null, confirmDel = null, q = "";
  const STATUS = { editing: ["修訂中", "plain"], review: ["審閱中", "theirs"], reviewed: ["待檢視", "mine"], final: ["已定稿", "ok"] };
  $("lede").textContent = "各契約案分別管理：新增契約後進入該案，即可匯入契約草案（Word）、邀請他方，並進行條文修訂與審閱。";
  $("ctitle").textContent = "契約案件";
  $("tabs").hidden = true;
  $("csource").textContent = "合約共同編輯器";
  async function load() {
    try { list = (await adminApi(pw, "contracts")).contracts; store.set("ce:admin", pw); }
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
    const b = ev.target.closest("[data-act]"); if (!b) return;
    const a = b.dataset.act;
    if (a === "new" && !tpls) loadTemplates().then((d) => { tpls = d; if (creating) redrawKeepingInput(); }).catch((e) => toast(e.message));
    if (a === "new") { creating = true; renaming = null; confirmDel = null; draw(); }
    if (a === "new-cancel") { creating = false; draw(); }
    if (a === "rename") { renaming = b.dataset.id; confirmDel = null; draw(); }
    if (a === "rename-cancel") { renaming = null; draw(); }
    if (a === "del") { confirmDel = b.dataset.id; renaming = null; draw(); }
    if (a === "del-cancel") { confirmDel = null; draw(); }
    if (a === "del-do") { try { await adminApi(pw, "contracts/" + b.dataset.id, "DELETE"); toast("已刪除"); } catch (e) { toast(e.message); } confirmDel = null; load(); }
    if (a === "logout") { store.set("ce:admin", null); pw = ""; list = null; creating = false; draw(); }
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && list) load(); });
  pw ? load() : draw();
}
