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
│       └── pages/               畫面；每個畫面一個資料夾，裡面放它自己的畫面與操作
│           ├── home/            首頁（/ 與 /new）
│           │   ├── index.js         選擇畫面、繪製、把按鈕與表單交給對應畫面
│           │   ├── state.js         首頁狀態 H、管理 API
│           │   ├── login.js         登入
│           │   ├── list.js          契約列表：統計卡篩選、搜尋、改名、刪除
│           │   └── new-contract.js  新增契約：選範本、填資料、建立
│           ├── join/index.js    加入契約（/j/<代碼>）：輸入進入密碼、姓名與角色
│           └── contract/        契約頁（/c/<id>/…）
│               ├── index.js         啟動：讀連結金鑰、綁定事件與網址、開始輪詢
│               ├── context.js       頁面狀態 S（依用途分組）與 api()
│               ├── state.js         由 S 推導的資料（輪到誰、待審閱條文、可見條文…）
│               ├── sync.js          與伺服器溝通：載入、輪詢、act／simple 送出操作、上傳圖片
│               ├── router.js        分頁代號 ↔ 網址；go() 換頁，瀏覽器上一頁可用
│               ├── render.js        繪製外框，再繪製目前分頁（見 tabs/index.js）
│               ├── events.js        事件委派：data-act → 各分頁與共用的操作
│               ├── shell/           各分頁共用的外框
│               │   ├── topbar.js        頂端列：品牌、成員頭像（分頁與進度在同一列）
│               │   ├── pagenav.js       分頁與進度：在頂端列同一列，四個分頁按鈕與四個步驟（每頁都有）
│               │   ├── progress.js      流程計算：四個步驟、輪到誰、下一步與主要按鈕
│               │   ├── page-header.js   頁首標題、子頁的「返回」、編輯契約名稱
│               │   ├── name-prompt.js   填寫或編輯姓名與角色
│               │   ├── invite-share.js  共編連結與進入密碼：顯示、一鍵複製、重新產生
│               │   ├── actions.js       共用操作：換頁、交接（送回、定稿、下一輪）、重試
│               │   └── notify.js        「複製通知內容」的通知文字
│               ├── dialogs/         對話視窗；index.js 是視窗定義的格式（Dialog）與開關
│               │   ├── handoff.js       「交給他方」確認視窗（附連結與密碼）
│               │   └── export/          匯出：index.js 選擇 PDF／Word、export.js 產生檔案
│               └── tabs/            分頁，一個資料夾一頁；index.js 是分頁定義
│                   ├── index.js         分頁登錄與分頁定義的格式（Tab）
│                   ├── overview/        總覽：view.js 步驟與下一步、news.js 自上次查看後的更新
│                   ├── content/         契約內容：clauses.js 契約紙張、outline.js 條文目錄、toolbar.js 工具列、
│                   │                    editor.js／editing.js 條文編輯與儲存、fields.js／field-popover.js 直接填寫、
│                   │                    locate.js 定位條文
│                   ├── review/          審閱：view.js 一次一處、summary.js 修訂摘要、actions.js 接受／退回／全部接受
│                   ├── members/         成員：view.js 邀請卡（連結＋密碼）、甲乙方成員、我的資料
│                   ├── history/         修訂紀錄（契約內容的子頁）：view.js 紀錄與篩選
│                   └── import/          匯入（契約內容的子頁）：view.js 三種方式、previews.js 預覽與比對、import.js 讀檔與寫入
├── server/                      後端（Cloudflare Workers 執行環境）
│   ├── router.js                /api/* 分派
│   ├── http.js                  JSON 回應、錯誤、輸入檢查、上限
│   ├── db.js                    資料表定義與自動建立／升級
│   ├── auth.js                  成員金鑰（只存雜湊）、管理密碼比對
│   ├── invites.js               共編連結與進入密碼：加密保存、雜湊比對、錯誤次數鎖定
│   ├── model.js                 讀取與輸出資料、甲乙方判定、修訂紀錄
│   └── routes/
│       ├── admin.js             契約列表、新增、改名、刪除（需管理密碼）
│       ├── contract.js          契約狀態、成員、共編連結、匯入、交接、圖片上傳
│       ├── join.js              以共編連結＋進入密碼加入契約
│       ├── clauses.js           條文編輯、移動、刪除、接受、退回、整批匯回
│       └── images.js            /img/* 讀取 R2 圖片
├── functions/                   Cloudflare Pages Functions 進入點（各一行）
├── scripts/build-template.mjs   把 .docx 轉成範本
├── test/
│   ├── setup.mjs                以 jsdom 讓前端模組可在 Node 執行
│   ├── unit/                    node:test 單元測試
│   └── e2e/
│       ├── helpers.mjs          啟動本機伺服器、開啟分頁、切換契約分頁、「更多」選單、匯出視窗
│       ├── contract-flow.mjs    主要流程：建立 → 填寫 → 邀請 → 審閱 → Word 往返 → PDF
│       └── all-pages.mjs        逐一操作每個畫面的按鈕
└── docs/ARCHITECTURE.md         本文件
```

## 前端分層

依賴方向只能由上往下：

```
pages/        畫面（每個畫面一個資料夾：畫面 HTML＋自己的操作）
word/ pdf/ ui/ api/   功能模組（Word、PDF、介面元件、後端 API）
lib/          契約領域邏輯（填寫欄位、條文切分、修訂比對），不碰畫面
core/         基礎工具（DOM、格式、過濾、文字比對、函式庫載入）
```

- **一頁一個重點**：契約頁的導覽列只有四個分頁（總覽、契約內容、審閱、成員）；修訂紀錄與匯入是「契約內容」的子頁（從「更多」選單進入，頁首有「返回」），匯出是視窗。各頁都有網址；首頁的列表與新增契約也是不同網址。
- **文件區最大化**：分頁與進度和頂端列合為一列；「契約內容」的工具列固定在頂端列下方（桌面版），文件緊接在下方。
- **文字精簡**：畫面只放必要的標題、狀態與按鈕文字，不放說明段落；按鈕名稱本身就說明要做什麼。
- **一個畫面一個主要按鈕**：每個畫面最多一個主要按鈕（實心）與一個次要按鈕（外框），其餘收進「更多」選單或改為小圖示、文字連結。進度列只顯示進度，不放按鈕。
- **單一狀態 → 整頁重繪**：契約頁的 `S`（context.js）是唯一狀態來源，`render()` 依 `S` 繪製；畫面函式只回傳 HTML 字串。所有使用者輸入的內容在輸出前都經 `esc()` 或 `sanitize()` 處理。
- **操作就近放置**：按鈕以 `data-act` 標示操作名稱，處理函式寫在該分頁的 `index.js`（`actions`），視窗的操作在 `dialogs/`，跨分頁的操作在 `shell/actions.js`；`events.js` 只負責依名稱找到函式，名稱重複會直接報錯。
- 第三方函式庫（mammoth、JSZip、docx、html2canvas、jsPDF）體積大，由 `core/loader.js` 在第一次需要時才載入；版本固定，且受 CSP 限制只允許 jsDelivr。

### 分頁定義

每個分頁的 `tabs/<代號>/index.js` 匯出一個物件（格式見 `tabs/index.js` 的 `Tab`）：

```js
export default {
  id: "review",                                   // 與資料夾同名
  nav: { label: "審閱", count: () => theirsClauses().length },   // 子頁改用 parent: "content"
  title: () => "審閱修訂",                         // 頁首標題
  keepTyping: true,                               // 輸入中不被背景更新重繪
  html: reviewHtml,                               // 主要內容
  after() {},                                     // 內容放進畫面後（綁定表單等），可省略
  actions: { "review-accept": (el, id) => decide(id, "accept") },
  init() {}                                       // 啟動時執行一次，可省略
};
```

### 新增一個分頁

1. 建立 `tabs/<代號>/index.js`（分頁定義）與 `view.js`（畫面），操作寫在 `actions`。
2. 在 `tabs/index.js` 的 `TABS` 加入，順序即導覽列順序；不放在導覽列的子頁不寫 `nav`，改寫 `parent`。
3. 在 `router.js` 的 `SLUGS` 加入網址片段。
4. 樣式加到 `css/contract.css`，以分頁名稱分段。

## 資料模型（D1）

| 資料表 | 用途 | 主要欄位 |
| --- | --- | --- |
| `contracts` | 契約 | `title` 案名、`case_no` 案號、`version`（每次變更 +1，供輪詢）、`handoff`（目前輪到哪一方、第幾輪） |
| `participants` | 成員 | `key_hash` 成員金鑰雜湊（加入後存在瀏覽器，下次自動登入）、`role`（owner 建立者／party 成員）、`side`（A 甲方／B 乙方）、`name` 姓名、`title` 角色、`revoked` 已停用 |
| `invites` | 共編連結與進入密碼（每份契約每一方一組） | `side`、`token_hash` 連結代碼雜湊、`pin_hash` 密碼雜湊、`secret`（連結代碼與密碼，以 ADMIN_PASSWORD 衍生的金鑰 AES-GCM 加密，供再次顯示）、`fails` 密碼錯誤次數（達 10 次鎖定）、`revoked` 已重新產生 |
| `clauses` | 條文 | `ord` 排序、`title`、`html`、`removed`、`rev`（樂觀鎖，避免同時修改互相覆蓋） |
| `revisions` | 修訂紀錄 | `kind`（edit／add／move／delete）、`data`（修訂前後內容）、`by_id`、`status`（pending 待審閱／accepted 已接受／reverted 已退回／withdrawn 本方撤回）、`round` 輪次 |

## API

所有路徑以 `/api` 開頭。契約 API 以 `Authorization: Bearer <成員金鑰>` 識別成員；管理 API 以 `x-admin-password` 驗證；加入 API 不需登入，以進入密碼驗證。

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
| GET | `/c/:id/invites` | 共編連結與進入密碼（本方的；建立契約的一方另含他方的），沒有時自動產生 |
| POST | `/c/:id/invites/:side/rotate` | 重新產生某一方的連結與密碼，舊的立即失效 |
| POST | `/c/:id/participants/:pid/remove` | 停用成員 |
| GET | `/join/:token` | 加入頁資訊：契約名稱、將加入的一方 |
| POST | `/join/:token` | 以進入密碼、姓名、角色加入，回傳成員金鑰 |
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

**邀請與加入**：成員頁或「交給他方」視窗顯示該方的共編連結（`/j/<代碼>`）與 6 位數進入密碼 → 邀請方複製後傳給對方（建議連結與密碼分開傳送）→ 對方開啟連結，輸入密碼、姓名與角色 → 伺服器驗證密碼（錯誤 10 次即鎖定）後建立成員並回傳金鑰，存在對方瀏覽器，之後直接進入契約。

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
