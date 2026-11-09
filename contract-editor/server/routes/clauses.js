// /api/c/:id/clauses/* 與 /bulk：條文的新增、修訂、移動、提議刪除、接受、退回，以及匯入修訂版 Word 的整批修訂。
// 每個改動都寫一筆修訂紀錄（revisions），由他方審閱；接受與退回以「方」（甲方／乙方）為單位。

import { HttpError, MAX_HTML, MAX_TITLE, json, now, str, uid } from "../http.js";
import { addRev, clauseOut, loadClause, pendingOf, touch, visibleClauses } from "../model.js";

export async function clauseRoutes(c) {
  const { env, seg, cid, me, contract, sameSide, otherSide, action, b } = c;
  if (action === "bulk") {
    // A whole revised Word file: one tracked revision per changed clause, all or nothing.
    if (!Array.isArray(b.changes) || !b.changes.length || b.changes.length > 500) throw new HttpError(400, "bad_request", "沒有需要送出的修訂");
    const { results: all } = await env.DB.prepare("SELECT * FROM clauses WHERE contract_id = ?").bind(cid).all();
    const byId = new Map(all.map((c) => [c.id, c]));
    const conflicts = [], stmts = [], stamp = now();
    for (const ch of b.changes) {
      if (ch.type === "edit" || ch.type === "delete") {
        const c = byId.get(ch.clauseId);
        if (!c) { conflicts.push({ clauseId: ch.clauseId, title: ch.title || "" }); continue; }
        if (ch.baseRev !== c.rev) { conflicts.push({ clauseId: c.id, title: c.title }); continue; }
        if (ch.type === "edit") {
          const title = str(ch.title || c.title, MAX_TITLE, "條款標題").trim() || c.title, html = str(ch.html ?? "", MAX_HTML, "條款內容");
          stmts.push(env.DB.prepare("UPDATE clauses SET title = ?, html = ?, rev = rev + 1, updated_by = ?, updated_at = ? WHERE id = ?").bind(title, html, me.id, stamp, c.id));
          stmts.push(addRev(env, contract, me, c.id, "edit", { clauseTitle: c.title, titleBefore: c.title, titleAfter: title, before: c.html, after: html, via: "word" }));
        } else if (!c.removed) {
          stmts.push(env.DB.prepare("UPDATE clauses SET removed = 1, rev = rev + 1, updated_by = ?, updated_at = ? WHERE id = ?").bind(me.id, stamp, c.id));
          stmts.push(addRev(env, contract, me, c.id, "delete", { clauseTitle: c.title, titleBefore: c.title, before: c.html, via: "word" }));
        }
      } else if (ch.type === "add") {
        const title = str(ch.title || "新條款", MAX_TITLE, "條款標題").trim() || "新條款", html = str(ch.html || "", MAX_HTML, "條款內容");
        const ord = Number.isFinite(ch.order) ? ch.order : all.length;
        const id = uid();
        stmts.push(env.DB.prepare("INSERT INTO clauses (id, contract_id, ord, title, html, removed, rev, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)").bind(id, cid, ord, title, html, me.id, stamp));
        stmts.push(addRev(env, contract, me, id, "add", { clauseTitle: title, titleAfter: title, after: html, via: "word" }));
      }
    }
    if (conflicts.length) return json({ code: "conflict", message: `他方已修訂其中 ${conflicts.length} 條，請重新匯出最新版本後再修訂`, conflicts }, 409);
    if (!stmts.length) return json({ ok: true, unchanged: true });
    stmts.push(touch(env, contract, me));
    await env.DB.batch(stmts);
    return json({ ok: true, count: b.changes.length });
  }
  if (action === "clauses/add") {
    const title = str(b.title || "新條款", MAX_TITLE, "條款標題").trim() || "新條款";
    const html = str(b.html || "", MAX_HTML, "條款內容");
    const vis = await visibleClauses(env, cid);
    const i = vis.findIndex((c) => c.id === b.afterId);
    const prev = vis[i], next = i >= 0 ? vis[i + 1] : vis[0];
    const ord = prev && next ? (prev.ord + next.ord) / 2 : prev ? prev.ord + 1 : next ? next.ord - 1 : 0;
    const id = uid();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO clauses (id, contract_id, ord, title, html, removed, rev, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)").bind(id, cid, ord, title, html, me.id, now()),
      addRev(env, contract, me, id, "add", { clauseTitle: title, titleAfter: title, after: html }),
      touch(env, contract, me)
    ]);
    return json({ ok: true, id });
  }

  if (seg[2] === "clauses" && seg.length === 5) {
    const clauseId = seg[3], op = seg[4];
    const c = await loadClause(env, cid, clauseId);
    const stamp = now();
    if (op === "edit") {
      const title = str(b.title || c.title, MAX_TITLE, "條款標題").trim() || c.title;
      const html = str(b.html ?? "", MAX_HTML, "條款內容");
      if (b.baseRev !== c.rev) return json({ code: "conflict", message: "他方於您編輯期間已修訂本條", clause: clauseOut(c) }, 409);
      if (title === c.title && html === c.html) return json({ ok: true, unchanged: true });
      // Several quick changes by the same person (ticking boxes, filling blanks) become one revision.
      const last = await env.DB.prepare("SELECT * FROM revisions WHERE contract_id = ? AND clause_id = ? ORDER BY at DESC LIMIT 1").bind(cid, clauseId).first();
      const merge = b.merge && last && last.status === "pending" && last.kind === "edit" && last.by_id === me.id && stamp - last.at < 30 * 60 * 1000;
      const revStmt = merge
        ? env.DB.prepare("UPDATE revisions SET data = ?, at = ? WHERE id = ?").bind(JSON.stringify({ ...JSON.parse(last.data), titleAfter: title, after: html }), stamp, last.id)
        : addRev(env, contract, me, clauseId, "edit", { clauseTitle: c.title, titleBefore: c.title, titleAfter: title, before: c.html, after: html });
      const res = await env.DB.batch([
        env.DB.prepare("UPDATE clauses SET title = ?, html = ?, rev = rev + 1, updated_by = ?, updated_at = ? WHERE id = ? AND rev = ?").bind(title, html, me.id, stamp, clauseId, c.rev),
        revStmt,
        touch(env, contract, me)
      ]);
      return json({ ok: true, changed: res[0].meta.changes, rev: c.rev + 1 });
    }
    if (op === "move") {
      const dir = b.dir === -1 ? -1 : 1;
      const vis = await visibleClauses(env, cid);
      const i = vis.findIndex((x) => x.id === clauseId), j = i + dir;
      if (i < 0 || j < 0 || j >= vis.length) return json({ ok: true, unchanged: true });
      const a = vis[j], bb = vis[j + dir];
      const ord = bb ? (a.ord + bb.ord) / 2 : a.ord + dir;
      await env.DB.batch([
        env.DB.prepare("UPDATE clauses SET ord = ?, rev = rev + 1, updated_by = ?, updated_at = ? WHERE id = ?").bind(ord, me.id, stamp, clauseId),
        addRev(env, contract, me, clauseId, "move", { clauseTitle: c.title, titleAfter: c.title, orderBefore: c.ord, orderAfter: ord }),
        touch(env, contract, me)
      ]);
      return json({ ok: true });
    }
    if (op === "delete") {
      if (c.removed) return json({ ok: true, unchanged: true });
      await env.DB.batch([
        env.DB.prepare("UPDATE clauses SET removed = 1, rev = rev + 1, updated_by = ?, updated_at = ? WHERE id = ?").bind(me.id, stamp, clauseId),
        addRev(env, contract, me, clauseId, "delete", { clauseTitle: c.title, titleBefore: c.title, before: c.html }),
        touch(env, contract, me)
      ]);
      return json({ ok: true });
    }
    if (op === "accept") {
      await env.DB.batch([
        env.DB.prepare("UPDATE revisions SET status = 'accepted', reviewed_by = ?, reviewed_at = ? WHERE clause_id = ? AND contract_id = ? AND status = 'pending' AND by_id IN (SELECT value FROM json_each(?))").bind(me.id, stamp, clauseId, cid, JSON.stringify(otherSide)),
        env.DB.prepare("UPDATE contracts SET version = version + 1 WHERE id = ?").bind(cid)
      ]);
      return json({ ok: true });
    }
    if (op === "revert") {
      const note = str(b.note ?? "", 500, "理由").trim();
      const pend = await pendingOf(env, cid, clauseId);
      if (!pend.length) return json({ ok: true, unchanged: true });
      // undo newest first, so each step lands on the state it was made from
      let st = { title: c.title, html: c.html, removed: c.removed, ord: c.ord };
      for (const r of [...pend].reverse()) {
        const d = JSON.parse(r.data);
        if (r.kind === "edit") { st.title = d.titleBefore; st.html = d.before; }
        else if (r.kind === "add") st.removed = 1;
        else if (r.kind === "delete") st.removed = 0;
        else if (r.kind === "move") st.ord = d.orderBefore;
      }
      await env.DB.batch([
        env.DB.prepare("UPDATE clauses SET title = ?, html = ?, removed = ?, ord = ?, rev = rev + 1, updated_by = ?, updated_at = ? WHERE id = ?").bind(st.title, st.html, st.removed, st.ord, me.id, stamp, clauseId),
        env.DB.prepare("UPDATE revisions SET status = CASE WHEN by_id IN (SELECT value FROM json_each(?)) THEN 'withdrawn' ELSE 'reverted' END, reviewed_by = ?, reviewed_at = ?, note = ? WHERE clause_id = ? AND contract_id = ? AND status = 'pending'").bind(JSON.stringify(sameSide), me.id, stamp, note, clauseId, cid),
        env.DB.prepare("UPDATE contracts SET version = version + 1 WHERE id = ?").bind(cid)
      ]);
      return json({ ok: true });
    }
  }
  throw new HttpError(404, "not_found", "沒有這個功能");
}
