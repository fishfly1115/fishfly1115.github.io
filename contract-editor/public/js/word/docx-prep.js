// Word 匯入前處理：把 Word 的自動編號（一、（一）、1.、□ 等）轉成真正的文字，並記下段落縮排，
// 讓 mammoth 轉出的 HTML 保留契約原本的條項款目編號與層級。需要全域的 JSZip。

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const MARK = ""; // + String.fromCharCode(0xE100 + halfEm) at the start of a paragraph
const kids = (el, name) => el ? [...el.childNodes].filter((n) => n.nodeType === 1 && n.namespaceURI === W && n.localName === name) : [];
const kid = (el, name) => kids(el, name)[0] || null;
const val = (el) => el ? (el.getAttributeNS(W, "val") ?? el.getAttribute("w:val")) : null;
const attr = (el, name) => el ? (el.getAttributeNS(W, name) ?? el.getAttribute("w:" + name)) : null;

const ZH = "〇一二三四五六七八九";
function zhCount(n) {
  if (n <= 0) return String(n);
  if (n < 10) return ZH[n];
  if (n < 20) return "十" + (n % 10 ? ZH[n % 10] : "");
  if (n < 100) return ZH[Math.floor(n / 10)] + "十" + (n % 10 ? ZH[n % 10] : "");
  if (n < 1000) { const h = Math.floor(n / 100), r = n % 100; return ZH[h] + "百" + (r ? (r < 10 ? "零" + ZH[r] : (r < 20 ? "一" : "") + zhCount(r)) : ""); }
  return String(n);
}
const LEGAL = "零壹貳參肆伍陸柒捌玖";
const legal = (n) => n < 10 ? LEGAL[n] : n < 20 ? "拾" + (n % 10 ? LEGAL[n % 10] : "") : LEGAL[Math.floor(n / 10)] + "拾" + (n % 10 ? LEGAL[n % 10] : "");
const roman = (n) => { const t = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]]; let s = ""; for (const [v, r] of t) while (n >= v) { s += r; n -= v; } return s; };
const letter = (n) => { let s = ""; while (n > 0) { n--; s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); } return s; };
function fmt(n, f) {
  switch (f) {
    case "taiwaneseCountingThousand": case "taiwaneseCounting": case "chineseCounting": case "chineseCountingThousand": case "ideographDigital": return zhCount(n);
    case "ideographTraditional": return "甲乙丙丁戊己庚辛壬癸"[(n - 1) % 10];
    case "ideographZodiac": return "子丑寅卯辰巳午未申酉戌亥"[(n - 1) % 12];
    case "ideographLegalTraditional": case "chineseLegalSimplified": return legal(n);
    case "decimalFullWidth": case "decimalFullWidth2": return String(n).replace(/\d/g, (d) => String.fromCharCode(0xff10 + +d));
    case "decimalEnclosedCircle": case "decimalEnclosedCircleChinese": return n <= 20 ? String.fromCharCode(0x2460 + n - 1) : String(n);
    case "decimalEnclosedParen": return n <= 20 ? String.fromCharCode(0x2474 + n - 1) : `(${n})`;
    case "lowerRoman": return roman(n);
    case "upperRoman": return roman(n).toUpperCase();
    case "lowerLetter": return letter(n);
    case "upperLetter": return letter(n).toUpperCase();
    case "decimalZero": return String(n).padStart(2, "0");
    case "none": return "";
    default: return String(n);
  }
}
// Symbol-font bullets (Wingdings / Symbol private-use characters) to Unicode.
const BULLETS = { "\uf06e": "■", "\uf075": "◆", "\uf06c": "●", "\uf0b7": "•", "\uf0a7": "▪", "\uf0d8": "➢", "\uf0fc": "✓", "\uf0a8": "□", "\uf06f": "□", "\uf071": "□", "\uf072": "□", "\uf0fe": "☑", "\uf076": "❖", "\uf0e0": "→" };
const bullet = (t) => [...(t || "•")].map((c) => BULLETS[c] || (c.charCodeAt(0) >= 0xf000 && c.charCodeAt(0) <= 0xf0ff ? "•" : c)).join("");

function twips(ind) { if (!ind) return null; const v = attr(ind, "left") ?? attr(ind, "start"); return v == null ? null : parseInt(v, 10) || 0; }

