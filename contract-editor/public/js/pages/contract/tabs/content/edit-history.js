// 編輯中條文的復原／重做（工具列按鈕與 Ctrl+Z／Ctrl+Y）。
// 不用瀏覽器內建的復原：各瀏覽器行為不一（Chrome 常一次只復原一個字），這裡自己記錄：
// 連續輸入稍停後算一步；格式按鈕、表格、圖片等每次操作各算一步。只記標題與內文，復原後照常自動儲存。

const PAUSE = 600; // 停止輸入多久算一步（毫秒）
const LIMIT = 100; // 最多記幾步

/** @param {HTMLElement} title @param {HTMLElement} body */
export function createHistory(title, body) {
  const snap = () => ({ title: title.textContent, html: body.innerHTML, caret: caretOf(body) });
  const list = [snap()];
  let pos = 0, timer = 0;
  const apply = (s) => { title.textContent = s.title; body.innerHTML = s.html; body.focus(); placeCaret(body, s.caret); };
  const h = {
    /** 有輸入：稍停後記成一步 */
    typed() { clearTimeout(timer); timer = setTimeout(h.commit, PAUSE); },
    /** 立刻把目前內容記成一步（與上一步相同就不記） */
    commit() {
      clearTimeout(timer); timer = 0;
      const s = snap(), cur = list[pos];
      if (s.title === cur.title && s.html === cur.html) return;
      list.splice(pos + 1, Infinity, s);
      if (list.length > LIMIT) list.shift();
      pos = list.length - 1;
    },
    /** @returns {boolean} 是否有改變 */
    undo() { h.commit(); if (pos === 0) return false; apply(list[--pos]); return true; },
    redo() { h.commit(); if (pos >= list.length - 1) return false; apply(list[++pos]); return true; }
  };
  return h;
}

// 游標在內文中的位置（字數）；不在內文時為 null（放在最後）
function caretOf(root) {
  const sel = getSelection();
  if (!sel.rangeCount || !root.contains(sel.anchorNode)) return null;
  const r = document.createRange(); r.setStart(root, 0); r.setEnd(sel.anchorNode, sel.anchorOffset);
  return r.toString().length;
}

/** 把游標放在內文第 offset 個字的位置；null 放在最後 */
export function placeCaret(root, offset) {
  const sel = getSelection(), r = document.createRange();
  if (offset == null) { r.selectNodeContents(root); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); return; }
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let left = offset, n;
  while ((n = walk.nextNode())) {
    if (left <= n.length) { r.setStart(n, left); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); return; }
    left -= n.length;
  }
  placeCaret(root, null);
}
