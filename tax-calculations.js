(function (root) {
  "use strict";

  function roundMoney(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.round((number + Number.EPSILON) * 100) / 100;
  }

  function calculateTaxBreakdown({ total, gstHstAmount, pstAmount, taxType }) {
    const normalizedTotal = roundMoney(total);
    const normalizedGstHst = roundMoney(gstHstAmount);
    const normalizedPst = taxType === "GST + PST" ? roundMoney(pstAmount) : 0;
    const totalTax = roundMoney(normalizedGstHst + normalizedPst);
    const subtotal = roundMoney(normalizedTotal - totalTax);

    return {
      total: normalizedTotal,
      gstHstAmount: normalizedGstHst,
      pstAmount: normalizedPst,
      totalTax,
      subtotal
    };
  }

  function getRecordTaxBreakdown(record) {
    const total = roundMoney(record.total);
    const hasSplitTax = Number.isFinite(record.gstHstAmount) || Number.isFinite(record.pstAmount);
    const gstHstAmount = Number.isFinite(record.gstHstAmount)
      ? roundMoney(record.gstHstAmount)
      : hasSplitTax
        ? 0
        : roundMoney(record.taxAmount);
    const pstAmount = roundMoney(record.pstAmount);
    const totalTax = Number.isFinite(record.totalTax)
      ? roundMoney(record.totalTax)
      : hasSplitTax
        ? roundMoney(gstHstAmount + pstAmount)
        : roundMoney(record.taxAmount);

    return {
      total,
      gstHstAmount,
      pstAmount,
      totalTax,
      subtotal: roundMoney(total - totalTax)
    };
  }

  root.BookkeepingTax = Object.freeze({
    roundMoney,
    calculateTaxBreakdown,
    getRecordTaxBreakdown
  });
})(globalThis);
