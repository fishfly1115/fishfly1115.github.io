/**
 * 首頁「契約案件」列表
 * 頁面目的：找到要處理的契約並開啟
 * 使用者：機關承辦人（持有管理密碼）
 * 主要任務：1. 開啟輪到您處理的契約 2. 新增契約
 * 最重要資料：契約列表（統計卡同時是篩選器）
 */
import { $, esc, toast } from "../../core/dom.js";
import { fmt } from "../../core/format.js";
import { store } from "../../core/storage.js";
import { icon } from "../../ui/icons.js";
import { H, admin } from "./state.js";

const SIDE = { A: "甲方", B: "乙方" };
// 依「輪到誰」分組
const BUCKETS = [["mine", "待您處理", "他方修訂待審閱、待確認結果"], ["other", "等待他方", "已送他方審閱或確認"], ["editing", "修訂中", "雙方仍在修訂"], ["final", "已定稿", "可匯出定稿本"]];
const STATUS = { editing: ["修訂中", "plain"], review: ["審閱中", "theirs"], reviewed: ["待確認", "mine"], final: ["已定稿", "ok"] };
const turnOf = (c) => c.turn || (c.handoff?.status === "final" ? "none" : c.pendingCount ? "me" : "both");
const bucketOf = (c) => ({ me: "mine", other: "other", both: "editing", none: "final" })[turnOf(c)];

// 第一次載入時，有待處理的契約就預設顯示「待您處理」
export function defaultFilter() {
  if (!H.only) H.only = H.list.some((c) => bucketOf(c) === "mine") ? "mine" : "all";
}

function headerHtml() {
  const { list, only, q } = H;
  const count = (k) => list.filter((c) => bucketOf(c) === k).length;
  const label = BUCKETS.find(([k]) => k === only)?.[1];
  return `
    <div class="home-head"><h1>契約案件</h1><div class="grow"></div><button class="btn primary" data-act="new">${icon("add", { size: 18 })}新增契約</button></div>
    <div class="stats-grid" role="group" aria-label="依處理狀態篩選">${BUCKETS.map(([k, name, sub]) => `
      <button class="stat" data-act="filter" data-v="${only === k ? "all" : k}" data-tone="${k}" aria-pressed="${only === k}">
        <span class="stat-label"><span class="dot"></span>${name}</span>
        <span class="stat-n">${count(k)}<small>件</small></span>
        <span class="stat-sub">${sub}</span></button>`).join("")}</div>
    <div class="filterbar">${label ? `<span class="fchip">篩選：${label}<button data-act="clear-filter" aria-label="清除篩選">${icon("close", { size: 14 })}</button></span><button class="linkbtn" data-act="clear-filter">清除篩選</button>` : `<span class="meta-s">全部 ${list.length} 件</span>`}
      <div class="grow"></div>
      ${list.length > 4 ? `<input id="q" class="inp search" type="search" value="${esc(q)}" placeholder="搜尋契約名稱、案號或他方" aria-label="搜尋契約">` : ""}</div>`;
}

function rowHtml(c) {
  const [st, cls] = STATUS[c.handoff?.status] || STATUS.editing;
  const others = c.participants.filter((p) => p.role !== "owner").map((p) => p.name || p.label);
  if (H.renaming === c.id) return `<tr class="editing"><td colspan="6"><form class="row" data-form="rename" data-id="${c.id}">
      <div class="field grow"><label for="rn-${c.id}">契約名稱</label><input id="rn-${c.id}" maxlength="200" value="${esc(c.title)}" required></div>
      <div class="field" style="flex:0 1 200px"><label for="rc-${c.id}">案號</label><input id="rc-${c.id}" maxlength="100" value="${esc(c.caseNo || "")}"></div>
      <div class="row" style="align-self:end"><button class="btn" type="button" data-act="rename-cancel">取消</button><button class="btn primary" type="submit" ${H.busy ? "disabled" : ""}>儲存</button></div></form></td></tr>`;
  if (H.confirmDel === c.id) return `<tr class="editing danger"><td colspan="6"><div class="row">
      <div class="grow"><strong>刪除「${esc(c.title)}」？</strong><div class="meta-s">條文、修訂紀錄與圖片都會刪除，無法復原</div></div>
      <button class="btn" data-act="del-cancel">取消</button><button class="btn danger" data-act="del-do" data-id="${c.id}">刪除</button></div></td></tr>`;
  return `<tr class="${turnOf(c) === "me" ? "my-turn" : ""}">
    <td class="c-title"><a class="t" href="/c/${c.id}">${esc(c.title)}</a><div class="meta-s">${c.caseNo ? `案號 ${esc(c.caseNo)} · ` : ""}${c.clauseCount ? `${c.clauseCount} 條` : "尚無條文"}</div></td>
    <td data-label="狀態"><span class="pill ${cls}">${st}</span><span class="meta-s"> 第 ${c.handoff?.round || 1} 輪</span></td>
    <td data-label="輪到" class="c-turn">${turnHtml(c)}</td>
    <td data-label="他方" class="c-other">${others.length ? esc(others.join("、")) : `<span class="meta-s">尚未邀請</span>`}</td>
    <td data-label="更新時間" class="num"><span class="meta-s">${fmt(c.updatedAt)}</span></td>
    <td class="c-act"><div class="menu-wrap"><button class="btn icon ghost" data-act="row-menu" data-id="${c.id}" aria-label="更多動作" aria-haspopup="menu" aria-expanded="${H.rowMenu === c.id}">${icon("more")}</button>
      ${H.rowMenu === c.id ? `<div class="menu" role="menu"><button role="menuitem" data-act="rename" data-id="${c.id}"><strong>編輯名稱與案號</strong></button><button role="menuitem" class="danger" data-act="del" data-id="${c.id}"><strong>刪除契約</strong></button></div>` : ""}</div></td>
  </tr>`;
}

