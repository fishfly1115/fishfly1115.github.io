// 契約頁共用的執行環境：目前契約、使用者金鑰，以及畫面狀態 S。
// ctx 在 pages/contract/index.js 初始化；S 由各 view 讀取、各 action 修改後呼叫 render()。

export const ctx = { CID: null, KEY: null, ADMIN: null, api: null };

export const S = {
  // 伺服器資料
  uid: null, me: null, contract: null, handoff: null, participants: [], clauses: [], revs: [], version: 0, lastSeen: null,
  // 載入與權限
  loaded: { c: false, r: false, h: false }, slow: false, noAccess: null, canWrite: true, isAdmin: false, busy: false,
  // 畫面
  view: "contract", filter: "todo", onlyChecked: false, plainView: new Set(), expanded: new Set(), menu: null,
  outlineOpen: false, panelTab: "review", focusPending: null, acceptAll: false, editing: null, editBase: null, adding: null, confirm: null, renaming: false,
  peopleOpen: false, nameOpen: false, invited: null, forcePeople: false,
  // 匯入與匯出
  importing: false, importPreview: null, reimport: null, reimportAll: false, tplPick: false, tpls: null,
  exporting: false, exportOpen: false, exportFmt: "pdf", exportOnlyChecked: true
};

export const api = (path, body) => ctx.api(path, body);
