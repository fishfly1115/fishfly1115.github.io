# 架構說明

合約共同編輯器分成三層：瀏覽器端（`public/`，原生 ES modules，不需打包）、伺服器端（`server/`，Cloudflare Pages Functions 執行），以及資料層（D1 資料庫、R2 圖片儲存）。`functions/` 只是 Cloudflare 規定的進入點，實作全部在 `server/`。

```
contract-editor/
├── public/                      靜態網站（部署為 Cloudflare Pages）
│   ├── index.html               唯一頁面；首頁與契約頁共用
│   ├── _headers / _redirects    CSP 等安全標頭、/c/* 導回 index.html
│   ├── css/
│   │   ├── tokens.css           色彩、字型等設計變數（含深色模式）
│   │   ├── base.css             版面、按鈕、表單、面板、選單等共用元件
│   │   ├── contract.css         契約頁：條文、修訂標示、編輯器、填寫欄位、比對
│   │   └── print.css            匯出 PDF 時的排版舞台
│   ├── data/templates.json      契約範本
│   ├── fonts/                   PDF 內嵌字型（Noto Sans TC）
│   └── js/
│       ├── main.js              進入點：依網址決定進首頁或契約頁
│       ├── core/                與業務無關的基礎工具（diff.js 另提供審閱卡片用的修訂摘要 changeList）
│       │   ├── dom.js           $、esc、toast、複製、下載
│       │   ├── format.js        日期時間格式、民國年
│       │   ├── storage.js       localStorage 包裝
│       │   ├── loader.js        依需要從 CDN 載入第三方函式庫
│       │   ├── sanitize.js      DOMPurify 設定與 HTML 正規化
│       │   ├── diff.js          文字逐字比對與修訂標示
│       │   └── indent-styles.js Word 縮排（data-i）對應的 CSS
│       ├── lib/                 契約領域邏輯（純函式，可在 Node 測試）
│       │   ├── fields.js        □ 勾選、日期、底線空格、【】、空白儲存格的辨識與填寫；「僅顯示已勾選」
│       │   ├── split.js         把匯入的 HTML 切成條文（第X條、附件、簽署欄）
│       │   ├── compare.js       匯回的修訂版與現行版逐條比對
│       │   └── templates.js     讀取範本
│       ├── api/client.js        呼叫後端 API（附上連結金鑰或管理密碼）
│       ├── word/                Word 匯入、匯出
│       │   ├── docx-prep.js     匯入前把 Word 自動編號、縮排轉成文字
│       │   ├── docx-import.js   .docx → HTML（mammoth），圖片上傳
│       │   └── docx-export.js   條文 → .docx（標楷體、標題 2、頁碼）
│       ├── pdf/pdf-export.js    條文 → PDF（畫面截圖＋可搜尋文字層、浮水印、頁碼）
│       ├── ui/
│       │   ├── icons.js         介面圖示（一律使用 MUI Material Icons 的 SVG 路徑）
│       │   ├── theme-toggle.js  右上角深色／淺色切換
│       │   └── template-picker.js 範本選擇元件
│       ├── theme-init.js        在畫面繪製前套用已選的主題（避免閃爍）
│       └── pages/
│           ├── home.js          首頁：登入、契約列表、新增／改名／刪除
│           └── contract/        契約頁
│               ├── index.js     啟動：讀連結金鑰、綁定事件、開始輪詢
│               ├── context.js   頁面共用狀態 S 與 api()
│               ├── state.js     由狀態推導的選擇器（目前輪到誰、待審閱、可見條文…）
│               ├── sync.js      取得最新狀態、輪詢、執行動作後更新
│               ├── render.js    依狀態重繪整頁
│               ├── events.js    事件委派：data-act 按鈕、表單、欄位點選
│               ├── views/       純畫面（回傳 HTML 字串）
│               │   ├── turnbar.js       頂端列（位置、成員）與流程進度列（四個步驟、輪到誰、下一步）
│               │   ├── review-panel.js  右側審閱面板：每條修訂一張卡片（改了什麼、接受／退回）、成員分頁
│               │   ├── mobile-bar.js    手機底部審閱列（第 i／n 處、接受／退回）
│               │   ├── outline.js       左側條文目錄（審閱狀態、跳到下一處待審閱）
│               │   ├── toolbar.js       工具列、匯出選單
│               │   ├── members.js       成員與連結
│               │   ├── news.js          他方新動態
│               │   ├── clauses.js       條文與修訂審閱
│               │   ├── editor.js        條文編輯器
│               │   ├── field-popover.js 日期／空格填寫小視窗
│               │   ├── log.js           修訂紀錄
│               │   └── importing.js     匯入預覽、匯回比對
│               └── actions/     使用者操作（呼叫 API、改狀態）
│                   ├── fields.js     直接填寫（連續填寫合併為一筆修訂）
│                   ├── navigate.js   定位條文、依序跳到下一處待審閱
│                   ├── editing.js    編輯、儲存、圖片上傳
│                   ├── importing.js  匯入 Word、匯回修訂版
│                   └── exporting.js  匯出 PDF／Word
├── server/                      後端（Cloudflare Workers 執行環境）
│   ├── router.js                /api/* 分派
│   ├── http.js                  JSON 回應、錯誤、輸入檢查、上限
│   ├── db.js                    資料表定義與自動建立／升級
│   ├── auth.js                  連結金鑰（只存雜湊）、管理密碼比對
│   ├── model.js                 讀取與輸出資料、甲乙方判定、修訂紀錄
│   └── routes/
│       ├── admin.js             契約列表、新增、改名、刪除（需管理密碼）
│       ├── contract.js          契約狀態、成員、邀請、匯入、交接、圖片上傳
│       ├── clauses.js           條文編輯、移動、刪除、接受、退回、整批匯回
│       └── images.js            /img/* 讀取 R2 圖片
├── functions/                   Cloudflare Pages Functions 進入點（各一行）
├── scripts/build-template.mjs   把 .docx 轉成範本
├── test/
│   ├── setup.mjs                以 jsdom 讓前端模組可在 Node 執行
│   ├── unit/                    node:test 單元測試
│   └── e2e/contract-flow.mjs    Playwright 完整流程測試
└── docs/ARCHITECTURE.md         本文件
```

