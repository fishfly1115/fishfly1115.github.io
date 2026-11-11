/**
 * 「成員」頁
 * 頁面目的：請他方（或本方同仁）加入，並知道雙方有哪些人
 * 主要按鈕：一鍵複製邀請訊息；次要按鈕：切換邀請對象（他方／本方同仁）
 * 版面：上方一張邀請卡（連結＋密碼，旁邊小圖示可個別複製）；下方甲乙方成員；最下方一列我的資料。
 */
import { esc } from "../../../../core/dom.js";
import { fmt } from "../../../../core/format.js";
import { S, ctx } from "../../context.js";
import { SIDE, mySide, otherSide } from "../../state.js";
import { copyMessageBtn, rotateHtml, shareRowsHtml } from "../../shell/invite-share.js";

// 建立契約的一方可以邀請他方；另一方只能邀請本方同仁
export const ownerSide = () => S.participants.find((p) => p.role === "owner")?.side || "A";
const canInviteOther = () => mySide() === ownerSide();
/** 邀請卡目前顯示哪一方的連結（預設：能邀請他方就先邀請他方） */
export const shareSide = () => S.shareSide || (canInviteOther() ? otherSide() : mySide());

const canRevoke = (p) => p.role !== "owner" && p.id !== S.uid && (S.isAdmin || p.side === mySide());

function inviteCard() {
  const side = shareSide(), mine = side === mySide(), name = SIDE[side];
  const title = mine ? "邀請本方同仁" : `請${name}加入`;
  const note = mine
    ? `同仁開啟連結、輸入密碼並填寫姓名後即可加入，屬於${name}，可以一起修訂；審閱以「方」為單位，本方任一人處理即可。`
    : `${name}開啟連結、輸入密碼並填寫姓名後即可加入。按「交給${name}」時也會顯示這組連結與密碼。`;
  const swap = !canInviteOther() ? ""
    : mine ? `<button class="btn" data-act="share-side" data-v="${otherSide()}">改為邀請${SIDE[otherSide()]}</button>`
    : `<button class="btn" data-act="share-side" data-v="${mySide()}">邀請本方同仁</button>`;
  return `<section class="card invite-card" aria-label="${esc(title)}">
    <h2>${esc(title)}</h2>
    <p class="share-note">${esc(note)}</p>
    ${shareRowsHtml(side)}
    <div class="actions">${S.invites?.[side] ? copyMessageBtn(side, "join") : ""}${swap}<div class="grow"></div>${S.invites?.[side] ? rotateHtml(side) : ""}</div>
  </section>`;
}

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
  return `<section class="card side-card" data-side="${mine ? "mine" : "other"}">
    <header class="side-head"><h2>${SIDE[side]}（${mine ? "本方" : "他方"}）</h2><span class="pill ${mine ? "mine" : "theirs"}">${people.length} 人</span></header>
    <ul class="members">${people.map(memberRow).join("") || `<li class="member-empty">${SIDE[side]}尚未加入</li>`}</ul>
  </section>`;
}

export function membersHtml() {
  const me = S.me || {};
  return `<div class="members-page">
    ${inviteCard()}
    <div class="side-cards">${sideCard(mySide())}${sideCard(otherSide())}</div>
    <section class="my-info" aria-label="我的資料">
      <strong>我的資料</strong>
      <span>${esc(me.name || "尚未填寫姓名")}${me.title ? `・${esc(me.title)}` : ""}・${esc(me.label || SIDE[mySide()])}</span>
      <button class="linkbtn" data-act="name-edit">編輯</button>
      ${ctx.KEY ? `<button class="linkbtn" data-act="copy-mine" title="換到另一台電腦時使用">複製我的專屬連結</button>` : ""}
    </section>
  </div>`;
}
