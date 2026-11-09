// 匯出 Word（.docx）：把契約的 HTML 條文轉成真正的 Word 段落、清單與表格。
// 每條條文的標題使用「標題 2」樣式，重新匯入修訂版時即依此逐條比對。需要全域的 docx（docx@8）。

const FONT_EA = "標楷體", FONT_LATIN = "Times New Roman";

async function loadImages(root) {
  const map = new Map();
  await Promise.all([...root.querySelectorAll("img")].map(async (img) => {
    const src = img.getAttribute("src");
    if (!src || map.has(src)) return;
    try {
      const res = await fetch(src); if (!res.ok) return;
      const buf = await res.arrayBuffer();
      const dim = await new Promise((ok) => { const i = new Image(); i.onload = () => ok([i.naturalWidth, i.naturalHeight]); i.onerror = () => ok([400, 300]); i.src = URL.createObjectURL(new Blob([buf])); });
      const maxW = 600, scale = Math.min(1, maxW / (dim[0] || maxW));
      map.set(src, { data: buf, w: Math.round(dim[0] * scale), h: Math.round(dim[1] * scale) });
    } catch { /* skip images that cannot be fetched */ }
  }));
  return map;
}

function build(D, images) {
  const runs = (node, st = {}) => {
    const out = [];
    for (const c of node.childNodes) {
      if (c.nodeType === 3) { if (c.data) out.push(new D.TextRun({ text: c.data, bold: st.b, italics: st.i, underline: st.u ? {} : undefined, strike: st.s })); continue; }
      if (c.nodeType !== 1) continue;
      const t = c.tagName;
      if (t === "BR") { out.push(new D.TextRun({ text: "", break: 1 })); continue; }
      if (t === "IMG") { const im = images.get(c.getAttribute("src")); if (im) out.push(new D.ImageRun({ data: im.data, transformation: { width: im.w, height: im.h } })); continue; }
      const ns = { ...st };
      if (t === "STRONG" || t === "B") ns.b = true;
      if (t === "EM" || t === "I") ns.i = true;
      if (t === "U" || t === "INS") ns.u = true;
      if (t === "S" || t === "DEL") ns.s = true;
      out.push(...runs(c, ns));
    }
    return out;
  };
  const indent = (el) => { const n = parseInt(el.getAttribute("data-i") || "0", 10) || 0; return n ? { left: n * 120 } : undefined; };
  const para = (el, extra = {}) => new D.Paragraph({ children: runs(el, /^H[1-6]$/.test(el.tagName) ? { b: true } : {}), indent: indent(el), spacing: { line: 360, after: 60 }, ...extra });

  function blocks(container, depth = 0) {
    const out = [];
    const loose = [];
    const flushLoose = () => { if (loose.length) { const p = new D.Paragraph({ children: loose.flatMap((n) => runs({ childNodes: [n] })), spacing: { line: 360, after: 60 } }); out.push(p); loose.length = 0; } };
    for (const el of container.childNodes) {
      if (el.nodeType === 3) { if (el.data.trim()) loose.push(el); continue; }
      if (el.nodeType !== 1) continue;
      const t = el.tagName;
      if (["STRONG", "B", "EM", "I", "U", "S", "SPAN", "BR", "IMG", "INS", "DEL", "SUB", "SUP"].includes(t)) { loose.push(el); continue; }
      flushLoose();
      if (t === "OL" || t === "UL") {
        for (const li of el.children) {
          if (li.tagName !== "LI") continue;
          const nested = [...li.children].filter((x) => x.tagName === "OL" || x.tagName === "UL");
          const clone = li.cloneNode(true); clone.querySelectorAll("ol,ul").forEach((x) => x.remove());
          out.push(new D.Paragraph({ children: runs(clone), numbering: { reference: t === "OL" ? "ol" : "ul", level: Math.min(depth, 8) }, spacing: { line: 360, after: 60 } }));
          for (const n of nested) out.push(...blocks({ childNodes: [n] }, depth + 1));
        }
      } else if (t === "TABLE") {
        const rows = [...el.querySelectorAll("tr")].filter((tr) => tr.closest("table") === el);
        if (!rows.length) continue;
        out.push(new D.Table({
          width: { size: 100, type: D.WidthType.PERCENTAGE },
          rows: rows.map((tr) => new D.TableRow({
            children: [...tr.children].filter((td) => td.tagName === "TD" || td.tagName === "TH").map((td) => {
              const inner = blocks(td, depth);
              return new D.TableCell({
                children: inner.length ? inner : [new D.Paragraph("")],
                columnSpan: parseInt(td.getAttribute("colspan") || "1", 10) || 1,
                rowSpan: parseInt(td.getAttribute("rowspan") || "1", 10) || 1,
                margins: { top: 60, bottom: 60, left: 100, right: 100 }
              });
            })
          }))
        }));
        out.push(new D.Paragraph(""));
      } else if (t === "BLOCKQUOTE" || t === "DIV" || t === "TD" || t === "TH") {
        const inner = blocks(el, depth);
        if (inner.length) out.push(...inner); else out.push(para(el));
      } else out.push(para(el));
    }
    flushLoose();
    return out;
  }
  return blocks;
}

