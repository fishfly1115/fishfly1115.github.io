// 在畫面繪製前套用使用者選擇的深色／淺色主題，避免先閃一下另一種顏色。
// 未選擇時不設定 data-theme，跟隨裝置設定（tokens.css 的 prefers-color-scheme）。
(function () {
  try {
    var t = localStorage.getItem("ce:theme");
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  } catch (e) { /* 無法讀取 localStorage 時跟隨裝置設定 */ }
})();
