// 契約頁的事件：所有按鈕以 data-act 標示操作名稱，由這裡依名稱找到對應的處理函式（事件委派）。
// 操作定義在各分頁（tabs/<代號>/index.js 的 actions）與共用操作（shell/actions.js）。
import { sharedActions } from "./shell/actions.js";
import { bindDialog } from "./shell/handoff-dialog.js";
import { poll } from "./sync.js";
import { TABS } from "./tabs/index.js";

// 合併所有操作；名稱重複代表兩個分頁會互相覆蓋，直接報錯
function collectActions() {
  const all = { ...sharedActions };
  for (const tab of Object.values(TABS)) {
    for (const [name, fn] of Object.entries(tab.actions || {})) {
      if (name in all) throw new Error(`操作名稱重複：${name}（${tab.id}）`);
      all[name] = fn;
    }
  }
  return all;
}

export function bindEvents() {
  const actions = collectActions();
  for (const tab of Object.values(TABS)) tab.init?.();
  bindDialog();
  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-act]");
    if (!el || el.disabled) return;
    actions[el.dataset.act]?.(el, el.dataset.id, ev);
  });
  // 切回瀏覽器分頁時立即檢查他方是否有新變更
  document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); });
}
