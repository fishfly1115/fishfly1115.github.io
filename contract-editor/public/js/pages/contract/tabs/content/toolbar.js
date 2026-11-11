// 「契約內容」頁的工具列：左邊是閱讀用的切換（目錄、選項顯示方式、標示說明）；
// 右邊是這一頁的操作：主要按鈕（交給他方等下一步）、次要按鈕「匯出」，其餘收進「⋯ 更多」選單。
import { $ } from "../../../../core/dom.js";
import { Fields } from "../../../../lib/fields.js";
import { icon } from "../../../../ui/icons.js";
import { S } from "../../context.js";
import { contentPrimary } from "../../shell/progress.js";
import { canEditDoc, visible } from "../../state.js";

export function renderToolbar() {
  const el = $("toolbar");
  const has = S.clauses.length > 0;
  const hasBoxes = S.clauses.some((c) => Fields.hasBoxes(c.html));
  const toggle = hasBoxes ? `<div class="seg" role="group" aria-label="選項顯示方式"><button data-act="only-checked" data-v="0" aria-pressed="${!S.onlyChecked}">全部選項</button><button data-act="only-checked" data-v="1" aria-pressed="${S.onlyChecked}">僅已勾選</button></div>` : "";
  const outlineBtn = S.clauses.length > 1 ? `<button class="btn only-narrow" data-act="outline-toggle" aria-expanded="${S.outlineOpen}">${icon("toc", { size: 18 })}目錄</button>` : "";
  const legend = has ? `<span class="legend"><span><del class="d">刪除線</del> 刪除的原文</span><span><ins class="d">底線</ins> 新增的文字</span></span>` : "";
  const primary = has ? contentPrimary() : "";
  // 定稿後主要按鈕就是「匯出定稿本」，不再重複次要的「匯出」
  const exportBtn = has && !primary.includes("export-open") ? `<button class="btn" data-act="export-open">${icon("download", { size: 18 })}匯出</button>` : "";
  el.innerHTML = `${outlineBtn}${toggle}${legend}<div class="grow"></div><div class="pb-acts">${exportBtn}${primary}${moreMenu()}</div>`;
}

// 「⋯ 更多」：匯入修訂版 Word、套用範本或匯入新 Word、新增條文、修訂紀錄
function moreMenu() {
  const vis = visible();
  const items = [
    canEditDoc() && S.clauses.length && ["reimport-pick", "", "匯入修訂版 Word", "Word 修訂後匯回逐條比對"],
    S.isAdmin && ["nav", "import", "套用範本／匯入新 Word", "以範本或新檔取代目前條文"],
    canEditDoc() && vis.length && !S.adding && ["add", "", "新增條文", "加在最後一條之後"],
    ["nav", "history", "修訂紀錄", "雙方所有修訂與審閱結果"]
  ].filter(Boolean);
  const menu = S.moreOpen ? `<div class="menu" role="menu">${items.map(([act, v, title, desc]) =>
    `<button role="menuitem" data-act="${act}" ${v ? `data-v="${v}"` : ""} ${act === "add" ? `data-after="${vis[vis.length - 1].id}"` : ""}><strong>${title}</strong><span>${desc}</span></button>`).join("")}</div>` : "";
  return `<div class="menu-wrap"><button class="btn ghost" data-act="more-toggle" aria-haspopup="menu" aria-expanded="${S.moreOpen}">${icon("more", { size: 18 })}更多</button>${menu}</div>`;
}
