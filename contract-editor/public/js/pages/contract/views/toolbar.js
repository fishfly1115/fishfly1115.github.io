// 契約標題、選項顯示切換、匯入選單、匯出面板。
import { $, esc } from "../../../core/dom.js";
import { Fields } from "../../../lib/fields.js";
import { S } from "../context.js";
import { render } from "../render.js";
import { canEditDoc, caseNo, docTitle, visible } from "../state.js";
import { act } from "../sync.js";
import { icon } from "../../../ui/icons.js";

export const menuBtn = (id, label, primary) => `<div class="menu-wrap"><button class="btn ${primary ? "primary" : ""}" data-act="menu" data-id="${id}" aria-haspopup="menu" aria-expanded="${S.menu === id}">${label}${icon("dropDown", { size: 18 })}</button>${S.menu === id ? menuHtml(id) : ""}</div>`;
export function menuHtml(id) {
  const items = id === "import" ? [
    canEditDoc() && S.clauses.length && ["reimport-pick", "匯入修訂版 Word", "以匯出的 Word 修訂後匯回，逐條比對差異"],
    S.isAdmin && ["tpl-open", "套用範本", "以範本取代目前條文"],
    S.isAdmin && ["import-pick", "匯入新契約 Word", "以新的 Word 檔取代目前條文"]
  ] : [];
  return `<div class="menu" role="menu">${items.filter(Boolean).map(([act, label, hint]) => `<button role="menuitem" data-act="${act}"><strong>${label}</strong><span>${hint}</span></button>`).join("")}</div>`;
}
export function renderHeader() {
  // 契約名稱與案號顯示在頂端列與紙張上；頁首只在編輯名稱時出現
  $("csource").hidden = true;
  $("ctitle").hidden = !S.renaming;
  $("lede").hidden = true;
  if (S.renaming && $("renameform")) { /* keep what the owner is typing across background refreshes */ }
  else if (S.renaming) {
    $("ctitle").innerHTML = `<form id="renameform" class="row"><input id="rtitle" class="inp" maxlength="200" value="${esc(docTitle())}" aria-label="契約名稱" style="flex:1 1 240px"><input id="rcase" class="inp" maxlength="100" value="${esc(caseNo())}" placeholder="案號" aria-label="案號" style="flex:0 1 180px;font-size:15px"><button class="btn sm primary" type="submit">儲存</button><button class="btn sm" type="button" data-act="rename-cancel">取消</button></form>`;
    $("renameform").addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = $("rtitle").value.trim(); if (!title) return;
      try { await act("rename", { title, caseNo: $("rcase").value.trim() }, "已更新契約名稱"); S.renaming = false; render(); } catch {}
    });
  } else {
    $("ctitle").innerHTML = (S.loaded.c ? esc(docTitle()) : `<span class="skel" style="width:60%;height:30px"></span>`) + (S.isAdmin && S.loaded.c ? ` <button class="btn icon ghost" data-act="rename-open" aria-label="編輯名稱與案號" title="編輯名稱與案號">${icon("edit", { size: 18 })}</button>` : "");
  }
  const el = $("exportbar");
  if (!S.loaded.c || S.noAccess || S.importPreview || S.reimport || S.tplPick) { el.innerHTML = ""; return; }
  const hasBoxes = S.clauses.some((c) => Fields.hasBoxes(c.html));
  const toggle = hasBoxes ? `<div class="seg" role="group" aria-label="選項顯示方式"><button data-act="only-checked" data-v="0" aria-pressed="${!S.onlyChecked}">全部選項</button><button data-act="only-checked" data-v="1" aria-pressed="${S.onlyChecked}">僅已勾選</button></div>` : "";
  const imp = (S.isAdmin || (canEditDoc() && S.clauses.length)) ? menuBtn("import", `${icon("upload", { size: 18 })}匯入`) : "";
  const outlineBtn = S.view === "contract" && S.clauses.length > 1 ? `<button class="btn only-narrow" data-act="outline-toggle" aria-expanded="${S.outlineOpen}">${icon("toc", { size: 18 })}目錄</button>` : "";
  const legend = S.view === "contract" && S.clauses.length ? `<span class="legend"><span><del class="d">刪除線</del> 刪除的原文</span><span><ins class="d">底線</ins> 新增的文字</span></span>` : "";
  const vis = visible();
  const addBtn = S.view === "contract" && canEditDoc() && vis.length && !S.adding ? `<button class="btn ghost" data-act="add" data-after="${vis[vis.length - 1].id}">${icon("add", { size: 18 })}新增條文</button>` : "";
  el.innerHTML = `${outlineBtn}${toggle}${legend}<div class="grow"></div>${imp}${addBtn}`;
  if (S.exportOpen) el.insertAdjacentHTML("beforeend", exportPanelHtml());
}
export function exportPanelHtml() {
  const open = S.revs.filter((r) => r.status === "pending").length;
  const hasBoxes = S.clauses.some((c) => Fields.hasBoxes(c.html));
  const pdf = S.exportFmt === "pdf";
  return `<section class="panel export" aria-label="匯出">
    <div class="row"><h2>匯出</h2><div class="grow"></div><button class="btn icon ghost" data-act="export-close" aria-label="關閉">${icon("close")}</button></div>
    <div class="tplgrid">
      <label class="tpl"><input type="radio" name="efmt" value="pdf" ${pdf ? "checked" : ""}><span><strong>PDF 定稿本</strong><span class="meta">A4 直式，含案號、頁碼；未定稿時加註「草案」浮水印</span></span></label>
      <label class="tpl"><input type="radio" name="efmt" value="docx" ${pdf ? "" : "checked"}><span><strong>Word（可編輯）</strong><span class="meta">可在 Word 整份修訂後，以「匯入 → 匯入修訂版 Word」送回逐條比對</span></span></label>
    </div>
    ${hasBoxes ? `<label class="check"><input type="checkbox" id="eonly" ${S.exportOnlyChecked ? "checked" : ""}> 僅保留已勾選的選項</label>` : ""}
    ${open ? `<div class="warnline">尚有 ${open} 處修訂未審閱，匯出內容為目前條文（含未審閱的修訂）</div>` : ""}
    <div class="row"><div class="grow"></div><button class="btn" data-act="export-close">取消</button><button class="btn primary" data-act="export-go">${pdf ? "匯出 PDF" : "匯出 Word"}</button></div>
  </section>`;
}
