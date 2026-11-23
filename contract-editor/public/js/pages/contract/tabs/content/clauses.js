// 「契約內容」頁的紙張檢視：條文排在 A4 紙上（與 PDF 同一套排版 .pf，分頁見 paper.js），
// 紙上只留修訂標示（刪除線、底線）與左側色條；修訂人、撤回、前往審閱等放在紙張右側的註記欄（窄螢幕改為點色條從下方開啟）。
// 點條文即可直接修訂（inline-editor.js）；他方修訂到「審閱」頁處理。
import { diffHtml, diffText } from "../../../../core/diff.js";
import { esc } from "../../../../core/dom.js";
import { fmt } from "../../../../core/format.js";
import { Fields } from "../../../../lib/fields.js";
import { headHtml } from "../../../../lib/paginate.js";
import { icon } from "../../../../ui/icons.js";
import { S } from "../../context.js";
import { FIELD_LABELS, KIND, SIDE, canEditDoc, caseNo, clauseHtmlOf, docTitle, isNew, mySide, pendingOf, revHtml, roundNo, sameSide, status, visible, whoFull } from "../../state.js";

export function paperHtml() {
  const vis = visible();
  if (!vis.length) return `<div class="sheet"><div class="empty"><p>尚無條文</p><div class="row" style="justify-content:center">${S.isAdmin ? `<button class="btn primary" data-act="nav" data-v="import">匯入 Word 或套用範本</button>` : ""}<button class="btn" data-act="add" data-after="">新增條文</button></div></div></div>`;
  const head = headHtml({ title: docTitle(), caseNo: caseNo(), final: status() === "final", round: roundNo() });
  const sheetFor = S.noteOpen && vis.find((c) => c.id === S.noteOpen);
  return `<div class="desk" id="desk">
    <div class="paper-wrap" id="paper-wrap"><div class="paper" id="paper">
      <div class="pages" id="pages" aria-hidden="true"></div>
      <div class="pf galley" id="galley">${head}${vis.map(clauseHtml).join("")}</div>
      <div class="gaps" id="gaps" aria-hidden="true"></div>
    </div></div>
    <aside class="notes" id="notes" aria-label="修訂註記">${vis.map((c) => { const b = noteBody(c); return b ? `<div class="note" data-for="${c.id}" data-tone="${toneOf(c)}">${b}</div>` : ""; }).join("")}</aside>
  </div>
  ${sheetFor ? `<div class="note-sheet" id="note-sheet" role="dialog" aria-label="修訂註記" data-tone="${toneOf(sheetFor)}"><button class="btn icon ghost note-x" data-act="note-close" aria-label="關閉">${icon("close")}</button><div class="note-sheet-t">${esc(sheetFor.title)}</div>${noteBody(sheetFor) || ""}</div>` : ""}`;
}

export function fieldsView(html, interactive) {
  if (S.onlyChecked) return Fields.hideUncheckedHtml(html);
  if (!interactive) return html;
  const root = Fields.parse(html);
  Fields.decorate(root, FIELD_LABELS);
  return root.innerHTML;
}

// 這一條的修訂狀況
function infoOf(c) {
  const pend = pendingOf(c.id);
  const theirs = pend.filter((r) => !sameSide(r.by)), ours = pend.filter((r) => sameSide(r.by));
  const kinds = new Set(pend.map((r) => r.kind || "edit"));
  const firstEdit = pend.find((r) => (r.kind || "edit") === "edit");
  // 他方的修訂預設標出差異；本方的修訂預設顯示修訂後內容（可繼續填寫），需要時再切換
  const flip = S.plainView.has(c.id), plain = theirs.length ? flip : !flip;
  return { pend, theirs, ours, kinds, firstEdit, plain, isAdd: kinds.has("add"), isDel: kinds.has("delete") };
}
const toneOf = (c) => { const i = infoOf(c); return i.theirs.length ? "theirs" : i.ours.length ? "mine" : "plain"; };

