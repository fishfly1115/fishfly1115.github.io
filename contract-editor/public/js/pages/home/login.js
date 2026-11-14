// 登入：輸入管理密碼（他方以專屬連結進入契約，不需要密碼）。
import { $ } from "../../core/dom.js";
import { H } from "./state.js";

export const loginScreen = {
  html: () => `<form class="login" data-form="login">
    <div class="brand big"><span class="brand-mark" aria-hidden="true">約</span><span class="brand-name">合約共同編輯器</span></div>
        <div class="field"><label for="pw">管理密碼</label><input id="pw" type="password" autocomplete="current-password" required></div>
    <button class="btn primary block" type="submit">登入</button></form>`,
  after: () => $("pw").focus(),
  forms: { login: (form, { load }) => { H.pw = $("pw").value; load(); } }
};
