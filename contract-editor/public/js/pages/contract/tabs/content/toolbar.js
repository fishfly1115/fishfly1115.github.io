// 「契約內容」頁的工具列：目錄（窄螢幕）、選項顯示方式、標示說明、新增條文。
import { $ } from "../../../../core/dom.js";
import { Fields } from "../../../../lib/fields.js";
import { icon } from "../../../../ui/icons.js";
import { S } from "../../context.js";
import { canEditDoc, visible } from "../../state.js";

export function renderToolbar() {
  const el = $("toolbar");
  if (!S.clauses.length) { el.innerHTML = ""; return; }
  const hasBoxes = S.clauses.some((c) => Fields.hasBoxes(c.html));
  const toggle = hasBoxes ? `<div class="seg" role="group" aria-label="選項顯示方式"><button data-act="only-checked" data-v="0" aria-pressed="${!S.onlyChecked}">全部選項</button><button data-act="only-checked" data-v="1" aria-pressed="${S.onlyChecked}">僅已勾選</button></div>` : "";
  const outlineBtn = S.clauses.length > 1 ? `<button class="btn only-narrow" data-act="outline-toggle" aria-expanded="${S.outlineOpen}">${icon("toc", { size: 18 })}目錄</button>` : "";
  const legend = `<span class="legend"><span><del class="d">刪除線</del> 刪除的原文</span><span><ins class="d">底線</ins> 新增的文字</span></span>`;
  const vis = visible();
  const addBtn = canEditDoc() && vis.length && !S.adding ? `<button class="btn ghost" data-act="add" data-after="${vis[vis.length - 1].id}">${icon("add", { size: 18 })}新增條文</button>` : "";
  el.innerHTML = `${outlineBtn}${toggle}${legend}<div class="grow"></div>${addBtn}`;
}
