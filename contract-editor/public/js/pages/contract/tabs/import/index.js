// 「匯入」頁：匯入修訂版 Word（逐條比對）、套用範本、匯入新契約 Word；寫入前都先預覽。
import { $, toast } from "../../../../core/dom.js";
import { loadTemplates } from "../../../../lib/templates.js";
import { S } from "../../context.js";
import { render } from "../../render.js";
import { docTitle } from "../../state.js";
import { doImport, doReimport, pickDocx, pickRevised } from "./import.js";
import { importHtml, reimportHtml, tplPickHtml } from "./previews.js";
import { choicesHtml } from "./view.js";

const pickFile = (id) => { $(id).value = ""; $(id).click(); };

/** @type {import("../index.js").Tab} */
export default {
  id: "import",
  parent: "content",
  title: () => "匯入",
  html: () => S.tplPick ? tplPickHtml() : S.importPreview ? importHtml() : S.reimport ? reimportHtml() : choicesHtml(),
  actions: {
    "reimport-pick": () => pickFile("rev-input"),
    "reimport-go": () => doReimport(),
    "reimport-cancel": () => { S.reimport = null; render(); },
    "reimport-all": (el) => { S.reimportAll = el.checked; render(); },
    "import-pick": () => pickFile("docx-input"),
    "import-go": () => doImport(),
    "import-cancel": () => { S.importPreview = null; render(); },
    "tpl-open": () => {
      S.tplPick = true; render();
      loadTemplates().then((d) => { S.tpls = d; render(); }).catch((e) => { toast(e.message); S.tplPick = false; render(); });
    },
    "tpl-cancel": () => { S.tplPick = false; render(); },
    "tpl-preview": () => {
      const t = S.tpls.templates.find((x) => x.id === document.querySelector("input[name=tpl]:checked")?.value); if (!t) return;
      S.tplPick = false;
      S.importPreview = { title: docTitle() === "採購契約書" ? t.title : docTitle(), clauses: t.clauses, source: `範本：${t.name}`, split: "template", imgFail: 0 };
      render(); window.scrollTo({ top: 0 });
    }
  },
  init() {
    $("docx-input").addEventListener("change", (e) => pickDocx(e.target.files[0]));
    $("rev-input").addEventListener("change", (e) => pickRevised(e.target.files[0]));
  }
};
