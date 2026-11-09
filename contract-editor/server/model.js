// 資料模型：資料表列轉成 API 回應格式、甲乙方判斷、常用查詢，以及每次修訂都要寫入的版本號與修訂紀錄。

import { HttpError, now, uid } from "./http.js";

export const clauseOut = (c) => ({ id: c.id, order: c.ord, title: c.title, html: c.html, removed: !!c.removed, rev: c.rev, updatedBy: c.updated_by, updatedAt: c.updated_at });
export const revOut = (r) => ({ id: r.id, kind: r.kind, clauseId: r.clause_id, ...JSON.parse(r.data), fmt: "html", by: r.by_id, at: r.at, status: r.status, round: r.round, reviewedBy: r.reviewed_by, reviewedAt: r.reviewed_at, note: r.note });
// Each person belongs to one side of the contract: A = 甲方, B = 乙方.
export const sideFromLabel = (label) => /乙方|廠商/.test(label || "") ? "B" : /甲方|機關/.test(label || "") ? "A" : null;
export function sideOf(p, ownerSide) {
  if (p.side === "A" || p.side === "B") return p.side;
  const s = sideFromLabel(p.label);
  if (p.role === "owner") return s || "A";
  return s || (ownerSide === "A" ? "B" : "A");
}
export const partOut = (p, ownerSide) => ({ id: p.id, role: p.role, label: p.label, name: p.name, title: p.title || "", side: sideOf(p, ownerSide), revoked: !!p.revoked, lastSeen: p.last_seen });
export async function sides(env, cid) {
  const { results } = await env.DB.prepare("SELECT * FROM participants WHERE contract_id = ? ORDER BY created_at").bind(cid).all();
  const owner = results.find((p) => p.role === "owner");
  const ownerSide = owner ? sideOf(owner, "A") : "A";
  return { list: results, ownerSide, side: (p) => sideOf(p, ownerSide) };
}

export async function loadContract(env, cid) {
  const c = await env.DB.prepare("SELECT * FROM contracts WHERE id = ?").bind(cid).first();
  if (!c) throw new HttpError(404, "not_found", "查無此契約");
  return { ...c, handoff: JSON.parse(c.handoff) };
}
export async function loadClause(env, cid, clauseId) {
  const c = await env.DB.prepare("SELECT * FROM clauses WHERE id = ? AND contract_id = ?").bind(clauseId, cid).first();
  if (!c) throw new HttpError(404, "not_found", "找不到這個條款，可能已被刪除");
  return c;
}
export async function pendingOf(env, cid, clauseId) {
  const { results } = await env.DB.prepare("SELECT * FROM revisions WHERE contract_id = ? AND clause_id = ? AND status = 'pending' ORDER BY at").bind(cid, clauseId).all();
  return results;
}
export async function visibleClauses(env, cid) {
  const { results } = await env.DB.prepare(
    `SELECT c.* FROM clauses c WHERE c.contract_id = ? AND (c.removed = 0 OR EXISTS (SELECT 1 FROM revisions r WHERE r.clause_id = c.id AND r.status = 'pending' AND r.kind = 'delete')) ORDER BY c.ord`
  ).bind(cid).all();
  return results;
}

// Every change bumps the contract version (clients poll it) and reopens a finished round.
export function touch(env, contract, me) {
  const h = contract.handoff;
  if (h.status === "final" || h.status === "reviewed") {
    const next = { status: "editing", round: (h.round || 1) + 1, by: me.id, at: now() };
    return env.DB.prepare("UPDATE contracts SET version = version + 1, handoff = ? WHERE id = ?").bind(JSON.stringify(next), contract.id);
  }
  return env.DB.prepare("UPDATE contracts SET version = version + 1 WHERE id = ?").bind(contract.id);
}
export function addRev(env, contract, me, clauseId, kind, data) {
  return env.DB.prepare("INSERT INTO revisions (id, contract_id, clause_id, kind, data, by_id, at, status, round) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)")
    .bind(uid(), contract.id, clauseId, kind, JSON.stringify(data), me.id, now(), contract.handoff.round || 1);
}
