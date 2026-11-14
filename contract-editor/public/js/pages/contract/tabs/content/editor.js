// 條文編輯器：格式工具列、表格列欄工具、貼上 Word 內容、插入圖片。
import { esc, toast } from "../../../../core/dom.js";
import { normalize, plainToHtml, sanitize } from "../../../../core/sanitize.js";
import { fitPreview, printPreview } from "./preview.js";
import { uploadImage } from "../../sync.js";
import { clauseHtmlOf } from "../../state.js";
import { fail } from "../../sync.js";
import { icon } from "../../../../ui/icons.js";

export function tableOp(ed, op) {
  const n = getSelection().anchorNode;
  const td = n && (n.nodeType === 1 ? n : n.parentElement).closest("td,th");
  if (!td || !ed.contains(td)) { toast("請先將游標放在表格的儲存格內"); return; }
  const tr = td.parentElement, table = td.closest("table"), idx = [...tr.children].indexOf(td);
  const blankCell = (tag) => { const c = document.createElement(tag || "TD"); c.innerHTML = "<p>　</p>"; return c; };
  if (op === "row+") { const nr = document.createElement("tr"); [...tr.children].forEach((c) => { const nc = blankCell(c.tagName); if (c.colSpan > 1) nc.colSpan = c.colSpan; nr.appendChild(nc); }); tr.after(nr); }
  if (op === "row-") { if (table.querySelectorAll("tr").length > 1) tr.remove(); else toast("表格至少需保留一列"); }
  if (op === "col+") table.querySelectorAll("tr").forEach((r) => { const c = r.children[Math.min(idx, r.children.length - 1)]; c ? c.after(blankCell(c.tagName)) : r.appendChild(blankCell()); });
  if (op === "col-") { if (tr.children.length > 1) table.querySelectorAll("tr").forEach((r) => { const c = r.children[Math.min(idx, r.children.length - 1)]; if (c && r.children.length > 1) c.remove(); }); else toast("表格至少需保留一欄"); }
}
export function editorEl(c) {
  const key = c ? c.id : "new";
  const box = document.createElement("div");
  box.className = "editor"; box.id = "editor-" + key;
  box.innerHTML = `
    <label class="hint" for="et-${key}">${c ? "條文標題" : "新條文標題"}</label>
    <input id="et-${key}" maxlength="200" value="${esc(c ? c.title : "")}" placeholder="例如：第十條　其他約定">
    <div class="seg ed-mode" role="group" aria-label="檢視方式"><button type="button" data-mode="edit" aria-pressed="true">編輯</button><button type="button" data-mode="preview" aria-pressed="false">預覽匯出版面</button></div>
    <div class="ed-pane">
      <div class="toolbar" role="toolbar" aria-label="格式">
        <button type="button" data-cmd="bold" title="粗體" aria-label="粗體">${icon("bold")}</button>
        <button type="button" data-cmd="italic" title="斜體" aria-label="斜體">${icon("italic")}</button>
        <button type="button" data-cmd="underline" title="底線" aria-label="底線">${icon("underline")}</button>
        <button type="button" data-cmd="strikeThrough" title="刪除線" aria-label="刪除線">${icon("strike")}</button>
        <button type="button" data-cmd="insertOrderedList" title="編號清單" aria-label="編號清單">${icon("listNumbered")}</button>
        <button type="button" data-cmd="insertUnorderedList" title="項目清單" aria-label="項目清單">${icon("listBulleted")}</button>
        <button type="button" data-cmd="indent" title="增加縮排" aria-label="增加縮排">${icon("indent")}</button>
        <button type="button" data-cmd="outdent" title="減少縮排" aria-label="減少縮排">${icon("outdent")}</button>
        <button type="button" data-cmd="table" title="插入表格">${icon("table", { size: 18 })}表格</button>
        <button type="button" data-cmd="row+" title="在下方插入列">${icon("add", { size: 16 })}列</button>
        <button type="button" data-cmd="row-" title="刪除此列">${icon("remove", { size: 16 })}列</button>
        <button type="button" data-cmd="col+" title="在右側插入欄">${icon("add", { size: 16 })}欄</button>
        <button type="button" data-cmd="col-" title="刪除此欄">${icon("remove", { size: 16 })}欄</button>
        <button type="button" data-cmd="image" title="插入圖片">${icon("image", { size: 18 })}圖片</button>
        <button type="button" data-cmd="removeFormat" title="清除格式" aria-label="清除格式">${icon("clearFormat")}</button>
      </div>
      <div class="editable rich" id="eb-${key}" contenteditable="true" role="textbox" aria-multiline="true" aria-label="條文內容">${c ? clauseHtmlOf(c) : "<p><br></p>"}</div>
    </div>
    <div class="print-preview" hidden></div>
    <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden>
    <div class="warn" id="ew-${key}" hidden></div>
    <div class="actions"><button class="btn primary" data-act="save" data-id="${key}">${c ? "儲存修訂" : "新增條文"}</button><button class="btn" data-act="cancel">取消</button></div>`;
  const ed = box.querySelector(".editable"), fileIn = box.querySelector("input[type=file]");
  let range = null;
  const keepRange = () => { const s = getSelection(); if (s.rangeCount && ed.contains(s.anchorNode)) range = s.getRangeAt(0).cloneRange(); };
  ed.addEventListener("keyup", keepRange); ed.addEventListener("mouseup", keepRange);
  const insertImage = async (file) => {
    try {
      toast("正在上傳圖片…");
      const url = await uploadImage(file);
      ed.focus(); if (range) { const s = getSelection(); s.removeAllRanges(); s.addRange(range); }
      document.execCommand("insertHTML", false, `<img src="${esc(url)}" alt="">`);
    } catch (e) { fail(e); }
  };
  ed.addEventListener("paste", (e) => {
    const files = [...(e.clipboardData?.files || [])].filter((f) => /^image\/(png|jpe?g|gif|webp)$/.test(f.type));
    if (files.length) { e.preventDefault(); keepRange(); files.forEach(insertImage); return; }
    const html = e.clipboardData?.getData("text/html"), text = e.clipboardData?.getData("text/plain");
    e.preventDefault();
    document.execCommand("insertHTML", false, html ? sanitize(html.replace(/<!--[\s\S]*?-->/g, "")) : plainToHtml(text || ""));
  });
  fileIn.addEventListener("change", () => { if (fileIn.files[0]) insertImage(fileIn.files[0]); fileIn.value = ""; });
  // 「編輯／預覽匯出版面」切換：預覽時隱藏編輯區（內容保留），顯示與 PDF 相同版面的紙張
  const pane = box.querySelector(".ed-pane"), pv = box.querySelector(".print-preview"), title = box.querySelector(`#et-${key}`);
  const onResize = () => { if (!box.isConnected) removeEventListener("resize", onResize); else if (!pv.hidden) fitPreview(pv); };
  addEventListener("resize", onResize);
  box.querySelector(".ed-mode").addEventListener("click", (e) => {
    const b = e.target.closest("[data-mode]"); if (!b) return;
    const preview = b.dataset.mode === "preview";
    box.querySelectorAll(".ed-mode button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    pane.hidden = preview; pv.hidden = !preview;
    if (preview) printPreview(pv, title.value.trim() || (c ? c.title : "新條文"), normalize(ed.innerHTML));
    else ed.focus();
  });
  const tb = box.querySelector(".toolbar");
  tb.addEventListener("mousedown", (e) => e.preventDefault());
  tb.addEventListener("click", (e) => {
    const b = e.target.closest("[data-cmd]"); if (!b) return;
    ed.focus();
    if (b.dataset.cmd === "table") document.execCommand("insertHTML", false, "<table><tbody><tr><td>　</td><td>　</td><td>　</td></tr><tr><td>　</td><td>　</td><td>　</td></tr></tbody></table><p><br></p>");
    else if (/^(row|col)[+-]$/.test(b.dataset.cmd)) tableOp(ed, b.dataset.cmd);
    else if (b.dataset.cmd === "image") { keepRange(); fileIn.click(); }
    else document.execCommand(b.dataset.cmd, false, null);
  });
  return box;
}
