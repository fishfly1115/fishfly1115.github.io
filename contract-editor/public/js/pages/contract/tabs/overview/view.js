/**
 * 總覽頁
 * 頁面目的：一眼知道「現在在哪一步、輪到誰、下一步按哪裡」
 * 主要任務：按下唯一的主要按鈕，前往該做的事（審閱、修訂、送出、匯出）
 * 最重要資料：目前步驟與下一步
 */
import { esc } from "../../../../core/dom.js";
import { icon } from "../../../../ui/icons.js";
import { S } from "../../context.js";
import { steps, nextStep } from "../../shell/progress.js";
import { roundNo, status, visible } from "../../state.js";
import { newsHtml } from "./news.js";

export function overviewHtml() {
  const { now, list } = steps(), st = status();
  const x = nextStep();
  const stepsHtml = list.map((label, i) => {
    const state = st === "final" || i < now ? "done" : i === now ? "now" : "next";
    return `${i ? `<span class="step-line" aria-hidden="true"></span>` : ""}<li class="step" data-state="${state}" ${state === "now" ? `aria-current="step"` : ""}><span class="step-n">${state === "done" ? icon("check", { size: 16 }) : i + 1}</span><span class="step-t">${label}</span></li>`;
  }).join("");
  const live = S.participants.filter((p) => !p.revoked).length;
  return `<div class="overview">
    <ol class="steps" aria-label="流程進度（第 ${roundNo()} 輪）">${stepsHtml}</ol>
    <section class="hero" data-mine="${x.mine ? 1 : 0}">
      <p class="hero-kicker">${esc(x.who)}</p>
      <h2>${esc(x.title)}</h2>
      <p class="hero-sub">${esc(x.sub)}</p>
      <div class="actions">${x.primary.replace("class=\"btn ", "class=\"btn lg ")}${x.secondary}</div>
    </section>
    ${newsHtml()}
    <dl class="facts"><div><dt>條文</dt><dd>${visible().length} 條</dd></div><div><dt>成員</dt><dd>${live} 人</dd></div><div><dt>本輪</dt><dd>第 ${roundNo()} 輪</dd></div></dl>
  </div>`;
}
