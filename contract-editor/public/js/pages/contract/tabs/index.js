/**
 * 契約頁的分頁登錄。每個分頁一個資料夾（tabs/<代號>/），index.js 匯出一個分頁定義：
 *
 * @typedef {object} Tab
 * @property {string} id                 分頁代號，與資料夾同名；網址見 router.js
 * @property {{icon: string, label: string, count?: () => number, tone?: string, show?: () => boolean}} nav
 *           導覽列：圖示（ui/icons.js）、名稱、數量徽章、是否顯示
 * @property {() => string} title         頁首標題
 * @property {() => string} lede          頁首下方一句說明
 * @property {() => string[]} [tasks]     「這一頁要做的事」：2～3 個步驟
 * @property {() => string} html          主要內容（HTML 字串）
 * @property {() => void} [after]         內容放進畫面後要做的事（綁定表單、側欄、工具列）
 * @property {() => void} [enter]         切換到此頁時執行（例如重新載入資料）
 * @property {boolean} [keepTyping]       使用者正在此頁輸入時，背景更新不重繪（避免清掉輸入）
 * @property {boolean} [renamable]        頁首是否顯示「編輯名稱與案號」
 * @property {Record<string, (el: HTMLElement, id: string|undefined, ev: Event) => void>} [actions]
 *           此頁按鈕的操作，以 data-act 名稱為鍵（全部分頁的名稱不可重複）
 * @property {() => void} [init]          啟動時執行一次（綁定此頁專用的全域事件）
 */
import content from "./content/index.js";
import exportTab from "./export/index.js";
import history from "./history/index.js";
import importTab from "./import/index.js";
import members from "./members/index.js";
import overview from "./overview/index.js";
import review from "./review/index.js";

/** 導覽列的順序即此順序 */
export const TABS = { overview, content, review, history, members, export: exportTab, import: importTab };
