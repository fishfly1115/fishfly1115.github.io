// 修訂摘要：把一條條文的待審閱修訂整理成「前文 · 原文 → 新文」清單。
import { changeList } from "../../../../core/diff.js";
import { esc } from "../../../../core/dom.js";
import { textOf } from "../../../../core/sanitize.js";
import { icon } from "../../../../ui/icons.js";
import { KIND, clauseHtmlOf, pendingOf, revHtml } from "../../state.js";

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
  return `<ul class="chg">${items.map((x) => `<li>${x.ctx ? `<span class="chg-ctx">${esc(x.ctx)}</span>` : ""}${x.from ? `<del>${esc(x.from)}</del><span class="arrow">${icon("arrowForward", { size: 14, label: "改為" })}</span>` : ""}<ins>${esc(x.to || "（刪除）")}</ins></li>`).join("")}${more ? `<li class="meta-s">另有 ${more} 處</li>` : ""}</ul>`;
}
