// 頁面頂端的進度列：第幾輪、目前輪到哪一方、下一步按鈕。
import { $, esc } from "../../../core/dom.js";
import { fmt } from "../../../core/format.js";
import { S } from "../context.js";
import { SIDE, mySide, pendingForMe, roundNo, sameSide, status, whoFull } from "../state.js";

export function renderTurn() {
  const el = $("turn");
  if (S.noAccess) { el.innerHTML = `<div class="stage"><span class="stage-dot"></span><div class="stage-text"><div class="stage-title">無法開啟此契約</div><div class="stage-sub">${esc(S.noAccess)}</div></div></div>`; return; }
  if (!S.loaded.c) {
    el.innerHTML = S.slow
      ? `<div class="stage"><span class="stage-dot"></span><div class="stage-text"><div class="stage-title">暫時無法連線</div><div class="stage-sub">請確認網路連線後重試</div></div></div><div class="actions"><button class="btn" data-act="retry">重試</button></div>`
      : `<div class="stage"><span class="skel" style="width:220px;height:18px"></span></div>`;
    return;
  }
  const st = status(), by = S.handoff?.by, n = roundNo();
  const byUs = by && sameSide(by), side = SIDE[mySide()], other = SIDE[mySide() === "A" ? "B" : "A"];
  const todo = pendingForMe().length;
  const ours = S.revs.filter((r) => r.status === "pending" && sameSide(r.by) && (r.round || 1) === n).length;
  let title, sub, mine = false, acts = "";
  const copyBtn = `<button class="btn" data-act="copy">複製通知內容</button>`;
  if (st === "editing") {
    title = `第 ${n} 輪 · 修訂中`;
    sub = todo ? `${other}提出 ${todo} 處修訂，待您審閱` : ours ? `本方（${side}）本輪已修訂 ${ours} 處` : "雙方均可直接修訂條文";
    mine = !!todo;
    acts = `<button class="btn primary" data-act="handoff-review">修訂完成，送${other}審閱</button>`;
  } else if (st === "review") {
    if (byUs) { title = `第 ${n} 輪 · 已送${other}審閱`; sub = "審閱結果會列在修訂紀錄"; acts = copyBtn; }
    else {
      mine = true; title = `待審閱：${whoFull(by)}已送出第 ${n} 輪修訂`;
      sub = todo ? `尚有 ${todo} 處待審閱，請逐條接受或退回` : `已全部審閱，可送回${other}確認`;
      acts = `<button class="btn primary" data-act="handoff-reviewed" ${todo ? "disabled title=\"尚有修訂未審閱\"" : ""}>審閱完畢，送回${other}</button>`;
    }
  } else if (st === "reviewed") {
    const rs = S.revs.filter((r) => (r.round || 1) === n && !sameSide(r.by) === !!byUs);
    const ok = rs.filter((r) => r.status === "accepted").length, no = rs.filter((r) => r.status === "reverted").length;
    if (byUs) { title = `第 ${n} 輪 · 已送回${other}確認`; sub = `本方接受 ${ok} 處、退回 ${no} 處`; acts = copyBtn; }
    else {
      mine = true; title = `${whoFull(by)}已審閱完畢，請確認結果`;
      sub = `本方修訂：接受 ${ok} 處、退回 ${no} 處`;
      acts = `<button class="btn good" data-act="final">同意定稿</button><button class="btn" data-act="next-round">開始下一輪修訂</button>`;
    }
  } else {
    title = "雙方已確認定稿"; sub = `第 ${n} 輪定稿 · ${fmt(S.handoff?.at)}`;
    acts = `<button class="btn primary" data-act="export-open">匯出定稿本</button><button class="btn" data-act="next-round">重新開啟修訂</button>`;
  }
  el.innerHTML = `
    <div class="stage" data-mine="${mine ? 1 : 0}">
      ${st === "final" ? `<span class="seal" aria-hidden="true">定<br>稿</span>` : `<span class="stage-dot"></span>`}
      <div class="stage-text"><div class="stage-title">${esc(title)}</div><div class="stage-sub">${esc(sub)}</div></div>
    </div>
    <div class="actions">${acts}</div>`;
}
