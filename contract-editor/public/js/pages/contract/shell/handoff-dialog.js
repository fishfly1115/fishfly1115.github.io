// 「交給他方」確認視窗：顯示他方的共編連結與進入密碼（可分別或一鍵複製），確認後才正式交出。
// 他方的連結只有建立契約的一方看得到；另一方交出時只顯示確認與通知內容。
import { $, esc } from "../../../core/dom.js";
import { S } from "../context.js";
import { render } from "../render.js";
import { SIDE, otherSide, roundNo, sameSide } from "../state.js";
import { simple } from "../sync.js";
import { loadInvites, shareBoxHtml } from "./invite-share.js";

export function renderDialog() {
  const root = $("dialog");
  if (S.dialog !== "handoff" || !S.loaded.c) { root.innerHTML = ""; root.hidden = true; return; }
  const other = SIDE[otherSide()], n = roundNo();
  const ours = S.revs.filter((r) => r.status === "pending" && sameSide(r.by) && (r.round || 1) === n).length;
  const canShare = !S.invites || otherSide() in S.invites;
  root.hidden = false;
  if (root.querySelector(".dialog") && root.dataset.round === String(n) && !S.forceDialog) return; // 已開啟：背景更新不重繪
  S.forceDialog = false;
  root.dataset.round = String(n);
  root.innerHTML = `<div class="scrim" data-act="dialog-close"></div>
    <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
      <h2 id="dlg-title">交給${other}審閱</h2>
      <p class="dialog-sub">本輪您修訂了 ${ours} 處。交出後由${other}審閱，您仍可查看，但在${other}送回前請勿再修改。</p>
      ${canShare ? shareBoxHtml(otherSide(), {
        title: `把以下兩項傳給${other}`, kind: "handoff", rotatable: false,
        note: `建議分開傳送：連結以電子郵件寄出，密碼以電話或簡訊告知。${other}已加入的成員不需要再輸入密碼。`
      }) : `<p class="dialog-sub">交出後，可按「複製通知內容」通知${other}。</p>`}
      <footer class="dialog-foot"><span class="meta-s">${canShare ? `連結與密碼之後也可在「成員與連結」頁查看` : ""}</span><div class="grow"></div>
        <button class="btn" data-act="dialog-close">取消</button><button class="btn primary" data-act="handoff-confirm">確認交給${esc(other)}</button></footer>
    </section>`;
  root.querySelector("[data-act=handoff-confirm]").focus();
}

export const dialogActions = {
  "handoff-review": () => { S.dialog = "handoff"; S.forceDialog = true; render(); loadInvites().then(() => { S.forceDialog = true; render(); }); },
  "dialog-close": () => { S.dialog = null; render(); },
  "handoff-confirm": () => { S.dialog = null; simple("handoff", { status: "review", round: roundNo() }, `已交給${SIDE[otherSide()]}審閱`); }
};

// Esc 關閉視窗
export function bindDialog() {
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.dialog) { S.dialog = null; render(); } });
}