export function clauseHtml(c) {
  const i = infoOf(c);
  const state = i.theirs.length ? "theirs" : i.ours.length ? "mine" : "clean";
  const bar = state !== "clean" || S.confirm?.id === c.id ? `<button class="cbar" data-act="note-open" data-id="${c.id}" data-tone="${state === "clean" ? "mine" : state}" aria-label="查看修訂註記" title="查看修訂註記"></button>` : "";
  if (S.editing === c.id) return `<section class="pb clause" data-state="edit" id="c-${c.id}" data-cid="${c.id}">${bar}<div id="slot-${c.id}"></div></section>`;
  const cur = clauseHtmlOf(c);
  const showDiff = i.firstEdit && !i.plain && !i.isAdd && !i.isDel && !S.onlyChecked;
  const titleHtml = showDiff && i.firstEdit.titleBefore !== c.title ? diffText(i.firstEdit.titleBefore, c.title) : esc(c.title);
  const bodyHtml = showDiff ? diffHtml(revHtml(i.firstEdit, "before"), cur) : fieldsView(cur, canEditDoc() && !i.isDel);
  // 顯示目前內容（非差異標示）時，點條文就能直接修訂
  const editable = canEditDoc() && !i.isDel && !showDiff && !S.onlyChecked;
  const last = c.updatedAt ? `${whoFull(c.updatedBy)} · ${fmt(c.updatedAt)}` : "";
  return `<section class="pb clause ${i.isAdd ? "added" : ""} ${i.isDel ? "deleted" : ""} ${S.focusPending === c.id ? "focus" : ""}" data-state="${state}" id="c-${c.id}" data-cid="${c.id}"${editable ? " data-editable" : ""}>
    ${bar}<h3${last ? ` title="最後修訂：${esc(last)}"` : ""}>${titleHtml}</h3><div class="rich">${bodyHtml}</div></section>`;
}

// 修訂註記：誰改的、改了什麼、撤回／前往審閱／切換顯示；確認刪除或撤回也在這裡
function noteBody(c) {
  const i = infoOf(c), confirming = S.confirm?.id === c.id;
  if (!i.pend.length && !confirming) return "";
  let pills = "";
  if (i.theirs.length) pills += `<span class="pill theirs">待您審閱</span>`;
  else if (i.ours.length) pills += `<span class="pill mine">待${SIDE[mySide() === "A" ? "B" : "A"]}審閱</span>`;
  if (i.isAdd) pills += `<span class="pill ok">新增條文</span>`;
  if (i.isDel) pills += `<span class="pill no">提議刪除</span>`;
  if (i.kinds.has("move")) pills += `<span class="pill plain">已調整位置</span>`;
  const head = i.pend.length ? `<div class="note-who">${i.pend.some(isNew) ? `<span class="newdot" title="新的修訂"></span>` : ""}${esc([...new Set(i.pend.map((r) => whoFull(r.by)))].join("、"))}</div>
    <div class="note-meta">${fmt(i.pend[i.pend.length - 1].at)} · ${esc([...i.kinds].map((k) => KIND[k]).join("、"))}${i.pend.length > 1 ? ` ${i.pend.length} 次` : ""}</div>
    <div class="note-pills">${pills}</div>` : "";
  if (confirming) {
    const k = S.confirm.kind;
    const label = k === "delete" ? "提議刪除此條？" : i.theirs.length ? "退回此條修訂？" : "撤回本方修訂？";
    const msg = k === "delete" ? "他方接受後才會刪除" : "恢復為修訂前內容";
    const verb = k === "delete" ? "提議刪除" : i.theirs.length ? "退回" : "撤回";
    return `${head}<div class="confirm" data-kind="${k}"><label for="reason-${c.id}"><strong>${label}</strong>${msg}</label>
      ${k === "delete" ? "" : `<input id="reason-${c.id}" class="inp" maxlength="500" placeholder="${i.theirs.length ? "退回理由（選填）" : "撤回原因（選填）"}">`}
      <div class="actions"><button class="btn sm" data-act="confirm-cancel">取消</button><button class="btn sm bad" data-act="${k === "delete" ? "delete-do" : "revert-do"}" data-id="${c.id}">${verb}</button></div></div>`;
  }
  const acts = [
    i.firstEdit && !i.isAdd && !i.isDel && `<button class="linkbtn" data-act="toggle-plain" data-id="${c.id}">${i.plain ? "顯示修訂處" : "只看修訂後"}</button>`,
    i.theirs.length && `<button class="btn sm primary" data-act="review-go" data-id="${c.id}">前往審閱${icon("chevronRight", { size: 16 })}</button>`,
    !i.theirs.length && i.ours.length && `<button class="btn sm" data-act="revert-open" data-id="${c.id}">撤回</button>`
  ].filter(Boolean).join("");
  return `${head}<div class="note-acts">${acts}</div>`;
}
