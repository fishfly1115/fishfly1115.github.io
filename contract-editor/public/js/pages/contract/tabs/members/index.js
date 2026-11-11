// 「成員與連結」頁：甲乙方成員、共編連結與進入密碼、我的資料。
import { copy } from "../../../../core/dom.js";
import { S } from "../../context.js";
import { loadInvites } from "../../shell/invite-share.js";
import { SIDE, myLink, mySide, otherSide } from "../../state.js";
import { simple } from "../../sync.js";
import { membersHtml } from "./view.js";

// 建立契約的一方可以邀請他方；另一方只能邀請本方同仁
const ownerSide = () => S.participants.find((p) => p.role === "owner")?.side || "A";

/** @type {import("../index.js").Tab} */
export default {
  id: "members",
  nav: { icon: "group", label: "成員與連結", tone: "plain", count: () => S.participants.filter((p) => !p.revoked).length },
  title: () => "成員與連結",
  lede: () => "雙方各有一組共編連結與進入密碼；對方開啟連結並輸入密碼後即可加入。",
  tasks: () => mySide() === ownerSide()
    ? [`請${SIDE[otherSide()]}加入：把右邊的連結與密碼傳給${SIDE[otherSide()]}`, "需要同事一起修訂：左邊「邀請本方同仁」", "確認您的姓名與角色"]
    : ["需要同事一起修訂：把「邀請本方同仁」的連結與密碼傳給同事", "確認您的姓名與角色"],
  html: membersHtml,
  enter: () => { S.invites = null; },
  after: () => loadInvites(),
  actions: {
    "copy-mine": () => copy(myLink(), "已複製您的專屬連結"),
    revoke: (el, id) => simple(`participants/${id}/remove`, {}, "已停用，此人無法再進入")
  }
};
