// localStorage 包裝：無痕模式或停用儲存時不拋錯。

export const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} }
};

// 契約的專屬連結金鑰（代表「我是哪一位成員」）。
// 同一個瀏覽器可能同時以甲方、乙方開啟同一份契約（例如自己測試），所以身分跟著分頁走：
// 每個分頁記在 sessionStorage，重新整理仍是同一個身分；localStorage 只記「這個瀏覽器的預設身分」，
// 供新開的分頁使用，且已有預設身分時不覆蓋，避免另一個分頁加入成為他方後，原本的分頁變成他方視角。
const tab = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} }
};
export const contractKey = {
  get: (cid) => tab.get("ce:key:" + cid) || store.get("ce:key:" + cid),
  /** 記住這個分頁的身分；這個瀏覽器還沒有預設身分時，一併設為預設 */
  remember(cid, key) {
    tab.set("ce:key:" + cid, key);
    if (!store.get("ce:key:" + cid)) store.set("ce:key:" + cid, key);
  }
};
