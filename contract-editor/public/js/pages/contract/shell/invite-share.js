// 共編連結與進入密碼：載入、顯示（「成員與連結」頁與「交給他方」視窗共用）、一鍵複製、重新產生。
// 每一方一組；本方的可邀請同仁，建立契約的一方另可看到他方的（用來請他方加入）。
import { copy, esc, toast } from "../../../core/dom.js";
import { icon } from "../../../ui/icons.js";
import { S, api } from "../context.js";
import { render } from "../render.js";
import { SIDE, caseNo, docTitle, roundNo } from "../state.js";
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

/**
 * 連結與密碼區塊
 * @param {"A"|"B"} side
 * @param {{ title: string, note: string, kind: "join"|"handoff", rotatable?: boolean }} o
 */
export function shareBoxHtml(side, { title, note, kind, rotatable = true }) {
  if (!S.invites) return `<div class="share-box"><span class="skel" style="height:120px"></span></div>`;
  const inv = S.invites[side];
  if (!inv) return "";
  const rotate = !rotatable ? "" : S.confirmRotate === side
    ? `<div class="rotate-confirm"><span>重新產生後，舊的連結與密碼立即失效。</span><button class="btn sm" data-act="rotate-cancel">取消</button><button class="btn sm danger" data-act="rotate-do" data-side="${side}">重新產生</button></div>`
    : `<button class="linkbtn" data-act="rotate-open" data-side="${side}">重新產生</button>`;
  return `<section class="share-box" aria-label="${esc(title)}">
    <div class="share-head"><h3>${esc(title)}</h3>${rotate}</div>
    ${inv.locked ? `<div class="warnline">密碼錯誤次數過多，這組連結已鎖住，請按「重新產生」。</div>` : ""}
    <div class="copy-row"><div><span class="copy-label">共編連結</span><code class="copy-value" data-share="link">${esc(joinUrl(inv))}</code></div>
      <button class="btn" data-act="copy-link" data-side="${side}">${icon("copy", { size: 16 })}複製</button></div>
    <div class="copy-row"><div><span class="copy-label">進入密碼</span><code class="copy-value pin" data-share="pin">${pinText(inv.pin)}</code></div>
      <button class="btn" data-act="copy-pin" data-side="${side}">${icon("copy", { size: 16 })}複製</button></div>
    <button class="btn primary block" data-act="copy-message" data-side="${side}" data-kind="${kind}">${icon("copy", { size: 18 })}一鍵複製邀請訊息（含連結與密碼）</button>
    <p class="share-note">${esc(note)}</p>
  </section>`;
}

export const inviteActions = {
  "copy-link": (el) => copy(joinUrl(S.invites[el.dataset.side]), "已複製共編連結"),
  "copy-pin": (el) => copy(S.invites[el.dataset.side].pin, "已複製進入密碼"),
  "copy-message": (el) => copy(inviteMessage(el.dataset.side, el.dataset.kind), "已複製邀請訊息（含連結與密碼）"),
  "rotate-open": (el) => { S.confirmRotate = el.dataset.side; S.forceMain = true; render(); },
  "rotate-cancel": () => { S.confirmRotate = null; S.forceMain = true; render(); },
  "rotate-do": async (el) => {
    const side = el.dataset.side;
    try {
      S.invites[side] = (await api(`invites/${side}/rotate`, {})).invite;
      toast(`已重新產生${SIDE[side]}的連結與密碼，舊的已失效`);
    } catch (e) { fail(e); }
    S.confirmRotate = null; S.forceMain = true; render();
  }
};
