// 「總覽」頁：目前在哪一步、輪到誰、唯一的下一步按鈕，以及自上次查看後的更新。
import { S, api } from "../../context.js";
import { render } from "../../render.js";
import { go } from "../../router.js";
import { caseNo, docTitle, roundNo } from "../../state.js";
import { overviewHtml } from "./view.js";

/** @type {import("../index.js").Tab} */
export default {
  id: "overview",
  nav: { icon: "dashboard", label: "總覽" },
  title: docTitle,
  lede: () => [caseNo() && `案號 ${caseNo()}`, `第 ${roundNo()} 輪`].filter(Boolean).join(" · "),
  renamable: true,
  html: overviewHtml,
  actions: {
    "see-log": () => { S.filter = "all"; go("history"); },
    "mark-seen": () => { S.lastSeen = Date.now(); render(); api("seen", {}).catch(() => {}); }
  }
};
