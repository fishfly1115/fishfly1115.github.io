// 條文編輯器的儲存：新增條文或修訂既有條文；他方同時修改時提示衝突、不覆蓋。
import { $, toast } from "../../../../core/dom.js";
import { normalize, textOf } from "../../../../core/sanitize.js";
import { S, api } from "../../context.js";
import { render } from "../../render.js";
import { clauseHtmlOf, who } from "../../state.js";
import { act, fail, refresh } from "../../sync.js";

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
