// 直接填寫欄位後的儲存：同一條文依序送出，避免版本衝突。
import { Fields } from "../../../lib/fields.js";
import { S, api } from "../context.js";
import { render } from "../render.js";
import { clauseHtmlOf } from "../state.js";
import { fail, refresh } from "../sync.js";

const fieldQueue = new Map();
export function fieldChange(cid, k, value) {
  const c = S.clauses.find((x) => x.id === cid); if (!c) return;
  const before = clauseHtmlOf(c), after = Fields.apply(before, k, value);
  if (after === before) return;
  c.html = after; render();
  const prev = fieldQueue.get(cid) || Promise.resolve();
  const next = prev.then(async () => {
    const r = await api(`clauses/${cid}/edit`, { title: c.title, html: c.html, baseRev: c.rev, merge: true });
    if (r.rev) c.rev = r.rev;
  }).catch((e) => { fail(e); }).finally(() => { if (fieldQueue.get(cid) === next) { fieldQueue.delete(cid); refresh(); } });
  fieldQueue.set(cid, next);
}
