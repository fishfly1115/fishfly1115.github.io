// 各分頁的頁首（標題＋一句說明）、契約內容頁的工具列，以及「匯出」「匯入」兩頁的內容。
import { $, esc } from "../../../core/dom.js";
import { Fields } from "../../../lib/fields.js";
import { icon } from "../../../ui/icons.js";
import { S } from "../context.js";
import { render } from "../render.js";
import { SIDE, canEditDoc, caseNo, docTitle, otherSide, roundNo, visible } from "../state.js";
import { act } from "../sync.js";

const PAGES = {
  overview: () => [docTitle(), [caseNo() && `案號 ${caseNo()}`, `第 ${roundNo()} 輪`].filter(Boolean).join(" · ")],
  contract: () => ["契約內容", "直接勾選、填寫，或按「修訂」修改條文；每處修改都會留下紀錄，交由他方審閱。"],
  review: () => ["審閱修訂", `逐處確認${SIDE[otherSide()]}的修訂：接受即採用，退回即恢復原文。`],
  log: () => ["修訂紀錄", "雙方所有修訂與審閱結果。"],
  members: () => ["成員與連結", "各方成員以專屬連結進入；連結外流時可停用，再產生新的連結。"],
  export: () => ["匯出", "下載 PDF 定稿本，或可在 Word 中繼續修訂的檔案。"],
  import: () => ["匯入", "以 Word 檔或範本更新契約內容；寫入前都會先預覽。"]
};

export function renderHeader() {
  $("csource").hidden = true;
  const [title, lede] = S.loaded.c && !S.noAccess ? (PAGES[S.view] || PAGES.overview)() : ["", ""];
  $("ctitle").hidden = !title && !S.renaming;
  $("lede").hidden = !lede || S.renaming;
  $("lede").textContent = lede;
  if (S.renaming && $("renameform")) { /* 背景更新時保留正在輸入的內容 */ }
  else if (S.renaming) {
    $("ctitle").innerHTML = `<form id="renameform" class="row"><input id="rtitle" class="inp" maxlength="200" value="${esc(docTitle())}" aria-label="契約名稱" style="flex:1 1 240px"><input id="rcase" class="inp" maxlength="100" value="${esc(caseNo())}" placeholder="案號" aria-label="案號" style="flex:0 1 180px;font-size:15px"><button class="btn sm" type="button" data-act="rename-cancel">取消</button><button class="btn sm primary" type="submit">儲存</button></form>`;
    $("renameform").addEventListener("submit", async (e) => {
      e.preventDefault();
      const t = $("rtitle").value.trim(); if (!t) return;
      try { await act("rename", { title: t, caseNo: $("rcase").value.trim() }, "已更新契約名稱"); S.renaming = false; render(); } catch {}
    });
  } else if (!S.loaded.c) {
    $("ctitle").hidden = false;
    $("ctitle").innerHTML = `<span class="skel" style="width:60%;height:30px"></span>`;
  } else {
    const edit = S.view === "overview" && S.isAdmin ? ` <button class="btn icon ghost" data-act="rename-open" aria-label="編輯名稱與案號" title="編輯名稱與案號">${icon("edit", { size: 18 })}</button>` : "";
    $("ctitle").innerHTML = esc(title) + edit;
  }
  // 工具列只在「契約內容」頁
  const el = $("exportbar");
  if (!S.loaded.c || S.noAccess || S.view !== "contract" || !S.clauses.length) { el.innerHTML = ""; return; }
  const hasBoxes = S.clauses.some((c) => Fields.hasBoxes(c.html));
  const toggle = hasBoxes ? `<div class="seg" role="group" aria-label="選項顯示方式"><button data-act="only-checked" data-v="0" aria-pressed="${!S.onlyChecked}">全部選項</button><button data-act="only-checked" data-v="1" aria-pressed="${S.onlyChecked}">僅已勾選</button></div>` : "";
  const outlineBtn = S.clauses.length > 1 ? `<button class="btn only-narrow" data-act="outline-toggle" aria-expanded="${S.outlineOpen}">${icon("toc", { size: 18 })}目錄</button>` : "";
  const legend = `<span class="legend"><span><del class="d">刪除線</del> 刪除的原文</span><span><ins class="d">底線</ins> 新增的文字</span></span>`;
  const vis = visible();
  const addBtn = canEditDoc() && vis.length && !S.adding ? `<button class="btn ghost" data-act="add" data-after="${vis[vis.length - 1].id}">${icon("add", { size: 18 })}新增條文</button>` : "";
  el.innerHTML = `${outlineBtn}${toggle}${legend}<div class="grow"></div>${addBtn}`;
}

// 匯出頁
export function exportHtml() {
  if (!S.clauses.length) return `<div class="empty card"><p>尚無條文可匯出</p><button class="btn" data-act="nav" data-v="contract">前往契約內容</button></div>`;
  const open = S.revs.filter((r) => r.status === "pending").length;
  const hasBoxes = S.clauses.some((c) => Fields.hasBoxes(c.html));
  const pdf = S.exportFmt === "pdf";
  return `<section class="card page-card" aria-label="匯出">
    <h2 class="pc-h">檔案格式</h2>
    <div class="tplgrid">
      <label class="tpl"><input type="radio" name="efmt" value="pdf" ${pdf ? "checked" : ""}><span><strong>PDF 定稿本</strong><span class="meta">A4 直式，含案號、頁碼；未定稿時加註「草案」浮水印</span></span></label>
      <label class="tpl"><input type="radio" name="efmt" value="docx" ${pdf ? "" : "checked"}><span><strong>Word（可編輯）</strong><span class="meta">在 Word 整份修訂後，可到「匯入」頁送回逐條比對</span></span></label>
    </div>
    ${hasBoxes ? `<label class="check"><input type="checkbox" id="eonly" ${S.exportOnlyChecked ? "checked" : ""}> 僅保留已勾選的選項</label>` : ""}
    ${open ? `<div class="warnline">尚有 ${open} 處修訂未審閱，匯出內容為目前條文（含未審閱的修訂）</div>` : ""}
    <div class="row"><div class="grow"></div><button class="btn primary lg" data-act="export-go" ${S.exporting ? "disabled" : ""}>${icon("download", { size: 18 })}${S.exporting ? "匯出中…" : pdf ? "匯出 PDF" : "匯出 Word"}</button></div>
  </section>`;
}

// 匯入頁：三種方式各一張卡片
export function importPageHtml() {
  const cards = [
    canEditDoc() && S.clauses.length && ["reimport-pick", "upload", "匯入修訂版 Word", "把「匯出」的 Word 整份修訂後匯回，系統逐條比對，確認後成為待他方審閱的修訂。", "選擇修訂版 Word"],
    S.isAdmin && ["tpl-open", "document", "套用範本", "以範本取代目前條文，套用前會先預覽。", "選擇範本"],
    S.isAdmin && ["import-pick", "upload", "匯入新契約 Word", "以新的 Word 檔取代目前條文，自動保留編號與縮排，匯入前會先預覽。", "選擇 Word 檔"]
  ].filter(Boolean);
  if (!cards.length) return `<div class="empty card"><p>目前沒有可用的匯入方式</p></div>`;
  return `<div class="choice-grid">${cards.map(([act, ic, title, desc, btn]) => `<section class="card choice">${icon(ic, { size: 28 })}<h2>${title}</h2><p>${desc}</p><button class="btn ${act === "reimport-pick" || !S.clauses.length ? "primary" : ""}" data-act="${act}">${btn}</button></section>`).join("")}</div>`;
}
