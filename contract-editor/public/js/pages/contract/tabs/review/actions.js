// 審閱頁的操作：接受或退回目前這一處（完成後自動前往下一處）、全部接受。
import { $, toast } from "../../../../core/dom.js";
import { S, api } from "../../context.js";
import { render } from "../../render.js";
import { theirsClauses } from "../../state.js";
import { fail, refresh } from "../../sync.js";

// 全部接受：逐條送出後重新載入一次
export async function acceptAll() {
  const ids = theirsClauses().map((c) => c.id);
  S.acceptAll = false; S.busy = true; render();
  let done = 0;
  try { for (const id of ids) { await api(`clauses/${id}/accept`, {}); done++; } toast(`已接受 ${done} 條修訂`); }
  catch (e) { fail(e); }
  S.busy = false; S.forceMain = true; await refresh();
}

// 審閱頁：處理完這一處後，自動前往下一處
export async function decide(id, how) {
  const list = theirsClauses(), i = list.findIndex((c) => c.id === id);
  const next = list[i + 1] || list[i - 1];
  const note = how === "revert" ? ($("rv-reason")?.value || "").trim() : undefined;
  S.busy = true;
  try {
    await api(`clauses/${id}/${how}`, how === "revert" ? { note } : {});
    toast(how === "accept" ? "已接受這處修訂" : "已退回，條文恢復為修訂前內容");
    S.focusPending = next ? next.id : null;
  } catch (e) { fail(e); }
  S.busy = false; S.forceMain = true; await refresh();
}
