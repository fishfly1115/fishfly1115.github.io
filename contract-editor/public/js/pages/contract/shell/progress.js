// 契約進度：目前在四個步驟的哪一步（分頁與進度列 pagenav.js）、現在輪到誰、這一步要做什麼與主要按鈕
// （總覽頁；「契約內容」頁的工具列用 contentPrimary()）。
import { fmt } from "../../../core/format.js";
import { icon } from "../../../ui/icons.js";
import { S } from "../context.js";
import { SIDE, canEditDoc, mySide, otherSide, pendingForMe, roundNo, sameSide, sideOfId, status } from "../state.js";

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

const handoffBtn = () => `<button class="btn primary" data-act="handoff-review">交給${SIDE[otherSide()]}</button>`;
const navBtn = (v, label, cls = "") => `<button class="btn ${cls}" data-act="nav" data-v="${v}">${label}</button>`;

/**
 * 目前的狀態與下一步。
 * @returns {{ mine: boolean, who: string, title: string, sub: string, primary: string, secondary: string }}
 *   who：現在輪到誰；title：這一步要做什麼；primary：唯一的主要按鈕；secondary：次要按鈕（可空）
 */
export function nextStep() {
  const st = status(), by = S.handoff?.by, n = roundNo();
  const byUs = by && sameSide(by), me = SIDE[mySide()], other = SIDE[otherSide()];
  const todo = pendingForMe().length;
  const ours = S.revs.filter((r) => r.status === "pending" && sameSide(r.by) && (r.round || 1) === n).length;
  const mineWho = `輪到您（${me}）`, otherWho = `輪到${other}`;
  const copy = `<button class="btn" data-act="copy">複製通知內容</button>`;
  const handoff = () => handoffBtn();
  if (todo && st !== "final") return { mine: true, who: mineWho, title: `審閱${other}的 ${todo} 處修訂`, sub: "", primary: navBtn("review", `${icon("arrowForward", { size: 18 })}開始審閱`, "primary"), secondary: "" };
  if (st === "editing") {
    if (ours) return { mine: true, who: mineWho, title: `已修訂 ${ours} 處，可交給${other}`, sub: "", primary: handoff(), secondary: navBtn("content", "前往契約內容") };
    return { mine: true, who: "雙方都可修訂", title: "修訂契約內容", sub: "", primary: navBtn("content", `${icon("edit", { size: 18 })}前往契約內容`, "primary"), secondary: "" };
  }
  if (st === "review") {
    if (byUs) return { mine: false, who: otherWho, title: `等待${other}審閱`, sub: "", primary: "", secondary: copy };
    return { mine: true, who: mineWho, title: `審閱完畢，送回${other}`, sub: "", primary: `<button class="btn primary" data-act="handoff-reviewed">審閱完畢，送回${other}</button>`, secondary: "" };
  }
  if (st === "reviewed") {
    const rs = S.revs.filter((r) => (r.round || 1) === n && !sameSide(r.by) === !!byUs);
    const ok = rs.filter((r) => r.status === "accepted").length, no = rs.filter((r) => r.status === "reverted").length;
    if (byUs) return { mine: false, who: otherWho, title: `等待${other}確認`, sub: `接受 ${ok} 處、退回 ${no} 處`, primary: "", secondary: copy };
    return { mine: true, who: mineWho, title: "確認審閱結果", sub: `${other}接受 ${ok} 處、退回 ${no} 處`, primary: `<button class="btn good" data-act="final">同意定稿</button>`, secondary: `<button class="btn" data-act="next-round">開始下一輪修訂</button>` };
  }
  return { mine: false, who: "已完成", title: "雙方已確認定稿", sub: `第 ${n} 輪 · ${fmt(S.handoff?.at)}`, primary: `<button class="btn primary" data-act="export-open">${icon("download", { size: 18 })}匯出定稿本</button>`, secondary: `<button class="btn" data-act="next-round">重新開啟修訂</button>` };
}

/**
 * 「契約內容」頁工具列的主要按鈕：修訂階段一律是「交給他方」；其他階段與總覽的下一步相同
 * （已在契約內容頁，就不再顯示「前往契約內容」）。沒有該做的事時回傳空字串。
 */
export function contentPrimary() {
  if (status() === "editing" && canEditDoc() && !pendingForMe().length) return handoffBtn();
  const { primary } = nextStep();
  return primary.includes(`data-v="content"`) ? "" : primary;
}
