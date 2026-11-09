# 合約共同編輯器（Cloudflare 版）

供機關與廠商共同擬定採購契約：匯入契約草案（Word）後，雙方各以專屬連結直接修訂條文；每處修訂均自動記錄修訂人、時間與修訂前內容，由他方接受或退回。雙方確認定稿後，可匯出含案號、頁碼的 PDF 定稿本（文字可選取、可搜尋；未定稿版本附「草案」浮水印）。

- 前端：`public/`（靜態檔，部署到 Cloudflare Pages）
- 後端：`functions/`（Cloudflare Pages Functions）
- 資料庫：Cloudflare D1（綁定名稱 `DB`，第一次使用時自動建立資料表）
- 圖片：Cloudflare R2（綁定名稱 `IMAGES`）

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

1. 打開網站首頁，輸入 `ADMIN_PASSWORD`，按「新增契約」，填寫契約名稱（案名）、案號，並選擇本方身分（機關（甲方）或廠商（乙方））。
2. 進入契約後，按「匯入 Word 契約」選擇 .docx 契約草案，確認預覽後匯入。
3. 按「邀請他方／成員」，輸入他方身分（例如「廠商（乙方）○○股份有限公司」），產生專屬連結，以電子郵件等方式送交他方。
4. 雙方修訂、審閱；頁面頂端顯示目前應由何方處理，他方畫面每數秒自動更新。
5. 雙方確認定稿後，按「匯出 PDF」取得定稿本。

## 安全說明

- 每條專屬連結就是一把鑰匙，拿到的人就能修改合約；資料庫只存鑰匙的雜湊值。外流時，擁有者可以在「成員與連結」停用該連結，再產生新的連結。
- 只有知道 `ADMIN_PASSWORD` 的人能建立或刪除合約，也能以擁有者身分開啟任何合約。
- 合約內容在顯示前都會過濾（DOMPurify），並以 Content-Security-Policy 禁止外來程式碼。

## 本機測試

```bash
cd contract-editor
npx wrangler pages dev public --d1 DB=local-db --r2 IMAGES=local-img --binding ADMIN_PASSWORD=test
```

PDF 內嵌字型為 Noto Sans TC（SIL Open Font License 1.1）。
