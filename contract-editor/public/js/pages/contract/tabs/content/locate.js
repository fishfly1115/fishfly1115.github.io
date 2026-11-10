// 契約內容頁：定位到指定條文（條文目錄點選時使用）。
import { S } from "../../context.js";
import { render } from "../../render.js";

export function locate(id, { flash = true } = {}) {
  S.focusPending = id; S.outlineOpen = false;
  render();
  const el = document.getElementById("c-" + id);
  if (!el) return;
  el.scrollIntoView({ block: "start", behavior: "smooth" });
  if (flash) { el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1200); }
}
