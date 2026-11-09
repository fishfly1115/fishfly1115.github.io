// 與 Pages Functions API（/api/...）溝通。錯誤一律轉成帶 status、code 的 Error。

async function request(url, { method = "GET", headers = {}, body } = {}) {
  let payload;
  if (body instanceof Blob) { payload = body; headers["content-type"] = body.type; }
  else if (body !== undefined) { payload = JSON.stringify(body); headers["content-type"] = "application/json"; }
  const res = await fetch(url, { method, headers, body: payload });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message || "連線失敗"), { status: res.status, code: data.code, data });
  return data;
}

// 契約頁：以專屬連結金鑰（或管理密碼）呼叫 /api/c/:id/...；有 body 時為 POST。
export function contractApi({ cid, key, admin }) {
  return (path, body) => {
    const headers = {};
    if (key) headers.authorization = "Bearer " + key;
    if (admin) headers["x-admin-password"] = admin;
    return request(`/api/c/${cid}/${path}`, { method: body === undefined ? "GET" : "POST", headers, body });
  };
}

// 首頁：以管理密碼呼叫 /api/admin/...
export function adminApi(password, path, method = "GET", body) {
  return request("/api/admin/" + path, { method, headers: { "x-admin-password": password }, body });
}
