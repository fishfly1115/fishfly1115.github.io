// 分頁與進度列（頂端列下方，每一頁都有）：左邊四個分頁按鈕，右邊四個步驟（已完成、目前在這一步、還沒到）。
// 只顯示位置與進度，不放操作按鈕；每一頁的主要按鈕在該頁內容裡。
import { $ } from "../../../core/dom.js";
import { icon } from "../../../ui/icons.js";
import { S } from "../context.js";
import { currentTab } from "../render.js";
import { pathOf } from "../router.js";
import { status } from "../state.js";
import { TABS } from "../tabs/index.js";
import { steps } from "./progress.js";

export function renderPageNav() {
  const el = $("tabs");
  el.hidden = !S.loaded.c || !!S.noAccess;
  if (el.hidden) { el.innerHTML = ""; return; }
  el.innerHTML = `<div class="pagenav-in">${tabsHtml()}${stepsHtml()}</div>`;
}

function tabsHtml() {
  const tab = currentTab(), here = tab.parent || tab.id;
  return `<div class="pn-tabs">${Object.values(TABS).filter((t) => t.nav).map((t) => {
    const n = t.nav.count?.();
    return `<a class="pn" href="${pathOf(t.id)}" data-act="nav" data-v="${t.id}" ${here === t.id ? `aria-current="page"` : ""}><span>${t.nav.label}</span>${n ? `<span class="count ${t.nav.tone === "plain" ? "plain" : ""}">${n}</span>` : ""}</a>`;
  }).join("")}</div>`;
}

function stepsHtml() {
  const { now, list } = steps(), fin = status() === "final";
  return `<ol class="fs" aria-label="流程進度">${list.map((label, i) => {
    const state = fin || i < now ? "done" : i === now ? "now" : "next";
    const sub = { done: "已完成", now: "目前在這一步", next: `第 ${i + 1} 步` }[state];
    return `${i ? `<li class="fs-line" data-done="${fin || i <= now}" aria-hidden="true"></li>` : ""}<li class="fs-step" data-state="${state}" ${state === "now" ? `aria-current="step"` : ""}>
      <span class="fs-n">${state === "done" ? icon("check", { size: 16 }) : i + 1}</span><span class="fs-t"><small>${sub}</small><strong>${label}</strong></span></li>`;
  }).join("")}</ol>`;
}
