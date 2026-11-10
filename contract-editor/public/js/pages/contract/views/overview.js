/**
 * 總覽頁
 * 頁面目的：一眼知道「現在在哪一步、輪到誰、下一步按哪裡」
 * 主要任務：按下唯一的主要按鈕，前往該做的事（審閱、修訂、送出、匯出）
 * 最重要資料：目前步驟與下一步
 */
import { esc } from "../../../core/dom.js";
import { fmt } from "../../../core/format.js";
import { icon } from "../../../ui/icons.js";
import { S } from "../context.js";
import { SIDE, mySide, otherSide, pendingForMe, roundNo, sameSide, sideOfId, status, visible, whoFull } from "../state.js";
import { newsHtml } from "./news.js";

// 四個步驟的名稱（依交接紀錄推算由哪一方審閱、哪一方確認）與目前步驟
export function steps() {
  const st = status(), by = S.handoff?.by, bySide = by ? sideOfId(by) : null;
  const flip = (s) => s === "A" ? "B" : "A";
  let reviewer = otherSide(), confirmer = mySide();
  if (st === "review" && bySide) { reviewer = flip(bySide); confirmer = bySide; }
  if (st === "reviewed" && bySide) { reviewer = bySide; confirmer = flip(bySide); }
  const now = { editing: 0, review: 1, reviewed: 2, final: 3 }[st] ?? 0;
  return { now, list: ["雙方修訂", `${SIDE[reviewer]}審閱`, `${SIDE[confirmer]}確認`, "定稿"] };
}

const nav = (v, label, cls = "") => `<button class="btn ${cls}" data-act="nav" data-v="${v}">${label}</button>`;

// 目前的狀態說明與下一步（主要按鈕只有一個）
export function nextStep() {
  const st = status(), by = S.handoff?.by, n = roundNo();
  const byUs = by && sameSide(by), other = SIDE[otherSide()];
  const todo = pendingForMe().length;
  const ours = S.revs.filter((r) => r.status === "pending" && sameSide(r.by) && (r.round || 1) === n).length;
  const copy = `<button class="btn" data-act="copy">複製通知內容</button>`;
  if (todo && st !== "final") return { mine: true, title: `審閱${other}的 ${todo} 處修訂`, sub: "逐處接受或退回，完成後再送出。", acts: nav("review", `${icon("arrowForward", { size: 18 })}開始審閱`, "primary lg") };
  if (st === "editing") {
    if (ours) return { mine: true, title: `本方已修訂 ${ours} 處`, sub: `修訂完成後送${other}審閱；還要修改請到「契約內容」。`, acts: `<button class="btn primary lg" data-act="handoff-review">修訂完成，送${other}審閱</button>${nav("contract", "繼續修訂")}` };
    return { mine: false, title: "修訂契約內容", sub: "雙方都可以直接勾選、填寫或修訂條文；每處修改都會留下紀錄。", acts: nav("contract", `${icon("edit", { size: 18 })}前往契約內容`, "primary lg") };
  }
  if (st === "review") {
    if (byUs) return { mine: false, title: `等待${other}審閱`, sub: `第 ${n} 輪修訂已送出，${other}審閱後會通知您。`, acts: copy };
    return { mine: true, title: `已審閱完畢，送回${other}`, sub: `${whoFull(by)}送出的修訂都已處理。`, acts: `<button class="btn primary lg" data-act="handoff-reviewed">審閱完畢，送回${other}</button>` };
  }
  if (st === "reviewed") {
    const rs = S.revs.filter((r) => (r.round || 1) === n && !sameSide(r.by) === !!byUs);
    const ok = rs.filter((r) => r.status === "accepted").length, no = rs.filter((r) => r.status === "reverted").length;
    if (byUs) return { mine: false, title: `等待${other}確認結果`, sub: `本方接受 ${ok} 處、退回 ${no} 處。`, acts: copy };
    return { mine: true, title: "確認審閱結果", sub: `${other}接受 ${ok} 處、退回 ${no} 處。同意即定稿，或開始下一輪修訂。`, acts: `<button class="btn good lg" data-act="final">同意定稿</button><button class="btn" data-act="next-round">開始下一輪修訂</button>` };
  }
  return { mine: false, title: "雙方已確認定稿", sub: `第 ${n} 輪定稿 · ${fmt(S.handoff?.at)}`, acts: `${nav("export", `${icon("download", { size: 18 })}匯出定稿本`, "primary lg")}<button class="btn" data-act="next-round">重新開啟修訂</button>` };
}

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
      <p class="hero-kicker">${x.mine ? "輪到您" : st === "final" ? "已完成" : "目前狀態"}</p>
      <h2>${esc(x.title)}</h2>
      <p class="hero-sub">${esc(x.sub)}</p>
      <div class="actions">${x.acts}</div>
    </section>
    ${newsHtml()}
    <dl class="facts"><div><dt>條文</dt><dd>${visible().length} 條</dd></div><div><dt>成員</dt><dd>${live} 人</dd></div><div><dt>本輪</dt><dd>第 ${roundNo()} 輪</dd></div></dl>
  </div>`;
}
