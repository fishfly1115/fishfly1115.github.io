/**
 * 契約頁的分頁與網址：每一頁只處理一件事。
 *   /c/<id>           總覽：目前在哪一步、輪到誰、下一步
 *   /c/<id>/contract  契約內容：閱讀、勾選填寫、修訂條文
 *   /c/<id>/review    審閱：一次看一處修訂，接受或退回
 *   /c/<id>/history   修訂紀錄
 *   /c/<id>/members   成員與連結
 *   /c/<id>/export    匯出 PDF／Word
 *   /c/<id>/import    匯入 Word、套用範本
 */
import { S, ctx } from "./context.js";
import { render } from "./render.js";

const SLUGS = { overview: "", contract: "contract", review: "review", log: "history", members: "members", export: "export", import: "import" };
const BY_SLUG = Object.fromEntries(Object.entries(SLUGS).map(([v, s]) => [s, v]));

export function viewFromPath() {
  const m = location.pathname.match(/^\/c\/[0-9a-f-]{36}\/?([a-z]*)\/?$/i);
  return BY_SLUG[(m?.[1] || "").toLowerCase()] || "overview";
}

export const pathOf = (view) => `/c/${ctx.CID}${SLUGS[view] ? "/" + SLUGS[view] : ""}`;

// 換頁：清掉上一頁的暫時狀態（選單、確認框、匯出設定），捲回頂端
export function go(view, { replace = false } = {}) {
  if (!(view in SLUGS)) view = "overview";
  Object.assign(S, { view, confirm: null, outlineOpen: false, acceptAll: false, invited: null });
  if (view !== "import") Object.assign(S, { importPreview: null, reimport: null, tplPick: false });
  history[replace ? "replaceState" : "pushState"](null, "", pathOf(view));
  render();
  window.scrollTo({ top: 0 });
}

export function bindRouter() {
  window.addEventListener("popstate", () => { S.view = viewFromPath(); S.confirm = null; render(); });
}
