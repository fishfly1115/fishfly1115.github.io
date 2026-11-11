/**
 * 「成員與連結」頁
 * 頁面目的：知道雙方有哪些人，並邀請他方或本方同仁加入
 * 主要任務：1. 把他方的共編連結與密碼傳給他方 2. 邀請本方同仁 3. 確認自己的資料
 * 版面：左邊本方、右邊他方，各自列出成員與一組連結＋密碼；「我的資料」在下方。
 */
import { esc } from "../../../../core/dom.js";
import { fmt } from "../../../../core/format.js";
import { S, ctx } from "../../context.js";
import { SIDE, mySide, otherSide } from "../../state.js";
import { shareBoxHtml } from "../../shell/invite-share.js";

const canRevoke = (p) => p.role !== "owner" && p.id !== S.uid && (S.isAdmin || p.side === mySide());

function memberRow(p) {
  const meta = [p.role === "owner" && "契約建立者", p.label, p.lastSeen ? `最後查看：${fmt(p.lastSeen)}` : "尚未開啟"].filter(Boolean).join(" · ");
  return `<li class="member">
    <span class="avatar lg" data-side="${p.side === mySide() ? "mine" : "other"}" aria-hidden="true">${esc((p.name || p.label || "?").trim().slice(0, 1))}</span>
    <div class="member-info">
      <div class="member-name"><strong>${esc(p.name || "尚未填寫姓名")}</strong>${p.title ? `<span class="pill plain">${esc(p.title)}</span>` : ""}${p.id === S.uid ? `<span class="pill mine">您</span>` : ""}</div>
      <div class="meta-s">${esc(meta)}</div>
    </div>
    ${canRevoke(p) ? `<button class="btn sm ghost" data-act="revoke" data-id="${p.id}" title="停用後此人無法再進入，修訂紀錄會保留">停用</button>` : ""}
  </li>`;
}

function sideCard(side) {
  const mine = side === mySide();
  const people = S.participants.filter((p) => !p.revoked && p.side === side);
  const share = mine
    ? shareBoxHtml(side, { title: "邀請本方同仁", kind: "join", note: `同仁加入後屬於${SIDE[side]}，可以一起修訂；審閱以「方」為單位，本方任一人處理即可。` })
    : shareBoxHtml(side, { title: `${SIDE[side]}共編連結`, kind: "join", note: `${SIDE[side]}開啟連結、輸入密碼並填寫姓名後即可加入。按「交給${SIDE[side]}」時也會顯示這組連結與密碼。` });
  return `<section class="card side-card">
    <header class="side-head"><h2>${SIDE[side]}（${mine ? "本方" : "他方"}）</h2><span class="pill ${mine ? "mine" : "theirs"}">${people.length} 人</span></header>
    <ul class="members">${people.map(memberRow).join("") || `<li class="member-empty">${SIDE[side]}尚未加入${mine ? "" : "，請把下方的連結與密碼傳給對方"}</li>`}</ul>
    ${share}
  </section>`;
}

export function membersHtml() {
  const me = S.me || {};
  return `<div class="members-page">
    <div class="side-cards">${sideCard(mySide())}${sideCard(otherSide())}</div>
    <section class="card my-info" aria-label="我的資料">
      <h2>我的資料</h2>
      <dl><div><dt>姓名</dt><dd>${esc(me.name || "尚未填寫")}</dd></div><div><dt>角色</dt><dd>${esc(me.title || "—")}</dd></div><div><dt>單位</dt><dd>${esc(me.label || SIDE[mySide()])}</dd></div></dl>
      <div class="grow"></div>
      ${ctx.KEY ? `<button class="btn ghost" data-act="copy-mine" title="換到另一台電腦時使用">複製我的專屬連結</button>` : ""}
      <button class="btn" data-act="name-edit">編輯</button>
    </section>
  </div>`;
}
