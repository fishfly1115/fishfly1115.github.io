// 契約頁的使用者操作：所有按鈕以 data-act 標示，由這裡統一分派（事件委派）。
import { $, copy, toast } from "../../core/dom.js";
import { store } from "../../core/storage.js";
import { loadTemplates } from "../../lib/templates.js";
import { copyMsg, save, simple } from "./actions/editing.js";
import { exportPdf, exportWord } from "./actions/exporting.js";
import { fieldChange } from "./actions/fields.js";
import { doImport, doReimport, pickDocx, pickRevised } from "./actions/importing.js";
import { S, api, ctx } from "./context.js";
import { render } from "./render.js";
import { docTitle, myLink, roundNo, theirsClauses } from "./state.js";
import { fail, poll, refresh } from "./sync.js";
import { closePop, openPop } from "./views/field-popover.js";
import { locate } from "./actions/navigate.js";
import { go } from "./router.js";

// 全部接受：逐條送出後重新載入一次
async function acceptAll() {
  const ids = theirsClauses().map((c) => c.id);
  S.acceptAll = false; S.busy = true; render();
  let done = 0;
  try { for (const id of ids) { await api(`clauses/${id}/accept`, {}); done++; } toast(`已接受 ${done} 條修訂`); }
  catch (e) { fail(e); }
  S.busy = false; S.forceMain = true; await refresh();
}

// 審閱頁：處理完這一處後，自動前往下一處
async function decide(id, how) {
  const list = theirsClauses(), i = list.findIndex((c) => c.id === id);
  const next = list[i + 1] || list[i - 1];
  const note = how === "revert" ? ($("rv-reason")?.value || "").trim() : undefined;
  S.busy = true;
  try {
    await api(`clauses/${id}/${how}`, how === "revert" ? { note } : {});
    toast(how === "accept" ? "已接受這處修訂" : "已退回，條文恢復為修訂前內容");
    S.focusPending = next ? next.id : null;
  } catch (e) { fail(e); }
  S.busy = false; S.forceMain = true; await refresh();
}

