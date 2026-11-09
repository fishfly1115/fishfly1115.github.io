// 條文清單：每條的修訂標示、審閱按鈕與可直接填寫的欄位。
import { diffHtml, diffText } from "../../../core/diff.js";
import { esc } from "../../../core/dom.js";
import { fmt } from "../../../core/format.js";
import { Fields } from "../../../lib/fields.js";
import { S } from "../context.js";
import { FIELD_LABELS, KIND, SIDE, canEditDoc, caseNo, clauseHtmlOf, docTitle, isNew, mySide, pendingOf, revHtml, roundNo, sameSide, visible, whoFull } from "../state.js";

export function contractHtml() {
  if (!S.loaded.c) return `<div class="sheet">${S.slow ? `<p class="empty">無法載入條文，請確認網路連線<br><button class="btn" data-act="retry">重試</button></p>` : `<div class="skel-block"><span class="skel" style="width:30%"></span><span class="skel"></span><span class="skel"></span><span class="skel" style="width:70%"></span><span class="skel" style="width:30%;margin-top:24px"></span><span class="skel"></span><span class="skel" style="width:85%"></span></div>`}</div>`;
  const vis = visible();
  if (!vis.length && !S.adding) return `<div class="sheet"><div class="empty"><p>尚無條文</p><div class="row" style="justify-content:center">${S.isAdmin ? `<button class="btn primary" data-act="tpl-open">套用範本</button><button class="btn" data-act="import-pick">匯入 Word 契約</button>` : ""}<button class="btn" data-act="add" data-after="">新增條文</button></div></div></div>`;
  const slotNew = `<section class="clause added" data-state="edit"><div id="slot-new"></div></section>`;
  let body = "";
  vis.forEach((c, i) => { body += clauseHtml(c, i, vis); if (S.adding?.afterId === c.id) body += slotNew; });
  if (S.adding && !vis.some((c) => c.id === S.adding.afterId)) body += slotNew;
  const addEnd = canEditDoc() && !S.adding && vis.length ? `<div class="addrow"><button class="btn sm ghost" data-act="add" data-after="${vis[vis.length - 1].id}">＋ 新增條文</button></div>` : "";
  const hint = canEditDoc() && !S.onlyChecked && vis.some((c) => Fields.count(clauseHtmlOf(c))) ? `<p class="fill-hint">點選 □ 勾選；點選日期或底線空格直接填寫</p>` : "";
  return `<article class="sheet">${sheetHead()}${hint}${body}${addEnd}</article>`;
}
// 紙張頂端：契約名稱、案號、輪次與來源（建立者可編輯名稱）
function sheetHead() {
  const src = S.contract?.source ? (S.contract.source.startsWith("範本：") ? S.contract.source : `匯入自 ${S.contract.source}`) : "";
  const meta = [caseNo() && `案號 ${caseNo()}`, `第 ${roundNo()} 輪`, src].filter(Boolean).map(esc).join("<span aria-hidden=\"true\">　·　</span>");
  return `<header class="sheet-head"><h2>${esc(docTitle())}${S.isAdmin ? ` <button class="btn icon ghost" data-act="rename-open" aria-label="編輯名稱與案號" title="編輯名稱與案號">✎</button>` : ""}</h2><p>${meta}</p></header>`;
}
export function fieldsView(html, interactive) {
  if (S.onlyChecked) return Fields.hideUncheckedHtml(html);
  if (!interactive) return html;
  const root = Fields.parse(html);
  Fields.decorate(root, FIELD_LABELS);
  return root.innerHTML;
}
export function clauseHtml(c, idx, vis) {
  if (S.editing === c.id) return `<section class="clause" data-state="edit"><div id="slot-${c.id}"></div></section>`;
  const pend = pendingOf(c.id);
  const theirs = pend.filter((r) => !sameSide(r.by)), ours = pend.filter((r) => sameSide(r.by));
  const kinds = new Set(pend.map((r) => r.kind || "edit"));
  const state = theirs.length ? "theirs" : ours.length ? "mine" : "clean";
  // 他方的修訂預設標出差異；本方的修訂預設可繼續填寫，需要時再切換顯示差異
  const flip = S.plainView.has(c.id), plain = theirs.length ? flip : !flip;
  const cur = clauseHtmlOf(c);
  const firstEdit = pend.find((r) => (r.kind || "edit") === "edit");
  const isAdd = kinds.has("add"), isDel = kinds.has("delete");
  const showDiff = firstEdit && !plain && !isAdd && !isDel && !S.onlyChecked;
  const titleHtml = showDiff && firstEdit.titleBefore !== c.title ? diffText(firstEdit.titleBefore, c.title) : esc(c.title);
  const bodyHtml = showDiff ? diffHtml(revHtml(firstEdit, "before"), cur) : fieldsView(cur, canEditDoc() && !isDel);
  const authors = [...new Set(pend.map((r) => whoFull(r.by)))].join("、");
  const what = [...kinds].map((k) => KIND[k]).join("、");
  let pill = "";
  if (theirs.length) pill = `<span class="pill theirs">待您審閱</span>`;
  else if (ours.length) pill = `<span class="pill mine">待${SIDE[mySide() === "A" ? "B" : "A"]}審閱</span>`;
  if (isAdd) pill += `<span class="pill ok">新增條文</span>`;
  if (isDel) pill += `<span class="pill no">提議刪除</span>`;
  if (kinds.has("move")) pill += `<span class="pill plain">已調整位置</span>`;
  const fresh = pend.some(isNew) ? `<span class="newdot" title="新的修訂"></span> ` : "";
  let review = "";
  if (S.confirm?.id === c.id) {
    const k = S.confirm.kind;
    const msg = k === "delete" ? "他方接受後才會刪除，在此之前條文以刪除線顯示"
      : theirs.length ? "條文恢復為修訂前內容，紀錄會保留" : "條文恢復為修訂前內容";
    const label = k === "delete" ? "提議刪除此條？" : theirs.length ? "退回此條修訂？" : "撤回本方修訂？";
    const verb = k === "delete" ? "提議刪除" : theirs.length ? "退回" : "撤回";
    review = `<div class="confirm" data-kind="${k}"><label for="reason-${c.id}"><strong>${label}</strong>${msg}</label>
      ${k === "delete" ? "" : `<input id="reason-${c.id}" class="inp" maxlength="500" placeholder="${theirs.length ? "退回理由（他方可見，選填）" : "撤回原因（選填）"}">`}
      <div class="actions"><button class="btn" data-act="confirm-cancel">取消</button><button class="btn bad" data-act="${k === "delete" ? "delete-do" : "revert-do"}" data-id="${c.id}">${verb}</button></div></div>`;
  } else if (pend.length) {
    review = `<div class="review">
      <span class="note">${esc(authors)} · ${fmt(pend[pend.length - 1].at)} · ${esc(what)}${pend.length > 1 ? ` ${pend.length} 次` : ""}</span>
      ${firstEdit && !isAdd && !isDel ? `<button class="linkbtn" data-act="toggle-plain" data-id="${c.id}">${plain ? "顯示修訂處" : "只看修訂後"}</button>` : ""}
      <span class="rv-acts">${theirs.length ? `<button class="btn sm bad" data-act="revert-open" data-id="${c.id}">退回</button><button class="btn sm good" data-act="accept" data-id="${c.id}">接受</button>` : ""}
      ${!theirs.length && ours.length ? `<button class="btn sm" data-act="revert-open" data-id="${c.id}">撤回</button>` : ""}</span>
    </div>`;
  }
  const tools = canEditDoc() && !isDel ? `<div class="tools">
      <button class="btn sm" data-act="edit" data-id="${c.id}">修訂</button>
      <button class="btn icon ghost" data-act="up" data-id="${c.id}" title="上移" aria-label="上移" ${idx === 0 ? "disabled" : ""}>↑</button>
      <button class="btn icon ghost" data-act="down" data-id="${c.id}" title="下移" aria-label="下移" ${idx === vis.length - 1 ? "disabled" : ""}>↓</button>
      <button class="btn icon ghost" data-act="add" data-after="${c.id}" title="在下方新增條文" aria-label="在下方新增條文">＋</button>
      <button class="btn icon ghost" data-act="delete-open" data-id="${c.id}" title="提議刪除" aria-label="提議刪除">✕</button></div>` : "";
  const last = c.updatedAt ? `${whoFull(c.updatedBy)} · ${fmt(c.updatedAt)}` : "";
  return `<section class="clause ${isAdd ? "added" : ""} ${isDel ? "deleted" : ""} ${S.focusPending === c.id ? "focus" : ""}" data-state="${state}" id="c-${c.id}" data-cid="${c.id}">
    <div class="clause-head"><h3${last ? ` title="最後修訂：${esc(last)}"` : ""}>${fresh}${titleHtml}</h3><div class="actions">${pill}${tools}</div></div>
    ${review}
    <div class="rich">${bodyHtml || `<p style="color:var(--muted)">（無內文）</p>`}</div>
  </section>`;
}
