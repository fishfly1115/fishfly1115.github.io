/**
 * 條文目錄（左側欄）
 * 目的：長契約中快速定位條文，並一眼看出哪些條文待審閱
 * 主要任務：1. 跳到指定條文 2. 依序處理待審閱的條文
 * 最重要資料：各條文的審閱狀態（待您審閱／待他方審閱）
 * 窄螢幕時收合，由工具列的「目錄」按鈕開啟。
 */
import { $, esc } from "../../../core/dom.js";
import { S } from "../context.js";
import { SIDE, mySide, pendingOf, sameSide, visible } from "../state.js";

let currentId = null;
const showOutline = () => S.loaded.c && !S.noAccess && S.view === "contract" && !S.importPreview && !S.reimport && !S.tplPick && visible().length > 1;

function stateOf(c) {
  const pend = pendingOf(c.id);
  if (pend.some((r) => !sameSide(r.by))) return "theirs";
  if (pend.length) return "mine";
  return "";
}

export function renderOutline() {
  const el = $("outline"), on = showOutline();
  el.hidden = !on;
  $("layout").classList.toggle("with-outline", on);
  el.classList.toggle("open", on && S.outlineOpen);
  if (!on) { el.innerHTML = ""; return; }
  const vis = visible();
  const other = SIDE[mySide() === "A" ? "B" : "A"];
  const todo = vis.filter((c) => stateOf(c) === "theirs").length;
  const items = vis.map((c) => {
    const st = stateOf(c), del = pendingOf(c.id).some((r) => r.kind === "delete");
    const tag = st === "theirs" ? "待您審閱" : st === "mine" ? `待${other}審閱` : "";
    return `<li><a href="#c-${c.id}" data-act="goto" data-id="${c.id}" data-state="${st}"${c.id === currentId ? ` aria-current="true"` : ""} class="${del ? "gone" : ""}" title="${esc(c.title)}${tag ? `（${tag}）` : ""}">
      <span class="o-dot" aria-hidden="true"></span><span class="o-t">${esc(c.title)}</span>${tag ? `<span class="sr">${tag}</span>` : ""}</a></li>`;
  }).join("");
  el.innerHTML = `<div class="o-head"><span>條文目錄</span><span class="o-n">${vis.length} 條</span>
      <button class="btn icon ghost only-narrow" data-act="outline-toggle" aria-label="關閉目錄">✕</button></div>
    ${todo ? `<button class="o-todo" data-act="next-pending"><span class="o-dot" data-state="theirs" aria-hidden="true"></span>待您審閱 ${todo} 條<span class="o-go">下一處 ↓</span></button>` : ""}
    <ol class="o-list">${items}</ol>
    <div class="o-legend"><span><span class="o-dot" data-state="theirs"></span>待您審閱</span><span><span class="o-dot" data-state="mine"></span>待${other}審閱</span></div>`;
}

// 捲動時標示目前閱讀到的條文
let spy = null;
export function watchOutline() {
  spy?.disconnect();
  if ($("outline").hidden || !("IntersectionObserver" in window)) return;
  spy = new IntersectionObserver((entries) => {
    const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!hit) return;
    const id = currentId = hit.target.dataset.cid;
    document.querySelectorAll(".o-list a").forEach((a) => {
      const cur = a.dataset.id === id;
      if (cur) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
      if (cur) keepVisible(a);
    });
  }, { rootMargin: "-140px 0px -60% 0px" });
  document.querySelectorAll("section.clause[data-cid]").forEach((s) => spy.observe(s));
}

// 只捲動目錄本身，不影響頁面捲動
function keepVisible(a) {
  const box = $("outline"), top = a.offsetTop, h = box.clientHeight;
  if (top < box.scrollTop + 60) box.scrollTop = Math.max(0, top - 60);
  else if (top > box.scrollTop + h - 60) box.scrollTop = top - h + 60;
}
