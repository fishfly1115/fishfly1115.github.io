// 「複製通知內容」：依目前進度產生給他方的正式通知文字，複製後由使用者以電子郵件等方式送交。
import { copy } from "../../../core/dom.js";
import { caseNo, docTitle, roundNo, status } from "../state.js";

export function copyNotice() {
  const st = status(), n = roundNo(), name = docTitle();
  const ref = caseNo() ? `（案號：${caseNo()}）` : "";
  const msg = st === "review" ? `「${name}」${ref}契約草案第 ${n} 輪修訂已完成，敬請以專屬連結登入審閱，修訂處均已標示。`
    : st === "reviewed" ? `「${name}」${ref}契約草案第 ${n} 輪修訂已審閱完畢，敬請以專屬連結登入確認審閱結果。`
    : st === "final" ? `「${name}」${ref}契約內容業經雙方確認定稿，敬請以專屬連結登入檢視並下載定稿版本。`
    : `「${name}」${ref}契約草案已有更新，敬請以專屬連結登入檢視。`;
  copy(msg, "已複製通知內容");
}
