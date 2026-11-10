// 首頁的狀態：管理密碼、契約列表、目前畫面（列表／新增契約）與列表的篩選、搜尋、列操作。
import { adminApi } from "../../api/client.js";
import { store } from "../../core/storage.js";

export const H = {
  pw: store.get("ce:admin") || "",
  list: null,                 // 契約列表；null 表示尚未登入
  screen: location.pathname === "/new" ? "new" : "list",
  busy: false,
  // 列表
  only: store.get("ce:home:filter"), q: "", rowMenu: null, renaming: null, confirmDel: null,
  // 新增契約
  tpls: null
};

export const admin = (path, method, body) => adminApi(H.pw, path, method, body);
