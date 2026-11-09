// 讀取 Word（.docx）並轉成 HTML：先保留自動編號與縮排（docx-prep），再交給 mammoth 轉換。
// 圖片透過 uploadImage 上傳到 R2；EMF 等瀏覽器無法顯示的格式會計入 imgFail。
import { need } from "../core/loader.js";
import { post, prepare } from "./docx-prep.js";

const WEB_IMAGE = /^image\/(png|jpe?g|gif|webp)$/;

export function b64ToBlob(b64, type) {
  const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type });
}

export async function readDocx(file, uploadImage) {
  await need("jszip", "mammoth");
  const prepped = await prepare(await file.arrayBuffer());
  let imgFail = 0;
  const res = await window.mammoth.convertToHtml({ arrayBuffer: prepped }, {
    styleMap: ["u => u", "strike => s"],
    convertImage: window.mammoth.images.imgElement(async (image) => {
      if (WEB_IMAGE.test(image.contentType) && uploadImage) {
        try { return { src: await uploadImage(b64ToBlob(await image.read("base64"), image.contentType)) }; } catch (e) { console.warn(e); }
      }
      imgFail++;
      return { src: "", alt: "（圖片未能匯入）" };
    })
  });
  return { html: post(res.value), imgFail };
}

export const isDocx = (file) => /\.docx$/i.test(file?.name || "");
export const docxHint = (file) => /\.doc$/i.test(file?.name || "") ? "舊版 .doc 檔請先以 Word「另存新檔」為 .docx 再匯入" : "請選擇 .docx 檔";
