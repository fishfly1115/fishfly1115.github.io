// 頂端列：品牌、目前位置（契約案件／契約名稱／案號）、成員頭像。分頁導覽列在 nav.js。
import { $, esc } from "../../../core/dom.js";
import { S, ctx } from "../context.js";
import { SIDE, caseNo, docTitle, mySide, whoFull } from "../state.js";

export function renderTopbar() {
  const back = ctx.ADMIN ? `<a href="/" class="crumb">契約案件</a><span class="sep" aria-hidden="true">/</span>` : "";
  $("crumb").innerHTML = S.loaded.c && !S.noAccess
    ? `${back}<span class="crumb-title">${esc(docTitle())}</span>${caseNo() ? `<span class="crumb-case">${esc(caseNo())}</span>` : ""}`
    : back;
  const el = $("turn");
  if (!S.loaded.c || S.noAccess) { el.innerHTML = ""; return; }
  const live = S.participants.filter((p) => !p.revoked);
  el.innerHTML = `<div class="avatars" aria-label="成員 ${live.length} 人">${live.slice(0, 4).map((p) => `<span class="avatar" data-side="${p.side === mySide() ? "mine" : "other"}" title="${esc(whoFull(p.id))}">${esc((p.name || p.label || SIDE[p.side] || "?").trim().slice(0, 1))}</span>`).join("")}${live.length > 4 ? `<span class="avatar more">+${live.length - 4}</span>` : ""}</div>`;
}