## 前端分層

依賴方向只能由上往下：

```
pages/        頁面（組合下列各層）
  ├─ views/   只負責產生畫面，不呼叫 API
  └─ actions/ 處理使用者操作，呼叫 API 後交給 sync 更新
word/ pdf/ ui/ api/   功能模組
lib/          契約領域邏輯（不碰 DOM 以外的瀏覽器 API）
core/         基礎工具
```

- 契約頁採「單一狀態 → 整頁重繪」：`context.js` 的 `S` 是唯一狀態來源，`render()` 依 `S` 產生畫面；`views/` 都是回傳 HTML 字串的純函式。所有使用者輸入的內容在輸出前都經 `esc()` 或 `sanitize()` 處理。
- 版面：頂端列與流程進度列固定在上方；契約頁為「條文目錄｜契約內容｜審閱面板」三欄。寬度 < 1280px 時審閱按鈕回到條文內；< 960px 時目錄收成抽屜，並以底部審閱列操作。
- 事件統一在 `events.js` 以 `data-act` 委派，按鈕不各自綁定。
- 第三方函式庫（mammoth、JSZip、docx、html2canvas、jsPDF）體積大，由 `core/loader.js` 在第一次需要時才載入；版本固定，且受 CSP 限制只允許 jsDelivr。

## 資料模型（D1）

| 資料表 | 用途 | 主要欄位 |
| --- | --- | --- |
| `contracts` | 契約 | `title` 案名、`case_no` 案號、`version`（每次變更 +1，供輪詢）、`handoff`（目前輪到哪一方、第幾輪） |
| `participants` | 成員與連結 | `key_hash` 連結金鑰雜湊、`role`（owner 建立者／party 成員）、`side`（A 甲方／B 乙方）、`name` 姓名、`title` 角色、`revoked` 已停用 |
| `clauses` | 條文 | `ord` 排序、`title`、`html`、`removed`、`rev`（樂觀鎖，避免同時修改互相覆蓋） |
| `revisions` | 修訂紀錄 | `kind`（edit／add／move／delete）、`data`（修訂前後內容）、`by_id`、`status`（pending 待審閱／accepted 已接受／reverted 已退回／withdrawn 本方撤回）、`round` 輪次 |

