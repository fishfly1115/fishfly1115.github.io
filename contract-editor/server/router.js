// API 路由入口：初始化資料庫後，依路徑交給 admin 或 contract 路由；HttpError 轉成 JSON 錯誤回應。

import { init } from "./db.js";
import { HttpError, json } from "./http.js";
import { adminRoutes } from "./routes/admin.js";
import { contractRoutes } from "./routes/contract.js";

export async function handleApi({ request, env, params }) {
  try {
    if (!env.DB) throw new HttpError(503, "not_configured", "網站尚未設定資料庫（D1 綁定名稱需為 DB）");
    await init(env.DB);
    const seg = [].concat(params.path || []);
    if (seg[0] === "admin") return await adminRoutes(request, env, seg);
    if (seg[0] === "c" && seg[1]) return await contractRoutes(request, env, seg);
    throw new HttpError(404, "not_found", "沒有這個功能");
  } catch (e) {
    if (e instanceof HttpError) return json({ code: e.code, message: e.message }, e.status);
    console.error(e);
    return json({ code: "server_error", message: "伺服器發生錯誤，請稍後再試" }, 500);
  }
}
