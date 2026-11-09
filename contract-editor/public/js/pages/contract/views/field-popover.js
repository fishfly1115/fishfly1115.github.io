// 填寫日期與空格的小視窗。
import { $, esc } from "../../../core/dom.js";
import { pad2 } from "../../../core/format.js";
import { Fields } from "../../../lib/fields.js";
import { fieldChange } from "../actions/fields.js";
import { S } from "../context.js";
import { clauseHtmlOf } from "../state.js";

export function closePop() { $("pop")?.remove(); }
export function openPop(btn, cid, k) {
  closePop();
  const c = S.clauses.find((x) => x.id === cid); if (!c) return;
  const inf = Fields.info(clauseHtmlOf(c), k); if (!inf) return;
  const pop = document.createElement("div");
  pop.id = "pop"; pop.className = "pop"; pop.setAttribute("role", "dialog");
  if (inf.type === "date") {
    const y = inf.y ? (+inf.y < 1000 ? +inf.y + 1911 : +inf.y) : "", iso = y && inf.mo && inf.d ? `${y}-${pad2(inf.mo)}-${pad2(inf.d)}` : "";
    pop.innerHTML = `<label for="pop-in">日期（存為民國年）</label><input id="pop-in" class="inp" type="date" value="${iso}">
      <div class="row"><button class="btn sm ghost" data-pop="clear">清除</button><div class="grow"></div><button class="btn sm" data-pop="close">取消</button><button class="btn sm primary" data-pop="ok">套用</button></div>`;
  } else {
    const blank = /^[\s　_＿【】]*$/.test(inf.text || "");
    pop.innerHTML = `<label for="pop-in">${inf.type === "cell" ? "儲存格內容" : "填寫內容"}</label><input id="pop-in" class="inp" maxlength="200" value="${blank ? "" : esc((inf.text || "").replace(/^【|】$/g, "").trim())}">
      <div class="row"><div class="grow"></div><button class="btn sm" data-pop="close">取消</button><button class="btn sm primary" data-pop="ok">套用</button></div>`;
  }
  document.body.appendChild(pop);
  const r = btn.getBoundingClientRect();
  pop.style.top = `${window.scrollY + r.bottom + 6}px`;
  pop.style.left = `${Math.max(8, Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - pop.offsetWidth - 8))}px`;
  const input = $("pop-in"); input.focus();
  const done = (v) => { closePop(); btn.focus(); if (v !== undefined) fieldChange(cid, k, v); };
  const ok = () => {
    if (inf.type === "date") { if (!input.value) return done(null); const [yy, mm, dd] = input.value.split("-").map(Number); return done({ y: yy - 1911, m: mm, d: dd }); }
    done(input.value.trim());
  };
  pop.addEventListener("click", (e) => { const a = e.target.closest("[data-pop]")?.dataset.pop; if (a === "ok") ok(); if (a === "close") done(); if (a === "clear") done(null); });
  pop.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); ok(); } if (e.key === "Escape") done(); });
}
