// 頁首：各分頁的標題（總覽另有案號與輪次）；子頁有「返回」連結；總覽頁可編輯契約名稱與案號。
import { $, esc } from "../../../core/dom.js";
import { icon } from "../../../ui/icons.js";
import { S } from "../context.js";
import { render } from "../render.js";
import { pathOf } from "../router.js";
import { caseNo, docTitle } from "../state.js";
import { act } from "../sync.js";
import { TABS } from "../tabs/index.js";

/** @param {import("../tabs/index.js").Tab} tab */
export function renderPageHeader(tab) {
  const ready = S.loaded.c && !S.noAccess;
  const title = ready ? tab.title() : "", lede = ready ? tab.lede?.() || "" : "";
  const parent = ready && tab.parent && TABS[tab.parent];
  $("csource").innerHTML = parent ? `<a class="back" href="${pathOf(parent.id)}" data-act="nav" data-v="${parent.id}">${icon("chevronLeft", { size: 18 })}返回${parent.nav.label}</a>` : "";
  $("ctitle").hidden = !title && !S.renaming && ready;
  $("lede").hidden = !lede || S.renaming;
  $("lede").textContent = lede;
  if (S.renaming) return renderRenameForm();
  if (!S.loaded.c) { $("ctitle").innerHTML = `<span class="skel" style="width:60%;height:30px"></span>`; return; }
  const edit = tab.renamable && S.isAdmin ? ` <button class="btn icon ghost" data-act="rename-open" aria-label="編輯名稱與案號" title="編輯名稱與案號">${icon("edit", { size: 18 })}</button>` : "";
  $("ctitle").innerHTML = esc(title) + edit;
}

function renderRenameForm() {
  if ($("renameform")) return; // 背景更新時保留正在輸入的內容
  $("ctitle").innerHTML = `<form id="renameform" class="row"><input id="rtitle" class="inp" maxlength="200" value="${esc(docTitle())}" aria-label="契約名稱" style="flex:1 1 240px"><input id="rcase" class="inp" maxlength="100" value="${esc(caseNo())}" placeholder="案號" aria-label="案號" style="flex:0 1 180px;font-size:15px"><button class="btn sm" type="button" data-act="rename-cancel">取消</button><button class="btn sm primary" type="submit">儲存</button></form>`;
  $("renameform").addEventListener("submit", async (e) => {
    e.preventDefault();
    const t = $("rtitle").value.trim(); if (!t) return;
    try { await act("rename", { title: t, caseNo: $("rcase").value.trim() }, "已更新契約名稱"); S.renaming = false; render(); } catch { /* fail() 已提示 */ }
  });
}
