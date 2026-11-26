// 端對端測試：版面不溢出。在手機、平板直放與橫放、桌機寬度下，逐一打開各分頁、填寫小視窗、
// 選單與對話視窗，確認整頁沒有左右捲動，視窗與選單沒有超出畫面、內容沒有超出外框。
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { PASSWORD, chromium, nav, newPage, setName, startServer, step } from "./helpers.mjs";

const work = mkdtempSync(join(tmpdir(), "contract-e2e-layout-"));
const SIZES = [["手機", 390, 844], ["平板直放", 744, 1133], ["平板橫放", 1133, 744], ["桌機", 1440, 900]];

// 回傳溢出的描述；root 為要檢查的外框（選單、視窗），其內容不可超出外框（可左右滑動的格式按鈕列除外）
const overflow = (page, sel) => page.evaluate((sel) => {
  const out = [], vw = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > window.innerWidth + 1) out.push(`整頁左右溢出（${document.documentElement.scrollWidth} > ${window.innerWidth}）`);
  for (const root of sel ? document.querySelectorAll(sel) : []) {
    const R = root.getBoundingClientRect();
    if (R.right > vw + 1 || R.left < -1) out.push(`${sel} 超出畫面`);
    const el = [...root.querySelectorAll("*")].find((el) => {
      if (el.closest(".ribbon")) return false;
      const e = el.getBoundingClientRect();
      return e.width && (e.right > R.right + 1 || e.left < R.left - 1);
    });
    if (el) out.push(`${sel} 內的 ${el.tagName.toLowerCase()}.${el.className} 超出外框`);
  }
  return out;
}, sel);

async function main() {
  const server = await startServer(work, 8799);
  const browser = await chromium.launch();
  try {
    const p = await newPage(browser, { width: 1200 });
    await p.goto(server.base + "/");
    await p.fill("#pw", PASSWORD);
    await p.click("[data-form=login] button");
    await p.click("[data-act=new]");
    await p.fill("#ntitle", "版面檢查");
    await p.click("[data-form=create] button[type=submit]");
    await p.waitForURL(/\/c\//);
    await setName(p, "陳承辦", "承辦人");
    await nav(p, "content", ".empty");
    await p.click(".empty [data-v=import]");
    await p.click("[data-act=tpl-open]");
    await p.check("input[name=tpl][value=research-funding]"); // 有日期、空格與表格的範本
    await p.click("[data-act=tpl-preview]");
    await p.click("[data-act=import-go]");
    await p.waitForSelector(".clause");

    for (const [name, width, height] of SIZES) {
      await p.setViewportSize({ width, height });
      const problems = [];
      const check = async (what, sel) => (await overflow(p, sel)).forEach((x) => problems.push(`${what}：${x}`));
      const esc = async () => { await p.keyboard.press("Escape"); await p.waitForTimeout(200); };

      for (const v of ["overview", "review", "members"]) { await p.click(`.pagenav [data-v=${v}]`); await p.waitForTimeout(300); await check(v); }
      await p.click(".pagenav [data-v=content]");
      await p.waitForSelector(".clause");
      await p.waitForTimeout(500);
      await check("契約內容", "#toolbar");
      for (const kind of ["date", "blank"]) {
        const fx = p.locator(`.fx[data-kind=${kind}]`).first();
        await fx.scrollIntoViewIfNeeded();
        await fx.click();
        await p.waitForSelector("#pop");
        await check(`填寫小視窗（${kind}）`, "#pop");
        await esc();
      }
      await p.click("[data-act=more-toggle]");
      await check("更多選單", "#toolbar .menu");
      await esc();
      await p.locator(".clause .rich").nth(2).click();
      await p.waitForSelector(".ie-body");
      const table = p.locator('.ribbon [data-cmd="table-menu"]');
      await table.scrollIntoViewIfNeeded();
      await table.click();
      await p.waitForSelector(".ribbon .menu");
      await check("表格選單", ".ribbon .menu");
      await esc(); await esc();
      const exportBtn = p.locator("#toolbar [data-act=export-open]:visible");
      if (await exportBtn.count()) await exportBtn.click();
      else { await p.click("[data-act=more-toggle]"); await p.click(".menu [data-act=export-open]"); }
      await p.waitForSelector(".dialog");
      await check("匯出視窗", ".dialog");
      await p.click("[data-act=dialog-close] >> nth=0", { position: { x: 4, y: 4 } });
      await p.waitForSelector(".dialog", { state: "detached" });

      assert.deepEqual(problems, [], `${name}（${width}px）版面溢出`);
      step(`${name}（${width}×${height}）：各分頁、填寫小視窗、選單與匯出視窗都沒有溢出`);
    }
    console.log("\n全部通過");
  } finally {
    await browser.close();
    server.stop();
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
