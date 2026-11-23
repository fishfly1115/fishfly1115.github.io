// 紙張檢視的版面：依 lib/paginate.js（與 PDF 相同）把條文排到一頁頁 A4 紙上，畫出頁首、頁尾頁碼與草案浮水印，
// 處理縮放，並把修訂註記對齊到條文旁邊。內容改變（編輯、圖片載入、視窗大小）時重新排一次。
import { $, esc } from "../../../../core/dom.js";
import { store } from "../../../../core/storage.js";
import { A4, MM_PER_PX, measureBlocks, pageCount, pageFooter, pageHeader, paginate } from "../../../../lib/paginate.js";
import { S } from "../../context.js";
import { caseNo, docTitle, status } from "../../state.js";

const px = (mm) => mm / MM_PER_PX;
/** 一張 A4 紙（CSS 像素，與排版寬度同比例） */
export const PAGE = { w: px(A4.w), h: px(A4.h), side: px(A4.side), top: px(A4.top), gap: 28 };
const ZOOMS = [0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5];
const NOTES_W = 280;

// ── 縮放 ────────────────────────────────────────────────

S.zoom = (() => { const z = store.get("ce:zoom"); return z && z !== "fit" ? Number(z) || "fit" : "fit"; })();
let zoomNow = 1;
const setZoom = (z) => { S.zoom = z; store.set("ce:zoom", String(z)); layoutPaper(); };
export const zoomActions = {
  "zoom-in": () => setZoom(ZOOMS.find((z) => z > zoomNow + 0.01) || ZOOMS[ZOOMS.length - 1]),
  "zoom-out": () => setZoom([...ZOOMS].reverse().find((z) => z < zoomNow - 0.01) || ZOOMS[0]),
  "zoom-fit": () => setZoom("fit")
};
/** 目前縮放比例（工具列顯示用） */
export const zoomLabel = () => S.zoom === "fit" ? "符合頁寬" : Math.round(zoomNow * 100) + "%";

// ── 排版 ────────────────────────────────────────────────

export function layoutPaper() {
  const desk = $("desk"), paper = $("paper"), galley = $("galley"), wrap = $("paper-wrap");
  if (!desk || !galley) return;
  const avail = desk.clientWidth - 16;
  const withNotes = avail >= PAGE.w * 0.6 + NOTES_W;
  desk.classList.toggle("with-notes", withNotes);
  const fit = Math.min(1, (avail - (withNotes ? NOTES_W : 0)) / PAGE.w);
  const z = zoomNow = S.zoom === "fit" ? fit : S.zoom;
  paper.style.transform = `scale(${z})`;
  paper.style.width = PAGE.w + "px";
  galley.style.padding = `${PAGE.top}px ${PAGE.side}px 0`;
  const label = $("zoom-label"); if (label) label.textContent = zoomLabel();

  // 先清掉上次為換頁加的間距，再依量測結果排
  for (const el of galley.querySelectorAll("[data-pgm]")) { el.style.marginTop = ""; el.removeAttribute("data-pgm"); }
  const { blocks, at } = measureBlocks(galley);
  const segs = paginate(blocks), n = pageCount(segs), kids = [...galley.children];
  const top0 = () => galley.getBoundingClientRect().top;
  const yOf = (el) => (el.getBoundingClientRect().top - top0()) / z;
  for (const s of segs) {
    const el = s.from === 0 ? kids[s.block] : at[s.block].get(s.from);
    if (!el) continue;
    const target = s.page * (PAGE.h + PAGE.gap) + PAGE.top + s.y;
    for (let i = 0; i < 3; i++) { // 相鄰段落的邊距會合併，量一次調一次
      const d = target - yOf(el); if (Math.abs(d) < 0.5) break;
      el.style.marginTop = (parseFloat(getComputedStyle(el).marginTop) || 0) + d + "px"; el.dataset.pgm = "1";
    }
  }
  const H = n * PAGE.h + (n - 1) * PAGE.gap;
  paper.style.height = H + "px";
  wrap.style.width = PAGE.w * z + "px"; wrap.style.height = H * z + "px";
  drawPages(n);

  // 條文在第幾頁（目錄）
  const pageOf = new Map();
  for (const s of segs) { const id = kids[s.block]?.dataset.cid; if (id && !pageOf.has(id)) pageOf.set(id, s.page + 1); }
  for (const el of document.querySelectorAll(".o-pg[data-cid]")) el.textContent = pageOf.has(el.dataset.cid) ? "p." + pageOf.get(el.dataset.cid) : "";
  const op = $("o-pages"); if (op) op.textContent = `· 共 ${n} 頁`;

  if (withNotes) placeNotes(galley, yOf, z);
}

// 每張紙：頁首（第 2 頁起）、頁尾頁碼、未定稿的「草案」浮水印——與 PDF 相同位置
function drawPages(n) {
  const meta = { title: docTitle(), caseNo: caseNo() }, draft = status() !== "final";
  // 頁首、頁尾在 PDF 是以文字基線定位（mm），這裡換算成上緣位置
  const head = px(A4.headerAt) - 12, foot = px(A4.footerAt) - 12, mark = px(160);
  $("pages").innerHTML = Array.from({ length: n }, (_, i) => `<div class="page" style="top:${i * (PAGE.h + PAGE.gap)}px;height:${PAGE.h}px">
    ${i ? `<div class="pg-head" style="top:${head}px">${esc(pageHeader(meta))}</div>` : ""}${draft ? `<div class="pg-mark" style="top:${mark}px">草案</div>` : ""}<div class="pg-foot" style="top:${foot}px">${pageFooter(i + 1, n)}</div></div>`).join("");
  // 頁與頁之間的空隙蓋在條文上面：跨頁條文的色條、底色不會畫進空隙
  $("gaps").innerHTML = Array.from({ length: n - 1 }, (_, i) => `<div class="pg-gap" style="top:${(i + 1) * PAGE.h + i * PAGE.gap}px;height:${PAGE.gap}px"></div>`).join("");
}

// 修訂註記對齊條文上緣；太擠時往下排
function placeNotes(galley, yOf, z) {
  let bottom = 0;
  for (const card of $("notes").children) {
    const block = galley.querySelector(`[data-cid="${CSS.escape(card.dataset.for)}"]`); if (!block) continue;
    const top = Math.max(yOf(block) * z, bottom);
    card.style.top = top + "px"; bottom = top + card.offsetHeight + 8;
  }
}

// ── 重新排版的時機 ──────────────────────────────────────

let timer = 0;
export const relayout = (delay = 120) => { clearTimeout(timer); timer = setTimeout(layoutPaper, delay); };

export function bindPaper() {
  addEventListener("resize", () => relayout(150));
  document.addEventListener("input", (e) => { if (e.target.closest?.("#galley")) relayout(250); });
  document.addEventListener("load", (e) => { if (e.target.tagName === "IMG" && e.target.closest("#galley")) relayout(50); }, true);
  document.fonts?.ready.then(() => relayout(0));
}

