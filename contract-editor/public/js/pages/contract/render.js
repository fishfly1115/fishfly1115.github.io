// 契約頁的整體繪製：頂端列、分頁導覽、頁首，再依目前分頁（S.view）繪製主要內容。
import { $ } from "../../core/dom.js";
import { S } from "./context.js";
import { contractHtml } from "./views/clauses.js";
import { editorEl } from "./views/editor.js";
import { importHtml, reimportHtml, tplPickHtml } from "./views/importing.js";
import { logHtml } from "./views/log.js";
import { renderPeople } from "./views/members.js";
import { renderNav } from "./views/nav.js";
import { renderOutline, watchOutline } from "./views/outline.js";
import { overviewHtml } from "./views/overview.js";
import { reviewHtml } from "./views/review-page.js";
import { exportHtml, importPageHtml, renderHeader } from "./views/toolbar.js";
import { renderTurn } from "./views/turnbar.js";

export function render() {
  renderTurn(); renderNav(); renderHeader(); renderPeople(); renderMain(); renderOutline(); watchOutline(); syncChrome();
  document.body.dataset.page = S.view;
}
// 頂端列＋導覽列的高度，供側欄固定位置與捲動定位使用
function syncChrome() { const h = document.querySelector(".appbar")?.offsetHeight; if (h) document.documentElement.style.setProperty("--chrome", h + "px"); }

const PAGES = { overview: overviewHtml, contract: contractHtml, review: reviewHtml, log: logHtml, members: () => "", export: exportHtml, import: importPageHtml };

export function renderMain() {
  const main = $("main");
  if (S.noAccess) { main.innerHTML = `<div class="card empty"><p>請向契約建立者索取您的專屬連結。契約建立者可以在「成員與連結」頁產生。</p></div>`; return; }
  if (!S.loaded.c) { main.innerHTML = contractHtml(); return; } // 載入中骨架／重試
  // 「審閱」頁正在輸入退回理由時，背景更新不要清掉
  if (S.view === "review" && document.activeElement?.id === "rv-reason" && !S.forceMain) return;
  S.forceMain = false;
  const key = S.view === "contract" ? (S.editing || (S.adding ? "new" : null)) : null;
  const keep = key ? document.getElementById("editor-" + key) : null;
  main.innerHTML = S.tplPick ? tplPickHtml() : S.importPreview ? importHtml() : S.reimport ? reimportHtml() : (PAGES[S.view] || overviewHtml)();
  if (key) {
    const slot = document.getElementById("slot-" + key);
    if (slot) slot.replaceWith(keep || editorEl(key === "new" ? null : S.clauses.find((c) => c.id === key)));
  }
}
