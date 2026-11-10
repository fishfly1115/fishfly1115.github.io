// 契約頁的分頁導覽列（頂端列下方）。每個分頁只處理一件事；「審閱」標示待您處理的數量。
import { $ } from "../../../core/dom.js";
import { icon } from "../../../ui/icons.js";
import { S } from "../context.js";
import { pathOf } from "../router.js";
import { canEditDoc, theirsClauses } from "../state.js";

export function renderNav() {
  const el = $("tabs");
  el.hidden = !S.loaded.c || !!S.noAccess;
  if (el.hidden) { el.innerHTML = ""; return; }
  const todo = theirsClauses().length, live = S.participants.filter((p) => !p.revoked).length;
  const items = [
    ["overview", "dashboard", "總覽"],
    ["contract", "document", "契約內容"],
    ["review", "review", "審閱", todo, "turn"],
    ["log", "history", "修訂紀錄"],
    ["members", "group", "成員", live, "plain"],
    ["export", "download", "匯出"],
    (S.isAdmin || canEditDoc()) && ["import", "upload", "匯入"]
  ].filter(Boolean);
  el.innerHTML = `<div class="pagenav-in">${items.map(([v, ic, label, n, tone]) =>
    `<a class="pn" href="${pathOf(v)}" data-act="nav" data-v="${v}" ${S.view === v ? `aria-current="page"` : ""}>${icon(ic, { size: 18 })}<span>${label}</span>${n ? `<span class="count ${tone === "plain" ? "plain" : ""}">${n}</span>` : ""}</a>`).join("")}</div>`;
}
