// Serves images uploaded into contracts from R2 (binding: IMAGES).
// Keys are random UUIDs under the contract id, so a URL is only known to people who can read that contract.
const TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export async function onRequestGet({ env, params }) {
  const key = [].concat(params.path || []).join("/");
  if (!env.IMAGES || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}$/.test(key)) return new Response("Not found", { status: 404 });
  const obj = await env.IMAGES.get(key);
  if (!obj) return new Response("Not found", { status: 404 });
  const type = obj.httpMetadata?.contentType;
  return new Response(obj.body, {
    headers: {
      "content-type": TYPES.includes(type) ? type : "application/octet-stream",
      "cache-control": "private, max-age=31536000, immutable",
      "x-content-type-options": "nosniff"
    }
  });
}
