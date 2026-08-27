await import("../tax-calculations.js");

const tax = globalThis.BookkeepingTax;
const actual = tax.calculateTaxBreakdown({
  total: 34.71,
  gstHstAmount: 1.59,
  pstAmount: 1.23,
  taxType: "GST + PST"
});

const expected = {
  total: 34.71,
  gstHstAmount: 1.59,
  pstAmount: 1.23,
  totalTax: 2.82,
  subtotal: 31.89
};

for (const [field, value] of Object.entries(expected)) {
  if (actual[field] !== value) {
    throw new Error(field + " 计算错误：预期 " + value + "，实际 " + actual[field]);
  }
}

const savedRecord = {
  total: 34.71,
  gstHstAmount: 1.59,
  pstAmount: 1.23,
  totalTax: 2.82,
  taxAmount: 2.82,
  subtotal: 33.12,
  taxType: "GST + PST"
};
const exported = tax.getRecordTaxBreakdown(savedRecord);

if (exported.subtotal !== 31.89 || exported.totalTax !== 2.82) {
  throw new Error("账簿或导出没有重新使用正确的税前金额与总税额");
}

console.log("GST + PST 检查通过：总税额 $2.82，税前金额 $31.89。");
