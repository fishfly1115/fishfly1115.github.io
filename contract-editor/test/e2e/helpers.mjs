// 端對端測試共用：啟動本機 wrangler（臨時資料庫）、開啟瀏覽器分頁、切換契約分頁、填寫姓名。
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
export const { chromium } = require("playwright");

export const ROOT = new URL("../../", import.meta.url).pathname;
export const PASSWORD = process.env.ADMIN_PASSWORD || "e2e-password";

// 前端由 jsDelivr 載入的函式庫，測試時改由 node_modules 提供，不需連外。
const CDN_LIBS = {
  "dompurify@3.0.6/dist/purify.min.js": "dompurify/dist/purify.min.js",
  "mammoth@1.6.0/mammoth.browser.min.js": "mammoth/mammoth.browser.min.js",
  "html2canvas@1.4.1/dist/html2canvas.min.js": "html2canvas/dist/html2canvas.min.js",
  "jspdf@2.5.1/dist/jspdf.umd.min.js": "jspdf/dist/jspdf.umd.min.js",
  "jszip@3.10.1/dist/jszip.min.js": "jszip/dist/jszip.min.js",
  "docx@8.5.0/build/index.umd.js": "docx/build/index.umd.js"
};

export const step = (msg) => console.log("✓", msg);

export async function startServer(work, port) {
  if (process.env.BASE_URL) return { base: process.env.BASE_URL.replace(/\/$/, ""), stop() {} };
  const proc = spawn("npx", ["wrangler", "pages", "dev", "public", "--port", String(port), "--persist-to", join(work, "state"),
    "--d1", "DB=e2e-db", "--r2", "IMAGES=e2e-img", "--binding", `ADMIN_PASSWORD=${PASSWORD}`], { cwd: ROOT, stdio: "ignore", detached: true, env: { ...process.env, WRANGLER_SEND_METRICS: "false" } });
  // 停止整個程序群組（npx → wrangler → workerd），避免殘留的伺服器佔住連接埠
  const stop = () => { try { process.kill(-proc.pid); } catch {} };
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(base + "/")).ok) return { base, stop }; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  stop();
  throw new Error("wrangler 未能在 60 秒內啟動");
}

export async function newPage(browser, { admin, width = 1200 } = {}) {
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width, height: 900 } });
  await ctx.route("https://cdn.jsdelivr.net/npm/**", (route) => {
    const key = Object.keys(CDN_LIBS).find((k) => route.request().url().endsWith(k));
    return key ? route.fulfill({ path: join(ROOT, "node_modules", CDN_LIBS[key]), contentType: "application/javascript" }) : route.abort();
  });
  await ctx.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ body: "", contentType: "text/css" }));
  if (admin) await ctx.addInitScript((pw) => localStorage.setItem("ce:admin", pw), admin);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => { throw new Error("頁面錯誤：" + e.message); });
  return page;
}

export async function setName(page, name, title) {
  await page.waitForSelector("#nameform");
  await page.fill("#myname", name);
  await page.fill("#mytitle", title);
  await page.click("#nameform button[type=submit]");
  await page.waitForSelector("#nameform", { state: "detached" });
}

// 切換契約頁的分頁（總覽、契約內容、審閱、成員）；修訂紀錄與匯入在「契約內容」的「更多」選單
export async function nav(page, view, ready) {
  if (view === "history" || view === "import") {
    await nav(page, "content");
    await more(page, `[data-v=${view}]`);
  } else await page.click(`.pagenav [data-v=${view}]`);
  if (ready) await page.waitForSelector(ready);
}

// 開啟「契約內容」工具列的「更多」選單並點選其中一項
export async function more(page, item) {
  await page.click("[data-act=more-toggle]");
  await page.click(`.menu ${item}`);
}

// 從「契約內容」頁開啟匯出視窗並選擇格式
export async function openExport(page, fmt) {
  await nav(page, "content", "[data-act=export-open]");
  await page.click("#toolbar [data-act=export-open]");
  await page.check(`.dialog input[name=efmt][value=${fmt}]`);
}

// 到「成員」頁讀取某一方的共編連結與進入密碼（which：「本方」或「他方」）
export async function readShare(page, which) {
  await nav(page, "members", ".invite-card [data-share=pin]");
  const showingMine = (await page.textContent(".invite-card h2")).includes("本方");
  if (showingMine !== (which === "本方")) {
    await page.click(".invite-card [data-act=share-side]");
    await page.waitForFunction((m) => document.querySelector(".invite-card h2")?.textContent.includes("本方") === m, which === "本方");
    await page.waitForSelector(".invite-card [data-share=pin]");
  }
  const card = page.locator(".invite-card");
  return {
    link: (await card.locator("[data-share=link]").textContent()).trim(),
    pin: (await card.locator("[data-share=pin]").textContent()).replace(/\s/g, "")
  };
}

// 以共編連結＋進入密碼加入契約，完成後停在契約總覽
export async function joinWith(page, { link, pin }, name, title) {
  await page.goto(link);
  await page.fill("#jpin", pin);
  await page.fill("#jname", name);
  await page.fill("#jtitle", title);
  await page.click("#joinform button[type=submit]");
  await page.waitForURL(/\/c\/[0-9a-f-]{36}$/);
  await page.waitForSelector(".hero");
}
