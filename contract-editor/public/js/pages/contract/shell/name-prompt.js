// 第一次進入契約（或按「編輯個人資料」）時，在頁首請成員填寫姓名與角色；任何分頁都會顯示。
import { $, esc } from "../../../core/dom.js";
import { S } from "../context.js";
import { render } from "../render.js";
import { ROLES, SIDE, mySide } from "../state.js";
import { act } from "../sync.js";

export function renderNamePrompt() {
  const el = $("name-prompt");
  if (!S.loaded.c || S.noAccess || !S.nameOpen) { el.innerHTML = ""; return; }
  if ($("nameform")) return; // 背景更新時保留正在輸入的內容
  el.innerHTML = `<form class="panel" id="nameform"><h2>${S.me?.name ? "編輯個人資料" : "請先填寫您的姓名與角色"}</h2>
    <p>${esc(S.me?.label || SIDE[mySide()])}的成員。姓名與角色會顯示在每一筆修訂紀錄。</p>
    <div class="row">
      <div class="field grow"><label for="myname">姓名</label><input id="myname" maxlength="60" value="${esc(S.me?.name || "")}" placeholder="例如：王小明" required></div>
      <div class="field" style="flex:0 1 200px"><label for="mytitle">角色</label><input id="mytitle" maxlength="30" list="roles" value="${esc(S.me?.title || "")}" placeholder="例如：法務"><datalist id="roles">${ROLES.map((r) => `<option value="${r}">`).join("")}</datalist></div>
    </div>
    <div class="row"><div class="grow"></div>${S.me?.name ? `<button class="btn" type="button" data-act="name-cancel">取消</button>` : ""}<button class="btn primary" type="submit">儲存</button></div></form>`;
  $("nameform").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("myname").value.trim(); if (!name) return;
    try { await act("me", { name, title: $("mytitle").value.trim() }, "已儲存個人資料"); S.nameOpen = false; render(); } catch { /* fail() 已提示 */ }
  });
}
