// DOM 小工具：取元素、跳脫 HTML、提示訊息、複製、下載檔案。

export const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let toastT;
export function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 4200); }
export async function copy(text, done) {
  try { await navigator.clipboard.writeText(text); toast(done || "已複製"); }
  catch { toast("無法自動複製，請手動選取文字複製"); }
}
export function saveBlob(filename, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
