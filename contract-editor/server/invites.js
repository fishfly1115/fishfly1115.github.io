// 共編連結與進入密碼：每份契約每一方（甲方 A／乙方 B）一組。
// - 連結代碼與密碼需要能再次顯示給邀請方，因此以 ADMIN_PASSWORD 衍生的金鑰（AES-GCM）加密保存。
// - 比對時只用雜湊：連結代碼 → token_hash（查詢），密碼 → pin_hash（加上連結代碼為鹽）。
// - 密碼連續輸入錯誤 MAX_FAILS 次即鎖住，需由邀請方「重新產生」。

import { newKey, sha256 } from "./auth.js";
import { HttpError, now, uid } from "./http.js";

export const MAX_FAILS = 10;
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function aesKey(env) {
  if (!env.ADMIN_PASSWORD) throw new HttpError(503, "not_configured", "網站尚未設定 ADMIN_PASSWORD，無法產生共編連結");
  const raw = await crypto.subtle.digest("SHA-256", enc.encode("contract-editor/invite/" + env.ADMIN_PASSWORD));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function seal(env, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(env), enc.encode(JSON.stringify(data))));
  return b64(iv) + "." + b64(ct);
}
async function unseal(env, sealed) {
  const [iv, ct] = sealed.split(".");
  try { return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await aesKey(env), unb64(ct)))); }
  catch { return null; } // ADMIN_PASSWORD 已更換：舊的連結無法再顯示，需重新產生
}

// 6 位數字密碼（以拒絕取樣避免偏差）
function newPin() {
  const max = Math.floor(0xffffffff / 1e6) * 1e6;
  for (;;) { const [x] = crypto.getRandomValues(new Uint32Array(1)); if (x < max) return String(x % 1e6).padStart(6, "0"); }
}
const pinHash = (token, pin) => sha256(token + ":" + pin);

async function create(env, cid, side) {
  const token = newKey(), pin = newPin(), t = now();
  await env.DB.batch([
    env.DB.prepare("UPDATE invites SET revoked = 1 WHERE contract_id = ? AND side = ? AND revoked = 0").bind(cid, side),
    env.DB.prepare("INSERT INTO invites (id, contract_id, side, token_hash, pin_hash, secret, fails, created_at, revoked) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0)")
      .bind(uid(), cid, side, await sha256(token), await pinHash(token, pin), await seal(env, { token, pin }), t)
  ]);
  return { side, token, pin, createdAt: t, locked: false };
}

// 取得某一方目前有效的連結與密碼；沒有（或無法解密）就產生一組新的
export async function currentInvite(env, cid, side) {
  const row = await env.DB.prepare("SELECT * FROM invites WHERE contract_id = ? AND side = ? AND revoked = 0 ORDER BY created_at DESC LIMIT 1").bind(cid, side).first();
  const secret = row && await unseal(env, row.secret);
  if (!secret) return create(env, cid, side);
  return { side, token: secret.token, pin: secret.pin, createdAt: row.created_at, locked: row.fails >= MAX_FAILS };
}

// 重新產生：舊的連結與密碼立即失效
export const rotateInvite = (env, cid, side) => create(env, cid, side);

// 依連結代碼找到有效的邀請
export async function findInvite(env, token) {
  if (!token || token.length > 64) return null;
  return env.DB.prepare("SELECT * FROM invites WHERE token_hash = ? AND revoked = 0").bind(await sha256(token)).first();
}

// 檢查密碼；錯誤時累計次數
export async function checkPin(env, invite, token, pin) {
  if (invite.fails >= MAX_FAILS) throw new HttpError(423, "locked", "密碼錯誤次數過多，這組連結已鎖住。請向邀請方索取新的連結與密碼。");
  if (/^\d{6}$/.test(pin || "") && (await pinHash(token, pin)) === invite.pin_hash) return;
  await env.DB.prepare("UPDATE invites SET fails = fails + 1 WHERE id = ?").bind(invite.id).run();
  const left = MAX_FAILS - invite.fails - 1;
  throw new HttpError(403, "wrong_pin", left > 0 ? `進入密碼不正確，還可以再試 ${left} 次` : "密碼錯誤次數過多，這組連結已鎖住。請向邀請方索取新的連結與密碼。");
}
