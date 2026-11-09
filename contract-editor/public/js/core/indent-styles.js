// Word 段落縮排以 data-i（半個字寬為單位）保存；這裡產生對應的 CSS。
// 手機上壓縮縮排，保留層級但讓深層條文仍有足夠寬度。

export function installIndentStyles() {
  const st = document.createElement("style");
  const rules = (f) => Array.from({ length: 60 }, (_, i) => `.rich [data-i="${i + 1}"]{padding-left:${f(i + 1)}em}`).join("");
  st.textContent = rules((n) => n * 0.5) + `@media (max-width:640px){${rules((n) => Math.min(n * 0.2, 3))}}`;
  document.head.appendChild(st);
}
