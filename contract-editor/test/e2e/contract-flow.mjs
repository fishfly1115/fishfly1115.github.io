// 端對端測試：以真實瀏覽器（Playwright）走完一份契約從建立到匯出的完整流程。
//
//   npm run test:e2e                         自動啟動本機 wrangler（臨時資料庫）後執行
//   BASE_URL=http://127.0.0.1:8788 \
//   ADMIN_PASSWORD=dev-password npm run test:e2e   改連已在執行的伺服器
//
// 流程：機關以範本建立契約 → 勾選、填日期、填空格（合併為一筆修訂）→ 僅顯示已勾選 →
// 邀請廠商 → 廠商新增本方成員 → 廠商成員接受機關修訂 → 匯出 Word → 修改後匯回比對 →
// 機關看到待審閱修訂 → 匯出 PDF。
//
// 需要 Playwright 與 Chromium（`npm i -D playwright && npx playwright install chromium`）。
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import JSZip from "jszip";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = new URL("../../", import.meta.url).pathname;
const PORT = 8799;
const PASSWORD = process.env.ADMIN_PASSWORD || "e2e-password";
const work = mkdtempSync(join(tmpdir(), "contract-e2e-"));

// 前端由 jsDelivr 載入的函式庫，測試時改由 node_modules 提供，不需連外。
const CDN_LIBS = {
  "dompurify@3.0.6/dist/purify.min.js": "dompurify/dist/purify.min.js",
  "mammoth@1.6.0/mammoth.browser.min.js": "mammoth/mammoth.browser.min.js",
  "html2canvas@1.4.1/dist/html2canvas.min.js": "html2canvas/dist/html2canvas.min.js",
  "jspdf@2.5.1/dist/jspdf.umd.min.js": "jspdf/dist/jspdf.umd.min.js",
  "jszip@3.10.1/dist/jszip.min.js": "jszip/dist/jszip.min.js",
  "docx@8.5.0/build/index.umd.js": "docx/build/index.umd.js"
};

const step = (msg) => console.log("✓", msg);

async function startServer() {
  if (process.env.BASE_URL) return { base: process.env.BASE_URL.replace(/\/$/, ""), stop() {} };
  const proc = spawn("npx", ["wrangler", "pages", "dev", "public", "--port", String(PORT), "--persist-to", join(work, "state"),
    "--d1", "DB=e2e-db", "--r2", "IMAGES=e2e-img", "--binding", `ADMIN_PASSWORD=${PASSWORD}`], { cwd: ROOT, stdio: "ignore", env: { ...process.env, WRANGLER_SEND_METRICS: "false" } });
  const base = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(base + "/")).ok) return { base, stop: () => proc.kill() }; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  proc.kill();
  throw new Error("wrangler 未能在 60 秒內啟動");
}

async function newPage(browser, { admin, width = 1200 } = {}) {
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

async function setName(page, name, title) {
  await page.waitForSelector("#nameform");
  await page.fill("#myname", name);
  await page.fill("#mytitle", title);
  await page.click("#nameform button[type=submit]");
  await page.waitForSelector("[data-act=people]");
}

async function invite(page, side, label) {
  await page.click("[data-act=people]");
  await page.waitForSelector("#iside");
  if (side) await page.selectOption("#iside", side);
  if (label) await page.fill("#ilabel", label);
  await page.click("#inviteform button[type=submit]");
  await page.waitForSelector("#people .warnline + .linkbox");
  return (await page.textContent("#people .warnline + .linkbox")).trim();
}

async function download(page, file) {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 90000 }), page.click("[data-act=export-go]")]);
  await dl.saveAs(file);
  return statSync(file).size;
}

