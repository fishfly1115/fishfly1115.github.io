// 契約頁進入點：網址 /c/<契約 id>#k=<專屬連結金鑰>。
// 金鑰存入 localStorage 後即從網址移除，避免出現在瀏覽紀錄與螢幕分享中。
import { contractApi } from "../../api/client.js";
import { store } from "../../core/storage.js";
import { S, api, ctx } from "./context.js";
import { bindEvents } from "./events.js";
import { render } from "./render.js";
import { refresh, startPolling } from "./sync.js";

export function startContract(cid) {
  const hashKey = new URLSearchParams(location.hash.slice(1)).get("k");
  if (hashKey) { store.set("ce:key:" + cid, hashKey); history.replaceState(null, "", location.pathname); }
  ctx.CID = cid;
  ctx.KEY = store.get("ce:key:" + cid);
  ctx.ADMIN = store.get("ce:admin");
  ctx.api = contractApi({ cid, key: ctx.KEY, admin: ctx.ADMIN });
  // 他方成員沒有管理密碼，首頁對他們沒有用途
  if (!ctx.ADMIN) document.getElementById("brand").removeAttribute("href");
  S.onlyChecked = store.get("ce:only:" + cid) === "1";

  bindEvents();
  try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch { /* older browsers */ }
  render();
  if (!ctx.KEY && !ctx.ADMIN) {
    S.noAccess = "網址缺少專屬連結的金鑰，請使用契約建立者傳送的完整連結開啟";
    render();
    return;
  }
  refresh().then(() => {
    if (S.noAccess) return;
    startPolling();
    api("seen", {}).catch(() => {});
  });
}
