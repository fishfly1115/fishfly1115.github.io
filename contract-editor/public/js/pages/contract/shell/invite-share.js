// 共編連結與進入密碼：載入、顯示（「成員」頁與「交給他方」視窗共用）、一鍵複製、重新產生。
// 每一方一組；本方的可邀請同仁，建立契約的一方另可看到他方的（用來請他方加入）。
import { copy, esc, toast } from "../../../core/dom.js";
import { icon } from "../../../ui/icons.js";
import { S, api } from "../context.js";
import { render } from "../render.js";
import { caseNo, docTitle, roundNo } from "../state.js";
import { fail } from "../sync.js";

export const joinUrl = (inv) => `${location.origin}/j/${inv.token}`;
const pinText = (pin) => `${pin.slice(0, 3)} ${pin.slice(3)}`;

// 載入目前有效的連結與密碼（伺服器只回傳此成員可查看的那幾方）
export async function loadInvites({ force = false } = {}) {
  if (S.invites && !force) return;
  try { S.invites = Object.fromEntries((await api("invites")).invites.map((i) => [i.side, i])); }
  catch (e) { fail(e); S.invites = {}; }
  S.forceMain = true; render();
}

// 邀請訊息：交接時附上進度說明；平常邀請只說明用途
export function inviteMessage(side, kind) {
  const inv = S.invites[side], ref = caseNo() ? `（案號：${caseNo()}）` : "";
  const lead = kind === "handoff"
    ? `「${docTitle()}」${ref}契約草案第 ${roundNo()} 輪修訂已完成，敬請以下列連結登入審閱。`
    : `誠邀您共同修訂「${docTitle()}」${ref}契約，請以下列連結登入。`;
  return `${lead}\n共編連結：${joinUrl(inv)}\n進入密碼：${inv.pin}`;
}

// 重新產生：先確認，舊的連結與密碼會立即失效
export function rotateHtml(side) {
  return S.confirmRotate === side
    ? `<div class="rotate-confirm"><span>舊的連結與密碼會失效</span><button class="btn sm" data-act="rotate-cancel">取消</button><button class="btn sm danger" data-act="rotate-do" data-side="${side}">重新產生</button></div>`
    : `<button class="linkbtn" data-act="rotate-open" data-side="${side}">重新產生連結與密碼</button>`;
}

// 共編連結與進入密碼兩列，各自旁邊有複製小圖示
export function shareRowsHtml(side) {
  if (!S.invites) return `<span class="skel" style="height:96px"></span>`;
  const inv = S.invites[side];
  if (!inv) return "";
  const copyBtn = (act, label) => `<button class="btn icon ghost" data-act="${act}" data-side="${side}" aria-label="${label}" title="${label}">${icon("copy", { size: 18 })}</button>`;
  return `${inv.locked ? `<div class="warnline">密碼錯誤太多次，已鎖住，請重新產生</div>` : ""}
    <div class="copy-rows">
      <div class="copy-row"><div><span class="copy-label">共編連結</span><code class="copy-value" data-share="link">${esc(joinUrl(inv))}</code></div>${copyBtn("copy-link", "複製共編連結")}</div>
      <div class="copy-row"><div><span class="copy-label">進入密碼</span><code class="copy-value pin" data-share="pin">${pinText(inv.pin)}</code></div>${copyBtn("copy-pin", "複製進入密碼")}</div>
    </div>`;
}

// 一鍵複製邀請訊息（含連結與密碼）
export const copyMessageBtn = (side, kind, cls = "primary") =>
  `<button class="btn ${cls}" data-act="copy-message" data-side="${side}" data-kind="${kind}">${icon("copy", { size: 18 })}一鍵複製邀請訊息</button>`;

export const inviteActions = {
  "copy-link": (el) => copy(joinUrl(S.invites[el.dataset.side]), "已複製共編連結"),
  "copy-pin": (el) => copy(S.invites[el.dataset.side].pin, "已複製進入密碼"),
  "copy-message": (el) => copy(inviteMessage(el.dataset.side, el.dataset.kind), "已複製邀請訊息"),
  "rotate-open": (el) => { S.confirmRotate = el.dataset.side; S.forceMain = true; render(); },
  "rotate-cancel": () => { S.confirmRotate = null; S.forceMain = true; render(); },
  "rotate-do": async (el) => {
    const side = el.dataset.side;
    try {
      S.invites[side] = (await api(`invites/${side}/rotate`, {})).invite;
      toast("已重新產生，舊的已失效");
    } catch (e) { fail(e); }
    S.confirmRotate = null; S.forceMain = true; render();
  }
};
