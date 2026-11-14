// 修訂時的「預覽」：用與 PDF 匯出相同的 .print-page 版面（A4、內文寬 794px），
// 整張紙等比縮放到畫面寬度，所以字型、字級與每一行的換行位置都和匯出的 PDF 一致。
import { esc } from "../../../../core/dom.js";

// PDF：A4 寬 210mm、左右邊界各 20mm，內文 170mm 對應 794px
const BODY = 794, PAGE = Math.round((BODY * 210) / 170), SIDE = Math.round((BODY * 20) / 170), TOP = Math.round((BODY * 18) / 170);

export function printPreview(host, title, html) {
  host.innerHTML = `<div class="pp-fit"><div class="pp-scale"><div class="pp-paper" style="width:${PAGE}px;padding:${TOP}px ${SIDE}px ${SIDE}px">
      <div class="print-page"><div class="pb"><h3>${esc(title)}</h3><div class="rich">${html}</div></div></div></div></div></div>
    <div class="pp-foot"><p class="hint">A4 版面，換行位置與匯出的 PDF 相同</p><button type="button" class="btn sm ghost pp-zoom" aria-pressed="false">放大</button></div>`;
  // 手機上整張縮到螢幕寬度字會很小：放大後改為左右捲動，換行位置不變
  const zoom = host.querySelector(".pp-zoom");
  zoom.addEventListener("click", () => {
    const on = zoom.getAttribute("aria-pressed") !== "true";
    zoom.setAttribute("aria-pressed", String(on)); zoom.textContent = on ? "縮小" : "放大";
    fitPreview(host);
  });
  fitPreview(host);
  host.querySelectorAll("img").forEach((im) => { if (!im.complete) im.addEventListener("load", () => fitPreview(host), { once: true }); });
}

export function fitPreview(host) {
  const box = host.querySelector(".pp-fit"), scale = host.querySelector(".pp-scale"), paper = host.querySelector(".pp-paper");
  if (!box || !paper || !box.clientWidth) return;
  const fit = Math.min(1, box.clientWidth / PAGE);
  const zoomed = host.querySelector(".pp-zoom")?.getAttribute("aria-pressed") === "true";
  const k = zoomed ? Math.min(1, fit * 2.2) : fit;
  paper.style.transform = `scale(${k})`;
  scale.style.width = `${Math.floor(PAGE * k)}px`;
  scale.style.height = `${Math.ceil(paper.offsetHeight * k)}px`;
}
