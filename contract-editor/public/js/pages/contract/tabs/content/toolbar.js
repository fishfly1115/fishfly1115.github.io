// 「契約內容」頁的工具列（固定在頂端）：左邊是格式按鈕（像 Word，點進條文後可用），
// 右邊是這一頁的操作：主要按鈕（交給他方等下一步）、次要按鈕「匯出」，其餘收進「⋯ 更多」選單。
import { $ } from "../../../../core/dom.js";
import { Fields } from "../../../../lib/fields.js";
import { icon } from "../../../../ui/icons.js";
import { S } from "../../context.js";
import { contentPrimary } from "../../shell/progress.js";
import { zoomLabel } from "./paper.js";
import { canEditDoc, visible } from "../../state.js";

// 格式按鈕：[指令, 圖示, 名稱]；null 為分隔線；表格的增刪列欄收在「表格」選單
const FORMAT = [
  ["undo", "undo", "復原（Ctrl+Z）"], ["redo", "redo", "重做（Ctrl+Y）"],
  null,
  ["bold", "bold", "粗體"], ["italic", "italic", "斜體"], ["underline", "underline", "底線"], ["strikeThrough", "strike", "刪除線"],
  null,
  ["insertOrderedList", "listNumbered", "編號清單"], ["insertUnorderedList", "listBulleted", "項目清單"],
  ["outdent", "outdent", "減少縮排"], ["indent", "indent", "增加縮排"],
  null,
  ["table-menu", "table", "表格"],
  null,
  ["image", "image", "插入圖片"], ["removeFormat", "clearFormat", "清除格式"]
];

export function renderToolbar() {
  const el = $("toolbar");
  const has = S.clauses.length > 0;
  const outlineBtn = S.clauses.length > 1 ? `<button class="btn icon only-narrow" data-act="outline-toggle" aria-expanded="${S.outlineOpen}" aria-label="條文目錄" title="條文目錄">${icon("toc", { size: 18 })}</button>` : "";
  const primary = has ? contentPrimary() : "";
  // 定稿後主要按鈕就是「匯出定稿本」，不再重複次要的「匯出」
  const exportBtn = has && !primary.includes("export-open") ? `<button class="btn" data-act="export-open">${icon("download", { size: 18 })}匯出</button>` : "";
  const zoom = has ? `<div class="zoom" role="group" aria-label="縮放"><button type="button" data-act="zoom-out" aria-label="縮小" title="縮小">${icon("remove", { size: 16 })}</button><button type="button" data-act="zoom-fit" id="zoom-label" title="符合頁寬">${zoomLabel()}</button><button type="button" data-act="zoom-in" aria-label="放大" title="放大">${icon("add", { size: 16 })}</button></div>` : "";
  el.innerHTML = `${outlineBtn}${has && canEditDoc() ? ribbon() : ""}<div class="grow"></div>${zoom}<div class="pb-acts">${exportBtn}${primary}${moreMenu(has && !primary.includes("export-open"))}</div>`;
  // 表格選單：格式按鈕列可左右滑動（會裁切內容），選單改為固定定位顯示在按鈕下方
  const tm = el.querySelector(".ribbon .menu"), tb = el.querySelector('.ribbon [data-cmd="table-menu"]');
  if (tm && tb) {
    const r = tb.getBoundingClientRect();
    Object.assign(tm.style, { position: "fixed", top: r.bottom + 4 + "px" });
    tm.style.left = Math.max(8, Math.min(r.left, document.documentElement.clientWidth - tm.offsetWidth - 8)) + "px"; // 不超出視窗右緣
  }
}