export function bindEvents() {
  // 點選可填寫欄位：□ 直接切換勾選，日期與空格開啟填寫視窗。用捕獲階段，先於一般按鈕處理。
  document.addEventListener("click", (e) => {
    const fx = e.target.closest(".fx");
    if (fx) {
      e.preventDefault();
      const cid = fx.closest("[data-cid]")?.dataset.cid, k = +fx.dataset.fx;
      if (!cid) return;
      if (fx.dataset.kind === "box") { closePop(); fieldChange(cid, k); }
      else openPop(fx, cid, k);
      return;
    }
    if ($("pop") && !e.target.closest("#pop")) closePop();
    if (S.outlineOpen && !e.target.closest("#outline,[data-act=outline-toggle]")) { S.outlineOpen = false; render(); }
  }, true);
  // 切回分頁時立即檢查他方是否有新變更
  document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); });
  $("docx-input").addEventListener("change", (e) => pickDocx(e.target.files[0]));
  $("rev-input").addEventListener("change", (e) => pickRevised(e.target.files[0]));
  document.addEventListener("change", (e) => {
    if (e.target.name === "efmt") { S.exportFmt = e.target.value; S.exportOnlyChecked = S.exportFmt === "pdf"; render(); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (S.outlineOpen) { S.outlineOpen = false; render(); }
  });
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-act],[data-filter]"); if (!b || b.disabled) return;
    if (b.dataset.filter) { S.filter = b.dataset.filter; render(); return; }
    const id = b.dataset.id;
    switch (b.dataset.act) {
      case "edit": {
        const c = S.clauses.find((x) => x.id === id);
        S.editing = id; S.adding = null; S.editBase = { rev: c.rev }; S.confirm = null; render();
        $("eb-" + id)?.focus(); break;
      }
      case "add": S.adding = { afterId: b.dataset.after || null }; S.editing = null; S.confirm = null; render(); $("et-new")?.focus(); break;
      case "cancel": S.editing = null; S.adding = null; render(); break;
      case "save": save(id); break;
      case "up": simple(`clauses/${id}/move`, { dir: -1 }); break;
      case "down": simple(`clauses/${id}/move`, { dir: 1 }); break;
      case "delete-open": S.confirm = { id, kind: "delete" }; render(); break;
      case "delete-do": simple(`clauses/${id}/delete`, {}, "已提議刪除，他方接受後才會正式刪除"); break;
      case "revert-open": S.confirm = { id, kind: "revert" }; render(); $("reason-" + id)?.focus(); break;
      case "confirm-cancel": S.confirm = null; render(); break;
      case "revert-do": simple(`clauses/${id}/revert`, { note: (b.closest(".confirm")?.querySelector("input")?.value || "").trim() }, "已恢復成改動前的樣子"); break;
      case "toggle-plain": S.plainView.has(id) ? S.plainView.delete(id) : S.plainView.add(id); render(); break;
      case "expand": S.expanded.has(id) ? S.expanded.delete(id) : S.expanded.add(id); render(); break;
      case "goto": ev.preventDefault(); locate(id, { flash: false }); break;
      case "locate": locate(id); break;
      case "nav": ev.preventDefault(); go(b.dataset.v); break;
      case "review-go": S.focusPending = id; go("review"); break;
      case "review-accept": if (!S.busy) decide(id, "accept"); break;
      case "review-revert": if (!S.busy) decide(id, "revert"); break;
      case "accept-all": S.acceptAll = true; render(); break;
      case "accept-all-cancel": S.acceptAll = false; render(); break;
      case "accept-all-do": acceptAll(); break;
      case "outline-toggle": S.outlineOpen = !S.outlineOpen; render(); break;
      case "see-log": S.filter = "all"; go("log"); break;
      case "mark-seen": S.lastSeen = Date.now(); render(); api("seen", {}).catch(() => {}); break;
      case "copy": copyMsg(); break;
      case "handoff-review": simple("handoff", { status: "review", round: roundNo() }, "已交給他方審閱。可用「複製通知訊息」告訴他方。"); break;
      case "handoff-reviewed": simple("handoff", { status: "reviewed", round: roundNo() }, "已交回他方檢視。"); break;
      case "final": simple("handoff", { status: "final", round: roundNo() }, "已同意定稿，可以匯出 PDF。"); break;
      case "next-round": simple("handoff", { status: "editing", round: roundNo() + 1 }, "已開始新一輪修訂。"); break;
      case "export-go": { const only = $("eonly") ? $("eonly").checked : false; S.exportFmt === "pdf" ? exportPdf(only) : exportWord(only); break; }
      case "only-checked": S.onlyChecked = b.dataset.v === "1"; store.set("ce:only:" + ctx.CID, S.onlyChecked ? "1" : null); closePop(); render(); break;
      case "reimport-pick": $("rev-input").value = ""; $("rev-input").click(); break;
      case "reimport-go": doReimport(); break;
      case "reimport-cancel": S.reimport = null; render(); break;
      case "reimport-all": S.reimportAll = b.checked; render(); break;
      case "retry": S.slow = false; render(); refresh(); break;
      case "tpl-open": S.tplPick = true; render(); loadTemplates().then((d) => { S.tpls = d; render(); }).catch((e) => { toast(e.message); S.tplPick = false; render(); }); break;
      case "tpl-cancel": S.tplPick = false; render(); break;
      case "tpl-preview": {
        const t = S.tpls.templates.find((x) => x.id === document.querySelector("input[name=tpl]:checked")?.value); if (!t) break;
        S.tplPick = false;
        S.importPreview = { title: docTitle() === "採購契約書" ? t.title : docTitle(), clauses: t.clauses, source: `範本：${t.name}`, split: "template", imgFail: 0 };
        render(); window.scrollTo({ top: 0 }); break;
      }
      case "import-pick": $("docx-input").value = ""; $("docx-input").click(); break;
      case "import-go": doImport(); break;
      case "import-cancel": S.importPreview = null; render(); break;
      case "copy-invite": copy(S.invited.link, "已複製，請傳給他方"); break;
      case "copy-mine": copy(myLink(), "已複製您的專屬連結"); break;
      case "revoke": simple(`participants/${id}/remove`, {}, "已停用這條連結"); break;
      case "name-edit": S.nameOpen = true; render(); break;
      case "name-cancel": S.nameOpen = false; render(); break;
      case "rename-open": S.renaming = true; render(); $("rtitle")?.focus(); break;
      case "rename-cancel": S.renaming = false; render(); break;
    }
  });
}
