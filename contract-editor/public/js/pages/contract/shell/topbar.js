// 頂端列：品牌、分頁與進度（pagenav.js，同一列）、成員頭像。契約名稱已在頁面與文件中，頂端列不重複。
import { $, esc } from "../../../core/dom.js";
import { S, ctx } from "../context.js";
import { SIDE, mySide, whoFull } from "../state.js";

export function renderTopbar() {
  // 載入前與無權限時才顯示「契約案件」連結；載入後由分頁按鈕取代（品牌標誌也可回到列表）
  $("crumb").innerHTML = ctx.ADMIN && !(S.loaded.c && !S.noAccess) ? `<a href="/" class="crumb">契約案件</a>` : "";
  const el = $("turn");
  if (!S.loaded.c || S.noAccess) { el.innerHTML = ""; return; }
  const live = S.participants.filter((p) => !p.revoked);
  el.innerHTML = `<div class="avatars" aria-label="成員 ${live.length} 人">${live.slice(0, 4).map((p) => `<span class="avatar" data-side="${p.side === mySide() ? "mine" : "other"}" title="${esc(whoFull(p.id))}">${esc((p.name || p.label || SIDE[p.side] || "?").trim().slice(0, 1))}</span>`).join("")}${live.length > 4 ? `<span class="avatar more">+${live.length - 4}</span>` : ""}</div>`;
}
