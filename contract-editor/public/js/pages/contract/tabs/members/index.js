// 「成員」頁：邀請他方或本方同仁（共編連結與進入密碼）、甲乙方成員、我的資料。
import { copy } from "../../../../core/dom.js";
import { S } from "../../context.js";
import { render } from "../../render.js";
import { loadInvites } from "../../shell/invite-share.js";
import { myLink } from "../../state.js";
import { simple } from "../../sync.js";
import { membersHtml } from "./view.js";

/** @type {import("../index.js").Tab} */
export default {
  id: "members",
  nav: { label: "成員", tone: "plain", count: () => S.participants.filter((p) => !p.revoked).length },
  title: () => "", // 分頁按鈕已標示，不重複標題
  html: membersHtml,
  enter: () => { S.invites = null; S.shareSide = null; },
  after: () => loadInvites(),
  actions: {
    "share-side": (el) => { S.shareSide = el.dataset.v; S.confirmRotate = null; render(); },
    "copy-mine": () => copy(myLink(), "已複製您的專屬連結"),
    revoke: (el, id) => simple(`participants/${id}/remove`, {}, "已停用，此人無法再進入")
  }
};
