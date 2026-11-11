# 合約共同編輯器（Cloudflare 版）

供機關與廠商共同擬定採購契約：匯入契約草案（Word）後，雙方各以專屬連結直接修訂條文；每處修訂均自動記錄修訂人、時間與修訂前內容，由他方接受或退回。雙方確認定稿後，可匯出含案號、頁碼的 PDF 定稿本（文字可選取、可搜尋；未定稿版本附「草案」浮水印）。

- 前端：`public/`（原生 ES modules，不需打包，部署到 Cloudflare Pages）
- 後端：`server/`（由 `functions/` 進入，於 Cloudflare Pages Functions 執行）
- 資料庫：Cloudflare D1（綁定名稱 `DB`，第一次使用時自動建立資料表）
- 圖片：Cloudflare R2（綁定名稱 `IMAGES`）

資料夾結構、分層、資料模型與 API 見 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

```
public/js/
  core/    基礎工具（DOM、格式、過濾、比對、函式庫載入）
  lib/     契約領域邏輯（填寫欄位、條文切分、修訂版比對、範本）
  word/    Word 匯入匯出      pdf/  PDF 匯出      api/  後端 API
  pages/   home/ 首頁（登入、列表、新增契約）；contract/ 契約頁（shell 外框、tabs/ 分頁一頁一個資料夾、dialogs/ 對話視窗）
server/    router → routes/（admin、contract、clauses、images）＋ db、auth、model
test/      unit/ 單元測試、e2e/ 完整流程與逐頁操作測試
```

## 部署方式一（建議）：GitHub Actions 自動部署

`.github/workflows/deploy-contract-editor.yml` 會在 `main` 分支的 `contract-editor/` 有變更時自動部署。第一次執行時，它會自動建立 Pages 專案、D1 資料庫和 R2 儲存桶，也會設定管理密碼。

你只需要做一次：

1. **建立 Cloudflare API Token**：Cloudflare 後台右上角頭像 → My Profile → API Tokens → Create Token → Create Custom Token，權限加入：
   - Account → Cloudflare Pages → Edit
   - Account → D1 → Edit
   - Account → Workers R2 Storage → Edit
2. **找到帳戶 ID（Account ID）**：在 Cloudflare 後台首頁或 Workers & Pages 頁面的右側欄。
3. **（要用圖片時）啟用 R2**：後台 → R2 Object Storage，第一次使用要先啟用。沒啟用也能部署，只是不能上傳圖片。
4. **在 GitHub 填入三個 secrets**：repo → Settings → Secrets and variables → Actions → New repository secret
   - `CLOUDFLARE_API_TOKEN`：第 1 步的 Token
   - `CLOUDFLARE_ACCOUNT_ID`：第 2 步的帳戶 ID
   - `CONTRACT_ADMIN_PASSWORD`：你自訂的管理密碼（首頁登入用）
5. **合併 PR 到 `main`**，部署就會自動開始。到 repo 的 Actions 頁面可以看進度，完成後摘要會列出網址（通常是 `https://contract-editor.pages.dev`）。之後也可以在 Actions → Deploy contract editor → Run workflow 手動重新部署。

## 部署方式二：在 Cloudflare 後台手動設定

1. **建立 D1 資料庫**：Cloudflare 後台 → Storage & Databases → D1 → Create，名稱例如 `contract-editor`。
2. **建立 R2 儲存桶**：後台 → R2 Object Storage → Create bucket，名稱例如 `contract-editor-images`。（第一次使用 R2 需要先在後台啟用。）
3. **建立 Pages 專案並連結 GitHub**：後台 → Workers & Pages → Create → Pages → Connect to Git，選 `fishfly1115/fishfly1115.github.io`，然後設定：
   - Production branch：`main`（或要部署的分支）
   - Framework preset：None
   - Build command：留空
   - Build output directory：`public`
   - Root directory（在 Advanced 裡）：`contract-editor`
4. **加入綁定**：Pages 專案 → Settings → Bindings：
   - D1 database → Variable name 填 `DB`，選第 1 步的資料庫
   - R2 bucket → Variable name 填 `IMAGES`，選第 2 步的儲存桶
5. **設定管理密碼**：Pages 專案 → Settings → Variables and Secrets → 新增 `ADMIN_PASSWORD`，類型選 Secret（加密），值設成一個夠長的密碼。
6. **重新部署**：Deployments → 最新一次部署 → Retry deployment（綁定與密碼要重新部署後才會生效）。
7. （選用）**自訂網域**：Pages 專案 → Custom domains。

## 使用方式

