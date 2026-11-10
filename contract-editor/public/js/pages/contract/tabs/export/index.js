// 「匯出」頁：下載 PDF 定稿本或 Word 檔。
import { $ } from "../../../../core/dom.js";
import { S } from "../../context.js";
import { render } from "../../render.js";
import { exportPdf, exportWord } from "./export.js";
import { exportHtml } from "./view.js";

/** @type {import("../index.js").Tab} */
export default {
  id: "export",
  nav: { icon: "download", label: "匯出" },
  title: () => "匯出",
  lede: () => "下載 PDF 定稿本，或可在 Word 中繼續修訂的檔案。",
  html: exportHtml,
  actions: {
    "export-go": () => { const only = $("eonly")?.checked ?? false; S.exportFmt === "pdf" ? exportPdf(only) : exportWord(only); }
  },
  init() {
    // 切換格式時，PDF 預設只保留已勾選的選項，Word 預設保留全部
    document.addEventListener("change", (e) => {
      if (e.target.name === "efmt") { S.exportFmt = e.target.value; S.exportOnlyChecked = S.exportFmt === "pdf"; render(); }
    });
  }
};