// 模擬廠商在 Word 裡修改：於兩段（非標題）內文末尾加字。
async function editDocx(src, dest) {
  const zip = await JSZip.loadAsync(readFileSync(src));
  let xml = await zip.file("word/document.xml").async("string");
  const paras = xml.split("</w:p>");
  const body = paras.map((p, i) => ({ p, i })).filter(({ p }) => !/Heading2|Title/.test(p) && /<w:t[^>]*>[^<]{12,}<\/w:t>/.test(p));
  for (const { i } of [body[3], body[Math.floor(body.length / 2)]]) {
    paras[i] = paras[i].replace(/(<w:t[^>]*>[^<]{12,})(<\/w:t>)(?![\s\S]*<w:t)/, "$1（乙方修訂）$2");
  }
  xml = paras.join("</w:p>");
  zip.file("word/document.xml", xml);
  writeFileSync(dest, await zip.generateAsync({ type: "nodebuffer" }));
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();
  try {
    const B = server.base;

    // 1. 機關登入首頁，以「資助研究計畫契約」範本建立契約
    const owner = await newPage(browser);
    await owner.goto(B + "/");
    await owner.fill("#pw", PASSWORD);
    await owner.click("[data-form=login] button");
    await owner.waitForSelector("[data-act=new]");
    await owner.click("[data-act=new]");
    await owner.check("input[name=tpl][value=research-funding]");
    await owner.fill("#ntitle", "資助研究計畫契約（測試）");
    await owner.fill("#ncase", "R-115-001");
    await owner.click("[data-form=create] button[type=submit]");
    await owner.waitForURL(/\/c\//);
    await owner.waitForSelector(".clause");
    await setName(owner, "陳承辦", "承辦人");
    assert.ok(await owner.locator(".fx-box").count() > 10, "範本應含可勾選的 □");
    step(`以範本建立契約（${await owner.locator(".clause").count()} 條）`);

    // 2. 直接填寫：兩個勾選、一個日期、一個空格，應合併為同一筆修訂
    const c1 = owner.locator("section.clause").nth(1);
    await c1.locator(".fx-box").nth(0).click();
    await owner.waitForTimeout(150);
    await c1.locator(".fx-box").nth(2).click();
    await owner.waitForTimeout(800);
    await c1.locator(".fx-date").first().click();
    await owner.fill("#pop-in", "2026-12-31");
    await owner.click("[data-pop=ok]");
    await owner.waitForTimeout(800);
    await c1.locator(".fx-blank").first().click();
    await owner.fill("#pop-in", "量子演算法");
    await owner.keyboard.press("Enter");
    await owner.waitForTimeout(1500);
    const text = await c1.locator(".rich").innerText();
    assert.match(text, /☑/);
    assert.match(text, /115年12月31日/);
    assert.match(text, /量子演算法/);
    const pending = await owner.evaluate(async () => {
      const r = await fetch(location.pathname.replace("/c/", "/api/c/") + "/state", { headers: { "x-admin-password": localStorage.getItem("ce:admin") } });
      return (await r.json()).revisions.filter((x) => x.status === "pending").length;
    });
    assert.equal(pending, 1, "連續填寫應合併為一筆修訂");
    step("勾選、日期、空格合併為一筆修訂");

    // 3. 僅顯示已勾選
    await owner.click("[data-act=only-checked][data-v='1']");
    assert.equal(await owner.locator("section.clause").nth(1).locator(".fx-box:not(.on)").count(), 0);
    await owner.click("[data-act=only-checked][data-v='0']");
    step("僅顯示已勾選");

    // 4. 邀請廠商；廠商新增本方法務
    const linkB = await invite(owner, "B", "廠商（乙方）○○生技股份有限公司");
    const vendor = await newPage(browser);
    await vendor.goto(linkB);
    await setName(vendor, "林經理", "主管");
    const linkB2 = await invite(vendor);
    const legal = await newPage(browser);
    await legal.goto(linkB2);
    await setName(legal, "黃律師", "法務");
    step("廠商加入並新增本方成員");

    // 5. 廠商法務接受機關的修訂（審閱以「方」為單位）
    await legal.waitForSelector("section.clause[data-state=theirs]");
    await legal.locator("section.clause[data-state=theirs] [data-act=accept]").first().click();
    await legal.waitForSelector("section.clause[data-state=theirs]", { state: "detached" });
    step("廠商接受機關修訂");

    // 6. 廠商匯出 Word → 修改 → 匯回比對
    await legal.click("[data-act=export-open]");
    await legal.check("input[name=efmt][value=docx]");
    const docxFile = join(work, "export.docx"), edited = join(work, "edited.docx");
    assert.ok(await download(legal, docxFile) > 5000);
    await editDocx(docxFile, edited);
    await legal.click("[data-act=menu]");
    await legal.setInputFiles("#rev-input", edited);
    await legal.waitForSelector(".stats");
    const stats = (await legal.locator(".stats .pill").allTextContents()).join(" ");
    const changed = Number(stats.match(/修訂 (\d+)/)[1]);
    assert.ok(changed >= 1 && /新增 0 條/.test(stats) && /刪除 0 條/.test(stats), "比對結果：" + stats);
    await legal.click("[data-act=reimport-go]");
    await legal.waitForSelector(".clause");
    step(`匯出 Word 修改後匯回（${stats}）`);

    // 7. 機關看到待審閱修訂，並匯出 PDF
    // 寬螢幕：審閱改在右側面板，每條一張卡片，列出改了什麼
    const owner2 = await newPage(browser, { admin: PASSWORD, width: 1440 });
    await owner2.goto(owner.url());
    await owner2.waitForSelector("section.clause[data-state=theirs]");
    assert.equal(await owner2.locator("section.clause[data-state=theirs]").count(), changed);
    assert.equal(await owner2.locator(".rcard").count(), changed);
    assert.match(await owner2.locator(".rcard .chg").first().innerText(), /乙方修訂/);
    assert.ok(await owner2.locator("section.clause .rv-acts").first().isHidden(), "有面板時條文內不重複顯示接受／退回");
    await owner2.click("[data-act=export-open]");
    const pdfFile = join(work, "export.pdf");
    assert.ok(await download(owner2, pdfFile) > 10000);
    assert.equal(readFileSync(pdfFile).subarray(0, 4).toString(), "%PDF");
    step("機關收到待審閱修訂並匯出 PDF");

    console.log("\n全部通過");
  } finally {
    await browser.close();
    server.stop();
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
