// 編輯中條文的復原／重做：一段連續輸入算一步，格式操作各算一步，復原後再輸入會清掉重做。
import "../setup.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
globalThis.getSelection = () => window.getSelection();
const { createHistory } = await import("../../public/js/pages/contract/tabs/content/edit-history.js");

const setup = () => {
  document.body.innerHTML = `<h3 id="t">第一條</h3><div id="b" contenteditable="true"><p>原文</p></div>`;
  const title = document.getElementById("t"), body = document.getElementById("b");
  return { title, body, h: createHistory(title, body) };
};

test("一段連續輸入記成一步，復原一次就回到輸入前", () => {
  const { body, h } = setup();
  for (const t of ["原文一", "原文一二", "原文一二三"]) { body.innerHTML = `<p>${t}</p>`; h.typed(); }
  assert.equal(h.undo(), true);
  assert.equal(body.textContent, "原文");
  assert.equal(h.undo(), false, "已經是最初的內容");
});

test("重做回到復原前；復原後再修改，就不能重做", () => {
  const { title, body, h } = setup();
  body.innerHTML = "<p>改一</p>"; h.commit();
  title.textContent = "第一條　新標題"; h.commit();
  h.undo();
  assert.equal(title.textContent, "第一條");
  assert.equal(body.textContent, "改一");
  h.redo();
  assert.equal(title.textContent, "第一條　新標題");
  h.undo(); h.undo();
  assert.equal(body.textContent, "原文");
  body.innerHTML = "<p>另一個方向</p>"; h.commit();
  assert.equal(h.redo(), false);
});
