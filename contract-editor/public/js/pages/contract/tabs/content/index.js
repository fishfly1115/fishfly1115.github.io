// 「契約內容」頁：條文目錄＋契約紙張；閱讀、勾選填寫、修訂、新增或調整條文。
// 工具列有這一頁的主要按鈕（交給他方）、匯出，以及「更多」選單（匯入、修訂紀錄）。
import { $ } from "../../../../core/dom.js";
import { store } from "../../../../core/storage.js";
import { S, ctx } from "../../context.js";
import { render } from "../../render.js";
import { go } from "../../router.js";
import { simple } from "../../sync.js";
import { sheetHtml } from "./clauses.js";
import { save } from "./editing.js";
import { editorEl } from "./editor.js";
import { closePop, openPop } from "./field-popover.js";
import { fieldChange } from "./fields.js";
import { locate } from "./locate.js";
import { renderOutline, watchOutline } from "./outline.js";
import { renderToolbar } from "./toolbar.js";
import { SIDE, otherSide } from "../../state.js";

// 編輯中的條文：重繪時保留同一個編輯器元素，避免清掉尚未儲存的內容
let keptEditor = null;
const editingKey = () => S.editing || (S.adding ? "new" : null);

/** @type {import("../index.js").Tab} */
export default {
  id: "content",
  nav: { label: "契約內容" },
  title: () => "契約內容",
  lede: () => "直接勾選、填寫，或按「修訂」修改條文；每處修改都會留下紀錄，交由他方審閱。",
  tasks: () => ["點 □ 勾選，點底線空格或日期直接填寫", "要改條文文字，按條文右上「修訂」", `全部改完，按右上「交給${SIDE[otherSide()]}」`],
  html() {
    const key = editingKey();
    keptEditor = key ? document.getElementById("editor-" + key) : null;
    return sheetHtml();
  },
  after() {
    const key = editingKey();
    const slot = key && document.getElementById("slot-" + key);
    if (slot) slot.replaceWith(keptEditor || editorEl(key === "new" ? null : S.clauses.find((c) => c.id === key)));
    renderToolbar();
    renderOutline();
    watchOutline();
  },
  actions: {
    edit: (el, id) => {
      const c = S.clauses.find((x) => x.id === id);
      Object.assign(S, { editing: id, adding: null, editBase: { rev: c.rev }, confirm: null });
      render(); $("eb-" + id)?.focus();
    },
    add: (el) => { Object.assign(S, { adding: { afterId: el.dataset.after || null }, editing: null, confirm: null }); render(); $("et-new")?.focus(); },
    cancel: () => { S.editing = null; S.adding = null; render(); },
    save: (el, id) => save(id),
    up: (el, id) => simple(`clauses/${id}/move`, { dir: -1 }),
    down: (el, id) => simple(`clauses/${id}/move`, { dir: 1 }),
    "delete-open": (el, id) => { S.confirm = { id, kind: "delete" }; render(); },
    "delete-do": (el, id) => simple(`clauses/${id}/delete`, {}, "已提議刪除，他方接受後才會正式刪除"),
    // 撤回本方尚未審閱的修訂
    "revert-open": (el, id) => { S.confirm = { id, kind: "revert" }; render(); $("reason-" + id)?.focus(); },
    "revert-do": (el, id) => simple(`clauses/${id}/revert`, { note: (el.closest(".confirm")?.querySelector("input")?.value || "").trim() }, "已撤回，條文恢復為修訂前內容"),
    "confirm-cancel": () => { S.confirm = null; render(); },
    "toggle-plain": (el, id) => { S.plainView.has(id) ? S.plainView.delete(id) : S.plainView.add(id); render(); },
    "review-go": (el, id) => { S.focusPending = id; go("review"); },
    goto: (el, id, ev) => { ev.preventDefault(); locate(id, { flash: false }); },
    "outline-toggle": () => { S.outlineOpen = !S.outlineOpen; render(); },
    "more-toggle": () => { S.moreOpen = !S.moreOpen; render(); },
    "only-checked": (el) => {
      S.onlyChecked = el.dataset.v === "1";
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
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !(S.outlineOpen || S.moreOpen)) return;
      S.outlineOpen = false; S.moreOpen = false; render();
    });
  }
};
