/**
 * 審閱面板（右側，寬螢幕）
 * 目的：把「接受／退回」集中在一處，契約內文保持乾淨
 * 主要任務：1. 看懂他方每一處改了什麼 2. 逐條接受或退回
 * 最重要資料：待您審閱的修訂卡片（每張列出「原文 → 新文」）
 * 分頁：待審閱／成員。窄螢幕不顯示，改用條文內按鈕與底部審閱列（mobile-bar.js）。
 */
import { changeList } from "../../../core/diff.js";
import { $, esc } from "../../../core/dom.js";
import { fmt } from "../../../core/format.js";
import { textOf } from "../../../core/sanitize.js";
import { S } from "../context.js";
import { KIND, SIDE, clauseHtmlOf, isWide, otherSide, pendingOf, revHtml, roundNo, sameSide, theirsClauses, visible, whoFull } from "../state.js";

const showPanel = () => isWide() && S.loaded.c && !S.noAccess && !S.importPreview && !S.reimport && !S.tplPick;

// 一條條文的待審閱修訂摘要
export function summaryOf(c) {
  const pend = pendingOf(c.id);
  const kinds = new Set(pend.map((r) => r.kind || "edit"));
  const last = pend[pend.length - 1];
  const edit = pend.find((r) => (r.kind || "edit") === "edit");
  let items = [], more = 0;
  if (kinds.has("add")) items = [{ ctx: "", from: "", to: "新增此條文" }];
  else if (kinds.has("delete")) items = [{ ctx: "", from: "此條文", to: "提議刪除" }];
  else if (edit) {
    if (edit.titleBefore && edit.titleBefore !== c.title) items.push({ ctx: "標題", from: edit.titleBefore, to: c.title });
    const r = changeList(textOf(revHtml(edit, "before")), textOf(clauseHtmlOf(c)));
    items.push(...r.items); more = r.more;
  }
  if (kinds.has("move")) items.push({ ctx: "", from: "", to: "調整條文位置" });
  return { pend, last, items, more, kind: kinds.has("add") ? "新增條文" : kinds.has("delete") ? "刪除條文" : [...kinds].map((k) => KIND[k]).join("、") };
}

export function changesHtml(items, more) {
  if (!items.length) return `<p class="meta-s">格式或空白調整</p>`;
  return `<ul class="chg">${items.map((x) => `<li>${x.ctx ? `<span class="chg-ctx">${esc(x.ctx)}</span>` : ""}${x.from ? `<del>${esc(x.from)}</del><span class="arrow" aria-label="改為">→</span>` : ""}<ins>${esc(x.to || "（刪除）")}</ins></li>`).join("")}${more ? `<li class="meta-s">另有 ${more} 處，見條文</li>` : ""}</ul>`;
}

function card(c) {
  const { last, items, more, kind } = summaryOf(c);
  const active = S.focusPending === c.id;
  const confirming = S.confirm?.id === c.id && S.confirm.kind === "revert";
  return `<article class="rcard${active ? " active" : ""}" data-cid-card="${c.id}">
    <div class="rc-head"><h3>${esc(c.title)}</h3><span class="pill mine">${esc(kind)}</span></div>
    <div class="meta-s">${esc(whoFull(last.by))} · ${fmt(last.at)}</div>
    ${changesHtml(items, more)}
    ${confirming ? `<div class="confirm"><label for="preason-${c.id}"><strong>退回此條修訂？</strong>條文恢復為修訂前內容，紀錄會保留</label>
        <input id="preason-${c.id}" class="inp" maxlength="500" placeholder="退回理由（他方可見，選填）">
        <div class="actions"><button class="btn" data-act="confirm-cancel">取消</button><button class="btn bad" data-act="revert-do" data-id="${c.id}">退回</button></div></div>`
      : `<div class="rc-acts"><button class="linkbtn" data-act="locate" data-id="${c.id}">在條文中定位</button><div class="grow"></div>
        <button class="btn bad" data-act="revert-open" data-id="${c.id}">退回</button><button class="btn good" data-act="accept" data-id="${c.id}">接受</button></div>`}
  </article>`;
}

function reviewTab() {
  const list = theirsClauses();
  const other = SIDE[otherSide()];
  const ours = visible().filter((c) => pendingOf(c.id).some((r) => sameSide(r.by)) && !list.includes(c));
  const oursHtml = ours.length ? `<section class="rp-ours"><h4>本方修訂 · 待${other}審閱 ${ours.length} 條</h4>
      <ul>${ours.map((c) => `<li><button class="linkbtn plain" data-act="locate" data-id="${c.id}">${esc(c.title)}</button><button class="btn sm ghost" data-act="revert-open" data-id="${c.id}">撤回</button></li>`).join("")}</ul></section>` : "";
  if (!list.length) {
    return `<div class="rp-body"><div class="rp-empty"><strong>目前沒有待您審閱的修訂</strong><span>${other}修訂條文後會出現在這裡</span></div>${oursHtml}</div>`;
  }
  const footer = S.acceptAll
    ? `<div class="rp-foot confirm-all"><span><strong>接受全部 ${list.length} 條修訂？</strong></span><div class="grow"></div><button class="btn" data-act="accept-all-cancel">取消</button><button class="btn good" data-act="accept-all-do">全部接受</button></div>`
    : `<div class="rp-foot"><span class="meta-s">尚有 ${list.length} 條待審閱</span><div class="grow"></div><button class="btn" data-act="accept-all">全部接受</button></div>`;
  return `<div class="rp-body"><p class="meta-s">${other}第 ${roundNo()} 輪修訂 · 依條文順序</p>${list.map(card).join("")}${oursHtml}</div>${footer}`;
}

export function renderPanel() {
  const el = $("rpanel"), on = showPanel();
  el.hidden = !on;
  $("layout").classList.toggle("with-panel", on);
  // 寬螢幕時成員面板放進右側「成員」分頁；第一次進入需填姓名時仍顯示在頁首
  const peopleInPanel = on && S.panelTab === "people" && !S.nameOpen;
  if (!on) { if ($("people").parentElement !== $("people-home")) $("people-home").appendChild($("people")); el.innerHTML = ""; return; }
  const n = theirsClauses().length, live = S.participants.filter((p) => !p.revoked).length;
  const tab = (id, label, count, tone) => `<button class="rp-tab" role="tab" data-act="panel-tab" data-v="${id}" aria-selected="${(S.panelTab || "review") === id}">${label}${count ? `<span class="count ${tone}">${count}</span>` : ""}</button>`;
  const keep = $("people");
  const tabsHtml = `${tab("review", "待審閱", n, "")}${tab("people", "成員", live, "plain")}`;
  // 背景更新時不要清掉正在輸入的內容（退回理由、邀請表單）
  const typing = el.contains(document.activeElement) && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
  if (typing || (peopleInPanel && $("rp-people")?.contains(keep))) { el.querySelector(".rp-tabs").innerHTML = tabsHtml; return; }
  el.innerHTML = `<div class="rp-tabs" role="tablist">${tabsHtml}</div>
    ${peopleInPanel ? `<div class="rp-body" id="rp-people"></div>` : reviewTab()}`;
  if (peopleInPanel) $("rp-people").appendChild(keep);
  else if (keep.parentElement !== $("people-home")) $("people-home").appendChild(keep);
}
