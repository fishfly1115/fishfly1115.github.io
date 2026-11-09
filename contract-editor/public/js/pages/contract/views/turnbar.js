/**
 * 頂端列與流程進度列
 * 目的：任何時候都看得出「目前在哪一步、輪到誰、下一步按哪裡」
 * 頂端列：品牌、位置（契約案件／契約名稱／案號）、成員、成員與連結、匯出
 * 流程列：雙方修訂 → 他方審閱 → 確認結果 → 定稿；右側為「輪到您／等待他方」與唯一的下一步按鈕
 */
import { $, esc } from "../../../core/dom.js";
import { fmt } from "../../../core/format.js";
import { S, ctx } from "../context.js";
import { SIDE, caseNo, docTitle, mySide, otherSide, pendingForMe, roundNo, sameSide, sideOfId, status, whoFull } from "../state.js";
import { icon } from "../../../ui/icons.js";

export function renderTurn() {
  renderCrumb();
  renderTopActions();
  renderFlow();
}

function renderCrumb() {
  const back = ctx.ADMIN ? `<a href="/" class="crumb">契約案件</a><span class="sep" aria-hidden="true">/</span>` : "";
  $("crumb").innerHTML = S.loaded.c && !S.noAccess
    ? `${back}<span class="crumb-title">${esc(docTitle())}</span>${caseNo() ? `<span class="crumb-case">${esc(caseNo())}</span>` : ""}`
    : back;
}

function renderTopActions() {
  const el = $("turn");
  if (!S.loaded.c || S.noAccess) { el.innerHTML = ""; return; }
  const live = S.participants.filter((p) => !p.revoked);
  const avatars = live.slice(0, 4).map((p) => `<span class="avatar" data-side="${p.side === mySide() ? "mine" : "other"}" title="${esc(whoFull(p.id))}">${esc((p.name || p.label || SIDE[p.side] || "?").trim().slice(0, 1))}</span>`).join("")
    + (live.length > 4 ? `<span class="avatar more">+${live.length - 4}</span>` : "");
  el.innerHTML = `<div class="avatars" aria-label="成員 ${live.length} 人">${avatars}</div>
    <button class="btn" data-act="people" aria-label="成員與連結" aria-pressed="${S.panelTab === "people" || S.peopleOpen}">${icon("group", { size: 18 })}<span class="btn-t">成員與連結</span></button>
    ${S.clauses.length ? `<button class="btn" data-act="export-open" aria-label="匯出" ${S.exporting ? "disabled" : ""}>${icon("download", { size: 18 })}<span class="btn-t">${S.exporting ? "匯出中…" : "匯出"}</span></button>` : ""}`;
}

// 依交接紀錄推算四個步驟的名稱與目前步驟
function steps() {
  const st = status(), by = S.handoff?.by, bySide = by ? sideOfId(by) : null;
  const flip = (s) => s === "A" ? "B" : "A";
  let reviewer = otherSide(), confirmer = mySide();
  if (st === "review" && bySide) { reviewer = flip(bySide); confirmer = bySide; }
  if (st === "reviewed" && bySide) { reviewer = bySide; confirmer = flip(bySide); }
  const now = { editing: 0, review: 1, reviewed: 2, final: 3 }[st] ?? 0;
  return { now, list: ["雙方修訂", `${SIDE[reviewer]}審閱`, `${SIDE[confirmer]}確認`, "定稿"] };
}

function renderFlow() {
  const el = $("flow");
  el.hidden = !S.loaded.c || !!S.noAccess;
  if (el.hidden) { el.innerHTML = ""; return; }
  const st = status(), by = S.handoff?.by, n = roundNo();
  const byUs = by && sameSide(by), side = SIDE[mySide()], other = SIDE[otherSide()];
  const todo = pendingForMe().length;
  const ours = S.revs.filter((r) => r.status === "pending" && sameSide(r.by) && (r.round || 1) === n).length;
  let title, sub, mine = false, acts = "";
  const copyBtn = `<button class="btn" data-act="copy">複製通知內容</button>`;
  if (st === "editing") {
    mine = !!todo;
    title = todo ? "輪到您審閱" : "修訂中";
    sub = todo ? `${other}提出 ${todo} 處修訂` : ours ? `本方（${side}）本輪已修訂 ${ours} 處` : "雙方均可直接修訂條文";
    acts = `<button class="btn primary" data-act="handoff-review">修訂完成，送${other}審閱</button>`;
  } else if (st === "review") {
    if (byUs) { title = `等待${other}審閱`; sub = `第 ${n} 輪 · 結果會列在修訂紀錄`; acts = copyBtn; }
    else {
      mine = true; title = "輪到您審閱";
      sub = todo ? `${whoFull(by)}送出 · 尚有 ${todo} 處待審閱` : `已全部審閱，可送回${other}確認`;
      acts = `<button class="btn primary" data-act="handoff-reviewed" ${todo ? "disabled title=\"尚有修訂未審閱\"" : ""}>審閱完畢，送回${other}</button>`;
    }
  } else if (st === "reviewed") {
    const rs = S.revs.filter((r) => (r.round || 1) === n && !sameSide(r.by) === !!byUs);
    const ok = rs.filter((r) => r.status === "accepted").length, no = rs.filter((r) => r.status === "reverted").length;
    if (byUs) { title = `等待${other}確認`; sub = `本方接受 ${ok} 處、退回 ${no} 處`; acts = copyBtn; }
    else {
      mine = true; title = "輪到您確認結果";
      sub = `本方修訂：${other}接受 ${ok} 處、退回 ${no} 處`;
      acts = `<button class="btn" data-act="next-round">開始下一輪修訂</button><button class="btn good" data-act="final">同意定稿</button>`;
    }
  } else {
    title = "雙方已確認定稿"; sub = `第 ${n} 輪定稿 · ${fmt(S.handoff?.at)}`;
    acts = `<button class="btn" data-act="next-round">重新開啟修訂</button><button class="btn primary" data-act="export-open">匯出定稿本</button>`;
  }
  const { now, list } = steps();
  const stepsHtml = list.map((label, i) => {
    const state = st === "final" || i < now ? "done" : i === now ? "now" : "next";
    return `${i ? `<span class="step-line" aria-hidden="true"></span>` : ""}<li class="step" data-state="${state}" ${state === "now" ? `aria-current="step"` : ""}><span class="step-n">${state === "done" ? icon("check", { size: 16 }) : i + 1}</span><span class="step-t">${label}</span></li>`;
  }).join("");
  const jump = todo && st !== "final" ? `<button class="btn" data-act="next-pending">${icon("nextDown", { size: 18 })}下一處待審閱</button>` : "";
  el.innerHTML = `<ol class="steps" aria-label="流程進度（第 ${n} 輪）">${stepsHtml}</ol>
    <div class="mprogress" aria-hidden="true"><span>第 ${now + 1} 步／共 4 步</span><strong>${list[now]}</strong><span class="bars">${list.map((_, i) => `<i data-state="${st === "final" || i < now ? "done" : i === now ? "now" : "next"}"></i>`).join("")}</span></div>
    <div class="grow"></div>
    <div class="turnbox" data-mine="${mine ? 1 : 0}" role="status">${st === "final" ? `<span class="seal sm" aria-hidden="true">定<br>稿</span>` : `<span class="stage-dot"></span>`}<div><div class="tb-title">${esc(title)}</div><div class="tb-sub">${esc(sub)}</div></div></div>
    <div class="actions">${jump}${acts}</div>`;
}
