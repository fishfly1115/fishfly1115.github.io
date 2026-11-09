// PDF 匯出：每段先在畫面外排版（#pdf-stage），用 html2canvas 轉成圖片以忠實保留版面，
// 再疊上一層看不見的文字（Noto Sans TC），讓 PDF 可以選取與搜尋。未定稿時加上「草案」浮水印。
import { esc } from "../core/dom.js";
import { rocToday } from "../core/format.js";
import { need } from "../core/loader.js";

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
export async function buildPdf(meta, clauses, stage) {
  await need("html2canvas", "jspdf");
  let textLayer = true;
  stage.innerHTML = `<div class="pb ph">${meta.final ? `<span class="seal">定<br>稿</span>` : ""}<h2>${esc(meta.title)}</h2>${meta.caseNo ? `<p>案號：${esc(meta.caseNo)}</p>` : ""}<p>${meta.final ? `定稿本（第 ${meta.round} 輪）` : `契約草案（第 ${meta.round} 輪）`}　列印日期：${rocToday()}</p></div>` +
    clauses.map((c) => `<div class="pb"><h3>${esc(c.title)}</h3><div class="rich">${c.html}</div></div>`).join("");
  try {
    await Promise.all([...stage.querySelectorAll("img")].map((im) => im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; })));
    try { await document.fonts.ready; } catch {}
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
    try { pdf.addFileToVFS("tc.ttf", await loadPdfFont()); pdf.addFont("tc.ttf", "tc", "normal"); pdf.setFont("tc"); }
    catch (e) { console.warn(e); textLayer = false; }
    const M = 20, W = 210 - 2 * M, TOP = 18, BOTTOM = 297 - 20, H = BOTTOM - TOP;
    let y = TOP;
    const newPage = () => { pdf.addPage(); y = TOP; };
    const writeText = (lines, k, yTop, fromCss, toCss) => {
      if (!textLayer) return;
      for (const l of lines) {
        if (l.top < fromCss - 1 || l.top >= toCss - 1) continue;
        pdf.setFontSize((l.fs * k) / 0.3528);
        const natural = pdf.getTextWidth(l.text), target = (l.right - l.left) * k;
        const cs = l.text.length > 1 ? (target - natural) / (l.text.length - 1) : 0;
        pdf.text(l.text, M + l.left * k, yTop + (l.top - fromCss + (l.bottom - l.top) * 0.8) * k, { renderingMode: "invisible", charSpace: cs });
      }
    };
    for (const block of stage.children) {
      const lines = textLines(block);
      const cv = await window.html2canvas(block, { scale: 2, backgroundColor: "#ffffff", logging: false, useCORS: true });
      const cssW = block.offsetWidth, k = W / cssW, pxPerCss = cv.width / cssW;
      const h = (cv.height / pxPerCss) * k;
      if (h <= H) {
        if (y + h > BOTTOM) newPage();
        pdf.addImage(cv.toDataURL("image/jpeg", 0.92), "JPEG", M, y, W, h);
        writeText(lines, k, y, 0, Infinity); y += h;
      } else {
        let sy = 0;
        while (sy < cv.height) {
          if (BOTTOM - y < 30) newPage();
          let sliceH = Math.min(cv.height - sy, Math.floor(((BOTTOM - y) / k) * pxPerCss));
          if (sy + sliceH < cv.height) {
            const cutCss = (sy + sliceH) / pxPerCss;
            const crossing = lines.filter((l) => l.top < cutCss && l.bottom > cutCss);
            if (crossing.length) { const safe = Math.min(...crossing.map((l) => l.top)) - 2; if (safe * pxPerCss > sy + 40) sliceH = Math.floor(safe * pxPerCss - sy); }
          }
          const part = document.createElement("canvas"); part.width = cv.width; part.height = sliceH;
          part.getContext("2d").drawImage(cv, 0, sy, cv.width, sliceH, 0, 0, cv.width, sliceH);
          pdf.addImage(part.toDataURL("image/jpeg", 0.92), "JPEG", M, y, W, (sliceH / pxPerCss) * k);
          writeText(lines, k, y, sy / pxPerCss, (sy + sliceH) / pxPerCss);
          y += (sliceH / pxPerCss) * k; sy += sliceH;
          if (sy < cv.height) newPage();
        }
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
        pdf.text(`第 ${i} 頁，共 ${n} 頁`, 105, 297 - 10, { align: "center" });
        const head = [meta.title, meta.caseNo && `案號：${meta.caseNo}`].filter(Boolean).join("　");
        if (i > 1) pdf.text(head.length > 46 ? head.slice(0, 45) + "…" : head, 105, 11, { align: "center" });
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
