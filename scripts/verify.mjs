import { readFile } from "node:fs/promises";

const html = await readFile("index.html", "utf8");
const css = await readFile("styles.css", "utf8");
const js = await readFile("app.js", "utf8");

const requiredIds = ["dropZone", "receiptInput", "analyzingPanel", "review", "recordForm", "recordsBody", "csvButton", "excelButton", "toastRegion"];
const missing = requiredIds.filter((id) => !html.includes(`id="${id}"`));

if (missing.length) {
  throw new Error(`缺少必要页面元素：${missing.join(", ")}`);
}

if (!css.includes("prefers-reduced-motion")) throw new Error("缺少减少动态效果支持");
if (!css.includes(":focus-visible")) throw new Error("缺少键盘焦点样式");
if (!js.includes("localStorage")) throw new Error("缺少本地保存能力");
if (!js.includes("exportCsv") || !js.includes("exportExcel")) throw new Error("缺少导出能力");
if (!js.includes("getRecordTotalTax") || !js.includes("pstAmount")) throw new Error("缺少 GST + PST 合计逻辑");
if (!html.includes("receipt-parser.js") || !js.includes("RECEIPT_PARSER.parseTaxAmounts")) throw new Error("PST OCR 解析模块未接入上传流程");
if (!js.includes("tessedit_pageseg_mode") || !js.includes("复核省税")) throw new Error("缺少 PST OCR 二次复核");

console.log("静态检查通过：结构、无障碍基础、本地存储与双格式导出均已配置。");
