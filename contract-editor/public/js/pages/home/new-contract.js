/**
 * 新增契約（/new）
 * 頁面目的：建立一份新契約並直接開啟
 * 主要任務：1. 選擇範本 2. 填寫契約名稱、案號與本方身分
 */
import { contractApi } from "../../api/client.js";
import { $, esc, toast } from "../../core/dom.js";
import { store } from "../../core/storage.js";
import { loadTemplates } from "../../lib/templates.js";
import { tplPicker } from "../../ui/template-picker.js";
import { H, admin } from "./state.js";

// 範本可能在使用者輸入時才載入完成：重畫表單但保留已輸入的內容
export function ensureTemplates({ draw }) {
  if (H.tpls) return;
  loadTemplates().then((d) => {
    H.tpls = d;
    const keep = ["ntitle", "ncase", "nrole"].map((id) => [id, $(id)?.value]);
    const focused = document.activeElement?.id;
    draw();
    keep.forEach(([id, v]) => { if (v != null && $(id)) $(id).value = v; });
    if (focused && $(focused)) $(focused).focus();
  }).catch((e) => toast(e.message));
}

export const newContractScreen = {
  header: () => `<div class="home-head"><div><a class="crumb" href="/" data-act="go-list">契約案件</a><h1>新增契約</h1></div></div>`,
  html: () => `<form class="card page-card new-form" data-form="create"><h2 class="pc-h">1　選擇範本</h2>
    <div class="field">${H.tpls ? tplPicker(H.tpls, "blank") : `<span class="skel" style="height:64px"></span>`}<p class="meta-s" id="tplnotice" hidden>${esc(H.tpls?.notice || "")}範本中【　】為待填欄位。</p></div>
    <h2 class="pc-h">2　填寫契約資料</h2>
    <div class="field"><label for="ntitle">契約名稱（案名）</label><input id="ntitle" maxlength="200" placeholder="例如：115 年度資訊系統維護採購案" required></div>
    <div class="row"><div class="field grow"><label for="ncase">案號</label><input id="ncase" maxlength="100" placeholder="例如：115-A-001（選填）"></div>
    <div class="field grow"><label for="nrole">本方身分</label><select id="nrole" class="inp"><option>機關（甲方）</option><option>廠商（乙方）</option></select></div></div>
    <div class="row"><div class="grow"></div><button class="btn" type="button" data-act="go-list">取消</button><button class="btn primary lg" type="submit" ${H.busy ? "disabled" : ""}>${H.busy ? "建立中…" : "建立並開啟"}</button></div></form>`,
  after(ctx) {
    ensureTemplates(ctx);
    $("ntitle").focus();
    // 選擇範本時，契約名稱尚未自行輸入就帶入範本名稱
    let lastAuto = "";
    document.querySelectorAll("input[name=tpl]").forEach((r) => r.addEventListener("change", () => {
      const t = H.tpls.templates.find((x) => x.id === r.value), el = $("ntitle");
      if (!el.value.trim() || el.value === lastAuto) { el.value = t.title; lastAuto = t.title; }
      $("tplnotice").hidden = !t.clauses.length;
    }));
  },
  forms: {
    create: async (form, { draw }) => {
      if (H.busy) return;
      const title = $("ntitle").value.trim(), caseNo = $("ncase").value.trim(), ownerLabel = $("nrole").value; if (!title) return;
      const tpl = H.tpls?.templates.find((t) => t.id === document.querySelector("input[name=tpl]:checked")?.value);
      H.busy = true; draw();
      try {
        const r = await admin("contracts", "POST", { title, caseNo, ownerLabel });
        store.set("ce:key:" + r.id, r.key);
        if (tpl?.clauses.length) {
          try { await contractApi({ cid: r.id, key: r.key })("import", { title, source: `範本：${tpl.name}`, clauses: tpl.clauses }); }
          catch { toast("契約已建立，但範本套用失敗，請進入契約後在「契約內容」的「更多」選單套用範本"); }
        }
        location.href = "/c/" + r.id;
        return;
      } catch (err) { toast(err.message); }
      H.busy = false; draw();
    }
  }
};