## API

所有路徑以 `/api` 開頭。契約 API 以 `Authorization: Bearer <連結金鑰>` 識別成員；管理 API 以 `x-admin-password` 驗證。

| 方法 | 路徑 | 說明 |
| --- | --- | --- |
| GET | `/admin/contracts` | 契約列表 |
| POST | `/admin/contracts` | 新增契約（可帶範本條文） |
| POST | `/admin/contracts/:id/rename` | 修改案名、案號 |
| DELETE | `/admin/contracts/:id` | 刪除契約 |
| GET | `/c/:id/version` | 目前版本號（輪詢用，回應很小） |
| GET | `/c/:id/state` | 契約、條文、修訂、成員完整狀態 |
| POST | `/c/:id/me` | 設定本人姓名與角色 |
| POST | `/c/:id/rename` | 修改契約名稱 |
| POST | `/c/:id/seen` | 記錄已讀時間（他方新動態） |
| POST | `/c/:id/invite` | 產生成員連結（擁有者可邀他方，各方可邀本方） |
| POST | `/c/:id/participants/:pid/remove` | 停用連結 |
| POST | `/c/:id/import` | 匯入整份契約（Word） |
| POST | `/c/:id/handoff` | 送交他方審閱／完成審閱 |
| POST | `/c/:id/images` | 上傳圖片到 R2 |
| POST | `/c/:id/bulk` | 匯回修訂版：一次送出多筆修訂（以 `baseRev` 檢查衝突） |
| POST | `/c/:id/clauses/add` | 新增條文 |
| POST | `/c/:id/clauses/:cid/edit` | 修訂條文（`merge: true` 時與同一人 30 分鐘內的修訂合併） |
| POST | `/c/:id/clauses/:cid/move` | 調整順序 |
| POST | `/c/:id/clauses/:cid/delete` | 刪除條文 |
| POST | `/c/:id/clauses/:cid/accept` | 接受他方修訂 |
| POST | `/c/:id/clauses/:cid/revert` | 退回他方修訂（還原修訂前內容） |
| GET | `/img/:contractId/:uuid` | 讀取圖片 |

## 主要流程

**修訂與審閱**：任一方直接修改條文 → 後端寫入新內容並新增一筆 `pending` 修訂 → 他方畫面輪詢 `/version` 發現變更後重新取得 `/state` → 條文標示為「待您審閱」→ 他方任一成員接受（保留）或退回（還原修訂前內容）。審閱以「方」為單位，同一方的成員不能審閱本方的修訂。

**匯入 Word**：`docx-prep` 先把 Word 自動編號（一、（一）、1.）與縮排轉成文字與 `data-i` 標記 → mammoth 轉 HTML → `split.js` 依「第X條」、附件、簽署欄切分條文 → 預覽確認後送出。

**匯回修訂版**：匯出的 Word 修改後匯回 → 同上轉成條文 → `compare.js` 依條文標題與內容比對現行版本，列出修訂、新增、刪除、未變更 → 確認後以 `/bulk` 一次送出，成為待他方審閱的修訂。

**匯出 PDF**：條文排版到隱藏的 `#pdf-stage` → html2canvas 逐頁截圖 → jsPDF 組成 PDF，並以內嵌字型疊上透明文字層（可選取、可搜尋）；未定稿時加上「草案」浮水印。

## 用語

| 程式 | 介面用語 |
| --- | --- |
| side A／B | 甲方（機關）／乙方（廠商） |
| owner／party | 契約建立者（擁有者）／一般成員 |
| revision | 修訂 |
| accept／revert | 接受／退回 |
| handoff | 交接：目前由何方處理 |
| round | 第幾輪審閱 |
