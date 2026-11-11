// /api/join/:token：他方或同仁以「共編連結＋進入密碼」加入契約（不需登入）。
//   GET  → 契約名稱與將加入的一方（顯示加入頁）
//   POST { pin, name, title } → 密碼正確則建立成員，回傳專屬金鑰

import { newKey, sha256 } from "../auth.js";
import { HttpError, body, json, now, str, uid } from "../http.js";
import { checkPin, findInvite, MAX_FAILS } from "../invites.js";
import { loadContract, touch } from "../model.js";

const SIDE_LABEL = { A: "機關（甲方）", B: "廠商（乙方）" };

export async function joinRoutes(request, env, seg) {
  const token = seg[1] || "";
  const invite = await findInvite(env, token);
  if (!invite) throw new HttpError(404, "not_found", "這個共編連結無效或已重新產生，請向邀請方索取新的連結與密碼");
  const contract = await loadContract(env, invite.contract_id);
  if (request.method === "GET") {
    return json({ title: contract.title, caseNo: contract.case_no || "", side: invite.side, locked: invite.fails >= MAX_FAILS });
  }
  if (request.method !== "POST") throw new HttpError(405, "method", "不支援的方法");
  const b = await body(request);
  await checkPin(env, invite, token, String(b.pin || "").replace(/\s/g, ""));
  const name = str(b.name ?? "", 60, "姓名").trim();
  if (!name) throw new HttpError(400, "bad_request", "請填寫您的姓名");
  const title = str(b.title ?? "", 30, "角色").trim();
  // 單位沿用同一方既有成員的寫法（例如「廠商（乙方）○○股份有限公司」）
  const peer = await env.DB.prepare("SELECT label FROM participants WHERE contract_id = ? AND side = ? AND revoked = 0 ORDER BY created_at LIMIT 1").bind(contract.id, invite.side).first();
  const key = newKey(), me = { id: uid() };
  await env.DB.batch([
    env.DB.prepare("INSERT INTO participants (id, contract_id, key_hash, role, label, name, title, side, created_at) VALUES (?, ?, ?, 'party', ?, ?, ?, ?, ?)")
      .bind(me.id, contract.id, await sha256(key), peer?.label || SIDE_LABEL[invite.side], name, title, invite.side, now()),
    touch(env, { ...contract, handoff: { status: "x" } }, me)
  ]);
  return json({ cid: contract.id, key });
}
