(function () {
  "use strict";

  const STORAGE_KEY = "bookkeeping-assistant-records-v1";
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
  const CURRENCY = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
  const RECEIPT_PARSER = window.ReceiptParser;
  const TAX = window.BookkeepingTax;

  const elements = {
    dropZone: document.querySelector("#dropZone"),
    receiptInput: document.querySelector("#receiptInput"),
    demoButton: document.querySelector("#demoButton"),
    uploadError: document.querySelector("#uploadError"),
    analyzingPanel: document.querySelector("#analyzingPanel"),
    scanPreview: document.querySelector("#scanPreview"),
    progressBar: document.querySelector("#progressBar"),
    progressLabel: document.querySelector("#progressLabel"),
    progressValue: document.querySelector("#progressValue"),
    analysisStatus: document.querySelector("#analysisStatus"),
    review: document.querySelector("#review"),
    receiptPreview: document.querySelector("#receiptPreview"),
    fileName: document.querySelector("#fileName"),
    fileSize: document.querySelector("#fileSize"),
    recordForm: document.querySelector("#recordForm"),
    merchant: document.querySelector("#merchant"),
    date: document.querySelector("#date"),
    category: document.querySelector("#category"),
    total: document.querySelector("#total"),
    taxAmount: document.querySelector("#taxAmount"),
    pstAmount: document.querySelector("#pstAmount"),
    pstField: document.querySelector("#pstField"),
    taxType: document.querySelector("#taxType"),
    gstHstLabel: document.querySelector("#gstHstLabel"),
    totalTax: document.querySelector("#totalTax"),
    subtotal: document.querySelector("#subtotal"),
    notes: document.querySelector("#notes"),
    suggestionText: document.querySelector("#suggestionText"),
    confidenceBadge: document.querySelector("#confidenceBadge"),
    merchantConfidence: document.querySelector("#merchantConfidence"),
    dateConfidence: document.querySelector("#dateConfidence"),
    totalConfidence: document.querySelector("#totalConfidence"),
    taxConfidence: document.querySelector("#taxConfidence"),
    pstConfidence: document.querySelector("#pstConfidence"),
    copyButton: document.querySelector("#copyButton"),
    newReceiptButton: document.querySelector("#newReceiptButton"),
    rotateButton: document.querySelector("#rotateButton"),
    emptyRecords: document.querySelector("#emptyRecords"),
    recordsTableWrap: document.querySelector("#recordsTableWrap"),
    recordsBody: document.querySelector("#recordsBody"),
    recordCount: document.querySelector("#recordCount"),
    csvButton: document.querySelector("#csvButton"),
    excelButton: document.querySelector("#excelButton"),
    toastRegion: document.querySelector("#toastRegion"),
    srStatus: document.querySelector("#srStatus")
  };

  let records = loadRecords();
  let currentFile = null;
  let currentPreviewUrl = "";
  let rotation = 0;
  let isAnalyzing = false;

  const categories = [
    { value: "办公用品", words: ["staples", "office depot", "paper", "printer", "ink", "stationery", "bureau en gros"] },
    { value: "餐饮与招待", words: ["restaurant", "cafe", "coffee", "tim horton", "starbucks", "pizza", "bakery", "meal"] },
    { value: "软件与订阅", words: ["adobe", "microsoft", "software", "subscription", "cloud", "hosting", "notion"] },
    { value: "车辆费用", words: ["esso", "shell", "petro", "fuel", "gas station", "parking", "auto", "tire"] },
    { value: "差旅", words: ["hotel", "air canada", "westjet", "flight", "train", "via rail", "uber", "lyft", "taxi"] },
    { value: "广告与推广", words: ["google ads", "facebook ads", "meta ads", "advertising", "marketing", "promotion"] },
    { value: "通讯", words: ["rogers", "bell", "telus", "internet", "mobile", "phone"] },
    { value: "专业服务", words: ["accounting", "legal", "law", "consulting", "bookkeeping", "professional"] },
    { value: "租金与水电", words: ["rent", "hydro", "electricity", "utility", "utilities", "enbridge"] },
    { value: "银行手续费", words: ["service charge", "bank fee", "monthly fee"] }
  ];

  initialize();

  function initialize() {
    renderRecords();
    bindEvents();
    updateTaxFields();
  }

  function bindEvents() {
    elements.dropZone.addEventListener("click", () => {
      if (!isAnalyzing) elements.receiptInput.click();
    });
    elements.dropZone.addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.key === " ") && !isAnalyzing) {
        event.preventDefault();
        elements.receiptInput.click();
      }
    });
    elements.receiptInput.addEventListener("change", (event) => {
      const [file] = event.target.files;
      if (file) handleFile(file, false);
    });
    ["dragenter", "dragover"].forEach((eventName) => {
      elements.dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        if (!isAnalyzing) elements.dropZone.classList.add("is-dragging");
      });
    });
    ["dragleave", "drop"].forEach((eventName) => {
      elements.dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        elements.dropZone.classList.remove("is-dragging");
      });
    });
    elements.dropZone.addEventListener("drop", (event) => {
      if (isAnalyzing) return;
      const [file] = event.dataTransfer.files;
      if (file) handleFile(file, false);
    });
    elements.demoButton.addEventListener("click", createDemoReceipt);
    elements.total.addEventListener("input", updateSubtotal);
    elements.taxAmount.addEventListener("input", updateSubtotal);
    elements.pstAmount.addEventListener("input", updateSubtotal);
    elements.taxType.addEventListener("change", updateTaxFields);
    elements.recordForm.addEventListener("submit", saveRecord);
    elements.copyButton.addEventListener("click", copyCurrentRecord);
    elements.newReceiptButton.addEventListener("click", resetUploader);
    elements.rotateButton.addEventListener("click", rotatePreview);
    elements.csvButton.addEventListener("click", exportCsv);
    elements.excelButton.addEventListener("click", exportExcel);
    elements.recordsBody.addEventListener("click", handleRecordAction);

    [elements.merchant, elements.date, elements.category, elements.total, elements.taxAmount, elements.pstAmount].forEach((input) => {
      input.addEventListener("input", () => clearFieldError(input.name));
      input.addEventListener("change", () => clearFieldError(input.name));
    });
  }

  async function handleFile(file, isDemo) {
    hideUploadError();
    if (!isDemo) {
      const error = validateFile(file);
      if (error) {
        showUploadError(error);
        elements.receiptInput.value = "";
        return;
      }
    }

    isAnalyzing = true;
    currentFile = file;
    rotation = 0;
    if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
    currentPreviewUrl = URL.createObjectURL(file);
    elements.scanPreview.src = currentPreviewUrl;
    elements.receiptPreview.src = currentPreviewUrl;
    elements.dropZone.hidden = true;
    document.querySelector(".upload-meta").hidden = true;
    document.querySelector(".demo-row").hidden = true;
    elements.analyzingPanel.hidden = false;
    setProgress(8, "准备图片", "正在检查收据内容…");

    try {
      const result = isDemo ? await analyzeDemo() : await analyzeReceipt(file);
      setProgress(100, "识别完成", "收据信息已提取");
      await wait(250);
      showReview(result, file);
    } catch (error) {
      console.error("Receipt analysis failed", error);
      const draft = createFallbackDraft(file);
      showReview(draft, file);
      showToast("自动识别暂不可用，已创建空白草稿，请手动核对。", "error", 5200);
    } finally {
      isAnalyzing = false;
    }
  }

  function validateFile(file) {
    if (!SUPPORTED_TYPES.has(file.type)) return "请选择 JPG、PNG、WebP 或 HEIC 格式的收据图片。";
    if (file.size > MAX_FILE_SIZE) return "图片超过 10 MB，请压缩后再上传。";
    if (file.size === 0) return "这张图片没有内容，请选择另一张收据。";
    return "";
  }

  async function analyzeDemo() {
    const steps = [
      [22, "定位文字区域", "正在查找商家与日期…"],
      [48, "读取金额与税额", "正在识别小计和 HST…"],
      [73, "判断费用分类", "正在匹配费用类别…"],
      [91, "检查识别结果", "正在整理可编辑字段…"]
    ];
    for (const [progress, label, status] of steps) {
      await wait(280);
      setProgress(progress, label, status);
    }
    return {
      merchant: "Maple & Main Office Supply",
      date: "2026-08-19",
      total: 125.98,
      taxAmount: 14.49,
      pstAmount: 0,
      taxType: "HST",
      category: "办公用品",
      confidence: { merchant: 94, date: 97, total: 98, taxAmount: 95, pstAmount: 95 },
      message: "收据包含纸张和打印机墨盒，建议归入“办公用品”。"
    };
  }

  async function analyzeReceipt(file) {
    if (!window.Tesseract) throw new Error("OCR library unavailable");

    let lastProgress = 10;
    const worker = await window.Tesseract.createWorker("eng", 1, {
      logger(message) {
        if (message.status === "recognizing text") {
          const value = Math.max(lastProgress, Math.round(20 + message.progress * 65));
          lastProgress = value;
          setProgress(value, "读取收据文字", `正在识别文字 ${Math.round(message.progress * 100)}%…`);
        } else if (message.status === "loading language traineddata") {
          setProgress(16, "加载本地识别模型", "首次使用需要准备识别能力…");
        }
      }
    });

    try {
      await worker.setParameters({ preserve_interword_spaces: "1" });
      const output = await worker.recognize(file);
      setProgress(90, "整理字段", "正在判断金额、税额与费用分类…");
      let parsed = parseReceiptText(output.data.text, output.data.confidence);

      if ((parsed.taxType === "GST" || parsed.taxType === "待确认") && parsed.pstAmount === 0) {
        lastProgress = 90;
        setProgress(90, "复核省税", "正在用另一种版面模式复核 PST…");
        await worker.setParameters({
          preserve_interword_spaces: "1",
          tessedit_pageseg_mode: "11"
        });
        const retryOutput = await worker.recognize(file);
        const retryParsed = parseReceiptText(
          output.data.text + "\n" + retryOutput.data.text,
          Math.max(output.data.confidence || 0, retryOutput.data.confidence || 0)
        );
        if (retryParsed.taxType === "GST + PST" && retryParsed.pstAmount > 0) parsed = retryParsed;
      }

      await wait(180);
      return parsed;
    } finally {
      await worker.terminate();
    }
  }

  function parseReceiptText(text, overallConfidence) {
    const lines = RECEIPT_PARSER.normalizeLines(text);
    const fullText = lines.join(" ");
    const total = findLabeledAmount(lines, /(?:grand\s*)?total|amount\s*due|balance\s*due/i) ?? findLargestAmount(lines);
    const recognizedTax = RECEIPT_PARSER.parseTaxAmounts(lines);
    const taxAmount = recognizedTax.gstHstAmount ?? 0;
    const rejectedPst = total !== null && recognizedTax.pstAmount >= total;
    const pstAmount = rejectedPst ? 0 : recognizedTax.pstAmount;
    const date = findDate(fullText);
    const merchant = findMerchant(lines);
    const category = suggestCategory(fullText);
    const taxType = rejectedPst
      ? taxAmount > 0 ? "GST" : "待确认"
      : recognizedTax.taxType;
    const baseConfidence = Number.isFinite(overallConfidence) ? Math.round(overallConfidence) : 60;

    return {
      merchant,
      date,
      total,
      taxAmount,
      pstAmount,
      taxType,
      category,
      confidence: {
        merchant: merchant ? Math.min(92, baseConfidence + 4) : 25,
        date: date ? Math.min(94, baseConfidence + 6) : 20,
        total: total ? Math.min(96, baseConfidence + 8) : 20,
        taxAmount: recognizedTax.foundGstHst ? Math.min(94, baseConfidence + 5) : 35,
        pstAmount: recognizedTax.foundPst && !rejectedPst ? Math.min(94, baseConfidence + 5) : 35
      },
      message: category === "其他／待分类"
        ? "未找到明确的分类线索，请根据实际业务用途选择费用分类。"
        : `根据收据中的商家或商品线索，建议归入“${category}”。`
    };
  }

  function findLabeledAmount(lines, labelPattern) {
    const candidates = lines.filter((line) => labelPattern.test(line));
    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const values = extractAmounts(candidates[index]);
      if (values.length) return values[values.length - 1];
    }
    return null;
  }

  function findLargestAmount(lines) {
    const values = lines.flatMap(extractAmounts).filter((value) => value > 0 && value < 10000000);
    return values.length ? Math.max(...values) : null;
  }

  function extractAmounts(line) {
    const matches = line.match(/(?:CAD\s*)?\$?\s*\d{1,6}(?:[,.]\d{2})/gi) || [];
    return matches.map((match) => Number(match.replace(/[^\d.,]/g, "").replace(/,(?=\d{2}$)/, ".").replace(/,/g, ""))).filter(Number.isFinite);
  }

  function findDate(text) {
    let match = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (match) return normalizeDate(Number(match[1]), Number(match[2]), Number(match[3]));

    match = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
    if (match) {
      const first = Number(match[1]);
      const second = Number(match[2]);
      const month = first > 12 ? second : first;
      const day = first > 12 ? first : second;
      return normalizeDate(Number(match[3]), month, day);
    }

    const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    match = text.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(20\d{2})\b/i);
    if (match) return normalizeDate(Number(match[3]), months[match[1].slice(0, 3).toLowerCase()], Number(match[2]));
    return "";
  }

  function normalizeDate(year, month, day) {
    const value = new Date(Date.UTC(year, month - 1, day));
    if (value.getUTCFullYear() !== year || value.getUTCMonth() !== month - 1 || value.getUTCDate() !== day) return "";
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function findMerchant(lines) {
    const excluded = /receipt|invoice|transaction|date|cashier|store\s*#|thank\s*you|welcome|www\.|https?|tel[:.]|subtotal|total|amount|gst|hst|tax|\d{3}[- )]\d{3}/i;
    const line = lines.slice(0, 10).find((value) => {
      const letters = (value.match(/[a-z]/gi) || []).length;
      return letters >= 4 && value.length <= 80 && !excluded.test(value) && !/^\d/.test(value);
    });
    return line ? line.replace(/[^a-z0-9&'(). -]/gi, "").trim() : "";
  }

  function suggestCategory(text) {
    const normalized = text.toLowerCase();
    const match = categories.find((category) => category.words.some((word) => normalized.includes(word)));
    return match ? match.value : "其他／待分类";
  }

  function createFallbackDraft(file) {
    const nameWithoutExtension = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
    return {
      merchant: nameWithoutExtension && !/^image|^img|^receipt|^scan/i.test(nameWithoutExtension) ? nameWithoutExtension : "",
      date: new Date().toISOString().slice(0, 10),
      total: null,
      taxAmount: 0,
      pstAmount: 0,
      taxType: "待确认",
      category: "其他／待分类",
      confidence: { merchant: 20, date: 35, total: 15, taxAmount: 20, pstAmount: 20 },
      message: "自动识别服务暂不可用。已保留收据图片，请手动填写并核对字段。"
    };
  }

  function showReview(result, file) {
    elements.analyzingPanel.hidden = true;
    elements.merchant.value = result.merchant || "";
    elements.date.value = result.date || "";
    elements.total.value = result.total === null || result.total === undefined ? "" : Number(result.total).toFixed(2);
    elements.taxAmount.value = result.taxAmount === null || result.taxAmount === undefined ? "" : Number(result.taxAmount).toFixed(2);
    elements.pstAmount.value = result.pstAmount === null || result.pstAmount === undefined ? "" : Number(result.pstAmount).toFixed(2);
    elements.taxType.value = result.taxType || "待确认";
    elements.category.value = result.category || "其他／待分类";
    elements.notes.value = "";
    elements.suggestionText.textContent = result.message;
    elements.fileName.textContent = file.name;
    elements.fileSize.textContent = formatFileSize(file.size);
    updateConfidence(result.confidence);
    updateTaxFields();
    clearAllErrors();
    elements.review.hidden = false;
    elements.review.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    elements.srStatus.textContent = "收据识别完成，请核对识别结果。";
    window.setTimeout(() => elements.merchant.focus({ preventScroll: true }), reducedMotion() ? 0 : 450);
  }

  function updateConfidence(confidence) {
    const fields = [
      ["merchant", elements.merchantConfidence],
      ["date", elements.dateConfidence],
      ["total", elements.totalConfidence],
      ["taxAmount", elements.taxConfidence]
    ];
    if (elements.taxType.value === "GST + PST") fields.push(["pstAmount", elements.pstConfidence]);
    let recognized = 1;
    let hasLow = false;
    fields.forEach(([key, element]) => {
      const value = confidence[key] || 0;
      const low = value < 65;
      if (value >= 65) recognized += 1;
      hasLow ||= low;
      element.textContent = low ? "需要核对" : "识别把握高";
      element.classList.toggle("low", low);
    });
    elements.confidenceBadge.classList.toggle("low", hasLow);
    elements.confidenceBadge.lastChild.textContent = hasLow ? ` 已提取 ${recognized} 项 · 请核对` : ` 已提取 ${recognized} 项`;
  }

  function saveRecord(event) {
    event.preventDefault();
    if (!validateForm()) {
      showToast("有几项信息需要补充或修改。", "error");
      return;
    }

    const breakdown = TAX.calculateTaxBreakdown({
      total: elements.total.value,
      gstHstAmount: elements.taxAmount.value,
      pstAmount: elements.pstAmount.value,
      taxType: elements.taxType.value
    });
    const { total, gstHstAmount, pstAmount, totalTax, subtotal } = breakdown;
    const record = {
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      date: elements.date.value,
      merchant: elements.merchant.value.trim(),
      category: elements.category.value,
      total,
      gstHstAmount,
      pstAmount,
      totalTax,
      taxAmount: totalTax,
      subtotal,
      taxType: elements.taxType.value,
      notes: elements.notes.value.trim(),
      sourceName: currentFile?.name || "",
      createdAt: new Date().toISOString()
    };

    records.unshift(record);
    if (!persistRecords()) {
      records.shift();
      showToast("记录保存失败，浏览器存储空间可能不足。请先导出已有记录。", "error", 5200);
      return;
    }

    renderRecords();
    showToast(`已保存：${record.merchant} · ${formatMoney(record.total)}`);
    elements.srStatus.textContent = "记录保存成功。";
    resetUploader(false);
    document.querySelector("#records").scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  }

  function validateForm() {
    clearAllErrors();
    const errors = [];
    const merchant = elements.merchant.value.trim();
    const total = Number(elements.total.value);
    const gstHst = elements.taxAmount.value.trim() === "" ? Number.NaN : Number(elements.taxAmount.value);
    const includesPst = elements.taxType.value === "GST + PST";
    const pst = includesPst
      ? elements.pstAmount.value.trim() === "" ? Number.NaN : Number(elements.pstAmount.value)
      : 0;
    const totalTax = Number.isFinite(gstHst) && Number.isFinite(pst)
      ? TAX.calculateTaxBreakdown({ total, gstHstAmount: gstHst, pstAmount: pst, taxType: elements.taxType.value }).totalTax
      : Number.NaN;

    if (!merchant) errors.push(["merchant", "请输入或核对商家名称。"]);
    if (!elements.date.value) errors.push(["date", "请选择交易日期。"]);
    if (!elements.category.value) errors.push(["category", "请选择费用分类。"]);
    if (!Number.isFinite(total) || total <= 0) errors.push(["total", "请输入大于 0 的含税总额。"]);
    if (!Number.isFinite(gstHst) || gstHst < 0) errors.push(["taxAmount", "GST/HST 税额不能小于 0。"]);
    if (includesPst && (!Number.isFinite(pst) || pst < 0)) errors.push(["pstAmount", "请输入有效的 PST 税额。"]);
    if (Number.isFinite(total) && Number.isFinite(totalTax) && totalTax > total) {
      errors.push([includesPst ? "pstAmount" : "taxAmount", "总税额不能高于含税总额。"]);
    }

    errors.forEach(([name, message]) => setFieldError(name, message));
    if (errors.length) {
      const first = elements.recordForm.elements[errors[0][0]];
      first.focus();
      return false;
    }
    return true;
  }

  function setFieldError(name, message) {
    const input = elements.recordForm.elements[name];
    const field = input.closest(".form-field");
    const error = document.querySelector(`#${CSS.escape(name)}Error`);
    field.classList.add("has-error");
    input.setAttribute("aria-invalid", "true");
    if (error) {
      error.textContent = message;
      input.setAttribute("aria-describedby", error.id);
    }
  }

  function clearFieldError(name) {
    const input = elements.recordForm.elements[name];
    if (!input) return;
    const field = input.closest(".form-field");
    const error = document.querySelector(`#${CSS.escape(name)}Error`);
    field?.classList.remove("has-error");
    input.removeAttribute("aria-invalid");
    input.removeAttribute("aria-describedby");
    if (error) error.textContent = "";
  }

  function clearAllErrors() {
    ["merchant", "date", "category", "total", "taxAmount", "pstAmount"].forEach(clearFieldError);
  }

  function updateSubtotal() {
    const { totalTax, subtotal } = TAX.calculateTaxBreakdown({
      total: elements.total.value,
      gstHstAmount: elements.taxAmount.value,
      pstAmount: elements.pstAmount.value,
      taxType: elements.taxType.value
    });
    elements.totalTax.textContent = formatMoney(totalTax);
    elements.subtotal.textContent = subtotal >= 0 ? formatMoney(subtotal) : "—";
  }

  function updateTaxFields() {
    const type = elements.taxType.value;
    const includesPst = type === "GST + PST";
    elements.pstField.hidden = !includesPst;
    elements.pstAmount.required = includesPst;
    elements.gstHstLabel.textContent = type === "HST" ? "HST 税额" : type === "GST" || includesPst ? "GST 税额" : "GST/HST 税额";
    if (!includesPst) clearFieldError("pstAmount");
    updateSubtotal();
  }

  async function copyCurrentRecord() {
    if (!validateForm()) {
      showToast("请先补充需要核对的字段，再复制结果。", "error");
      return;
    }
    const primaryTaxLabel = elements.taxType.value === "HST"
      ? "HST"
      : elements.taxType.value === "GST" || elements.taxType.value === "GST + PST"
        ? "GST"
        : "GST/HST";
    const text = [
      `商家：${elements.merchant.value.trim()}`,
      `日期：${elements.date.value}`,
      `分类：${elements.category.value}`,
      `税前金额：${elements.subtotal.textContent}`,
      `${primaryTaxLabel}：${formatMoney(Number(elements.taxAmount.value))}`,
      elements.taxType.value === "GST + PST" ? `PST：${formatMoney(Number(elements.pstAmount.value))}` : "",
      `总税额：${elements.totalTax.textContent}`,
      `含税总额：${formatMoney(Number(elements.total.value))}`,
      elements.notes.value.trim() ? `备注：${elements.notes.value.trim()}` : ""
    ].filter(Boolean).join("\n");

    try {
      await copyText(text);
      showToast("识别结果已复制到剪贴板。 ");
    } catch (error) {
      console.error("Copy failed", error);
      showToast("复制失败，请检查浏览器的剪贴板权限。", "error");
    }
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const successful = document.execCommand("copy");
    textarea.remove();
    if (!successful) throw new Error("Copy command failed");
  }

  function renderRecords() {
    elements.recordCount.textContent = String(records.length);
    elements.emptyRecords.hidden = records.length > 0;
    elements.recordsTableWrap.hidden = records.length === 0;
    elements.recordsBody.replaceChildren();

    records.forEach((record) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td data-label="日期">${escapeHtml(formatDate(record.date))}</td>
        <td data-label="商家" class="merchant-cell">${escapeHtml(record.merchant)}</td>
        <td data-label="费用分类"><span class="category-chip">${escapeHtml(record.category)}</span></td>
        <td data-label="税前金额" class="amount-cell">${escapeHtml(formatMoney(getRecordSubtotal(record)))}</td>
        <td data-label="总税额" class="amount-cell">${escapeHtml(formatMoney(getRecordTotalTax(record)))}</td>
        <td data-label="含税总额" class="amount-cell total-cell">${escapeHtml(formatMoney(record.total))}</td>
        <td class="delete-cell"><button class="delete-button" type="button" data-delete-id="${escapeHtml(record.id)}" aria-label="删除 ${escapeHtml(record.merchant)} 的记录">删除</button></td>
      `;
      elements.recordsBody.appendChild(row);
    });
  }

  function handleRecordAction(event) {
    const button = event.target.closest("[data-delete-id]");
    if (!button) return;
    const record = records.find((item) => item.id === button.dataset.deleteId);
    if (!record) return;
    const confirmed = window.confirm(`确定删除“${record.merchant}”这笔 ${formatMoney(record.total)} 的记录吗？`);
    if (!confirmed) return;
    records = records.filter((item) => item.id !== record.id);
    persistRecords();
    renderRecords();
    showToast("记录已删除。 ");
  }

  function exportCsv() {
    if (!records.length) {
      showToast("还没有可导出的记录，请先保存一张收据。", "error");
      return;
    }
    const headers = ["日期", "商家", "费用分类", "税前金额(CAD)", "税种", "GST/HST税额(CAD)", "PST税额(CAD)", "总税额(CAD)", "含税总额(CAD)", "备注", "来源文件"];
    const rows = records.map((record) => {
      const totalTax = getRecordTotalTax(record);
      return [record.date, record.merchant, record.category, getRecordSubtotal(record).toFixed(2), record.taxType, getRecordGstHst(record).toFixed(2), getRecordPst(record).toFixed(2), totalTax.toFixed(2), record.total.toFixed(2), record.notes, record.sourceName];
    });
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    downloadBlob(`记账记录-${today()}.csv`, `\ufeff${csv}`, "text/csv;charset=utf-8");
    showToast(`CSV 已导出，共 ${records.length} 笔记录。`);
  }

  function exportExcel() {
    if (!records.length) {
      showToast("还没有可导出的记录，请先保存一张收据。", "error");
      return;
    }
    const headers = ["日期", "商家", "费用分类", "税前金额(CAD)", "税种", "GST/HST税额(CAD)", "PST税额(CAD)", "总税额(CAD)", "含税总额(CAD)", "备注", "来源文件"];
    const rows = records.map((record) => [
      { value: record.date, type: "String" },
      { value: record.merchant, type: "String" },
      { value: record.category, type: "String" },
      { value: getRecordSubtotal(record).toFixed(2), type: "Number" },
      { value: record.taxType, type: "String" },
      { value: getRecordGstHst(record).toFixed(2), type: "Number" },
      { value: getRecordPst(record).toFixed(2), type: "Number" },
      { value: getRecordTotalTax(record).toFixed(2), type: "Number" },
      { value: record.total.toFixed(2), type: "Number" },
      { value: record.notes, type: "String" },
      { value: record.sourceName, type: "String" }
    ]);
    const headerXml = headers.map((value) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`).join("");
    const bodyXml = rows.map((row) => `<Row>${row.map((cell, index) => `<Cell${[3, 5, 6, 7, 8].includes(index) ? ' ss:StyleID="Money"' : ""}><Data ss:Type="${cell.type}">${escapeXml(cell.value)}</Data></Cell>`).join("")}</Row>`).join("");
    const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#E5F3EB" ss:Pattern="Solid"/></Style>
    <Style ss:ID="Money"><NumberFormat ss:Format="$0.00"/></Style>
  </Styles>
  <Worksheet ss:Name="记账记录"><Table><Row>${headerXml}</Row>${bodyXml}</Table></Worksheet>
</Workbook>`;
    downloadBlob(`记账记录-${today()}.xls`, workbook, "application/vnd.ms-excel;charset=utf-8");
    showToast(`Excel 已导出，共 ${records.length} 笔记录。`);
  }

  function downloadBlob(filename, content, type) {
    try {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("Export failed", error);
      showToast("导出失败，请稍后重试。", "error");
    }
  }

  function createDemoReceipt() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="980" viewBox="0 0 700 980">
      <rect width="700" height="980" fill="#e8ece9"/>
      <g transform="translate(95 35) rotate(-1 255 450)">
        <rect width="510" height="900" rx="4" fill="white"/>
        <g fill="#1e2a24" font-family="Arial, sans-serif" text-anchor="middle">
          <text x="255" y="70" font-size="25" font-weight="700">MAPLE &amp; MAIN</text>
          <text x="255" y="102" font-size="18">OFFICE SUPPLY</text>
          <text x="255" y="138" font-size="13">123 King Street West</text>
          <text x="255" y="160" font-size="13">Toronto, ON  M5H 2N2</text>
          <text x="255" y="194" font-size="12">HST # 81234 5678 RT0001</text>
        </g>
        <g fill="#1e2a24" font-family="monospace" font-size="14">
          <text x="42" y="245">DATE</text><text x="340" y="245">2026-08-19</text>
          <path d="M42 270H468" stroke="#1e2a24" stroke-dasharray="4 5"/>
          <text x="42" y="310">Premium copy paper</text><text x="395" y="310">42.99</text>
          <text x="42" y="348">Black printer ink</text><text x="395" y="348">68.50</text>
          <path d="M42 385H468" stroke="#1e2a24" stroke-dasharray="4 5"/>
          <text x="42" y="430">SUBTOTAL</text><text x="395" y="430">111.49</text>
          <text x="42" y="468">HST 13%</text><text x="395" y="468">14.49</text>
          <text x="42" y="520" font-size="19" font-weight="700">TOTAL</text><text x="385" y="520" font-size="19" font-weight="700">$125.98</text>
          <text x="42" y="582">VISA</text><text x="365" y="582">********2048</text>
          <path d="M42 620H468" stroke="#1e2a24" stroke-dasharray="4 5"/>
          <text x="255" y="680" text-anchor="middle">THANK YOU FOR SHOPPING LOCAL</text>
          <text x="255" y="720" text-anchor="middle">mapleandmain.ca</text>
          <g transform="translate(130 770)" stroke="#1e2a24">
            ${Array.from({ length: 34 }, (_, index) => `<path d="M${index * 7} 0v55" stroke-width="${index % 4 === 0 ? 4 : index % 3 === 0 ? 2 : 1}"/>`).join("")}
          </g>
        </g>
      </g>
    </svg>`;
    const file = new File([svg], "Maple-Main-示例收据.svg", { type: "image/svg+xml", lastModified: Date.now() });
    handleFile(file, true);
  }

  function resetUploader(scroll = true) {
    elements.review.hidden = true;
    elements.analyzingPanel.hidden = true;
    elements.dropZone.hidden = false;
    document.querySelector(".upload-meta").hidden = false;
    document.querySelector(".demo-row").hidden = false;
    elements.receiptInput.value = "";
    elements.dropZone.classList.remove("is-dragging");
    currentFile = null;
    rotation = 0;
    elements.receiptPreview.style.transform = "rotate(0deg)";
    if (scroll) {
      document.querySelector("#upload").scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
      elements.dropZone.focus({ preventScroll: true });
    }
  }

  function rotatePreview() {
    rotation = (rotation + 90) % 360;
    elements.receiptPreview.style.transform = `rotate(${rotation}deg)`;
    elements.srStatus.textContent = `收据图片已旋转 ${rotation} 度。`;
  }

  function setProgress(value, label, status) {
    const progress = Math.max(0, Math.min(100, Math.round(value)));
    elements.progressBar.style.width = `${progress}%`;
    elements.progressValue.textContent = `${progress}%`;
    elements.progressLabel.textContent = label;
    elements.analysisStatus.textContent = status;
  }

  function showUploadError(message) {
    elements.uploadError.querySelector("span").textContent = message;
    elements.uploadError.hidden = false;
    elements.srStatus.textContent = message;
  }

  function hideUploadError() {
    elements.uploadError.hidden = true;
    elements.uploadError.querySelector("span").textContent = "";
  }

  function showToast(message, type = "success", duration = 3600) {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    toast.innerHTML = `<span class="toast-icon" aria-hidden="true">${type === "error" ? "!" : "✓"}</span><span>${escapeHtml(message)}</span>`;
    elements.toastRegion.appendChild(toast);
    window.setTimeout(() => toast.remove(), duration);
  }

  function loadRecords() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(stored) ? stored.filter(isValidRecord) : [];
    } catch (error) {
      console.warn("Stored records could not be loaded", error);
      return [];
    }
  }

  function persistRecords() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      return true;
    } catch (error) {
      console.error("Stored records could not be saved", error);
      return false;
    }
  }

  function isValidRecord(record) {
    return record && typeof record.id === "string" && typeof record.merchant === "string" && Number.isFinite(record.total);
  }

  function getRecordGstHst(record) {
    return TAX.getRecordTaxBreakdown(record).gstHstAmount;
  }

  function getRecordPst(record) {
    return TAX.getRecordTaxBreakdown(record).pstAmount;
  }

  function getRecordTotalTax(record) {
    return TAX.getRecordTaxBreakdown(record).totalTax;
  }

  function getRecordSubtotal(record) {
    return TAX.getRecordTaxBreakdown(record).subtotal;
  }

  function formatMoney(value) {
    return CURRENCY.format(Number(value) || 0);
  }

  function formatDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return value || "—";
    const [year, month, day] = value.split("-");
    return `${year}/${month}/${day}`;
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function roundMoney(value) {
    return TAX.roundMoney(value);
  }

  function csvCell(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  function escapeHtml(value) {
    const span = document.createElement("span");
    span.textContent = String(value ?? "");
    return span.innerHTML;
  }

  function escapeXml(value) {
    return String(value ?? "").replace(/[<>&'"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character]);
  }

  function reducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function today() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function wait(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }
})();
