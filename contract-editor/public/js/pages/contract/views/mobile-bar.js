/**
 * 底部審閱列（窄螢幕）
 * 目的：手機上單手完成審閱：顯示「第 i／n 處」，大按鈕接受或退回，並可跳到下一處
 */
import { $, esc } from "../../../core/dom.js";
import { S } from "../context.js";
import { isNarrow, pendingOf, theirsClauses, whoFull } from "../state.js";
import { icon } from "../../../ui/icons.js";

export function renderMobileBar() {
  const el = $("mbar");
  const list = S.loaded.c && !S.noAccess && S.view === "contract" && !S.editing && !S.adding && !S.importPreview && !S.reimport && !S.tplPick && isNarrow() ? theirsClauses() : [];
  el.hidden = !list.length;
  document.body.classList.toggle("has-mbar", !!list.length);
  if (!list.length) { el.innerHTML = ""; return; }
  const idx = Math.max(0, list.findIndex((c) => c.id === S.focusPending));
  const c = list[idx], last = pendingOf(c.id).slice(-1)[0];
  el.innerHTML = `<div class="mb-info"><strong>第 ${idx + 1}／${list.length} 處</strong><span class="mb-t">${esc(c.title)} · ${esc(whoFull(last.by))}</span>
      ${list.length > 1 ? `<button class="linkbtn" data-act="next-pending">下一處${icon("chevronRight", { size: 18 })}</button>` : `<button class="linkbtn" data-act="locate" data-id="${c.id}">定位</button>`}</div>
    <div class="mb-acts"><button class="btn bad" data-act="revert-open" data-id="${c.id}">退回</button><button class="btn good" data-act="accept" data-id="${c.id}">接受</button></div>`;
}