1. 打開網站首頁，輸入 `ADMIN_PASSWORD` 登入，按「新增契約」，選擇範本並填寫契約名稱（案名）、案號與本方身分。
2. 進入契約後先看「總覽」：顯示目前在哪一步、輪到誰，以及下一步要按的按鈕。
3. 「契約內容」頁可直接勾選、填寫或修訂條文；要用既有的 Word 契約，按工具列的「更多 → 套用範本／匯入新 Word」。
4. 到「成員」頁按「一鍵複製邀請訊息」（或用連結、密碼旁的小圖示分別複製），傳給乙方（例如連結用電子郵件、密碼用電話）；乙方開啟連結、輸入密碼與姓名即可加入。按「交給乙方」時也會顯示這組連結與密碼。
5. 他方修訂後，到「審閱」頁逐處接受或退回；他方畫面每數秒自動更新。
6. 雙方確認定稿後，按「匯出定稿本」（或在「契約內容」按「匯出」）下載 PDF 定稿本或 Word 檔。

## 主要功能

- **一頁一個重點**：導覽列只有總覽（現在輪到誰、下一步）、契約內容（閱讀與修訂）、審閱（一次一處，接受或退回）、成員（邀請他方與同仁）四頁；匯入、匯出、修訂紀錄都在「契約內容」頁。每個畫面只有一個主要按鈕與一個次要按鈕。首頁的新增契約也是獨立一頁（`/new`）。
- **深色／淺色**：右上角圖示按鈕切換，選擇會記住；未選擇時跟隨裝置設定。
- **首頁待辦**：統計卡（待您處理／等待他方／修訂中／已定稿）同時是篩選，表格標示目前輪到哪一方。

- **範本**：新增契約時可選空白契約、資助研究計畫契約（中央研究院）、勞務採購契約、財物採購契約；範本存放於 `public/data/templates.json`。
- **直接填寫**：條文中的 □ 可直接點選勾選；「○年○月○日」可用日期選擇器填入（存為民國年）；底線空格、【　】與空白表格儲存格可直接填寫。連續填寫會合併為同一筆修訂。
- **僅顯示已勾選**：切換後隱藏未勾選的選項（含其下所屬的段落與表格），匯出 PDF／Word 時也可套用。
- **匯出**：PDF 定稿本（文字可搜尋）或 Word（.docx，標楷體，條文標題為「標題 2」樣式）。
- **匯入修訂版 Word**：任一方可將匯出的 Word 整份修訂後匯回，系統逐條比對並列出修訂、新增、刪除，確認後成為待他方審閱的修訂。
- **甲乙雙方與成員角色**：每位成員屬於甲方或乙方，加入時填寫姓名與角色（承辦人、法務、主管等）；各方可用本方的連結與密碼邀請同仁，審閱以「方」為單位。
- **流程提示**：每頁上方的進度列顯示四個步驟（已完成、目前在這一步、還沒到）；總覽寫出現在輪到誰、要做什麼；頁首列出「這一頁要做的事」。
- **Word 匯入**：保留 Word 自動編號（一、（一）、1. 等）與段落縮排；附件與簽署欄自動分段。

## 安全說明

- 加入契約需要「共編連結＋進入密碼」兩者；密碼錯誤 10 次即鎖定。連結或密碼外流時，在「成員」頁按「重新產生連結與密碼」，舊的立即失效；已加入的成員可個別停用。
- 連結代碼與密碼以 ADMIN_PASSWORD 衍生的金鑰加密保存（更換 ADMIN_PASSWORD 後需重新產生）；成員金鑰只存雜湊值。
- 只有知道 `ADMIN_PASSWORD` 的人能建立或刪除合約，也能以擁有者身分開啟任何合約。
- 合約內容在顯示前都會過濾（DOMPurify），並以 Content-Security-Policy 禁止外來程式碼。

## 本機開發與測試

```bash
cd contract-editor
npm install
npm run dev          # 本機伺服器 http://localhost:8788，管理密碼 dev-password
npm run lint         # ESLint
npm test             # 單元測試（欄位填寫、比對、條文切分、Word 匯出再匯入）
npm run test:e2e     # 以瀏覽器走完整流程並逐頁操作（需 Playwright 與 Chromium）
```

範本存放於 `public/data/templates.json`。要把一份 Word 契約做成範本：

```bash
npm run build:template -- 契約.docx --id my-contract --name "○○採購契約" --description "範本說明"
```

PDF 內嵌字型為 Noto Sans TC（SIL Open Font License 1.1）。介面圖示取自 MUI Material Icons（@mui/icons-material，MIT License），統一由 `public/js/ui/icons.js` 提供。
