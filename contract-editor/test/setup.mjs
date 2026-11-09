// 讓前端模組可在 Node 測試中執行：以 jsdom 提供瀏覽器 API，並掛上前端在瀏覽器中由 CDN 載入的函式庫。
import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";
import JSZip from "jszip";
import * as docx from "docx";

const { window } = new JSDOM("<!doctype html><body><div id=\"toast\" hidden></div></body>", { url: "http://localhost/" });
for (const k of ["window", "document", "DOMParser", "XMLSerializer", "NodeFilter", "Node", "HTMLElement", "localStorage", "getComputedStyle"]) {
  globalThis[k] = k === "window" ? window : window[k];
}
window.DOMPurify = createDOMPurify(window);
window.JSZip = JSZip;
window.docx = docx;
