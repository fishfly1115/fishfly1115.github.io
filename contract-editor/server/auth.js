// 身分驗證：每位成員的專屬連結金鑰（資料庫只存 SHA-256 雜湊），以及網站管理密碼 ADMIN_PASSWORD。

import { HttpError } from "./http.js";

export function newKey() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function sha256(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
export async function sameSecret(a, b) {
  if (!a || !b) return false;
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0; for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}
export async function isAdmin(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  return sameSecret(request.headers.get("x-admin-password"), env.ADMIN_PASSWORD);
}
export async function requireAdmin(request, env) {
  if (!env.ADMIN_PASSWORD) throw new HttpError(503, "not_configured", "網站尚未設定 ADMIN_PASSWORD");
  if (!(await isAdmin(request, env))) throw new HttpError(401, "unauthorized", "管理密碼錯誤");
}
export async function participant(request, env, cid) {
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
  throw new HttpError(401, "unauthorized", "這個連結無效或已被停用，請向契約建立者索取新的連結");
}
