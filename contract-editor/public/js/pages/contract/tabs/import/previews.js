// 匯入預覽：套用範本、匯入新契約、匯入修訂版的逐條比對。
import { diffHtml, diffText } from "../../../../core/diff.js";
import { esc } from "../../../../core/dom.js";
import { sanitize, squash, textOf } from "../../../../core/sanitize.js";
import { S } from "../../context.js";
import { clauseHtmlOf } from "../../state.js";
import { tplPicker } from "../../../../ui/template-picker.js";

export function tplPickHtml() {
  if (!S.tpls) return `<div class="sheet"><p class="empty">正在載入範本…</p></div>`;
  return `<div class="sheet"><div class="import-panel">
    <h2 style="margin:0;font-size:18px">套用範本</h2>
    ${S.tpls.notice ? `<p class="lead">${esc(S.tpls.notice)}</p>` : ""}
    ${tplPicker({ templates: S.tpls.templates.filter((t) => t.clauses.length) }, S.tpls.templates.find((t) => t.clauses.length)?.id)}
    <div class="actions"><button class="btn primary" data-act="tpl-preview">預覽範本</button><button class="btn" data-act="tpl-cancel">取消</button></div>
  </div></div>`;
}
export function importHtml() {
  const p = S.importPreview;
  const how = { template: `共 ${p.clauses.length} 段`, clause: `共 ${p.clauses.length} 條`, heading: `共 ${p.clauses.length} 段`, none: "未偵測到條文編號，整份會成為一個條文" }[p.split];
  const replacing = S.clauses.length ? `<div class="dangerline">將取代目前條文，並刪除 ${S.revs.length} 筆修訂紀錄</div>` : "";
  const imgNote = p.imgFail ? `<div class="warnline">${p.imgFail} 張圖片無法匯入</div>` : "";
  return `<div class="sheet"><div class="import-panel">
    <h2 style="margin:0;font-size:18px">${p.split === "template" ? `確認套用範本：${esc(p.source.replace(/^範本：/, ""))}` : `確認匯入：${esc(p.source)}`}</h2>
    <p class="lead">${how}</p>
    <div><label for="imp-title">契約名稱</label><input type="text" id="imp-title" maxlength="200" value="${esc(p.title)}"></div>
    <ol class="plist">${p.clauses.map((c) => `<li><span class="pt">${esc(c.title)}</span><span class="pp">${esc(textOf(c.html).slice(0, 80)) || "（無內文）"}</span></li>`).join("")}</ol>
    ${imgNote}${replacing}
    <div class="actions"><button class="btn primary" data-act="import-go" ${S.importing ? "disabled" : ""}>${S.importing ? "匯入中…" : "確認匯入"}</button><button class="btn" data-act="import-cancel">取消</button></div>
  </div></div>`;
}
export function reimportHtml() {
  const R = S.reimport, c = R.counts, total = c.edit + c.add + c.delete;
  const list = R.items.filter((i) => S.reimportAll || i.type !== "same");
  const item = (i) => {
    if (i.type === "same") return `<section class="clause cmp-same"><div class="clause-head"><h3>${esc(i.title)}</h3><span class="pill plain">未變更</span></div></section>`;
    if (i.type === "add") return `<section class="clause added"><div class="clause-head"><h3>${esc(i.title)}</h3><span class="pill ok">新增</span></div><div class="rich">${sanitize(i.html)}</div></section>`;
    if (i.type === "delete") return `<section class="clause deleted"><div class="clause-head"><h3>${esc(i.title)}</h3><span class="pill no">刪除</span></div><div class="rich">${clauseHtmlOf(i.clause)}</div></section>`;
    const tDiff = squash(i.clause.title) !== squash(i.title) ? diffText(i.clause.title, i.title) : esc(i.title);
    return `<section class="clause" data-state="mine"><div class="clause-head"><h3>${tDiff}</h3><span class="pill mine">修訂</span></div><div class="rich">${diffHtml(clauseHtmlOf(i.clause), sanitize(i.html))}</div></section>`;
  };
  return `<div class="sheet"><div class="import-panel">
    <div class="row"><h2 style="margin:0;font-size:18px">比對結果：${esc(R.source)}</h2></div>
    <div class="row stats"><span class="pill mine">修訂 ${c.edit} 條</span><span class="pill ok">新增 ${c.add} 條</span><span class="pill no">刪除 ${c.delete} 條</span><span class="pill plain">未變更 ${c.same} 條</span><div class="grow"></div>
      <label class="check"><input type="checkbox" data-act="reimport-all" ${S.reimportAll ? "checked" : ""}> 顯示未變更的條文</label></div>
    ${R.imgFail ? `<div class="warnline">${R.imgFail} 張圖片無法匯入</div>` : ""}
    ${total ? "" : `<p class="lead">沒有變更</p>`}
  </div>
  ${list.map(item).join("")}
  <div class="row" style="padding:20px 0"><div class="grow"></div><button class="btn" data-act="reimport-cancel">取消</button>${total ? `<button class="btn primary" data-act="reimport-go" ${S.busy ? "disabled" : ""}>${S.busy ? "送出中…" : `送出 ${total} 處修訂`}</button>` : ""}</div></div>`;
}
