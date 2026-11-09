// 範本選擇元件（首頁新增契約與契約頁套用範本共用）。
import { esc } from "../core/dom.js";

export const tplPicker = (data, chosen) => `<div class="tplgrid" role="radiogroup" aria-label="範本">${data.templates.map((t) => `<label class="tpl"><input type="radio" name="tpl" value="${esc(t.id)}" ${chosen === t.id ? "checked" : ""}><span><strong>${esc(t.name)}</strong><span class="meta">${esc(t.description)}${t.clauses.length ? `（${t.clauses.length} 段）` : ""}</span></span></label>`).join("")}</div>`;