function turnHtml(c) {
  const t = turnOf(c), mine = c.ownerSide || "A", other = mine === "A" ? "B" : "A";
  if (t === "me") return `<strong class="turn-me">您（${SIDE[mine]}）</strong>${c.pendingForMe ? `<div class="meta-s">${c.pendingForMe} 處待審閱</div>` : ""}`;
  if (t === "other") return `<span>${SIDE[other]}</span>`;
  if (t === "both") return `<span class="meta-s">雙方</span>`;
  return `<span class="meta-s">—</span>`;
}

function tableHtml() {
  const kw = H.q.trim().toLowerCase();
  const shown = H.list.filter((c) => (H.only === "all" || bucketOf(c) === H.only)
    && (!kw || c.title.toLowerCase().includes(kw) || (c.caseNo || "").toLowerCase().includes(kw) || c.participants.some((p) => (p.name || p.label || "").toLowerCase().includes(kw))));
  if (!shown.length) return !H.list.length
    ? `<div class="empty"><p>尚無契約案件</p><button class="btn primary" data-act="new">新增契約</button></div>`
    : `<div class="empty"><p>沒有符合條件的契約</p><button class="btn" data-act="clear-filter">清除篩選</button></div>`;
  return `<div class="card table-card"><table class="ctable">
    <thead><tr><th>契約名稱</th><th>狀態</th><th>輪到</th><th>他方</th><th class="num">更新時間</th><th><span class="sr">動作</span></th></tr></thead>
    <tbody>${shown.map(rowHtml).join("")}</tbody></table></div>`;
}

export const listScreen = {
  header: headerHtml,
  html: tableHtml,
  after({ draw }) {
    if (H.renaming) $("rn-" + H.renaming)?.focus();
    // 搜尋：重繪後保留游標位置
    $("q")?.addEventListener("input", (e) => {
      H.q = e.target.value; const pos = e.target.selectionStart; draw();
      const el = $("q"); el.focus(); el.setSelectionRange(pos, pos);
    });
  },
  actions: {
    filter: (el, { draw }) => { H.only = el.dataset.v; store.set("ce:home:filter", H.only); draw(); },
    "clear-filter": (el, { draw }) => { H.only = "all"; H.q = ""; store.set("ce:home:filter", "all"); draw(); },
    "row-menu": (el, { draw }) => { H.rowMenu = H.rowMenu === el.dataset.id ? null : el.dataset.id; draw(); },
    rename: (el, { draw }) => { Object.assign(H, { renaming: el.dataset.id, confirmDel: null, rowMenu: null }); draw(); },
    "rename-cancel": (el, { draw }) => { H.renaming = null; draw(); },
    del: (el, { draw }) => { Object.assign(H, { confirmDel: el.dataset.id, renaming: null, rowMenu: null }); draw(); },
    "del-cancel": (el, { draw }) => { H.confirmDel = null; draw(); },
    "del-do": async (el, { load }) => {
      try { await admin("contracts/" + el.dataset.id, "DELETE"); toast("已刪除契約"); } catch (e) { toast(e.message); }
      H.confirmDel = null; load();
    }
  },
  forms: {
    rename: async (form, { draw, load }) => {
      const id = form.dataset.id, title = $("rn-" + id).value.trim(), caseNo = $("rc-" + id).value.trim(); if (!title) return;
      H.busy = true; draw();
      try { await admin(`contracts/${id}/rename`, "POST", { title, caseNo }); H.renaming = null; toast("已更新"); await load(); } catch (err) { toast(err.message); }
      H.busy = false; draw();
    }
  }
};
