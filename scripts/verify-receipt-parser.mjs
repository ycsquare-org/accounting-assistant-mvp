await import("../receipt-parser.js");
await import("../tax-calculations.js");

const parser = globalThis.ReceiptParser;
const tax = globalThis.BookkeepingTax;
const fixtures = [
  {
    name: "标准同行格式",
    text: "SUBTOTAL 31.89\nGST 5% 1.59\nPST 3.86% 1.23\nTOTAL 34.71"
  },
  {
    name: "标签与金额换行",
    text: "SUBTOTAL 31.89\nGST 5%\n1.59\nP.S.T. 3.86%\n1.23\nTOTAL 34.71"
  },
  {
    name: "同一行多个税种",
    text: "SUBTOTAL 31.89\nGST 5% $1.59 PST 3.86% $1.23\nTOTAL $34.71"
  },
  {
    name: "常见 OCR 字符混淆",
    text: "SUBTOTAL 31.89\nG5I 5% $1.59\nP5I 3.86% $1,23\nTOTAL $34.71"
  },
  {
    name: "标签与金额分列",
    text: "SUBTOTAL 31.89\nGST         PST\n1.59        1.23\nTOTAL 34.71"
  }
];

const rejectionFixtures = [
  {
    name: "PST 缺失时不得读取 Total",
    text: "SUBTOTAL 31.89\nGST 5% 1.59\nPST 3.86%\nTOTAL 34.71"
  },
  {
    name: "PST 后同行 Total 不得读取",
    text: "SUBTOTAL 31.89\nGST 5% 1.59\nPST TOTAL 34.71"
  },
  {
    name: "Total 在 PST 前不得读取",
    text: "SUBTOTAL 31.89\nGST 5% 1.59\nTOTAL 34.71 PST"
  }
];

for (const fixture of fixtures) {
  const recognized = parser.parseTaxAmounts(fixture.text);
  if (recognized.gstHstAmount !== 1.59 || recognized.pstAmount !== 1.23 || recognized.taxType !== "GST + PST") {
    throw new Error(fixture.name + "解析失败：" + JSON.stringify(recognized));
  }

  const calculated = tax.calculateTaxBreakdown({
    total: 34.71,
    gstHstAmount: recognized.gstHstAmount,
    pstAmount: recognized.pstAmount,
    taxType: recognized.taxType
  });
  if (calculated.gstHstAmount !== 1.59 || calculated.pstAmount !== 1.23 || calculated.totalTax !== 2.82 || calculated.subtotal !== 31.89 || calculated.total !== 34.71) {
    throw new Error(fixture.name + "计算失败：" + JSON.stringify(calculated));
  }

  const exported = tax.getRecordTaxBreakdown({
    total: calculated.total,
    gstHstAmount: recognized.gstHstAmount,
    pstAmount: recognized.pstAmount,
    totalTax: calculated.totalTax,
    taxAmount: calculated.totalTax,
    subtotal: calculated.subtotal,
    taxType: recognized.taxType
  });
  if (exported.gstHstAmount !== 1.59 || exported.pstAmount !== 1.23 || exported.totalTax !== 2.82 || exported.subtotal !== 31.89 || exported.total !== 34.71) {
    throw new Error(fixture.name + "保存或导出链路失败：" + JSON.stringify(exported));
  }
}

for (const fixture of rejectionFixtures) {
  const recognized = parser.parseTaxAmounts(fixture.text);
  if (recognized.pstAmount !== 0 || recognized.gstHstAmount !== 1.59 || recognized.taxType !== "GST") {
    throw new Error(fixture.name + "错误读取了其他字段：" + JSON.stringify(recognized));
  }
}

const boundedSameLine = parser.parseTaxAmounts("GST 5% 1.59\nPST 3.86% 1.23 TOTAL 34.71");
if (boundedSameLine.pstAmount !== 1.23) {
  throw new Error("PST 同行边界解析失败：" + JSON.stringify(boundedSameLine));
}

console.log("PST OCR 解析检查通过：5 种正确格式均读取 PST $1.23，3 种缺失格式均未误取 Total $34.71。");
