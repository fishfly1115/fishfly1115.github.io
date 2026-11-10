// 首頁：/ 為契約案件列表，/new 為新增契約；未登入時顯示登入。
// 每個畫面（login.js、list.js、new-contract.js）提供 header()、html()、after()、actions、forms，
// 這裡負責選擇畫面、繪製，並把按鈕（data-act）與表單（data-form）交給對應的畫面處理。
import { $, toast } from "../../core/dom.js";
import { store } from "../../core/storage.js";
import { defaultFilter, listScreen } from "./list.js";
import { loginScreen } from "./login.js";
import { newContractScreen } from "./new-contract.js";
import { H, admin } from "./state.js";

const SCREENS = [loginScreen, listScreen, newContractScreen];
const current = () => !H.list ? loginScreen : H.screen === "new" ? newContractScreen : listScreen;
const ctx = { draw, load };

async function load() {
  try {
    H.list = (await admin("contracts")).contracts;
    store.set("ce:admin", H.pw);
    defaultFilter();
  } catch (e) {
    if (e.status === 401) { H.list = null; H.pw = ""; store.set("ce:admin", null); }
    toast(e.message);
  }
  draw();
}

function draw() {
  const screen = current();
  $("turn").innerHTML = H.list ? `<button class="btn ghost" data-act="logout">登出</button>` : "";
  document.querySelector("header.top").hidden = !H.list;
  $("toolbar").innerHTML = screen.header?.() || "";
  $("main").innerHTML = screen.html();
  screen.after?.(ctx);
}

function show(screen) {
  H.screen = screen;
  history.pushState(null, "", screen === "new" ? "/new" : "/");
  draw();
  window.scrollTo({ top: 0 });
}

const sharedActions = {
  new: (el, c, ev) => { ev.preventDefault(); Object.assign(H, { renaming: null, confirmDel: null }); show("new"); },
  "go-list": (el, c, ev) => { ev.preventDefault(); show("list"); },
  logout: () => { store.set("ce:admin", null); Object.assign(H, { pw: "", list: null, screen: "list" }); history.replaceState(null, "", "/"); draw(); }
};

export function startHome() {
  $("csource").textContent = "";
  $("ctitle").hidden = true;
  $("tabs").hidden = true;
  const actions = Object.assign({}, sharedActions, ...SCREENS.map((s) => s.actions || {}));
  const forms = Object.assign({}, ...SCREENS.map((s) => s.forms || {}));
  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-act]");
    // 點選列操作選單以外的地方時關閉選單
    if (H.rowMenu && !ev.target.closest(".menu-wrap")) { H.rowMenu = null; if (!el) draw(); }
    if (el) actions[el.dataset.act]?.(el, ctx, ev);
  });
  document.addEventListener("submit", (ev) => {
    const form = ev.target.closest("[data-form]"); if (!form) return;
    ev.preventDefault();
    forms[form.dataset.form]?.(form, ctx);
  });
  window.addEventListener("popstate", () => { H.screen = location.pathname === "/new" ? "new" : "list"; draw(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && H.list && H.screen === "list") load(); });
  H.pw ? load() : draw();
}