// 格式按鈕：點進條文後才能使用；旁邊顯示儲存狀態
function ribbon() {
  const off = !S.editing ? "disabled" : "";
  const btns = FORMAT.map((b) => !b ? `<span class="rb-sep" aria-hidden="true"></span>`
    : b[0] === "table-menu" ? tableMenu(off)
    : `<button type="button" data-cmd="${b[0]}" title="${b[2]}" aria-label="${b[2]}" ${off}>${icon(b[1], { size: 18 })}</button>`).join("");
  // 條文：上移、下移、在下方新增、提議刪除（作用在編輯中的條文）
  const id = S.editing || "", vis = visible(), i = vis.findIndex((c) => c.id === id);
  const tool = (act, ic, label, dis, extra = "") => `<button type="button" data-act="${act}" data-id="${id}" ${extra} title="${label}" aria-label="${label}" ${off || dis ? "disabled" : ""}>${icon(ic, { size: 18 })}</button>`;
  const tools = `<span class="rb-sep" aria-hidden="true"></span>${tool("up", "arrowUp", "上移此條", i <= 0)}${tool("down", "arrowDown", "下移此條", i < 0 || i === vis.length - 1)}${tool("add", "add", "在下方新增條文", false, `data-after="${id}"`)}${tool("delete-open", "delete", "提議刪除此條", false)}`;
  return `<div class="ribbon" role="toolbar" aria-label="格式">${btns}${tools}<span class="save-state" id="save-state" role="status"${S.editing ? "" : " data-hint"}>${S.editing ? "" : "點條文即可修訂"}</span></div>`;
}

// 表格：插入表格與增刪列欄收在同一個選單
function tableMenu(off) {
  const items = [["table", "插入表格"], ["row+", "在下方插入列"], ["row-", "刪除此列"], ["col+", "在右側插入欄"], ["col-", "刪除此欄"]];
  return `<span class="menu-wrap"><button type="button" data-cmd="table-menu" title="表格" aria-label="表格" aria-haspopup="menu" aria-expanded="${!!S.tableMenu}" ${off}>${icon("table", { size: 18 })}${icon("dropDown", { size: 16 })}</button>
    ${S.tableMenu && S.editing ? `<div class="menu" role="menu">${items.map(([cmd, t]) => `<button type="button" role="menuitem" data-cmd="${cmd}"><strong>${t}</strong></button>`).join("")}</div>` : ""}</span>`;
}

// 「⋯ 更多」：匯入修訂版 Word、套用範本或匯入新 Word、新增條文、修訂紀錄、只顯示已勾選；
// 窄螢幕另有匯出與縮放（工具列放不下時收進來）
function moreMenu(withExport) {
  const vis = visible();
  const hasBoxes = S.clauses.some((c) => Fields.hasBoxes(c.html));
  const items = [
    canEditDoc() && S.clauses.length && ["reimport-pick", "", "匯入修訂版 Word"],
    S.isAdmin && ["nav", "import", "套用範本／匯入新 Word"],
    canEditDoc() && vis.length && ["add", "", "新增條文"],
    ["nav", "history", "修訂紀錄"],
    hasBoxes && ["only-checked", "", "只顯示已勾選的選項", S.onlyChecked]
  ].filter(Boolean);
  const narrow = [withExport && ["export-open", "匯出"], ["zoom-in", "放大"], ["zoom-out", "縮小"], ["zoom-fit", "符合頁寬"]].filter(Boolean)
    .map(([act, t]) => `<button role="menuitem" class="menu-item-narrow" data-act="${act}"><strong>${t}</strong></button>`).join("");
  const menu = S.moreOpen ? `<div class="menu" role="menu">${items.map(([act, v, title, on]) =>
    `<button role="${on === undefined ? "menuitem" : "menuitemcheckbox"}" data-act="${act}" ${v ? `data-v="${v}"` : ""} ${act === "add" ? `data-after="${vis[vis.length - 1].id}"` : ""} ${on === undefined ? "" : `aria-checked="${!!on}"`}><strong>${on ? "✓ " : ""}${title}</strong></button>`).join("")}${narrow}</div>` : "";
  return `<div class="menu-wrap"><button class="btn ghost" data-act="more-toggle" aria-haspopup="menu" aria-expanded="${S.moreOpen}">${icon("more", { size: 18 })}更多</button>${menu}</div>`;
}
