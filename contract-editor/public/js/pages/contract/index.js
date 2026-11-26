// 契約頁進入點：網址 /c/<契約 id>#k=<專屬連結金鑰>。
// 金鑰記下後即從網址移除，避免出現在瀏覽紀錄與螢幕分享中（記在哪裡見 core/storage.js 的 contractKey）。
import { contractApi } from "../../api/client.js";
import { contractKey, store } from "../../core/storage.js";
import { S, api, ctx } from "./context.js";
import { openDialog } from "./dialogs/index.js";
import { bindEvents } from "./events.js";
import { bindRouter, viewFromPath } from "./router.js";
import { render } from "./render.js";
import { refresh, startPolling } from "./sync.js";

export function startContract(cid) {
  // 網址 #k=<金鑰>：專屬連結；#export：從首頁「下載定稿本」進來，載入後直接開啟匯出視窗
  const hash = new URLSearchParams(location.hash.slice(1)), hashKey = hash.get("k"), wantExport = hash.has("export");
  if (hashKey) contractKey.remember(cid, hashKey);
  if (location.hash) history.replaceState(null, "", location.pathname);
  ctx.CID = cid;
  ctx.KEY = contractKey.get(cid);
  ctx.ADMIN = store.get("ce:admin");
  ctx.api = contractApi({ cid, key: ctx.KEY, admin: ctx.ADMIN });
  // 他方成員沒有管理密碼，首頁對他們沒有用途
  if (!ctx.ADMIN) document.getElementById("brand").removeAttribute("href");
  S.onlyChecked = store.get("ce:only:" + cid) === "1";

  S.view = viewFromPath();
  bindEvents();
  bindRouter();
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
    if (wantExport) openDialog("export");
    api("seen", {}).catch(() => {});
  });
}
