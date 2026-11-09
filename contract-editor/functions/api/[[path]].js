// 合約共同編輯器 API — Cloudflare Pages Functions + D1 (binding: DB) + R2 (binding: IMAGES)
// Every party opens the contract with their own secret link; the key in that link is the only credential.
// The site owner also holds ADMIN_PASSWORD (a Pages secret) to create contracts and open any of them.

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS contracts (id TEXT PRIMARY KEY, title TEXT NOT NULL, source TEXT, created_at INTEGER NOT NULL, version INTEGER NOT NULL DEFAULT 1, handoff TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS participants (id TEXT PRIMARY KEY, contract_id TEXT NOT NULL, key_hash TEXT NOT NULL UNIQUE, role TEXT NOT NULL, label TEXT, name TEXT, last_seen INTEGER, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS participants_contract ON participants(contract_id)`,
  `CREATE TABLE IF NOT EXISTS clauses (id TEXT PRIMARY KEY, contract_id TEXT NOT NULL, ord REAL NOT NULL, title TEXT NOT NULL, html TEXT NOT NULL, removed INTEGER NOT NULL DEFAULT 0, rev INTEGER NOT NULL DEFAULT 1, updated_by TEXT, updated_at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS clauses_contract ON clauses(contract_id)`,
  `CREATE TABLE IF NOT EXISTS revisions (id TEXT PRIMARY KEY, contract_id TEXT NOT NULL, clause_id TEXT NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL, by_id TEXT NOT NULL, at INTEGER NOT NULL, status TEXT NOT NULL, round INTEGER NOT NULL, reviewed_by TEXT, reviewed_at INTEGER, note TEXT)`,
  `CREATE INDEX IF NOT EXISTS revisions_contract ON revisions(contract_id, at)`
];
let ready = false;
async function init(db) {
  if (ready) return;
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  ready = true;
}

const MAX_HTML = 600_000, MAX_TITLE = 200, MAX_IMAGE = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const HANDOFF = ["editing", "review", "reviewed", "final"];

class HttpError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const now = () => Date.now();
const uid = () => crypto.randomUUID();
function newKey() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function sha256(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function sameSecret(a, b) {
  if (!a || !b) return false;
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0; for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}
const str = (v, max, field) => {
  if (typeof v !== "string") throw new HttpError(400, "bad_request", `${field} 必須是文字`);
  if (v.length > max) throw new HttpError(413, "too_large", `${field} 太長`);
  return v;
};
async function body(request) {
  try { return await request.json(); } catch { throw new HttpError(400, "bad_request", "請求格式錯誤"); }
}

/* ---------- auth ---------- */
async function isAdmin(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  return sameSecret(request.headers.get("x-admin-password"), env.ADMIN_PASSWORD);
}
async function requireAdmin(request, env) {
  if (!env.ADMIN_PASSWORD) throw new HttpError(503, "not_configured", "網站尚未設定 ADMIN_PASSWORD");
  if (!(await isAdmin(request, env))) throw new HttpError(401, "unauthorized", "管理密碼錯誤");
}
async function participant(request, env, cid) {
  const auth = request.headers.get("authorization") || "";
  const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (key) {
    const p = await env.DB.prepare("SELECT * FROM participants WHERE key_hash = ? AND contract_id = ?").bind(await sha256(key), cid).first();
    if (p) return p;
  }
  if (await isAdmin(request, env)) {
    const p = await env.DB.prepare("SELECT * FROM participants WHERE contract_id = ? AND role = 'owner' ORDER BY created_at LIMIT 1").bind(cid).first();
    if (p) return p;
  }
  throw new HttpError(401, "unauthorized", "這個連結無效或已被停用，請向合約擁有者索取新的連結");
}

/* ---------- shapes ---------- */
const clauseOut = (c) => ({ id: c.id, order: c.ord, title: c.title, html: c.html, removed: !!c.removed, rev: c.rev, updatedBy: c.updated_by, updatedAt: c.updated_at });
const revOut = (r) => ({ id: r.id, kind: r.kind, clauseId: r.clause_id, ...JSON.parse(r.data), fmt: "html", by: r.by_id, at: r.at, status: r.status, round: r.round, reviewedBy: r.reviewed_by, reviewedAt: r.reviewed_at, note: r.note });
const partOut = (p) => ({ id: p.id, role: p.role, label: p.label, name: p.name, lastSeen: p.last_seen });

async function loadContract(env, cid) {
  const c = await env.DB.prepare("SELECT * FROM contracts WHERE id = ?").bind(cid).first();
  if (!c) throw new HttpError(404, "not_found", "找不到這份合約");
  return { ...c, handoff: JSON.parse(c.handoff) };
}
async function loadClause(env, cid, clauseId) {
  const c = await env.DB.prepare("SELECT * FROM clauses WHERE id = ? AND contract_id = ?").bind(clauseId, cid).first();
  if (!c) throw new HttpError(404, "not_found", "找不到這個條款，可能已被刪除");
  return c;
}
async function pendingOf(env, cid, clauseId) {
  const { results } = await env.DB.prepare("SELECT * FROM revisions WHERE contract_id = ? AND clause_id = ? AND status = 'pending' ORDER BY at").bind(cid, clauseId).all();
  return results;
}
async function visibleClauses(env, cid) {
  const { results } = await env.DB.prepare(
    `SELECT c.* FROM clauses c WHERE c.contract_id = ? AND (c.removed = 0 OR EXISTS (SELECT 1 FROM revisions r WHERE r.clause_id = c.id AND r.status = 'pending' AND r.kind = 'delete')) ORDER BY c.ord`
  ).bind(cid).all();
  return results;
}

// Every change bumps the contract version (clients poll it) and reopens a finished round.
function touch(env, contract, me) {
  const h = contract.handoff;
  if (h.status === "final" || h.status === "reviewed") {
    const next = { status: "editing", round: (h.round || 1) + 1, by: me.id, at: now() };
    return env.DB.prepare("UPDATE contracts SET version = version + 1, handoff = ? WHERE id = ?").bind(JSON.stringify(next), contract.id);
  }
  return env.DB.prepare("UPDATE contracts SET version = version + 1 WHERE id = ?").bind(contract.id);
}
function addRev(env, contract, me, clauseId, kind, data) {
  return env.DB.prepare("INSERT INTO revisions (id, contract_id, clause_id, kind, data, by_id, at, status, round) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)")
    .bind(uid(), contract.id, clauseId, kind, JSON.stringify(data), me.id, now(), contract.handoff.round || 1);
}

/* ---------- routes ---------- */
async function adminRoutes(request, env, seg) {
  await requireAdmin(request, env);
  const m = request.method;
  if (seg[1] === "contracts" && seg.length === 2 && m === "GET") {
    const { results: cs } = await env.DB.prepare(
      `SELECT c.id, c.title, c.source, c.created_at, c.handoff,
        (SELECT COUNT(*) FROM clauses WHERE contract_id = c.id AND removed = 0) AS clause_count,
        (SELECT COUNT(*) FROM revisions WHERE contract_id = c.id AND status = 'pending') AS pending_count,
        (SELECT MAX(at) FROM revisions WHERE contract_id = c.id) AS last_rev,
        (SELECT MAX(updated_at) FROM clauses WHERE contract_id = c.id) AS last_clause
       FROM contracts c ORDER BY c.created_at DESC`).all();
    const { results: ps } = await env.DB.prepare("SELECT contract_id, role, label, name FROM participants").all();
    return json({ contracts: cs.map((c) => {
      const handoff = JSON.parse(c.handoff);
      return {
        id: c.id, title: c.title, source: c.source, createdAt: c.created_at, handoff,
        clauseCount: c.clause_count, pendingCount: c.pending_count,
        updatedAt: Math.max(c.created_at, c.last_rev || 0, c.last_clause || 0, handoff.at || 0),
        participants: ps.filter((p) => p.contract_id === c.id).map((p) => ({ role: p.role, label: p.label, name: p.name }))
      };
    }) });
  }
  if (seg[1] === "contracts" && seg.length === 4 && seg[3] === "rename" && m === "POST") {
    const b = await body(request);
    const title = str(b.title ?? "", MAX_TITLE, "合約名稱").trim();
    if (!title) throw new HttpError(400, "bad_request", "請輸入合約名稱");
    const r = await env.DB.prepare("UPDATE contracts SET title = ?, version = version + 1 WHERE id = ?").bind(title, seg[2]).run();
    if (!r.meta.changes) throw new HttpError(404, "not_found", "找不到這份合約");
    return json({ ok: true });
  }
  if (seg[1] === "contracts" && seg.length === 2 && m === "POST") {
    const b = await body(request);
    const title = str(b.title || "合作契約書", MAX_TITLE, "合約名稱").trim() || "合作契約書";
    const id = uid(), pid = uid(), key = newKey(), t = now();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO contracts (id, title, created_at, version, handoff) VALUES (?, ?, ?, 1, ?)").bind(id, title, t, JSON.stringify({ status: "editing", round: 1, by: null, at: t })),
      env.DB.prepare("INSERT INTO participants (id, contract_id, key_hash, role, label, created_at) VALUES (?, ?, ?, 'owner', '擁有者', ?)").bind(pid, id, await sha256(key), t)
    ]);
    return json({ id, key });
  }
  if (seg[1] === "contracts" && seg.length === 3 && m === "DELETE") {
    const cid = seg[2];
    await env.DB.batch(["revisions", "clauses", "participants"].map((t) => env.DB.prepare(`DELETE FROM ${t} WHERE contract_id = ?`).bind(cid))
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

async function contractRoutes(request, env, seg) {
  const cid = seg[1], m = request.method, action = seg.slice(2).join("/");
  const me = await participant(request, env, cid);
  const contract = await loadContract(env, cid);
  const owner = me.role === "owner";
  const needOwner = () => { if (!owner) throw new HttpError(403, "forbidden", "只有合約擁有者可以這樣做"); };

  if (m === "GET" && action === "version") return json({ version: contract.version });
  if (m === "GET" && action === "state") {
    const [{ results: ps }, { results: cs }, { results: rs }] = await Promise.all([
      env.DB.prepare("SELECT * FROM participants WHERE contract_id = ? ORDER BY created_at").bind(cid).all(),
      env.DB.prepare("SELECT * FROM clauses WHERE contract_id = ? ORDER BY ord").bind(cid).all(),
      env.DB.prepare("SELECT * FROM revisions WHERE contract_id = ? ORDER BY at DESC").bind(cid).all()
    ]);
    return json({
      me: { ...partOut(me) },
      contract: { id: cid, title: contract.title, source: contract.source, version: contract.version, handoff: contract.handoff },
      participants: ps.map(partOut), clauses: cs.map(clauseOut), revisions: rs.map(revOut)
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

  if (action === "me") {
    const name = str(b.name ?? "", 60, "名字").trim();
    await env.DB.batch([env.DB.prepare("UPDATE participants SET name = ? WHERE id = ?").bind(name, me.id), touch(env, { ...contract, handoff: { status: "x" } }, me)]);
    return json({ ok: true });
  }
  if (action === "rename") {
    needOwner();
    const title = str(b.title ?? "", MAX_TITLE, "合約名稱").trim();
    if (!title) throw new HttpError(400, "bad_request", "請輸入合約名稱");
    await env.DB.prepare("UPDATE contracts SET title = ?, version = version + 1 WHERE id = ?").bind(title, cid).run();
    return json({ ok: true });
  }
  if (action === "seen") {
    await env.DB.prepare("UPDATE participants SET last_seen = ? WHERE id = ?").bind(now(), me.id).run();
    return json({ ok: true });
  }
  if (action === "invite") {
    needOwner();
    const label = str(b.label ?? "", 60, "身分說明").trim() || "對方";
    const key = newKey();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO participants (id, contract_id, key_hash, role, label, created_at) VALUES (?, ?, ?, 'party', ?, ?)").bind(uid(), cid, await sha256(key), label, now()),
      touch(env, { ...contract, handoff: { status: "x" } }, me)
    ]);
    return json({ key });
  }
  if (seg[2] === "participants" && seg[4] === "remove") {
    needOwner();
    if (seg[3] === me.id) throw new HttpError(400, "bad_request", "不能停用自己的連結");
    await env.DB.batch([env.DB.prepare("DELETE FROM participants WHERE id = ? AND contract_id = ? AND role <> 'owner'").bind(seg[3], cid), touch(env, { ...contract, handoff: { status: "x" } }, me)]);
    return json({ ok: true });
  }
  if (action === "import") {
    needOwner();
    const title = str(b.title || contract.title, MAX_TITLE, "合約名稱").trim() || contract.title;
    const source = str(b.source || "", 255, "檔名");
    if (!Array.isArray(b.clauses) || !b.clauses.length || b.clauses.length > 2000) throw new HttpError(400, "bad_request", "沒有可匯入的條款");
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
      if (b.baseRev !== c.rev) return json({ code: "conflict", message: "對方在你編輯時也改動了這一條", clause: clauseOut(c) }, 409);
      if (title === c.title && html === c.html) return json({ ok: true, unchanged: true });
      const res = await env.DB.batch([
        env.DB.prepare("UPDATE clauses SET title = ?, html = ?, rev = rev + 1, updated_by = ?, updated_at = ? WHERE id = ? AND rev = ?").bind(title, html, me.id, stamp, clauseId, c.rev),
        addRev(env, contract, me, clauseId, "edit", { clauseTitle: c.title, titleBefore: c.title, titleAfter: title, before: c.html, after: html }),
        touch(env, contract, me)
      ]);
      return json({ ok: true, changed: res[0].meta.changes });
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
        env.DB.prepare("UPDATE revisions SET status = 'accepted', reviewed_by = ?, reviewed_at = ? WHERE clause_id = ? AND contract_id = ? AND status = 'pending' AND by_id <> ?").bind(me.id, stamp, clauseId, cid, me.id),
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
        env.DB.prepare("UPDATE revisions SET status = CASE WHEN by_id = ? THEN 'withdrawn' ELSE 'reverted' END, reviewed_by = ?, reviewed_at = ?, note = ? WHERE clause_id = ? AND contract_id = ? AND status = 'pending'").bind(me.id, me.id, stamp, note, clauseId, cid),
        env.DB.prepare("UPDATE contracts SET version = version + 1 WHERE id = ?").bind(cid)
      ]);
      return json({ ok: true });
    }
  }
  throw new HttpError(404, "not_found", "沒有這個功能");
}

export async function onRequest({ request, env, params }) {
  try {
    if (!env.DB) throw new HttpError(503, "not_configured", "網站尚未設定資料庫（D1 綁定名稱需為 DB）");
    await init(env.DB);
    const seg = [].concat(params.path || []);
    if (seg[0] === "admin") return await adminRoutes(request, env, seg);
    if (seg[0] === "c" && seg[1]) return await contractRoutes(request, env, seg);
    throw new HttpError(404, "not_found", "沒有這個功能");
  } catch (e) {
    if (e instanceof HttpError) return json({ code: e.code, message: e.message }, e.status);
    console.error(e);
    return json({ code: "server_error", message: "伺服器發生錯誤，請稍後再試" }, 500);
  }
}
