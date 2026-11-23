// PDF 匯出：每段先在畫面外排版（#pdf-stage，與畫面的紙張檢視同一套樣式 .pf），用 html2canvas 轉成圖片以忠實保留版面，
// 再疊上一層看不見的文字（Noto Sans TC），讓 PDF 可以選取與搜尋。未定稿時加上「草案」浮水印。
import { esc } from "../core/dom.js";
import { need } from "../core/loader.js";
import { A4, FLOW_WIDTH, MM_PER_PX, headHtml, measureBlocks, pageCount, pageFooter, pageHeader, paginate } from "../lib/paginate.js";

let fontB64 = null;
async function loadPdfFont() {
  if (fontB64) return fontB64;
  const res = await fetch("/fonts/NotoSansTC-Regular.ttf");
  if (!res.ok) throw new Error("font " + res.status);
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return (fontB64 = btoa(bin));
}
function textLines(block) {
  const base = block.getBoundingClientRect(), out = [], rg = document.createRange();
  const w = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let node, cur = null;
  while ((node = w.nextNode())) {
    const fs = parseFloat(getComputedStyle(node.parentElement).fontSize) || 16;
    for (let i = 0; i < node.data.length; i++) {
      const ch = node.data[i]; if (ch === "\n" || ch === "\r") continue;
      rg.setStart(node, i); rg.setEnd(node, i + 1);
      const rs = rg.getClientRects(); if (!rs.length) continue;
      const r = rs[rs.length - 1]; if (!r.width && ch.trim()) continue;
      const top = r.top - base.top, left = r.left - base.left, right = r.right - base.left, bottom = r.bottom - base.top;
      if (cur && Math.abs(top - cur.top) < fs * 0.5 && left >= cur.right - 1.5 && left - cur.right < fs * 1.2) { cur.text += ch; cur.right = right; }
      else { if (cur) out.push(cur); cur = { text: ch, left, right, top, bottom, fs }; }
    }
  }
  if (cur) out.push(cur);
  return out.filter((l) => l.text.trim());
}

// meta: { title, caseNo, final, round }；clauses: [{ title, html }]（html 需已清理）；stage: 畫面外的容器
// 分頁由 lib/paginate.js 決定（與畫面上的紙張檢視相同），每段轉成圖片後依分頁結果放到各頁。
export async function buildPdf(meta, clauses, stage) {
  await need("html2canvas", "jspdf");
  let textLayer = true;
  stage.className = "pf";
  stage.innerHTML = headHtml(meta) + clauses.map((c) => `<div class="pb"><h3>${esc(c.title)}</h3><div class="rich">${c.html}</div></div>`).join("");
  try {
    await Promise.all([...stage.querySelectorAll("img")].map((im) => im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; })));
    try { await document.fonts.ready; } catch {}
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
    try { pdf.addFileToVFS("tc.ttf", await loadPdfFont()); pdf.addFont("tc.ttf", "tc", "normal"); pdf.setFont("tc"); }
    catch (e) { console.warn(e); textLayer = false; }
    const k = MM_PER_PX, blocks = [...stage.children];
    const segs = paginate(measureBlocks(stage).blocks);
    for (let p = 1; p < pageCount(segs); p++) pdf.addPage();
    const canvases = new Map();
    for (const s of segs) {
      const block = blocks[s.block];
      if (!canvases.has(s.block)) canvases.set(s.block, { cv: await window.html2canvas(block, { scale: 2, backgroundColor: "#ffffff", logging: false, useCORS: true }), lines: textLines(block) });
      const { cv, lines } = canvases.get(s.block);
      const pxPerCss = cv.width / block.offsetWidth, sy = Math.round(s.from * pxPerCss), sh = Math.min(cv.height - sy, Math.round((s.to - s.from) * pxPerCss));
      if (sh <= 0) continue;
      const part = document.createElement("canvas"); part.width = cv.width; part.height = sh;
      part.getContext("2d").drawImage(cv, 0, sy, cv.width, sh, 0, 0, cv.width, sh);
      pdf.setPage(s.page + 1);
      const y = A4.top + s.y * k;
      pdf.addImage(part.toDataURL("image/jpeg", 0.92), "JPEG", A4.side, y, FLOW_WIDTH * k, (sh / pxPerCss) * k);
      if (textLayer) for (const l of lines) {
        if (l.top < s.from - 1 || l.top >= s.to - 1) continue;
        pdf.setFontSize((l.fs * k) / 0.3528);
        const natural = pdf.getTextWidth(l.text), target = (l.right - l.left) * k;
        const cs = l.text.length > 1 ? (target - natural) / (l.text.length - 1) : 0;
        pdf.text(l.text, A4.side + l.left * k, y + (l.top - s.from + (l.bottom - l.top) * 0.8) * k, { renderingMode: "invisible", charSpace: cs });
      }
    }
    const n = pdf.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      pdf.setPage(i);
      if (textLayer) {
        pdf.setFont("tc");
        if (!meta.final) {
          // light "草案" watermark so a draft is never mistaken for the signed version
          pdf.saveGraphicsState(); pdf.setGState(new pdf.GState({ opacity: 0.07 }));
          pdf.setFontSize(110); pdf.setTextColor(0);
          pdf.text("草案", 105, 160, { align: "center", angle: 30 });
          pdf.restoreGraphicsState();
        }
        pdf.setFontSize(9); pdf.setTextColor(110);
        pdf.text(pageFooter(i, n), A4.w / 2, A4.footerAt, { align: "center" });
        if (i > 1) pdf.text(pageHeader(meta), A4.w / 2, A4.headerAt, { align: "center" });
      } else {
        pdf.setFont("helvetica"); pdf.setFontSize(9); pdf.setTextColor(110);
        pdf.text(`${i} / ${n}`, 105, 297 - 10, { align: "center" });
      }
    }
    pdf.setProperties({ title: meta.title, subject: [meta.caseNo && `案號 ${meta.caseNo}`, meta.final ? "定稿本" : "契約草案"].filter(Boolean).join("　") });
    return { blob: pdf.output("blob"), textLayer };
  } finally {
    stage.innerHTML = "";
  }
}
