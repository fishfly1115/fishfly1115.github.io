// 「審閱」頁：一次一處他方修訂，接受或退回後自動前往下一處。
import { S } from "../../context.js";
import { render } from "../../render.js";
import { theirsClauses } from "../../state.js";
import { acceptAll, decide } from "./actions.js";
import { reviewHtml } from "./view.js";

/** @type {import("../index.js").Tab} */
export default {
  id: "review",
  nav: { label: "審閱", count: () => theirsClauses().length },
  title: () => "", // 分頁按鈕已標示，不重複標題
  keepTyping: true,
  html: reviewHtml,
  actions: {
    "review-accept": (el, id) => { if (!S.busy) decide(id, "accept"); },
    "review-revert": (el, id) => { if (!S.busy) decide(id, "revert"); },
    "accept-all": () => { S.acceptAll = true; render(); },
    "accept-all-cancel": () => { S.acceptAll = false; render(); },
    "accept-all-do": () => acceptAll()
  }
};
