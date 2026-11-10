// 分頁導覽列（頂端列下方）：依 tabs/index.js 的順序列出各分頁的 nav 設定（圖示、名稱、數量）。
import { $ } from "../../../core/dom.js";
import { icon } from "../../../ui/icons.js";
import { S } from "../context.js";
import { pathOf } from "../router.js";
import { TABS } from "../tabs/index.js";

export function renderNav() {
  const el = $("tabs");
  el.hidden = !S.loaded.c || !!S.noAccess;
  if (el.hidden) { el.innerHTML = ""; return; }
  const items = Object.values(TABS).filter((t) => !t.nav.show || t.nav.show());
  el.innerHTML = `<div class="pagenav-in">${items.map((t) => {
    const n = t.nav.count?.();
    return `<a class="pn" href="${pathOf(t.id)}" data-act="nav" data-v="${t.id}" ${S.view === t.id ? `aria-current="page"` : ""}>${icon(t.nav.icon, { size: 18 })}<span>${t.nav.label}</span>${n ? `<span class="count ${t.nav.tone === "plain" ? "plain" : ""}">${n}</span>` : ""}</a>`;
  }).join("")}</div>`;
}
