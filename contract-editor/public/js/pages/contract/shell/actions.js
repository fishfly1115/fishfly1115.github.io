// 各分頁共用的操作：換頁、對話視窗（交給他方、匯出）、交接（送回、定稿、下一輪）、共編連結、通知、重試、編輯名稱、個人資料。
import { $ } from "../../../core/dom.js";
import { S } from "../context.js";
import { render } from "../render.js";
import { go } from "../router.js";
import { roundNo } from "../state.js";
import { refresh, simple } from "../sync.js";
import { dialogActions } from "../dialogs/index.js";
import { inviteActions } from "./invite-share.js";
import { copyNotice } from "./notify.js";

const handoff = (status, round, msg) => simple("handoff", { status, round }, msg);

export const sharedActions = {
  ...dialogActions,
  ...inviteActions,
  nav: (el, id, ev) => { ev.preventDefault(); go(el.dataset.v); },
  "handoff-reviewed": () => handoff("reviewed", roundNo(), "已送回"),
  final: () => handoff("final", roundNo(), "已定稿"),
  "next-round": () => handoff("editing", roundNo() + 1, "已開始新一輪修訂。"),
  copy: () => copyNotice(),
  retry: () => { S.slow = false; render(); refresh(); },
  "rename-open": () => { S.renaming = true; render(); $("rtitle")?.focus(); },
  "rename-cancel": () => { S.renaming = false; render(); },
  "name-edit": () => { S.nameOpen = true; render(); window.scrollTo({ top: 0 }); },
  "name-cancel": () => { S.nameOpen = false; render(); }
};
