// 條文修訂、通知內容、圖片上傳。
import { $, copy, toast } from "../../../core/dom.js";
import { normalize, textOf } from "../../../core/sanitize.js";
import { S, api } from "../context.js";
import { render } from "../render.js";
import { caseNo, clauseHtmlOf, docTitle, roundNo, status, who } from "../state.js";
import { act, fail, refresh } from "../sync.js";

export async function uploadImage(blob) {
  const r = await api("images", blob);
  return r.url;
}
export async function save(key) {
  if (S.busy) return;
  const title = $("et-" + key).value.trim();
  const html = normalize($("eb-" + key).innerHTML);
  const warn = $("ew-" + key);
  if (key === "new") {
    if (!title && !textOf(html) && !/<img/i.test(html)) { S.adding = null; render(); return; }
    S.busy = true;
    try { await act("clauses/add", { afterId: S.adding.afterId || null, title: title || "新條文", html }, "已新增條文，等待他方審閱"); S.adding = null; } catch {}
    S.busy = false; render(); return;
  }
  const c = S.clauses.find((x) => x.id === key); if (!c) return;
  const newTitle = title || c.title;
  if (newTitle === c.title && html === normalize(clauseHtmlOf(c))) { S.editing = null; render(); return; }
  S.busy = true;
  try {
    await api(`clauses/${key}/edit`, { title: newTitle, html, baseRev: S.editBase.rev });
    S.editing = null; toast("已儲存，他方會看到您改了哪裡"); await refresh();
  } catch (e) {
    if (e.status === 409) {
      warn.hidden = false;
      warn.textContent = `${who(e.data?.clause?.updatedBy)} 在您編輯時也改動了這一條。為了不蓋掉他方的內容，這次沒有儲存。請先複製您的草稿，按「取消」後重新點「修訂」。`;
    } else fail(e);
  }
  S.busy = false; render();
}
export async function simple(path, body, msg) { if (S.busy) return; S.busy = true; try { await act(path, body, msg); } catch {} S.busy = false; S.confirm = null; render(); }
export async function copyMsg() {
  const st = status(), n = roundNo(), name = docTitle();
  const ref = caseNo() ? `（案號：${caseNo()}）` : "";
  const msg = st === "review" ? `「${name}」${ref}契約草案第 ${n} 輪修訂已完成，敬請以專屬連結登入審閱，修訂處均已標示。`
    : st === "reviewed" ? `「${name}」${ref}契約草案第 ${n} 輪修訂已審閱完畢，敬請以專屬連結登入確認審閱結果。`
    : st === "final" ? `「${name}」${ref}契約內容業經雙方確認定稿，敬請以專屬連結登入檢視並下載定稿版本。`
    : `「${name}」${ref}契約草案已有更新，敬請以專屬連結登入檢視。`;
  copy(msg, "已複製通知內容，請以電子郵件等方式送交他方");
}
