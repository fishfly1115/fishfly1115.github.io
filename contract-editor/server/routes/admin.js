// /api/admin/*：首頁「契約案件」用，需管理密碼。列出、新增、編輯名稱與案號、刪除契約（含 R2 圖片）。

import { newKey, requireAdmin, sha256 } from "../auth.js";
import { HttpError, MAX_TITLE, body, json, now, str, uid } from "../http.js";
import { sideFromLabel } from "../model.js";

export async function adminRoutes(request, env, seg) {
  await requireAdmin(request, env);
  const m = request.method;
  if (seg[1] === "contracts" && seg.length === 2 && m === "GET") {
    const { results: cs } = await env.DB.prepare(
      `SELECT c.id, c.title, c.case_no, c.source, c.created_at, c.handoff,
        (SELECT COUNT(*) FROM clauses WHERE contract_id = c.id AND removed = 0) AS clause_count,
        (SELECT COUNT(*) FROM revisions WHERE contract_id = c.id AND status = 'pending') AS pending_count,
        (SELECT MAX(at) FROM revisions WHERE contract_id = c.id) AS last_rev,
        (SELECT MAX(updated_at) FROM clauses WHERE contract_id = c.id) AS last_clause
       FROM contracts c ORDER BY c.created_at DESC`).all();
    const { results: ps } = await env.DB.prepare("SELECT id, contract_id, role, label, name, side FROM participants").all();
    const { results: pend } = await env.DB.prepare("SELECT contract_id, by_id FROM revisions WHERE status = 'pending'").all();
    const sideOf = new Map(ps.map((p) => [p.id, p.side || (p.role === "owner" ? "A" : "B")]));
    // 以契約建立者（首頁使用者）的角度：哪一方該處理、有幾處修訂待本方審閱
    const ownerView = (cid, h) => {
      const owner = ps.find((p) => p.contract_id === cid && p.role === "owner");
      const mine = owner ? sideOf.get(owner.id) : "A";
      const pendingForMe = pend.filter((r) => r.contract_id === cid && sideOf.get(r.by_id) !== mine).length;
      const st = h.status || "editing", bySide = h.by ? sideOf.get(h.by) : null;
      // review：交出的一方等待他方審閱；reviewed：審閱方交回，原送審方確認
      const turn = st === "final" ? "none" : st === "editing" ? (pendingForMe ? "me" : "both") : bySide && bySide !== mine ? "me" : "other";
      return { ownerSide: mine, pendingForMe, turn };
    };
    return json({ contracts: cs.map((c) => {
      const handoff = JSON.parse(c.handoff);
      return {
        id: c.id, title: c.title, caseNo: c.case_no, source: c.source, createdAt: c.created_at, handoff,
        clauseCount: c.clause_count, pendingCount: c.pending_count, ...ownerView(c.id, handoff),
        updatedAt: Math.max(c.created_at, c.last_rev || 0, c.last_clause || 0, handoff.at || 0),
        participants: ps.filter((p) => p.contract_id === c.id).map((p) => ({ role: p.role, label: p.label, name: p.name, side: sideOf.get(p.id) }))
      };
    }) });
  }
  if (seg[1] === "contracts" && seg.length === 4 && seg[3] === "rename" && m === "POST") {
    const b = await body(request);
    const title = str(b.title ?? "", MAX_TITLE, "契約名稱").trim();
    if (!title) throw new HttpError(400, "bad_request", "請輸入契約名稱");
    const caseNo = str(b.caseNo ?? "", 100, "案號").trim();
    const r = await env.DB.prepare("UPDATE contracts SET title = ?, case_no = ?, version = version + 1 WHERE id = ?").bind(title, caseNo, seg[2]).run();
    if (!r.meta.changes) throw new HttpError(404, "not_found", "查無此契約");
    return json({ ok: true });
  }
  if (seg[1] === "contracts" && seg.length === 2 && m === "POST") {
    const b = await body(request);
    const title = str(b.title || "採購契約書", MAX_TITLE, "契約名稱").trim() || "採購契約書";
    const caseNo = str(b.caseNo ?? "", 100, "案號").trim();
    const ownerLabel = str(b.ownerLabel ?? "", 60, "本方身分").trim() || "機關（甲方）";
    const id = uid(), pid = uid(), key = newKey(), t = now();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO contracts (id, title, case_no, created_at, version, handoff) VALUES (?, ?, ?, ?, 1, ?)").bind(id, title, caseNo, t, JSON.stringify({ status: "editing", round: 1, by: null, at: t })),
      env.DB.prepare("INSERT INTO participants (id, contract_id, key_hash, role, label, side, created_at) VALUES (?, ?, ?, 'owner', ?, ?, ?)").bind(pid, id, await sha256(key), ownerLabel, sideFromLabel(ownerLabel) || "A", t)
    ]);
    return json({ id, key });
  }
  if (seg[1] === "contracts" && seg.length === 3 && m === "DELETE") {
    const cid = seg[2];
    await env.DB.batch(["revisions", "clauses", "participants", "invites"].map((t) => env.DB.prepare(`DELETE FROM ${t} WHERE contract_id = ?`).bind(cid))
      .concat(env.DB.prepare("DELETE FROM contracts WHERE id = ?").bind(cid)));
    if (env.IMAGES) {
      let cursor;
      do {
        const list = await env.IMAGES.list({ prefix: cid + "/", cursor });
        if (list.objects.length) await env.IMAGES.delete(list.objects.map((o) => o.key));
        cursor = list.truncated ? list.cursor : undefined;
      } while (cursor);
    }
    return json({ ok: true });
  }
  throw new HttpError(404, "not_found", "沒有這個功能");
}
