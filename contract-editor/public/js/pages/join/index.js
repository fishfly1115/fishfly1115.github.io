/**
 * 加入契約（/j/<連結代碼>）
 * 頁面目的：收到共編連結的人，輸入進入密碼與姓名後加入契約
 * 主要任務：輸入密碼 → 填寫姓名與角色 → 加入並開啟契約
 */
import { joinApi } from "../../api/client.js";
import { $, esc } from "../../core/dom.js";
import { store } from "../../core/storage.js";
import { ROLES } from "../../lib/roles.js";

const SIDE = { A: "甲方", B: "乙方" };

export async function startJoin(token) {
  for (const id of ["tabs", "flowbar"]) $(id).hidden = true;
  document.querySelector("header.top").hidden = true;
  $("brand").removeAttribute("href");
  const main = $("main");
  main.innerHTML = `<div class="join card"><span class="skel" style="height:220px"></span></div>`;
  let info;
  try { info = await joinApi(token); }
  catch (e) { main.innerHTML = `<div class="join card"><h1>無法開啟這個連結</h1><p>${esc(e.message)}</p></div>`; return; }
  document.title = `加入「${info.title}」 · 合約共同編輯器`;
  main.innerHTML = `<form class="join card" id="joinform" novalidate>
    <p class="meta-s">邀請您共同修訂</p>
    <h1>${esc(info.title)}</h1>
    ${info.caseNo ? `<p class="meta-s">案號 ${esc(info.caseNo)}</p>` : ""}
    <p class="join-side">您的身分：${SIDE[info.side]}</p>
    ${info.locked ? `<div class="warnline">密碼錯誤次數過多，這組連結已鎖住。請向邀請方索取新的連結與密碼。</div>` : ""}
    <div class="field"><label for="jpin">進入密碼（6 位數字）</label><input id="jpin" class="inp pin-input" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="○○○ ○○○" required></div>
    <div class="field"><label for="jname">您的姓名</label><input id="jname" class="inp" maxlength="60" autocomplete="name" placeholder="例如：林小明" required></div>
    <div class="field"><label for="jtitle">角色</label><input id="jtitle" class="inp" maxlength="30" list="jroles" placeholder="例如：主管、法務、承辦人"><datalist id="jroles">${ROLES.map((r) => `<option value="${r}">`).join("")}</datalist></div>
    <p class="field-error" id="jerr" role="alert" hidden></p>
    <button class="btn primary block lg" type="submit" ${info.locked ? "disabled" : ""}>加入並開啟契約</button>
    <p class="meta-s">密碼由邀請方另外提供。加入後，這台裝置下次會自動登入。</p>
  </form>`;
  $("jpin").focus();
  $("joinform").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pin = $("jpin").value.replace(/\s/g, ""), name = $("jname").value.trim(), err = $("jerr");
    err.hidden = true;
    if (!/^\d{6}$/.test(pin)) { err.textContent = "請輸入 6 位數字的進入密碼"; err.hidden = false; $("jpin").focus(); return; }
    if (!name) { err.textContent = "請填寫您的姓名"; err.hidden = false; $("jname").focus(); return; }
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "加入中…";
    try {
      const r = await joinApi(token, { pin, name, title: $("jtitle").value.trim() });
      store.set("ce:key:" + r.cid, r.key);
      location.href = "/c/" + r.cid;
    } catch (ex) {
      err.textContent = ex.message; err.hidden = false;
      btn.disabled = !!(ex.status === 423); btn.textContent = "加入並開啟契約";
      $("jpin").select();
    }
  });
}
