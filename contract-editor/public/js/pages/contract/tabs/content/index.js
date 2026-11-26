// 「契約內容」頁：條文目錄＋契約紙張；閱讀、勾選填寫、直接修訂（像 Word）、新增或調整條文。
// 工具列有格式按鈕、這一頁的主要按鈕（交給他方）、匯出，以及「更多」選單（匯入、修訂紀錄、只顯示已勾選）。
import { $ } from "../../../../core/dom.js";
import { store } from "../../../../core/storage.js";
import { S, ctx } from "../../context.js";
import { render } from "../../render.js";
import { go } from "../../router.js";
import { simple } from "../../sync.js";
import { paperHtml } from "./clauses.js";
import { closePop, openPop } from "./field-popover.js";
import { fieldChange } from "./fields.js";
import { addClause, beginEdit, conflictActions, editorFor, finishEdit, hasUnsaved, keepSelection, restoreSelection, runCommand } from "./inline-editor.js";
import { locate } from "./locate.js";
import { renderOutline, watchOutline } from "./outline.js";
import { bindPaper, layoutPaper, zoomActions } from "./paper.js";
import { renderToolbar } from "./toolbar.js";

// 重繪時保留編輯中條文的游標位置（編輯區元素本身由 inline-editor.js 沿用）
let kept = null;

/** @type {import("../index.js").Tab} */
export default {
  id: "content",
  nav: { label: "契約內容" },
  title: () => "", // 分頁按鈕已標示，不重複標題
  html() {
    kept = keepSelection();
    return paperHtml();
  },
  after() {
    const c = S.editing && S.clauses.find((x) => x.id === S.editing);
    const slot = c && document.getElementById("slot-" + c.id);
    if (slot) { slot.replaceWith(editorFor(c)); restoreSelection(kept); }
    kept = null;
    renderToolbar();
    renderOutline();
    layoutPaper();
    watchOutline();
  },
  leave: () => finishEdit(),
  actions: {
    ...conflictActions,
    ...zoomActions,
    // 修訂註記：有註記欄時捲到該則並標示，沒有（窄螢幕）時從下方開啟
    "note-open": (el, id) => {
      const card = document.querySelector(`#desk.with-notes .note[data-for="${CSS.escape(id)}"]`);
      if (card) { card.classList.remove("flash"); void card.offsetWidth; card.classList.add("flash"); return; }
      S.noteOpen = id; render();
    },
    "note-close": () => { S.noteOpen = null; S.confirm = null; render(); },
    add: (el) => addClause(el.dataset.after),
    up: (el, id) => simple(`clauses/${id}/move`, { dir: -1 }),
    down: (el, id) => simple(`clauses/${id}/move`, { dir: 1 }),
    "delete-open": (el, id) => { S.confirm = { id, kind: "delete" }; S.noteOpen = id; render(); },
    "delete-do": (el, id) => simple(`clauses/${id}/delete`, {}, "已提議刪除，他方接受後才會正式刪除"),
    // 撤回本方尚未審閱的修訂
    "revert-open": (el, id) => { S.confirm = { id, kind: "revert" }; S.noteOpen = S.noteOpen && id; render(); $("reason-" + id)?.focus(); },
    "revert-do": (el, id) => simple(`clauses/${id}/revert`, { note: (el.closest(".confirm")?.querySelector("input")?.value || "").trim() }, "已撤回，條文恢復為修訂前內容"),
    "confirm-cancel": () => { S.confirm = null; S.noteOpen = null; render(); },
    "toggle-plain": (el, id) => { S.plainView.has(id) ? S.plainView.delete(id) : S.plainView.add(id); render(); },
    "review-go": (el, id) => { S.focusPending = id; S.reviewView = "todo"; go("review"); },
    goto: (el, id, ev) => { ev.preventDefault(); locate(id, { flash: false }); },
    "outline-toggle": () => { S.outlineOpen = !S.outlineOpen; render(); },
    "more-toggle": () => { S.moreOpen = !S.moreOpen; render(); },
    "only-checked": () => {
      S.onlyChecked = !S.onlyChecked;
      store.set("ce:only:" + ctx.CID, S.onlyChecked ? "1" : null);
      closePop(); render();
    }
  },
  init() {
    // 點選可填寫欄位：□ 直接切換勾選，日期與空格開啟填寫視窗。用捕獲階段，先於一般按鈕處理。
    document.addEventListener("click", (e) => {
      const fx = e.target.closest(".fx");
      if (fx) {
        e.preventDefault();
        const cid = fx.closest("[data-cid]")?.dataset.cid, k = +fx.dataset.fx;
        if (!cid) return;
        if (fx.dataset.kind === "box") { closePop(); fieldChange(cid, k); }
        else openPop(fx, cid, k);
        return;
      }
      if ($("pop") && !e.target.closest("#pop")) closePop();
      if (S.outlineOpen && !e.target.closest("#outline,[data-act=outline-toggle]")) { S.outlineOpen = false; render(); }
      // 點選單外或選單項目都會收起「更多」選單（項目本身的操作仍會執行）
      if (S.moreOpen && !e.target.closest("[data-act=more-toggle]")) { S.moreOpen = false; render(); }
    }, true);
    // 點條文開始修訂；點條文以外的地方結束（格式按鈕、填寫視窗除外）
    document.addEventListener("click", (e) => {
      if (S.view !== "content") return;
      const t = e.target;
      if (S.editing && !t.closest(`#ie-${CSS.escape(S.editing)}, .ribbon, #pop`)) finishEdit();
      const sec = t.closest(".clause[data-editable]");
      if (sec && t.closest("h3, .rich") && !t.closest(".fx, button, a, input")) beginEdit(sec.dataset.cid, t.closest("h3") ? "title" : { x: e.clientX, y: e.clientY });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (S.editing) { finishEdit(); return; }
      if (S.noteOpen) { S.noteOpen = null; S.confirm = null; render(); return; }
      if (!(S.outlineOpen || S.moreOpen)) return;
      S.outlineOpen = false; S.moreOpen = false; render();
    });
    // 格式按鈕：按下時不讓編輯區失去游標
    document.addEventListener("mousedown", (e) => { if (e.target.closest(".ribbon button")) e.preventDefault(); });
    document.addEventListener("click", (e) => { const b = e.target.closest(".ribbon [data-cmd]"); if (b && !b.disabled) runCommand(b.dataset.cmd); });
    bindPaper();
    // 還有修改沒存好就關閉或離開頁面時提醒
    window.addEventListener("beforeunload", (e) => { if (hasUnsaved()) e.preventDefault(); });
  }
};
