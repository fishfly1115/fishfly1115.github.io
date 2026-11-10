// 「成員與連結」頁：甲乙方成員、產生專屬連結、停用連結。
import { $, esc } from "../../../../core/dom.js";
import { fmt } from "../../../../core/format.js";
import { S, ctx } from "../../context.js";
import { render } from "../../render.js";
import { SIDE, mySide, otherLabel } from "../../state.js";
import { act } from "../../sync.js";

export function membersHtml() {
  const live = S.participants.filter((p) => !p.revoked);
  const group = (side) => live.filter((p) => p.side === side);
  const row = (p) => `<li><span class="who"><strong>${esc(p.name || "尚未填寫姓名")}</strong>${p.title ? `<span class="chip-o">${esc(p.title)}</span>` : ""}<span class="meta">${p.id === S.uid ? "您 · " : ""}${p.role === "owner" ? "契約建立者 · " : ""}${p.lastSeen ? `最後查看 ${fmt(p.lastSeen)}` : "尚未開啟"}</span></span>
      ${(p.role !== "owner" && p.id !== S.uid && (S.isAdmin || p.side === mySide())) ? `<button class="btn sm ghost" data-act="revoke" data-id="${p.id}">停用連結</button>` : ""}</li>`;
  const sideBlock = (side) => `<div class="side-col"><h3>${SIDE[side]}${side === mySide() ? "（本方）" : ""}</h3><ul class="plist2">${group(side).map(row).join("") || `<li><span class="meta">尚無成員</span></li>`}</ul></div>`;
  const otherSide = mySide() === "A" ? "B" : "A";
  return `<section class="card page-card">
    <div class="sides">${sideBlock(mySide())}${sideBlock(otherSide)}</div>
    <form id="inviteform" class="row">
      <div class="field" style="flex:0 1 160px"><label for="iside">新增至</label><select id="iside" class="inp">${`<option value="${mySide()}">本方（${SIDE[mySide()]}）</option>`}${S.isAdmin ? `<option value="${otherSide}">他方（${SIDE[otherSide]}）</option>` : ""}</select></div>
      <div class="field grow"><label for="ilabel">單位</label><input id="ilabel" class="inp" maxlength="60" placeholder="${esc(S.me?.label || "")}"></div>
      <button class="btn primary" type="submit">產生專屬連結</button>
    </form>
    <p class="meta">取得連結的人自行填寫姓名與角色後即可參與修訂。${S.isAdmin ? "" : "僅可新增本方成員。"}</p>
    ${S.invited ? `<div class="warnline">「${esc(S.invited.label)}」的專屬連結僅顯示一次，請以電子郵件等方式送交；持有連結者即可修訂本契約。</div><div class="linkbox">${esc(S.invited.link)}</div><div class="row"><button class="btn sm" data-act="copy-invite">複製連結</button></div>` : ""}
    <div class="row">${ctx.KEY ? `<button class="btn sm" data-act="copy-mine">複製我的連結</button>` : ""}<button class="btn sm" data-act="name-edit">編輯個人資料</button></div>
  </section>`;
}

// 邀請表單：選擇本方或他方後，自動帶入單位名稱的提示
export function bindMembers() {
  $("iside")?.addEventListener("change", (e) => { $("ilabel").placeholder = e.target.value === mySide() ? (S.me?.label || "") : otherLabel(); });
  $("inviteform")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const side = $("iside").value;
    const label = $("ilabel").value.trim() || (side === mySide() ? (S.me?.label || SIDE[side]) : otherLabel());
    try { const r = await act("invite", { label, side }, "已產生專屬連結"); S.invited = { label, link: `${location.origin}/c/${ctx.CID}#k=${r.key}` }; S.forceMain = true; render(); } catch {}
  });
}
