// 「成員與連結」頁：成員名單、產生與停用專屬連結。
import { copy } from "../../../../core/dom.js";
import { S } from "../../context.js";
import { myLink } from "../../state.js";
import { simple } from "../../sync.js";
import { bindMembers, membersHtml } from "./view.js";

/** @type {import("../index.js").Tab} */
export default {
  id: "members",
  nav: { icon: "group", label: "成員", tone: "plain", count: () => S.participants.filter((p) => !p.revoked).length },
  title: () => "成員與連結",
  lede: () => "各方成員以專屬連結進入；連結外流時可停用，再產生新的連結。",
  keepTyping: true,
  html: membersHtml,
  after: bindMembers,
  actions: {
    "copy-invite": () => copy(S.invited.link, "已複製，請傳給他方"),
    "copy-mine": () => copy(myLink(), "已複製您的專屬連結"),
    revoke: (el, id) => simple(`participants/${id}/remove`, {}, "已停用這條連結")
  }
};
