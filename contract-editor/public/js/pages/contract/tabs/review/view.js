/**
 * 審閱頁
 * 頁面目的：逐處決定他方的修訂
 * 主要任務：看懂這一處改了什麼 → 接受或退回 → 自動前往下一處
 * 最重要資料：目前這一處的「原文 → 新文」與條文全文標示
 * 一次只顯示一處；全部處理完後，顯示下一步（送回他方）。
 */
import { diffHtml } from "../../../../core/diff.js";
import { esc } from "../../../../core/dom.js";
import { fmt } from "../../../../core/format.js";
import { icon } from "../../../../ui/icons.js";
import { S } from "../../context.js";
import { SIDE, clauseHtmlOf, otherSide, pendingOf, revHtml, sameSide, status, theirsClauses, whoFull } from "../../state.js";
import { changesHtml, summaryOf } from "./summary.js";

// 目前審閱的條文：S.focusPending 指定的那條，否則第一條
export function currentIndex(list = theirsClauses()) {
  return Math.max(0, list.findIndex((c) => c.id === S.focusPending));
}

function bodyHtml(c) {
  const pend = pendingOf(c.id), kinds = new Set(pend.map((r) => r.kind || "edit"));
  const cur = clauseHtmlOf(c), edit = pend.find((r) => (r.kind || "edit") === "edit");
  if (kinds.has("add")) return `<div class="rich rv-added">${cur}</div>`;
  if (kinds.has("delete")) return `<div class="rich rv-deleted">${cur}</div>`;
  return `<div class="rich">${edit ? diffHtml(revHtml(edit, "before"), cur) : cur}</div>`;
}

function doneHtml() {
  const other = SIDE[otherSide()];
  const canSend = status() === "review" && S.handoff?.by && !sameSide(S.handoff.by);
  return `<section class="hero" data-mine="${canSend ? 1 : 0}">
    <p class="hero-kicker">審閱</p>
    <h2>目前沒有待您審閱的修訂</h2>
    <p class="hero-sub">${canSend ? `全部處理完畢，可以送回${other}確認結果。` : `${other}修訂條文後，會出現在這裡。`}</p>
    <div class="actions">${canSend ? `<button class="btn primary lg" data-act="handoff-reviewed">審閱完畢，送回${other}</button>` : ""}<button class="btn" data-act="nav" data-v="overview">回到總覽</button></div>
  </section>`;
}

export function reviewHtml() {
  const list = theirsClauses();
  if (!list.length) return doneHtml();
  const i = currentIndex(list), c = list[i];
  const { last, items, more, kind } = summaryOf(c);
  const prev = list[i - 1], next = list[i + 1];
  const all = S.acceptAll
    ? `<span class="rv-allq">接受全部 ${list.length} 處？</span><button class="btn sm" data-act="accept-all-cancel">取消</button><button class="btn sm good" data-act="accept-all-do">全部接受</button>`
    : `<button class="btn sm ghost" data-act="accept-all">全部接受</button>`;
  return `<div class="review-page">
    <div class="rv-top">
      <strong class="rv-count">第 ${i + 1}／${list.length} 處</strong>
      <span class="rv-dots" aria-hidden="true">${list.map((x, k) => `<i data-on="${k === i}"></i>`).join("")}</span>
      <div class="grow"></div>${all}
    </div>
    <article class="rv-card">
      <header class="rv-head"><div><h2>${esc(c.title)}</h2><p class="meta-s">${esc(whoFull(last.by))} · ${fmt(last.at)}</p></div><span class="pill mine">${esc(kind)}</span></header>
      <section><h3 class="rv-h">改了什麼</h3>${changesHtml(items, more)}</section>
      <section><h3 class="rv-h">條文全文<span class="legend"><span><del class="d">刪除線</del> 刪除</span><span><ins class="d">底線</ins> 新增</span></span></h3><div class="rv-body">${bodyHtml(c)}</div></section>
      <footer class="rv-foot">
        <label class="field grow"><span>退回理由（選填，他方可見）</span><input id="rv-reason" class="inp" maxlength="500" placeholder="例如：經費金額需依核定公文"></label>
        <div class="rv-acts"><button class="btn bad lg" data-act="review-revert" data-id="${c.id}">退回</button><button class="btn good lg" data-act="review-accept" data-id="${c.id}">接受</button></div>
      </footer>
    </article>
    <nav class="rv-nav">${prev ? `<button class="btn ghost" data-act="review-go" data-id="${prev.id}">${icon("chevronLeft", { size: 18 })}上一處</button>` : "<span></span>"}${next ? `<button class="btn ghost" data-act="review-go" data-id="${next.id}">下一處${icon("chevronRight", { size: 18 })}</button>` : ""}</nav>
  </div>`;
}
