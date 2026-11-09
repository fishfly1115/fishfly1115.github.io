// 把一份 Word 契約（.docx）轉成範本，寫入 public/data/templates.json。
// 使用與網頁「匯入 Word 契約」相同的程式（docx-prep + mammoth + splitRich），結果一致。
//
//   npm run build:template -- 契約.docx --id research-funding --name "資助研究計畫契約（中央研究院）" \
//     [--description "範本說明"] [--title "契約名稱"]
//
// 相同 id 的範本會被取代，否則加在最後。
import "../test/setup.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import mammoth from "mammoth";
import { post, prepare } from "../public/js/word/docx-prep.js";
import { splitRich } from "../public/js/lib/split.js";

const TEMPLATES = new URL("../public/data/templates.json", import.meta.url);

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, title: { type: "string" } }
});
const [file] = positionals;
if (!file || !values.id || !values.name) {
  console.error("用法：npm run build:template -- <檔案.docx> --id <代號> --name <範本名稱> [--description <說明>] [--title <契約名稱>]");
  process.exit(1);
}

const buf = readFileSync(file);
const prepped = await prepare(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(prepped) }, { styleMap: ["u => u", "strike => s"] });
const parsed = splitRich(post(value), values.title || values.name);

const template = {
  id: values.id,
  name: values.name,
  description: values.description || "",
  title: values.title || parsed.title,
  clauses: parsed.clauses
};

const data = JSON.parse(readFileSync(TEMPLATES, "utf8"));
const at = data.templates.findIndex((t) => t.id === template.id);
if (at >= 0) data.templates[at] = template; else data.templates.push(template);
writeFileSync(TEMPLATES, JSON.stringify(data, null, 1));

console.log(`${at >= 0 ? "已更新" : "已新增"}範本「${template.name}」：${template.clauses.length} 條`);
for (const c of template.clauses) console.log("  -", c.title);
