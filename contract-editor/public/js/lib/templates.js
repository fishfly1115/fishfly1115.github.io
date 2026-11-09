// 契約範本：讀取 /data/templates.json。

let TEMPLATES = null;
export async function loadTemplates() {
  if (!TEMPLATES) { const r = await fetch("/data/templates.json"); if (!r.ok) throw new Error("範本載入失敗"); TEMPLATES = await r.json(); }
  return TEMPLATES;
}
