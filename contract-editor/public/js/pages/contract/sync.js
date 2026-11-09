// 與伺服器同步：載入狀態、每 4 秒檢查版本、他方變更時提示。
import { toast } from "../../core/dom.js";
import { S, api } from "./context.js";
import { render } from "./render.js";
import { KIND, docTitle, revTitle, sameSide, who } from "./state.js";

let first = true;
export async function refresh() {
  let st;
  try { st = await api("state"); }
  catch (e) {
    if (e.status === 401 || e.status === 404) { S.noAccess = e.message; render(); stopPolling(); return; }
    S.slow = true; render(); return;
  }
  S.slow = false;
  if (!first) announce(st);
  S.me = st.me; S.uid = st.me.id; S.isAdmin = st.me.role === "owner";
  S.contract = st.contract; S.handoff = st.contract.handoff; S.version = st.contract.version;
  S.participants = st.participants; S.clauses = st.clauses; S.revs = st.revisions;
  if (first) { S.lastSeen = st.me.lastSeen || 0; if (!st.me.name) S.nameOpen = true; }
  S.loaded = { c: true, r: true, h: true };
  first = false;
  document.title = `${docTitle()} · 合約共同編輯器`;
  render();
}
export function announce(st) {
  const old = new Map(S.revs.map((r) => [r.id, r]));
  for (const r of st.revisions) {
    const o = old.get(r.id);
    if (!o && r.by !== S.uid) toast(`${who(r.by)} 剛${KIND[r.kind || "edit"]}〈${revTitle(r)}〉`);
    if (o && o.status !== r.status && sameSide(r.by) && !sameSide(r.reviewedBy)) {
      if (r.status === "accepted") toast(`他方接受了您對〈${revTitle(r)}〉的${KIND[r.kind || "edit"]}`);
      if (r.status === "reverted") toast(`他方退回了您對〈${revTitle(r)}〉的${KIND[r.kind || "edit"]}`);
    }
  }
  const h = st.contract.handoff;
  if (h && h.by && !sameSide(h.by) && (!S.handoff || h.at !== S.handoff.at)) {
    const m = h.note === "imported" ? "匯入了新的契約" : { review: "把契約交給您審閱", reviewed: "審閱完成，交回給您檢視", final: "同意定稿", editing: "開始了新一輪修訂" }[h.status];
    if (m) toast(`${who(h.by)} ${m}`);
  }
}
let pollT = null;
export async function poll() {
  if (document.hidden || S.noAccess) return;
  try { const v = await api("version"); if (v.version !== S.version) await refresh(); S.slow = false; }
  catch (e) { if (e.status === 401 || e.status === 404) { S.noAccess = e.message; render(); stopPolling(); } else if (!S.slow) { S.slow = true; render(); } }
}
export function startPolling() { stopPolling(); pollT = setInterval(poll, 4000); }
export function stopPolling() { clearInterval(pollT); pollT = null; }
export async function act(path, body, okMsg) {
  try { const r = await api(path, body); if (okMsg) toast(okMsg); await refresh(); return r; }
  catch (e) { fail(e); throw e; }
}
export function fail(e) {
  console.error(e);
  if (e.status === 401) { S.noAccess = e.message; render(); }
  else if (e.status === 409) toast(e.message);
  else toast(e.message || "儲存失敗，請檢查網路後再試一次。");
}
