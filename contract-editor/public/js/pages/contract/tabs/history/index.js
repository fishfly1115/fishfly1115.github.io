// 「修訂紀錄」頁：雙方所有修訂與審閱結果。
import { S } from "../../context.js";
import { render } from "../../render.js";
import { logHtml } from "./view.js";

/** @type {import("../index.js").Tab} */
export default {
  id: "history",
  parent: "content",
  title: () => "修訂紀錄",
  lede: () => "雙方所有修訂與審閱結果。",
  html: logHtml,
  actions: {
    "history-filter": (el) => { S.filter = el.dataset.v; render(); },
    expand: (el, id) => { S.expanded.has(id) ? S.expanded.delete(id) : S.expanded.add(id); render(); }
  }
};
