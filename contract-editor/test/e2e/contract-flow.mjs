// 端對端測試：以真實瀏覽器（Playwright）走完一份契約從建立到匯出的完整流程。
//
//   npm run test:e2e                         自動啟動本機 wrangler（臨時資料庫）後執行
//   BASE_URL=http://127.0.0.1:8788 \
//   ADMIN_PASSWORD=dev-password npm run test:e2e   改連已在執行的伺服器
//
// 流程：機關以範本建立契約 → 勾選、填日期、填空格（合併為一筆修訂）→ 僅顯示已勾選 →
// 邀請廠商 → 廠商新增本方成員 → 廠商成員接受機關修訂 → 匯出 Word（視窗）→ 修改後由「更多」匯回比對 →
// 機關看到待審閱修訂 → 匯出 PDF。
//
// 需要 Playwright 與 Chromium（`npm i -D playwright && npx playwright install chromium`）。
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { PASSWORD, chromium, joinWith, more, nav, newPage, openExport, readShare, setName, startServer, step } from "./helpers.mjs";

const work = mkdtempSync(join(tmpdir(), "contract-e2e-"));

async function download(page, file) {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 90000 }), page.click(".dialog [data-act=export-go]")]);
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
  const server = await startServer(work, 8799);
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
    const contractUrl = owner.url();
    await owner.waitForSelector(".hero");
    await setName(owner, "陳承辦", "承辦人");
    assert.match(await owner.textContent(".hero h2"), /修訂契約內容/);
    await nav(owner, "content", ".clause");
    assert.match(owner.url(), /\/contract$/);
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
      const r = await fetch("/api" + location.pathname.match(/\/c\/[0-9a-f-]{36}/)[0] + "/state", { headers: { "x-admin-password": localStorage.getItem("ce:admin") } });
      return (await r.json()).revisions.filter((x) => x.status === "pending").length;
    });
    assert.equal(pending, 1, "連續填寫應合併為一筆修訂");
    step("勾選、日期、空格合併為一筆修訂");

    // 3. 僅顯示已勾選
    await owner.click("[data-act=only-checked][data-v='1']");
    assert.equal(await owner.locator("section.clause").nth(1).locator(".fx-box:not(.on)").count(), 0);
    await owner.click("[data-act=only-checked][data-v='0']");
    step("僅顯示已勾選");

    // 4. 機關把乙方的共編連結＋進入密碼給廠商；廠商再邀請本方法務
    const shareB = await readShare(owner, "他方");
    assert.match(shareB.pin, /^\d{6}$/);
    const vendor = await newPage(browser);
    await vendor.goto(shareB.link);
    await vendor.fill("#jpin", "000000");
    await vendor.fill("#jname", "林經理");
    await vendor.click("#joinform button[type=submit]");
    await vendor.waitForSelector("#jerr:not([hidden])");
    assert.match(await vendor.textContent("#jerr"), /進入密碼不正確/);
    await joinWith(vendor, shareB, "林經理", "主管");
    const shareB2 = await readShare(vendor, "本方");
    assert.equal(await vendor.locator("[data-act=share-side]").count(), 0, "乙方看不到甲方的連結");
    const legal = await newPage(browser);
    await joinWith(legal, shareB2, "黃律師", "法務");
    step("廠商以連結＋密碼加入（密碼錯誤會被擋下），並邀請本方成員");

    // 5. 廠商法務接受機關的修訂（審閱以「方」為單位）
    await nav(legal, "review", ".rv-card");
    assert.match(await legal.textContent(".rv-count"), /第 1／1 處/);
    await legal.click("[data-act=review-accept]");
    await legal.waitForSelector(".rv-card", { state: "detached" });
    assert.match(await legal.textContent(".hero h2"), /沒有待您審閱/);
    step("廠商接受機關修訂");

    // 6. 廠商匯出 Word → 修改 → 匯回比對
    await openExport(legal, "docx");
    const docxFile = join(work, "export.docx"), edited = join(work, "edited.docx");
    assert.ok(await download(legal, docxFile) > 5000);
    await editDocx(docxFile, edited);
    // 在「更多」選單選「匯入修訂版 Word」→ 選檔後自動到匯入頁顯示比對結果
    const [chooser] = await Promise.all([legal.waitForEvent("filechooser"), more(legal, "[data-act=reimport-pick]")]);
    await chooser.setFiles(edited);
    await legal.waitForSelector(".stats");
    const stats = (await legal.locator(".stats .pill").allTextContents()).join(" ");
    const changed = Number(stats.match(/修訂 (\d+)/)[1]);
    assert.ok(changed >= 1 && /新增 0 條/.test(stats) && /刪除 0 條/.test(stats), "比對結果：" + stats);
    await legal.click("[data-act=reimport-go]");
    await legal.waitForSelector(".hero");
    step(`匯出 Word 修改後匯回（${stats}）`);

    // 7. 機關：總覽提示審閱 → 審閱頁一次一處 → 匯出 PDF
    const owner2 = await newPage(browser, { admin: PASSWORD, width: 1440 });
    await owner2.goto(contractUrl);
    await owner2.waitForSelector(".hero");
    assert.match(await owner2.textContent(".hero h2"), new RegExp(`審閱乙方的 ${changed} 處修訂`));
    await owner2.click(".hero [data-v=review]");
    await owner2.waitForSelector(".rv-card");
    assert.match(await owner2.textContent(".rv-count"), new RegExp(`第 1／${changed} 處`));
    assert.match(await owner2.locator(".chg").innerText(), /乙方修訂/);
    await owner2.click("[data-act=review-accept]");
    await owner2.waitForFunction((n) => document.querySelector(".rv-count")?.textContent.includes(`／${n} 處`), changed - 1);
    await nav(owner2, "content", "section.clause[data-state=theirs]");
    assert.equal(await owner2.locator("section.clause[data-state=theirs] [data-act=review-go]").count(), changed - 1);
    await openExport(owner2, "pdf");
    const pdfFile = join(work, "export.pdf");
    assert.ok(await download(owner2, pdfFile) > 10000);
    assert.equal(readFileSync(pdfFile).subarray(0, 4).toString(), "%PDF");
    step("機關在審閱頁逐處處理修訂並匯出 PDF");

    console.log("\n全部通過");
  } finally {
    await browser.close();
    server.stop();
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
