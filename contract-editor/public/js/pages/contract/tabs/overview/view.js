/**
 * 總覽頁
 * 頁面目的：一眼知道「現在輪到誰、下一步按哪裡」（目前在哪一步見上方的進度列）
 * 主要按鈕：該做的事（交給他方、審閱、送回、定稿、匯出）；次要按鈕：第二常用的事
 * 最重要資料：現在要做的事
 */
import { esc } from "../../../../core/dom.js";
import { S } from "../../context.js";
import { nextStep } from "../../shell/progress.js";
import { roundNo, visible } from "../../state.js";
import { newsHtml } from "./news.js";

export function overviewHtml() {
  const x = nextStep();
  const live = S.participants.filter((p) => !p.revoked).length;
  return `<div class="overview">
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
