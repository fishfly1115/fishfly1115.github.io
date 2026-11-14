// 端對端測試：逐一操作每個畫面的按鈕，確認沒有壞掉的功能（補 contract-flow.mjs 未涵蓋的操作）。
//
//   首頁：新增（/new 與上一頁）、改名、刪除、統計卡篩選
//   契約：套用範本、修訂、撤回、調整順序、目錄跳轉、修訂紀錄篩選、成員連結、編輯個人資料、
//         改名、送審、全部接受、送回、定稿、匯出視窗、更多選單與子頁返回、瀏覽器上一頁
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { PASSWORD, chromium, joinWith, nav, newPage, readShare, setName, startServer, step } from "./helpers.mjs";

const work = mkdtempSync(join(tmpdir(), "contract-e2e-pages-"));

async function main() {
  const server = await startServer(work, 8798);
  const browser = await chromium.launch();
  try {
    const B = server.base;
    const o = await newPage(browser, { width: 1440 });
    await o.goto(B + "/");
    await o.fill("#pw", PASSWORD);
    await o.click("[data-form=login] button");
    await o.waitForSelector("[data-act=new]");

    // 首頁
    for (const name of ["甲案", "乙案"]) {
      await o.click("[data-act=new]");
      await o.waitForURL(/\/new$/);
      await o.fill("#ntitle", name);
      await o.click("[data-form=create] button[type=submit]");
      await o.waitForURL(/\/c\//);
      await o.goto(B + "/");
      await o.waitForSelector(".ctable");
    }
    await o.click("[data-act=new]");
    await o.reload();
    await o.waitForSelector("[data-form=create]");
    assert.match(o.url(), /\/new$/);
    await o.goBack();
    await o.waitForSelector(".ctable");
    step("新增契約為獨立頁面（可重新整理），上一頁回到列表");
    await o.locator("[data-act=row-menu]").first().click();
    await o.click("[data-act=rename]");
    await o.fill("[id^=rn-]", "甲案（改）");
    await o.click("[data-form=rename] button[type=submit]");
    await o.waitForSelector("text=甲案（改）");
    await o.locator("[data-act=row-menu]").nth(1).click();
    await o.click("[data-act=del]");
    await o.click("[data-act=del-do]");
    await o.waitForFunction(() => document.querySelectorAll(".ctable tbody tr").length === 1);
    step("列表改名、刪除");
    await o.click(".stat[data-tone=final]");
    await o.waitForSelector("text=沒有符合條件");
    await o.click(".empty [data-act=clear-filter]");
    await o.waitForSelector(".ctable");
    step("統計卡篩選與清除");

    // 契約：空白契約 → 匯入範本
    await o.click(".ctable a.t");
    await o.waitForSelector(".hero");
    await setName(o, "陳承辦", "承辦人");
    await nav(o, "content", ".empty");
    await o.click(".empty [data-v=import]");
    await o.waitForSelector(".choice");
    await o.click("[data-act=tpl-open]");
    await o.waitForSelector("input[name=tpl]");
    await o.click("[data-act=tpl-preview]");
    await o.click("[data-act=import-go]");
    await o.waitForURL(/\/contract$/);
    await o.waitForSelector(".clause");
    step("空白契約到匯入頁套用範本，完成後回到契約內容");

    // 契約內容：修訂、撤回、順序、目錄
    const clause = o.locator("section.clause").nth(2);
    await clause.hover();
    await clause.locator("[data-act=edit]").click();
    await o.locator(".editable").first().click();
    await o.keyboard.type("（測試修訂）");
    await o.click("[data-act=save]");
    await o.waitForSelector("section.clause[data-state=mine]");
    await o.locator("section.clause[data-state=mine] [data-act=revert-open]").click();
    await o.click("[data-act=revert-do]");
    await o.waitForSelector("section.clause[data-state=mine]", { state: "detached" });
    step("修訂條文並撤回");
    await o.locator("section.clause").nth(3).hover();
    await o.locator("section.clause").nth(3).locator("[data-act=down]").click();
    await o.waitForTimeout(800);
    await o.locator("section.clause").nth(1).locator(".fx-box").first().click();
    await o.waitForTimeout(1500);
    await o.click("[data-act=goto] >> nth=5");
    step("調整順序、勾選、目錄跳轉");

    // 其他分頁
    await nav(o, "history", ".filters");
    await o.click("[data-act=history-filter][data-v=mine]");
    await o.waitForSelector(".entry");
    const first = await readShare(o, "他方");
    const card = o.locator(".invite-card");
    await card.locator("[data-act=rotate-open]").click();
    await card.locator("[data-act=rotate-do]").click();
    await o.waitForFunction((old) => !document.body.textContent.includes(old), first.link);
    const share = await readShare(o, "他方");
    assert.notEqual(share.link, first.link);
    await o.click("[data-act=name-edit]");
    await o.waitForSelector("#nameform");
    await o.click("[data-act=name-cancel]");
    step("修訂紀錄篩選、重新產生他方連結與密碼、編輯個人資料");

    // 總覽：改名、交接流程
    await nav(o, "overview", ".hero");
    await o.click("[data-act=rename-open]");
    await o.fill("#rtitle", "資助研究契約");
    await o.click("#renameform button[type=submit]");
    await o.waitForSelector("#ctitle:has-text('資助研究契約')");
    // 交給乙方：確認視窗顯示同一組連結與密碼
    await nav(o, "content", ".clause");
    // 工具列只有一個主要按鈕（交給乙方）與一個次要按鈕（匯出），其他在「更多」
    assert.equal(await o.locator("#toolbar .btn.primary").count(), 1);
    await o.click("#toolbar [data-act=handoff-review]");
    await o.waitForSelector(".dialog [data-share=pin]");
    assert.equal((await o.textContent(".dialog [data-share=pin]")).replace(/\s/g, ""), share.pin);
    await o.click("[data-act=handoff-confirm]");
    await o.waitForSelector("#toolbar [data-act=handoff-review]", { state: "detached" });
    await nav(o, "overview", ".hero");
    assert.match(await o.textContent(".hero h2"), /等待乙方審閱/);
    assert.match(await o.textContent(".fs-step[aria-current=step]"), /乙方審閱/);
    const v = await newPage(browser, { width: 1440 });
    await joinWith(v, share, "林經理", "主管");
    await v.click(".hero [data-v=review]");
    await v.waitForSelector(".rv-card");
    await v.click("[data-act=accept-all]");
    await v.click("[data-act=accept-all-do]");
    await v.click(".hero [data-act=handoff-reviewed]");
    await nav(v, "overview", ".hero");
    assert.match(await v.textContent(".hero h2"), /等待甲方確認/);
    await o.reload();
    await nav(o, "overview", ".hero");
    assert.match(await o.textContent(".hero h2"), /確認審閱結果/);
    await o.click("[data-act=final]");
    await o.waitForSelector("text=雙方已確認定稿");
    await o.click(".hero [data-act=export-open]");
    await o.waitForSelector(".dialog input[name=efmt]");
    await o.keyboard.press("Escape");
    await o.waitForSelector("#dialog", { state: "hidden" });
    step("總覽改名，交給乙方（視窗顯示連結與密碼）→ 乙方加入、全部接受 → 送回 → 定稿 → 匯出視窗");
    await nav(o, "history", ".filters");
    assert.equal(await o.getAttribute(".pagenav [data-v=content]", "aria-current"), "page", "子頁標示所屬的「契約內容」");
    await o.click(".back");
    await o.waitForSelector(".clause");
    await o.goBack();
    await o.waitForSelector(".filters");
    await o.goBack();
    await o.waitForSelector(".clause");
    step("修訂紀錄由「更多」進入、可返回契約內容；瀏覽器上一頁回到前一個分頁");

    console.log("\n全部通過");
  } finally {
    await browser.close();
    server.stop();
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
