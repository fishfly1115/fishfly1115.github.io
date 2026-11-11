// 契約頁的繪製：外框（頂端列、分頁導覽、流程列、頁首、姓名表單、交接視窗）＋目前分頁的內容。
// 分頁內容由 tabs/<代號>/index.js 的定義提供，見 tabs/index.js。
import { $ } from "../../core/dom.js";
import { S } from "./context.js";
import { renderFlowbar } from "./shell/flowbar.js";
import { renderDialog } from "./shell/handoff-dialog.js";
import { renderNamePrompt } from "./shell/name-prompt.js";
import { renderNav } from "./shell/nav.js";
import { renderPageHeader } from "./shell/page-header.js";
import { renderTopbar } from "./shell/topbar.js";
import { TABS } from "./tabs/index.js";

export const currentTab = () => TABS[S.view] || TABS.overview;

export function render() {
  const tab = currentTab();
  document.body.dataset.page = tab.id;
  renderTopbar();
  renderNav();
  renderFlowbar();
  renderPageHeader(tab);
  renderNamePrompt();
  renderMain(tab);
  renderDialog();
  syncChrome();
}

function renderMain(tab) {
  const main = $("main");
  // 側欄與工具列只屬於「契約內容」頁，其他分頁先收起，由該頁的 after() 決定是否顯示
  $("outline").hidden = true;
  $("layout").classList.remove("with-outline");
  $("toolbar").innerHTML = "";
  if (S.noAccess) { main.innerHTML = `<div class="card empty"><p>請向契約建立者索取您的專屬連結。契約建立者可以在「成員與連結」頁產生。</p></div>`; return; }
  if (!S.loaded.c) { main.innerHTML = loadingHtml(); return; }
  // 正在此頁輸入時（退回理由、邀請表單），背景更新不要清掉輸入內容
  const typing = main.contains(document.activeElement) && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
  if (tab.keepTyping && typing && !S.forceMain) return;
  S.forceMain = false;
  main.innerHTML = tab.html();
  tab.after?.();
}

const loadingHtml = () => `<div class="card page-card">${S.slow
  ? `<p class="empty">無法載入契約，請確認網路連線<br><button class="btn" data-act="retry">重試</button></p>`
  : `<div class="skel-block"><span class="skel" style="width:30%"></span><span class="skel"></span><span class="skel"></span><span class="skel" style="width:70%"></span></div>`}</div>`;

// 頂端列＋導覽列的高度，供側欄固定位置與捲動定位使用
function syncChrome() {
  const h = document.querySelector(".appbar")?.offsetHeight;
  if (h) document.documentElement.style.setProperty("--chrome", h + "px");
}
