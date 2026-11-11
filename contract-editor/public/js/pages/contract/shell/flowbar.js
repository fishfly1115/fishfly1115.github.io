// 流程列（導覽列下方，總覽以外的每一頁都有）：四個步驟目前在哪一步、現在輪到誰要做什麼、唯一的主要按鈕。
// 輪到本方時整列以黃底標示。
import { $, esc } from "../../../core/dom.js";
import { icon } from "../../../ui/icons.js";
import { S } from "../context.js";
import { status } from "../state.js";
import { nextStep, steps } from "./progress.js";

export function renderFlowbar() {
  const el = $("flowbar");
  el.hidden = !S.loaded.c || !!S.noAccess || S.view === "overview";
  if (el.hidden) { el.innerHTML = ""; return; }
  const { now, list } = steps(), st = status(), x = nextStep();
  el.dataset.mine = x.mine ? "1" : "0";
  const stepsHtml = list.map((label, i) => {
    const state = st === "final" || i < now ? "done" : i === now ? "now" : "next";
    return `${i ? `<span class="fs-line" aria-hidden="true"></span>` : ""}<li data-state="${state}" ${state === "now" ? `aria-current="step"` : ""}><span class="fs-n">${state === "done" ? icon("check", { size: 14 }) : i + 1}</span><span class="fs-t">${label}</span></li>`;
  }).join("");
  el.innerHTML = `<div class="flowbar-in">
    <ol class="fs" aria-label="流程進度">${stepsHtml}</ol>
    <div class="fs-now"><strong>${esc(x.who)}</strong><span>${esc(x.title)}</span></div>
    <div class="fs-act">${x.primary || x.secondary}</div>
  </div>`;
}
