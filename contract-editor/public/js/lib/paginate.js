import { esc } from "../core/dom.js";
import { rocToday } from "../core/format.js";

// 分頁：決定每一段內容放在第幾頁。畫面上的紙張檢視與 PDF 匯出共用這一份（版面尺寸、標題區、量測與分頁），
// 所以兩邊在同樣的位置換頁。
//
// 單位是排版用的 CSS 像素：內文寬 794px 對應 A4 扣掉左右邊界後的 170mm。
// 每一段（標題區、每一條條文）是一個 block；一條條文太長、一頁放不下時，只在「可以切開的位置」換頁
// （條文內每個段落或表格列的上緣），不會把一行字切成兩半。

/** A4 版面（mm），與 PDF 相同 */
export const A4 = { w: 210, h: 297, side: 20, top: 18, bottom: 20, headerAt: 11, footerAt: 287 };
/** 排版寬度（CSS 像素）＝ A4 內文寬 170mm */
export const FLOW_WIDTH = 794;
/** 1 CSS 像素等於幾 mm */
export const MM_PER_PX = (A4.w - 2 * A4.side) / FLOW_WIDTH;
/** 一頁可放內文的高度（CSS 像素） */
export const PAGE_CONTENT = (A4.h - A4.top - A4.bottom) / MM_PER_PX;
/** 一段長內容要切開時，本頁剩下不到這個高度就直接換頁（與原 PDF 規則相同：30mm） */
const MIN_REMAIN = 30 / MM_PER_PX;
/** 切開後本頁至少要放這麼多，避免只放一點點就換頁 */
const MIN_SLICE = 20;

/**
 * @param {{ h: number, cuts: number[] }[]} blocks  每段的高度，以及段內可以換頁的位置（距段落上緣，遞增）
 * @param {number} [pageH] 每頁內文高度
 * @returns {{ block: number, page: number, y: number, from: number, to: number }[]}
 *   每個片段：第幾段、放在第幾頁（0 起算）、在該頁內文的位置，以及取該段的哪一部分（from～to）
 */
export function paginate(blocks, pageH = PAGE_CONTENT) {
  const out = [];
  let page = 0, y = 0;
  blocks.forEach((b, block) => {
    if (b.h <= pageH - y || (y === 0 && b.h <= pageH)) { out.push({ block, page, y, from: 0, to: b.h }); y += b.h; return; }
    if (b.h <= pageH) { page++; y = 0; out.push({ block, page, y, from: 0, to: b.h }); y = b.h; return; }
    // 一頁放不下：在可以切開的位置分到多頁
    let from = 0;
    while (from < b.h) {
      if (pageH - y < MIN_REMAIN && y > 0) { page++; y = 0; }
      const room = pageH - y;
      let to = b.h;
      if (from + room < b.h) {
        const fits = b.cuts.filter((c) => c > from + MIN_SLICE && c <= from + room);
        to = fits.length ? fits[fits.length - 1] : (y > 0 ? from : from + room);
      }
      if (to === from) { page++; y = 0; continue; } // 本頁放不下任何一段，換頁再放
      out.push({ block, page, y, from, to });
      y += to - from; from = to;
      if (from < b.h) { page++; y = 0; }
    }
  });
  return out;
}

/** 總頁數 */
export const pageCount = (segments) => segments.length ? segments[segments.length - 1].page + 1 : 1;

/**
 * 量測排版區（.pf）裡每一段的高度與可換頁位置。可換頁位置是條文內文（.rich）第 2 個起每個段落的上緣
 * （第 1 段不切，讓條文標題至少帶著一段內文）。
 * @param {HTMLElement} flow
 * @returns {{ blocks: { h: number, cuts: number[] }[], at: Map<number, HTMLElement>[] }}  at：每段「位置 → 該段落元素」
 */
export function measureBlocks(flow) {
  const blocks = [], at = [];
  for (const b of flow.children) {
    const rich = b.querySelector(".rich"), map = new Map(), top = b.getBoundingClientRect().top;
    // 以實際畫面位置換算（不受縮放與 offsetParent 影響），再除以縮放比例
    const scale = b.getBoundingClientRect().height / (b.offsetHeight || 1) || 1;
    for (const el of rich ? [...rich.children].slice(1) : []) map.set((el.getBoundingClientRect().top - top) / scale, el);
    blocks.push({ h: b.offsetHeight, cuts: [...map.keys()] });
    at.push(map);
  }
  return { blocks, at };
}

/** 標題區（契約名稱、案號、草案或定稿、列印日期），畫面與 PDF 用同一段 */
export const headHtml = ({ title, caseNo, final, round }) =>
  `<div class="pb ph"><h2>${esc(title)}</h2>${caseNo ? `<p>案號：${esc(caseNo)}</p>` : ""}<p>${final ? `定稿本（第 ${round} 輪）` : `契約草案（第 ${round} 輪）`}　列印日期：${rocToday()}</p></div>`;

/** 頁首（第 2 頁起）：契約名稱與案號 */
export const pageHeader = ({ title, caseNo }) => { const h = [title, caseNo && `案號：${caseNo}`].filter(Boolean).join("　"); return h.length > 46 ? h.slice(0, 45) + "…" : h; };
/** 頁尾 */
export const pageFooter = (i, n) => `第 ${i} 頁，共 ${n} 頁`;