// meta: { title, caseNo, status, date }; clauses: [{ title, html }]
async function toBlob(meta, clauses) {
  const D = window.docx;
  const holder = document.createElement("div");
  holder.innerHTML = clauses.map((c) => c.html).join("");
  const images = await loadImages(holder);
  const blocks = build(D, images);
  const children = [
    new D.Paragraph({ heading: D.HeadingLevel.TITLE, alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: meta.title, bold: true, size: 36 })], spacing: { after: 120 } })
  ];
  if (meta.caseNo) children.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: `案號：${meta.caseNo}`, size: 20 })] }));
  children.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: `${meta.status}　${meta.date}`, size: 20, color: "555555" })], spacing: { after: 240 } }));
  for (const c of clauses) {
    children.push(new D.Paragraph({ heading: D.HeadingLevel.HEADING_2, children: [new D.TextRun({ text: c.title })], spacing: { before: 240, after: 80 } }));
    const box = document.createElement("div"); box.innerHTML = c.html;
    children.push(...blocks(box));
  }
  const level = (i, fmt, text) => ({ level: i, format: fmt, text, alignment: D.AlignmentType.LEFT, style: { paragraph: { indent: { left: 480 * (i + 1), hanging: 360 } } } });
  const doc = new D.Document({
    creator: "合約共同編輯器",
    title: meta.title,
    styles: {
      default: { document: { run: { font: { ascii: FONT_LATIN, hAnsi: FONT_LATIN, eastAsia: FONT_EA }, size: 24 } } },
      paragraphStyles: [
        { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", run: { font: { eastAsia: FONT_EA, ascii: FONT_LATIN }, size: 36, bold: true, color: "000000" } },
        { id: "Heading2", name: "heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: { eastAsia: FONT_EA, ascii: FONT_LATIN }, size: 26, bold: true, color: "000000" }, paragraph: { keepNext: true } }
      ]
    },
    numbering: {
      config: [
        { reference: "ol", levels: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => level(i, [D.LevelFormat.DECIMAL, D.LevelFormat.LOWER_LETTER, D.LevelFormat.LOWER_ROMAN][i % 3], `%${i + 1}.`)) },
        { reference: "ul", levels: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => level(i, D.LevelFormat.BULLET, ["•", "◦", "▪"][i % 3])) }
      ]
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1300, right: 1300 } } },
      footers: { default: new D.Footer({ children: [new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ children: ["第 ", D.PageNumber.CURRENT, " 頁，共 ", D.PageNumber.TOTAL_PAGES, " 頁"], size: 18, color: "666666" })] })] }) },
      children
    }]
  });
  return D.Packer.toBlob(doc);
}

export { toBlob };
