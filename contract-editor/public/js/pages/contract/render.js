// 契約頁的整體繪製：依狀態把各區塊交給對應的 view。
import { $ } from "../../core/dom.js";
import { S } from "./context.js";
import { pendingForMe } from "./state.js";
import { contractHtml } from "./views/clauses.js";
import { editorEl } from "./views/editor.js";
import { importHtml, reimportHtml, tplPickHtml } from "./views/importing.js";
import { logHtml } from "./views/log.js";
import { renderPeople } from "./views/members.js";
import { renderNews } from "./views/news.js";
import { renderHeader } from "./views/toolbar.js";
import { renderTurn } from "./views/turnbar.js";

export function render() { renderTurn(); renderHeader(); renderPeople(); renderNews(); renderTabs(); renderMain(); }
export function renderTabs() {
  const hide = S.importPreview || S.reimport || S.tplPick || !S.loaded.c || S.noAccess;
  $("tabs").hidden = !!hide;
  if (hide) { $("tabs").innerHTML = ""; return; }
  const todo = pendingForMe().length;
  $("tabs").innerHTML = `
    <button class="tab" role="tab" aria-selected="${S.view === "contract"}" data-view="contract">契約內容</button>
    <button class="tab" role="tab" aria-selected="${S.view === "log"}" data-view="log">修訂紀錄${todo ? `<span class="count" title="待您審閱">${todo}</span>` : ""}</button>`;
}
export function renderMain() {
  const main = $("main");
  const key = S.editing || (S.adding ? "new" : null);
  const keep = key ? document.getElementById("editor-" + key) : null;
  if (S.noAccess) { main.innerHTML = `<div class="sheet"><p class="empty">請向契約契約建立者索取您的專屬連結。契約建立者可以在契約頁面按「邀請他方／成員」產生。</p></div>`; return; }
  main.innerHTML = S.tplPick ? tplPickHtml() : S.importPreview ? importHtml() : S.reimport ? reimportHtml() : S.view === "contract" ? contractHtml() : logHtml();
  if (key) {
    const slot = document.getElementById("slot-" + key);
    if (slot) slot.replaceWith(keep || editorEl(key === "new" ? null : S.clauses.find((c) => c.id === key)));
  }
}
