// 匯入預覽：套用範本、匯入新契約、匯入修訂版的逐條比對。
import { diffHtml, diffText } from "../../../../core/diff.js";
import { esc } from "../../../../core/dom.js";
import { sanitize, squash, textOf } from "../../../../core/sanitize.js";
import { S } from "../../context.js";
import { clauseHtmlOf, docTitle } from "../../state.js";
import { tplPicker } from "../../../../ui/template-picker.js";

export function tplPickHtml() {
  if (!S.tpls) return `<div class="sheet"><p class="empty">正在載入範本…</p></div>`;
  return `<div class="sheet"><div class="import-panel">
    <h2 style="margin:0;font-size:18px">套用範本</h2>
    <p class="lead">選擇範本後會先顯示預覽，確認後才會寫入。${esc(S.tpls.notice)}</p>
    ${tplPicker({ templates: S.tpls.templates.filter((t) => t.clauses.length) }, S.tpls.templates.find((t) => t.clauses.length)?.id)}
    <div class="actions"><button class="btn primary" data-act="tpl-preview">預覽範本</button><button class="btn" data-act="tpl-cancel">取消</button></div>
  </div></div>`;
}
export function importHtml() {
  const p = S.importPreview;
  const how = { template: `套用「${esc((p.source || "").replace(/^範本：/, ""))}」範本，共 ${p.clauses.length} 段。範本中【　】為待填欄位，套用後請逐條填寫或修訂。`, clause: `依「第○條」切成 ${p.clauses.length} 個條文。`, heading: `依 Word 標題切成 ${p.clauses.length} 個段落。`, none: "沒有找到「第○條」或 Word 標題，整份會先成為一個條文；匯入後可以用「＋」新增條文，把內容分開。" }[p.split];
  const replacing = S.clauses.length ? `<div class="dangerline">匯入後會取代目前的「${esc(docTitle())}」：現有條文和 ${S.revs.length} 筆修訂紀錄會刪除，進度回到第 1 輪。需要的話請先匯出 PDF 保存。</div>` : "";
  const imgNote = p.imgFail ? `<div class="warnline">有 ${p.imgFail} 張圖片格式或大小無法匯入（例如 Word 的 EMF 向量圖），請匯入後用「修訂」→「圖片」重新加入。</div>` : "";
  return `<div class="sheet"><div class="import-panel">
    <h2 style="margin:0;font-size:18px">${p.split === "template" ? `確認套用範本：${esc(p.source.replace(/^範本：/, ""))}` : `確認匯入：${esc(p.source)}`}</h2>
    <p class="lead">${how}${p.split === "template" ? "" : " 粗體、斜體、底線、清單、表格與圖片會保留。"}</p>
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
    ${R.imgFail ? `<div class="warnline">${R.imgFail} 張圖片無法匯入（例如 EMF 向量圖），送出後可於條文中重新加入</div>` : ""}
    ${total ? `<p class="lead">送出後，每處變更都會成為一筆修訂，由他方逐條接受或退回。</p>` : `<p class="lead">與目前條文相同，沒有需要送出的修訂。</p>`}
  </div>
  ${list.map(item).join("")}
  <div class="row" style="padding:20px 0"><div class="grow"></div><button class="btn" data-act="reimport-cancel">取消</button>${total ? `<button class="btn primary" data-act="reimport-go" ${S.busy ? "disabled" : ""}>${S.busy ? "送出中…" : `送出 ${total} 處修訂`}</button>` : ""}</div></div>`;
}
