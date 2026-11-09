// 匯入修訂版 Word 時，逐條比對匯入內容與目前條文。
// 以條文標題配對；文字與圖片數相同即視為未變更（忽略 Word 往返造成的格式差異）。
import { normalize, squash, textOf } from "../core/sanitize.js";

export const canon = (html) => textOf(html) + "|" + ((html || "").match(/<img/gi) || []).length;
export const titleKey = (t) => (t || "").replace(/[\s　：:、，,.。]/g, "");

// imported: [{title, html}]；current: 目前有效的條文（依順序）；htmlOf: 取得條文 HTML 的函式。
// 回傳 items（same／edit／add／delete，依匯入順序；刪除的放最後）與各類數量。新增條文會算出插入位置 order。
export function compareRevision(imported, current, htmlOf = (c) => c.html) {
  const used = new Set(), items = [];
  let prev = null, pendingAdds = [];
  const flushAdds = (nextClause) => {
    const a = prev ? prev.order : (nextClause ? nextClause.order - pendingAdds.length - 1 : 0);
    const b = nextClause ? nextClause.order : a + pendingAdds.length + 1;
    pendingAdds.forEach((it, i) => { it.order = a + ((b - a) * (i + 1)) / (pendingAdds.length + 1); });
    pendingAdds = [];
  };
  for (const im of imported) {
    const m = current.find((c) => !used.has(c.id) && titleKey(c.title) === titleKey(im.title));
    if (!m) { const it = { type: "add", title: im.title, html: normalize(im.html) }; items.push(it); pendingAdds.push(it); continue; }
    used.add(m.id); flushAdds(m); prev = m;
    const html = normalize(im.html);
    const same = canon(htmlOf(m)) === canon(html) && squash(m.title) === squash(im.title);
    items.push({ type: same ? "same" : "edit", clause: m, title: im.title, html });
  }
  flushAdds(null);
  current.filter((c) => !used.has(c.id)).forEach((c) => items.push({ type: "delete", clause: c, title: c.title }));
  const n = (t) => items.filter((i) => i.type === t).length;
  return { items, counts: { edit: n("edit"), add: n("add"), delete: n("delete"), same: n("same") } };
}