async function prepare(arrayBuffer) {
  const zip = await window.JSZip.loadAsync(arrayBuffer);
  const read = async (p) => zip.file(p) ? zip.file(p).async("string") : null;
  const P = new DOMParser();
  const docXml = await read("word/document.xml");
  if (!docXml) return arrayBuffer;
  const doc = P.parseFromString(docXml, "application/xml");
  const numXml = await read("word/numbering.xml");
  const stylesXml = await read("word/styles.xml");
  const abstracts = {}, nums = {}, styles = {};

  if (numXml) {
    const nd = P.parseFromString(numXml, "application/xml");
    for (const a of nd.getElementsByTagNameNS(W, "abstractNum")) {
      const id = attr(a, "abstractNumId"), lv = {};
      for (const l of kids(a, "lvl")) {
        const pPr = kid(l, "pPr");
        lv[attr(l, "ilvl")] = { fmt: val(kid(l, "numFmt")) || "decimal", text: val(kid(l, "lvlText")) ?? "", start: parseInt(val(kid(l, "start")) || "1", 10), suff: val(kid(l, "suff")) || "tab", ind: twips(kid(pPr, "ind")) };
      }
      abstracts[id] = { lv, link: val(kid(a, "numStyleLink")) };
    }
    for (const n of nd.getElementsByTagNameNS(W, "num")) {
      const ov = {};
      for (const o of kids(n, "lvlOverride")) { const so = kid(o, "startOverride"); if (so) ov[attr(o, "ilvl")] = parseInt(val(so), 10); }
      nums[attr(n, "numId")] = { abs: val(kid(n, "abstractNumId")), ov };
    }
  }
  if (stylesXml) {
    const sd = P.parseFromString(stylesXml, "application/xml");
    for (const s of sd.getElementsByTagNameNS(W, "style")) {
      if (attr(s, "type") !== "paragraph") continue;
      const pPr = kid(s, "pPr"), np = kid(pPr, "numPr");
      styles[attr(s, "styleId")] = { basedOn: val(kid(s, "basedOn")), numId: np ? val(kid(np, "numId")) : null, ilvl: np ? val(kid(np, "ilvl")) : null, ind: twips(kid(pPr, "ind")) };
    }
  }
  const styleProp = (id, key) => { for (let i = 0, s = styles[id]; s && i < 10; i++, s = styles[s.basedOn]) if (s[key] != null) return s[key]; return null; };

  const counters = {}; // abstractNumId -> {ilvl: n}
  const seenNum = new Set();
  const body = doc.getElementsByTagNameNS(W, "body")[0];
  for (const p of [...body.getElementsByTagNameNS(W, "p")]) {
    const pPr = kid(p, "pPr");
    const styleId = val(kid(pPr, "pStyle"));
    let np = kid(pPr, "numPr");
    let numId = np ? val(kid(np, "numId")) : styleProp(styleId, "numId");
    let ilvl = np ? val(kid(np, "ilvl")) : null;
    if (ilvl == null) ilvl = styleProp(styleId, "ilvl") ?? "0";
    let label = "", lvl = null;
    if (numId && numId !== "0" && nums[numId] && abstracts[nums[numId].abs]) {
      const num = nums[numId], absId = num.abs, abs = abstracts[absId];
      lvl = abs.lv[ilvl] || abs.lv["0"];
      const c = (counters[absId] ||= {});
      if (!seenNum.has(numId)) { seenNum.add(numId); for (const k of Object.keys(num.ov)) delete c[k], (c["ov" + k] = num.ov[k]); }
      if (lvl) {
        const L = parseInt(ilvl, 10);
        if (c[L] == null) c[L] = (c["ov" + L] ?? lvl.start) - 1;
        c[L]++;
        for (const k of Object.keys(c)) if (/^\d+$/.test(k) && +k > L) delete c[k];
        if (lvl.fmt === "bullet") label = bullet(lvl.text);
        else label = lvl.text.replace(/%(\d)/g, (_, d) => { const li = +d - 1, lv = abs.lv[li] || lvl; return fmt(c[li] ?? lv.start, lv.fmt); });
        if (label && lvl.suff !== "nothing" && !/[、）)：:\s]$/.test(label) && lvl.fmt !== "bullet") label += " ";
      }
      // stop mammoth from turning it into an HTML list; the label is now real text
      if (np) np.parentNode.removeChild(np);
      else if (pPr) { const z = doc.createElementNS(W, "w:numPr"); const ni = doc.createElementNS(W, "w:numId"); ni.setAttributeNS(W, "w:val", "0"); z.appendChild(ni); pPr.appendChild(z); }
    }
    let left = twips(kid(pPr, "ind"));
    if (left == null && lvl) left = lvl.ind;
    if (left == null) left = styleProp(styleId, "ind");
    const halfEm = Math.max(0, Math.min(60, Math.round((left || 0) / 120)));
    // Word shows numbers on empty numbered paragraphs, but in a contract they are just stray markers
    const hasText = [...p.getElementsByTagNameNS(W, "t")].some((t) => t.textContent.trim());
    let prefix = hasText ? label : "";
    const inCell = (() => { for (let a = p.parentNode; a; a = a.parentNode) if (a.localName === "tc") return true; return false; })();
    if (halfEm > 0 && !inCell) prefix = MARK + String.fromCharCode(0xE100 + halfEm) + prefix;
    if (!prefix) continue;
    const r = doc.createElementNS(W, "w:r"), t = doc.createElementNS(W, "w:t");
    t.setAttribute("xml:space", "preserve"); t.textContent = prefix; r.appendChild(t);
    const after = pPr ? pPr.nextSibling : p.firstChild;
    p.insertBefore(r, after);
  }
  zip.file("word/document.xml", new XMLSerializer().serializeToString(doc));
  return zip.generateAsync({ type: "arraybuffer" });
}

// After mammoth: turn the indent markers into data-i attributes.
function post(html) {
  return html
    .replace(new RegExp(`<(p|h[1-6]|li)((?:\\s[^>]*)?)>((?:<(?:strong|em|u|s|b|i)>)*)${MARK}([\\uE100-\\uE1FF])`, "g"), (_, tag, attrs, open, ch) => `<${tag}${attrs} data-i="${ch.charCodeAt(0) - 0xE100}">${open}`)
    .replace(new RegExp(`${MARK}[\\uE100-\\uE1FF]?`, "g"), "");
}

export { prepare, post };
