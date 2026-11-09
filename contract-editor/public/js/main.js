// 網站進入點：/ 為契約案件首頁（管理密碼），/c/<id> 為契約頁（專屬連結）。
import { installIndentStyles } from "./core/indent-styles.js";
import { startContract } from "./pages/contract/index.js";
import { startHome } from "./pages/home.js";

installIndentStyles();
const route = location.pathname.match(/^\/c\/([0-9a-f-]{36})\/?$/i);
if (route) startContract(route[1]); else startHome();
