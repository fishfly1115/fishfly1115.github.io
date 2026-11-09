// 修訂紀錄分頁。
import { diffHtml, diffText } from "../../../core/diff.js";
import { esc } from "../../../core/dom.js";
import { fmt } from "../../../core/format.js";
import { S } from "../context.js";
import { KIND, decidedNew, isNew, revHtml, revTitle, sameSide, who, whoFull } from "../state.js";

export function logHtml() {
  const f = S.filter;
  const filters = [["todo", "待您審閱"], ["mine", "本方修訂"], ["all", "全部"], ["accepted", "已接受"], ["reverted", "已退回／撤回"]];
  let list = S.revs;
  if (f === "todo") list = list.filter((r) => r.status === "pending" && !sameSide(r.by));
  if (f === "mine") list = list.filter((r) => sameSide(r.by));
  if (f === "accepted") list = list.filter((r) => r.status === "accepted");
  if (f === "reverted") list = list.filter((r) => r.status === "reverted" || r.status === "withdrawn");
  const empty = { todo: "沒有待您審閱的修訂。", mine: "本方尚未修訂條文。", all: "還沒有任何修訂。到「契約內容」點「修訂」開始。", accepted: "還沒有被接受的修訂。", reverted: "沒有被退回或撤回的修訂。" }[f];
  return `<div class="filters" role="group" aria-label="篩選">${filters.map(([k, l]) => `<button class="chip" aria-pressed="${f === k}" data-filter="${k}">${l}</button>`).join("")}</div>
    <div class="log">${list.length ? list.map(entryHtml).join("") : `<p class="empty">${empty}</p>`}</div>`;
}
export function entryHtml(r) {
  const mine = sameSide(r.by), kind = r.kind || "edit";
  let pill;
  if (r.status === "pending") pill = mine ? `<span class="pill mine">等待他方審閱</span>` : `<span class="pill theirs">待您審閱</span>`;
  else if (r.status === "accepted") pill = `<span class="pill ok">${esc(who(r.reviewedBy))}已接受 · ${fmt(r.reviewedAt)}</span>`;
  else if (r.status === "reverted") pill = `<span class="pill no">${esc(who(r.reviewedBy))}已退回 · ${fmt(r.reviewedAt)}</span>`;
  else pill = `<span class="pill plain">已撤回 · ${fmt(r.reviewedAt)}</span>`;
  const open = S.expanded.has(r.id);
  let title, body = "", canExpand = false;
  if (kind === "edit") {
    title = r.titleBefore !== r.titleAfter ? diffText(r.titleBefore, r.titleAfter) : esc(revTitle(r));
    body = `<div class="rich">${diffHtml(revHtml(r, "before"), revHtml(r, "after"))}</div>`; canExpand = true;
  } else if (kind === "add") { title = `新增條文：${esc(r.titleAfter)}`; body = `<div class="rich">${revHtml(r, "after")}</div>`; }
  else if (kind === "delete") { title = `刪除條文：${esc(r.titleBefore)}`; body = `<div class="rich gone">${revHtml(r, "before")}</div>`; }
  else { title = `調整位置：${esc(revTitle(r))}`; body = `<div class="meta">${r.orderAfter < r.orderBefore ? "往前移" : "往後移"}</div>`; }
  return `<article class="entry">
    <div class="entry-head">${isNew(r) || decidedNew(r) ? `<span class="newdot" title="新的"></span>` : ""}<strong>${title}</strong>${pill}</div>
    <div class="meta">${esc(whoFull(r.by))} ${KIND[kind]}${r.via === "word" ? "（匯入 Word）" : ""} · ${fmt(r.at)} · 第 ${r.round || 1} 輪</div>
    ${r.note ? `<div class="review"><span class="note">${r.status === "withdrawn" ? "撤回原因" : "退回理由"}：${esc(r.note)}</span></div>` : ""}
    ${body}
    <div class="actions">
      ${canExpand ? `<button class="linkbtn" data-act="expand" data-id="${r.id}">${open ? "收起全文對照" : "看修訂前／修訂後全文"}</button>` : ""}
      ${r.status === "pending" && !mine ? `<button class="linkbtn" data-act="goto" data-id="${r.clauseId}">到條文審閱</button>` : ""}
    </div>
    ${open && canExpand ? `<div class="compare"><div><h4>修訂前</h4><div class="rich">${revHtml(r, "before")}</div></div><div><h4>修訂後</h4><div class="rich">${revHtml(r, "after")}</div></div></div>` : ""}
  </article>`;
}
