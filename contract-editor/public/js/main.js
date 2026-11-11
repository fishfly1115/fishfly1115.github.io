// 網站進入點：/ 為契約案件首頁（管理密碼），/c/<id> 為契約頁（專屬連結），/j/<代碼> 為以共編連結＋進入密碼加入。
import { installIndentStyles } from "./core/indent-styles.js";
import { startContract } from "./pages/contract/index.js";
import { startHome } from "./pages/home/index.js";
import { startJoin } from "./pages/join/index.js";
import { initThemeToggle } from "./ui/theme-toggle.js";

installIndentStyles();
initThemeToggle();
const route = location.pathname.match(/^\/c\/([0-9a-f-]{36})(\/[a-z]*)?\/?$/i);
const join = location.pathname.match(/^\/j\/([A-Za-z0-9_-]{8,64})\/?$/);
if (route) startContract(route[1]);
else if (join) startJoin(join[1]);
else startHome();
