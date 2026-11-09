// 右上角深色／淺色切換。選擇存在此瀏覽器；未選擇時跟隨裝置設定。
import { $ } from "../core/dom.js";
import { store } from "../core/storage.js";
import { icon } from "./icons.js";

const media = window.matchMedia("(prefers-color-scheme: dark)");
const current = () => document.documentElement.getAttribute("data-theme") || (media.matches ? "dark" : "light");

function paint() {
  const dark = current() === "dark";
  const label = dark ? "切換為淺色" : "切換為深色";
  const b = $("themebtn");
  b.innerHTML = icon(dark ? "lightMode" : "darkMode");
  b.setAttribute("aria-label", label);
  b.title = label;
}

export function initThemeToggle() {
  paint();
  $("themebtn").addEventListener("click", () => {
    const next = current() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    store.set("ce:theme", next);
    paint();
  });
  media.addEventListener("change", paint);
}
