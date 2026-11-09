// HTTP 共用：錯誤型別、JSON 回應、請求內容讀取與欄位長度檢查。

// 欄位上限（字元數／位元組）
export const MAX_HTML = 600_000;
export const MAX_TITLE = 200;
export const MAX_IMAGE = 10 * 1024 * 1024;
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
export const HANDOFF = ["editing", "review", "reviewed", "final"];

export class HttpError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
export const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
export const now = () => Date.now();
export const uid = () => crypto.randomUUID();
export const str = (v, max, field) => {
  if (typeof v !== "string") throw new HttpError(400, "bad_request", `${field} 必須是文字`);
  if (v.length > max) throw new HttpError(413, "too_large", `${field} 太長`);
  return v;
};
export async function body(request) {
  try { return await request.json(); } catch { throw new HttpError(400, "bad_request", "請求格式錯誤"); }
}
