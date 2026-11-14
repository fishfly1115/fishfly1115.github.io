// 「交給他方」確認視窗：顯示他方的共編連結與進入密碼（可分別或一鍵複製），確認後才正式交出。
// 他方的連結只有建立契約的一方看得到；另一方交出時只顯示確認與通知內容。
import { esc } from "../../../core/dom.js";
import { S } from "../context.js";
import { render } from "../render.js";
import { loadInvites, shareRowsHtml, copyMessageBtn } from "../shell/invite-share.js";
import { SIDE, otherSide, roundNo, sameSide } from "../state.js";
import { simple } from "../sync.js";

const other = () => SIDE[otherSide()];
const canShare = () => !S.invites || otherSide() in S.invites;

/** @type {import("./index.js").Dialog} */
export default {
  id: "handoff",
  title: () => `交給${other()}審閱`,
  key: () => `${roundNo()}:${S.invites ? 1 : 0}`,
  open: () => { loadInvites().then(() => { S.forceDialog = true; render(); }); },
  html() {
    const n = roundNo(), o = other();
    const ours = S.revs.filter((r) => r.status === "pending" && sameSide(r.by) && (r.round || 1) === n).length;
    const sub = `<p class="dialog-sub">本輪修訂 ${ours} 處，交出後由${o}審閱。</p>`;
    if (!canShare()) return sub;
    return `${sub}<section class="share-box" aria-label="傳給${o}">
      <h3>傳給${o}</h3>
      ${shareRowsHtml(otherSide())}
      ${S.invites ? copyMessageBtn(otherSide(), "handoff", "") : ""}
    </section>`;
  },
  foot: () => `<div class="grow"></div><button class="btn ghost" data-act="dialog-close">取消</button><button class="btn primary" data-act="handoff-confirm">確認交給${esc(other())}</button>`,
  actions: {
    "handoff-confirm": () => { S.dialog = null; simple("handoff", { status: "review", round: roundNo() }, `已交給${other()}審閱`); }
  }
};
