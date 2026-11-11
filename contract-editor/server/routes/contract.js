// /api/c/:id/*：契約本身與成員。狀態、版本、個人資料、改名、共編連結與密碼、停用成員、匯入整份契約、交接（輪到哪一方）、圖片上傳。
// 條文的修訂與審閱交給 routes/clauses.js。

import { participant } from "../auth.js";
import { currentInvite, rotateInvite } from "../invites.js";
import { HANDOFF, HttpError, IMAGE_TYPES, MAX_HTML, MAX_IMAGE, MAX_TITLE, body, json, now, str, uid } from "../http.js";
import { clauseOut, loadContract, partOut, revOut, sides, touch } from "../model.js";
import { clauseRoutes } from "./clauses.js";

export async function contractRoutes(request, env, seg) {
  const cid = seg[1], m = request.method, action = seg.slice(2).join("/");
  const me = await participant(request, env, cid);
  const contract = await loadContract(env, cid);
  const team = await sides(env, cid);
  const mySide = team.side(me);
  const sameSide = team.list.filter((p) => team.side(p) === mySide).map((p) => p.id);
  const otherSide = team.list.filter((p) => team.side(p) !== mySide).map((p) => p.id);
  const owner = me.role === "owner";
  const needOwner = () => { if (!owner) throw new HttpError(403, "forbidden", "僅契約建立者可執行此操作"); };

  if (m === "GET" && action === "version") return json({ version: contract.version });
  // 共編連結與進入密碼：可查看本方的；建立契約的一方另可查看他方的（用來邀請他方加入）
  const ownerSide = team.side(team.list.find((p) => p.role === "owner") || me);
  const inviteSides = mySide === ownerSide ? [mySide, mySide === "A" ? "B" : "A"] : [mySide];
  if (m === "GET" && action === "invites") {
    return json({ invites: await Promise.all(inviteSides.map((side) => currentInvite(env, cid, side))) });
  }
  if (m === "GET" && action === "state") {
    const ps = team.list;
    const [{ results: cs }, { results: rs }] = await Promise.all([
      env.DB.prepare("SELECT * FROM clauses WHERE contract_id = ? ORDER BY ord").bind(cid).all(),
      env.DB.prepare("SELECT * FROM revisions WHERE contract_id = ? ORDER BY at DESC").bind(cid).all()
    ]);
    return json({
      me: partOut(me, team.ownerSide),
      contract: { id: cid, title: contract.title, caseNo: contract.case_no || "", source: contract.source, version: contract.version, handoff: contract.handoff },
      participants: ps.map((p) => partOut(p, team.ownerSide)), clauses: cs.map(clauseOut), revisions: rs.map(revOut)
    });
  }
  if (m === "GET" && seg[2] === "images") throw new HttpError(404, "not_found", "");

  if (m !== "POST") throw new HttpError(405, "method", "不支援的方法");

  if (action === "images") {
    const type = (request.headers.get("content-type") || "").split(";")[0].trim();
    if (!IMAGE_TYPES.includes(type)) throw new HttpError(415, "bad_type", "只支援 PNG、JPG、GIF、WebP 圖片");
    if (!env.IMAGES) throw new HttpError(503, "not_configured", "網站尚未設定圖片儲存（R2）");
    const buf = await request.arrayBuffer();
    if (buf.byteLength > MAX_IMAGE) throw new HttpError(413, "too_large", "圖片超過 10MB");
    const key = `${cid}/${uid()}`;
    await env.IMAGES.put(key, buf, { httpMetadata: { contentType: type } });
    return json({ url: `/img/${key}` });
  }

  const b = await body(request);
  const c = { env, seg, cid, me, contract, mySide, sameSide, otherSide, action, b };

  if (action === "me") {
    const name = str(b.name ?? me.name ?? "", 60, "名字").trim();
    const title = str(b.title ?? me.title ?? "", 30, "角色").trim();
    await env.DB.batch([env.DB.prepare("UPDATE participants SET name = ?, title = ? WHERE id = ?").bind(name, title, me.id), touch(env, { ...contract, handoff: { status: "x" } }, me)]);
    return json({ ok: true });
  }
  if (action === "rename") {
    needOwner();
    const title = str(b.title ?? "", MAX_TITLE, "契約名稱").trim();
    if (!title) throw new HttpError(400, "bad_request", "請輸入契約名稱");
    const caseNo = str(b.caseNo ?? contract.case_no ?? "", 100, "案號").trim();
    await env.DB.prepare("UPDATE contracts SET title = ?, case_no = ?, version = version + 1 WHERE id = ?").bind(title, caseNo, cid).run();
    return json({ ok: true });
  }
  if (action === "seen") {
    await env.DB.prepare("UPDATE participants SET last_seen = ? WHERE id = ?").bind(now(), me.id).run();
    return json({ ok: true });
  }
  if (seg[2] === "invites" && seg[4] === "rotate") {
    if (!inviteSides.includes(seg[3])) throw new HttpError(403, "forbidden", "無法重新產生這一方的連結");
    return json({ invite: await rotateInvite(env, cid, seg[3]) });
  }
  if (seg[2] === "participants" && seg[4] === "remove") {
    const target = team.list.find((p) => p.id === seg[3]);
    if (!target) throw new HttpError(404, "not_found", "查無此成員");
    if (!owner && team.side(target) !== mySide) throw new HttpError(403, "forbidden", "僅能停用本方成員的連結");
    if (seg[3] === me.id || target.role === "owner") throw new HttpError(400, "bad_request", "無法停用此連結");
    // keep the row so revision history still shows the person; only the key stops working
    await env.DB.batch([env.DB.prepare("UPDATE participants SET revoked = 1, key_hash = ? WHERE id = ? AND contract_id = ?").bind("revoked:" + uid(), seg[3], cid), touch(env, { ...contract, handoff: { status: "x" } }, me)]);
    return json({ ok: true });
  }
  if (action === "import") {
    needOwner();
    const title = str(b.title || contract.title, MAX_TITLE, "契約名稱").trim() || contract.title;
    const source = str(b.source || "", 255, "檔名");
    if (!Array.isArray(b.clauses) || !b.clauses.length || b.clauses.length > 2000) throw new HttpError(400, "bad_request", "沒有可匯入的條文");
    const t = now();
    const stmts = [
      env.DB.prepare("DELETE FROM revisions WHERE contract_id = ?").bind(cid),
      env.DB.prepare("DELETE FROM clauses WHERE contract_id = ?").bind(cid)
    ];
    b.clauses.forEach((c, i) => stmts.push(
      env.DB.prepare("INSERT INTO clauses (id, contract_id, ord, title, html, removed, rev, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)")
        .bind(uid(), cid, i, str(c.title || "條款", MAX_TITLE, "條款標題"), str(c.html || "", MAX_HTML, "條款內容"), me.id, t)
    ));
    stmts.push(env.DB.prepare("UPDATE contracts SET title = ?, source = ?, version = version + 1, handoff = ? WHERE id = ?")
      .bind(title, source, JSON.stringify({ status: "editing", round: 1, by: me.id, at: t, note: "imported" }), cid));
    await env.DB.batch(stmts);
    return json({ ok: true, count: b.clauses.length });
  }
  if (action === "handoff") {
    if (!HANDOFF.includes(b.status)) throw new HttpError(400, "bad_request", "狀態不正確");
    const round = Number.isInteger(b.round) && b.round > 0 && b.round < 10000 ? b.round : contract.handoff.round || 1;
    await env.DB.prepare("UPDATE contracts SET version = version + 1, handoff = ? WHERE id = ?").bind(JSON.stringify({ status: b.status, round, by: me.id, at: now() }), cid).run();
    return json({ ok: true });
  }
  return clauseRoutes(c);
}
