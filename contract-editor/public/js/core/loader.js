// 第三方函式庫在用到時才載入（只允許 cdn.jsdelivr.net，見 _headers 的 CSP）。

const LIB = {
  jszip: "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
  mammoth: "https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js",
  docx: "https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js",
  html2canvas: "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js",
  jspdf: "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"
};
// window global each library defines once loaded
const GLOBAL = { jszip: "JSZip", mammoth: "mammoth", docx: "docx", html2canvas: "html2canvas", jspdf: "jspdf" };

export const loadScript = (src) => new Promise((ok, no) => {
  const s = document.createElement("script");
  s.src = src; s.onload = ok; s.onerror = () => no(new Error("load " + src));
  document.head.appendChild(s);
});

export async function need(...names) {
  for (const n of names) if (!window[GLOBAL[n]]) await loadScript(LIB[n]);
}
