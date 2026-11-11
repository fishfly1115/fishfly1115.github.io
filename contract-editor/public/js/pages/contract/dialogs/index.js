/**
 * 契約頁的對話視窗：同一時間最多開一個，S.dialog 為目前視窗的代號。
 * 每個視窗一個檔案（或資料夾），匯出一個視窗定義：
 *
 * @typedef {object} Dialog
 * @property {string} id                 視窗代號（S.dialog）
 * @property {() => string} title         標題
 * @property {() => string} html          內容（HTML 字串）
 * @property {() => string} foot          底部按鈕：一個主要、一個次要
 * @property {() => void} [open]          開啟時執行（例如載入資料）
 * @property {() => string} [key]         值改變時才重繪；背景更新時保留使用者正在看的內容
 * @property {Record<string, (el: HTMLElement, id: string|undefined, ev: Event) => void>} [actions]
 * @property {() => void} [init]          啟動時執行一次
 */
import { $, esc } from "../../../core/dom.js";
import { S } from "../context.js";
import { render } from "../render.js";
import exportDialog from "./export/index.js";
import handoff from "./handoff.js";

const DIALOGS = { handoff, export: exportDialog };

export function openDialog(id) {
  S.dialog = id;
  S.forceDialog = true;
  DIALOGS[id].open?.();
  render();
}

export function closeDialog() { S.dialog = null; render(); }

// 視窗內容改變後要重繪（例如切換匯出格式）
export function redrawDialog() { S.forceDialog = true; render(); }

export function renderDialog() {
  const root = $("dialog"), d = DIALOGS[S.dialog];
  if (!d || !S.loaded.c) { root.innerHTML = ""; root.hidden = true; delete root.dataset.key; return; }
  root.hidden = false;
  const key = `${d.id}:${d.key?.() ?? ""}`;
  if (root.querySelector(".dialog") && root.dataset.key === key && !S.forceDialog) return;
  const first = root.dataset.key?.split(":")[0] !== d.id;
  S.forceDialog = false;
  root.dataset.key = key;
  root.innerHTML = `<div class="scrim" data-act="dialog-close"></div>
    <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
      <h2 id="dlg-title">${esc(d.title())}</h2>
      ${d.html()}
      <footer class="dialog-foot">${d.foot()}</footer>
    </section>`;
  if (first) root.querySelector(".dialog-foot .btn.primary")?.focus();
}

export const dialogActions = {
  "handoff-review": () => openDialog("handoff"),
  "export-open": () => openDialog("export"),
  "dialog-close": () => closeDialog(),
  ...handoff.actions,
  ...exportDialog.actions
};

export function bindDialogs() {
  for (const d of Object.values(DIALOGS)) d.init?.();
  // Esc 關閉視窗
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.dialog) closeDialog(); });
}
