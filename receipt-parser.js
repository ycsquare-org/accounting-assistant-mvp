(function (root) {
  "use strict";

  const HST_PATTERN = /\bhst\b|h[\s.]*[s5][\s.]*[t7i1]\b/i;
  const GST_PATTERN = /\bgst\b|g[\s.]*[s5][\s.]*[t7i1]\b/i;
  const PST_PATTERN = /\bpst\b|p[\s.]*[s5][\s.]*[t7i1]\b|provincial\s+sales\s+tax/i;
  const GENERIC_TAX_PATTERN = /\btax\b/i;
  const TAX_PATTERNS = [HST_PATTERN, GST_PATTERN, PST_PATTERN, GENERIC_TAX_PATTERN];
  const TOTAL_PATTERN = /\b(?:grand\s*)?(?:sub\s*)?t[o0]tal\b|amount\s*due|balance\s*due/i;
  const PAYMENT_PATTERN = /\b(?:cash|change|tender|debit|credit|visa|mastercard|amex|payment|paid|tip)\b/i;
  const FIELD_BOUNDARY_PATTERNS = [...TAX_PATTERNS, TOTAL_PATTERN, PAYMENT_PATTERN];

  function normalizeLines(input) {
    const source = Array.isArray(input) ? input : String(input || "").split(/\r?\n/);
    return source.map((line) => String(line).replace(/\t/g, " ").trim()).filter(Boolean);
  }

  function extractAmountMatches(text) {
    const pattern = /(?:CAD\s*)?\$?\s*\d{1,6}(?:[,.]\d{2})/gi;
    const amounts = [];
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const following = text.slice(pattern.lastIndex);
      if (/^\s*%/.test(following)) continue;
      const normalized = match[0]
        .replace(/[^\d.,]/g, "")
        .replace(/,(?=\d{2}$)/, ".")
        .replace(/,/g, "");
      const value = Number(normalized);
      if (Number.isFinite(value)) amounts.push({ value, index: match.index, end: pattern.lastIndex });
    }
    return amounts;
  }

  function extractAmounts(text) {
    return extractAmountMatches(text).map((match) => match.value);
  }

  function nextFieldLabelIndex(text) {
    const indexes = FIELD_BOUNDARY_PATTERNS
      .map((pattern) => text.search(pattern))
      .filter((index) => index >= 0);
    return indexes.length ? Math.min(...indexes) : -1;
  }

  function findLabeledAmount(lines, labelPattern) {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const label = line.match(labelPattern);
      if (!label) continue;

      const labelEnd = (label.index || 0) + label[0].length;
      const afterLabel = line.slice(labelEnd);
      const nextLabel = nextFieldLabelIndex(afterLabel);
      const segment = nextLabel >= 0 ? afterLabel.slice(0, nextLabel) : afterLabel;
      const sameLineAmounts = extractAmounts(segment);
      if (sameLineAmounts.length) return sameLineAmounts[sameLineAmounts.length - 1];

      const beforeLabel = line.slice(0, label.index || 0);
      const hasEarlierField = FIELD_BOUNDARY_PATTERNS.some((pattern) => pattern.test(beforeLabel));
      const beforeLabelAmounts = extractAmountMatches(beforeLabel);
      if (!hasEarlierField && beforeLabelAmounts.length) {
        const closest = beforeLabelAmounts[beforeLabelAmounts.length - 1];
        if ((label.index || 0) - closest.end <= 4) return closest.value;
      }

      if (index + 1 < lines.length) {
        const followingLine = lines[index + 1];
        const hasAnotherField = FIELD_BOUNDARY_PATTERNS.some((pattern) => pattern.test(followingLine));
        if (!hasAnotherField) {
        const followingAmounts = extractAmountMatches(followingLine);
        if (followingAmounts.length) {
          const labelColumn = label.index || 0;
          const closest = followingAmounts.reduce((best, candidate) => (
            Math.abs(candidate.index - labelColumn) < Math.abs(best.index - labelColumn) ? candidate : best
          ));
          return closest.value;
        }
        }
      }
    }
    return null;
  }

  function parseTaxAmounts(input) {
    const lines = normalizeLines(input);
    const hstAmount = findLabeledAmount(lines, HST_PATTERN);
    const gstAmount = findLabeledAmount(lines, GST_PATTERN);
    const pstAmount = findLabeledAmount(lines, PST_PATTERN);
    const genericTaxAmount = findLabeledAmount(lines, GENERIC_TAX_PATTERN);

    let taxType = "未收税";
    let gstHstAmount = null;

    if (pstAmount !== null) {
      taxType = "GST + PST";
      gstHstAmount = gstAmount ?? genericTaxAmount ?? 0;
    } else if (hstAmount !== null) {
      taxType = "HST";
      gstHstAmount = hstAmount;
    } else if (gstAmount !== null) {
      taxType = "GST";
      gstHstAmount = gstAmount;
    } else if (genericTaxAmount !== null) {
      taxType = "待确认";
      gstHstAmount = genericTaxAmount;
    }

    return {
      gstHstAmount,
      pstAmount: pstAmount ?? 0,
      taxType,
      foundGstHst: hstAmount !== null || gstAmount !== null || genericTaxAmount !== null,
      foundPst: pstAmount !== null
    };
  }

  root.ReceiptParser = Object.freeze({
    normalizeLines,
    extractAmountMatches,
    extractAmounts,
    findLabeledAmount,
    parseTaxAmounts
  });
})(globalThis);
