// 「自上次查看後」摘要（顯示在總覽頁）。
import { esc } from "../../../../core/dom.js";
import { fmt } from "../../../../core/format.js";
import { S } from "../../context.js";
import { decidedNew, docTitle, isNew, revTitle, sameSide, who } from "../../state.js";

export function newsHtml() {
  if (S.lastSeen == null || !S.loaded.r) return "";
  const newRevs = S.revs.filter(isNew), decided = S.revs.filter(decidedNew);
  const hand = S.handoff && S.handoff.by && !sameSide(S.handoff.by) && S.handoff.at > S.lastSeen;
  if (!newRevs.length && !decided.length && !hand) return "";
  const items = [];
  if (hand) {
    const m = S.handoff.note === "imported" ? `匯入了新的契約「${docTitle()}」` : { review: "把契約交給您審閱", reviewed: "審閱完成，交回給您檢視", final: "同意定稿", editing: "開始了新一輪修訂" }[S.handoff.status] || "更新了進度";
    items.push(`${esc(who(S.handoff.by))} ${esc(m)}（${fmt(S.handoff.at)}）`);
  }
  if (newRevs.length) {
    const titles = [...new Set(newRevs.map(revTitle))];
    items.push(`他方改動了 ${newRevs.length} 處：${esc(titles.slice(0, 4).join("、"))}${titles.length > 4 ? " 等" : ""}`);
  }
  if (decided.length) {
    const ok = decided.filter((r) => r.status === "accepted").length, no = decided.filter((r) => r.status === "reverted").length;
    items.push(`本方修訂：${ok ? `接受 ${ok} 處` : ""}${ok && no ? "、" : ""}${no ? `退回 ${no} 處` : ""}`);
  }
  return `<section class="news" aria-label="自上次查看後的更新">
    <div class="row"><h2>最新動態</h2>
    <div class="actions"><button class="btn sm" data-act="see-log">修訂紀錄</button><button class="btn sm" data-act="mark-seen">標為已讀</button></div></div>
    <ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul></section>`;
}
