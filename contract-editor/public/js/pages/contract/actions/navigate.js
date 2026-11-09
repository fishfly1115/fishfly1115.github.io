// 在條文間移動：定位到指定條文、依序跳到下一處待審閱（同步標示右側審閱卡片與底部審閱列）。
import { S } from "../context.js";
import { render } from "../render.js";
import { theirsClauses } from "../state.js";

export function locate(id, { flash = true } = {}) {
  S.focusPending = id; S.view = "contract"; S.outlineOpen = false;
  render();
  const el = document.getElementById("c-" + id);
  if (!el) return;
  el.scrollIntoView({ block: "start", behavior: "smooth" });
  document.querySelector(`[data-cid-card="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  if (flash) { el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1200); }
}

export function gotoNextPending() {
  const list = theirsClauses();
  if (!list.length) return;
  const i = list.findIndex((c) => c.id === S.focusPending);
  // 第一次：從目前畫面位置往下找；之後依序循環
  const next = i >= 0 ? list[(i + 1) % list.length]
    : list.find((c) => (document.getElementById("c-" + c.id)?.getBoundingClientRect().top ?? 0) > 140) || list[0];
  locate(next.id);
}
