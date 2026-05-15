/* ==============================
   State
   ============================== */
let selectedTf = "2m";
let selectedFile = null;

/* ==============================
   DOM refs
   ============================== */
const apiKeyInput    = document.getElementById("apiKey");
const toggleKeyBtn   = document.getElementById("toggleKey");
const dropZone       = document.getElementById("dropZone");
const fileInput      = document.getElementById("fileInput");
const dropContent    = document.getElementById("dropContent");
const previewCont    = document.getElementById("previewContainer");
const previewImg     = document.getElementById("previewImg");
const removeImgBtn   = document.getElementById("removeImg");
const tfButtons      = document.querySelectorAll(".tf-btn");
const analyzeBtn     = document.getElementById("analyzeBtn");
const btnText        = document.getElementById("btnText");
const btnSpinner     = document.getElementById("btnSpinner");
const statusDot      = document.getElementById("statusDot");
const statusText     = document.getElementById("statusText");
const emptyState     = document.getElementById("emptyState");
const resultContent  = document.getElementById("resultContent");
const toast          = document.getElementById("toast");

/* ==============================
   API Key toggle
   ============================== */
toggleKeyBtn.addEventListener("click", () => {
  if (apiKeyInput.type === "password") {
    apiKeyInput.type = "text";
    toggleKeyBtn.innerHTML = "&#128273;";
  } else {
    apiKeyInput.type = "password";
    toggleKeyBtn.innerHTML = "&#128065;";
  }
});

/* ==============================
   Timeframe selection
   ============================== */
tfButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    tfButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedTf = btn.dataset.tf;
  });
});

/* ==============================
   File handling
   ============================== */
dropZone.addEventListener("click", (e) => {
  if (!e.target.closest(".remove-img")) fileInput.click();
});

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) loadFile(file);
});

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) loadFile(fileInput.files[0]);
});

removeImgBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  clearFile();
});

function loadFile(file) {
  const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
  if (!allowed.includes(file.type)) {
    showToast("Only PNG, JPG, and WebP images are supported.");
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    showToast("Image too large. Max 20MB.");
    return;
  }

  selectedFile = file;
  const url = URL.createObjectURL(file);
  previewImg.src = url;
  dropContent.style.display = "none";
  previewCont.style.display = "block";
  updateAnalyzeBtn();
}

function clearFile() {
  selectedFile = null;
  fileInput.value = "";
  previewImg.src = "";
  previewCont.style.display = "none";
  dropContent.style.display = "flex";
  updateAnalyzeBtn();
}

function updateAnalyzeBtn() {
  const hasKey  = apiKeyInput.value.trim().length > 10;
  const hasFile = selectedFile !== null;
  analyzeBtn.disabled = !(hasKey && hasFile);
}

apiKeyInput.addEventListener("input", updateAnalyzeBtn);

/* ==============================
   Analyze
   ============================== */
analyzeBtn.addEventListener("click", runAnalysis);

async function runAnalysis() {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) { showToast("Please enter your Anthropic API key."); return; }
  if (!selectedFile) { showToast("Please upload a chart screenshot."); return; }

  setLoading(true);

  const formData = new FormData();
  formData.append("screenshot", selectedFile);
  formData.append("timeframe", selectedTf);
  formData.append("api_key", apiKey);

  try {
    const resp = await fetch("/analyze", { method: "POST", body: formData });
    const data = await resp.json();

    if (!resp.ok) {
      showToast(data.detail || "Analysis failed. Check your API key and try again.");
      setLoading(false);
      return;
    }

    renderResult(data);
  } catch (err) {
    showToast("Network error. Make sure the server is running.");
    console.error(err);
  } finally {
    setLoading(false);
  }
}

/* ==============================
   Render Result
   ============================== */
function renderResult(data) {
  const signal     = (data.signal || "NEUTRAL").toUpperCase();
  const confidence = data.confidence ?? 0;
  const entry      = data.entry_recommendation || "--";
  const summary    = data.summary || "";

  // Show result panel
  emptyState.style.display = "none";
  resultContent.style.display = "flex";
  resultContent.style.flexDirection = "column";
  resultContent.style.gap = "16px";
  resultContent.classList.add("fade-in");

  // Signal card
  const signalCard = document.getElementById("signalCard");
  signalCard.className = "signal-card " + signal.toLowerCase();
  document.getElementById("signalDirection").textContent = signal;
  document.getElementById("signalArrow").className = "signal-arrow";

  document.getElementById("confidenceValue").textContent = confidence + "%";
  document.getElementById("confidenceFill").style.width = confidence + "%";

  const entryShort = entry.replace("ENTER NOW", "ENTER NOW ✓")
                          .replace("WAIT FOR CONFIRMATION", "WAIT ...")
                          .replace("SKIP THIS TRADE", "SKIP ✗");
  document.getElementById("entryValue").textContent = entryShort;
  document.getElementById("tfSelected").textContent = selectedTf;

  // Summary
  document.getElementById("summaryText").textContent = summary;

  // Confluence
  const conf = data.confluence_score || {};
  const bull = conf.bullish_signals ?? 0;
  const bear = conf.bearish_signals ?? 0;
  const neut = conf.neutral_signals ?? 0;
  const total = bull + bear + neut || 1;

  document.getElementById("confBull").textContent = bull;
  document.getElementById("confBear").textContent = bear;
  document.getElementById("confNeut").textContent = neut;
  document.getElementById("confBarBull").style.width = (bull / total * 100) + "%";
  document.getElementById("confBarBear").style.width = (bear / total * 100) + "%";
  document.getElementById("confBarNeut").style.width = (neut / total * 100) + "%";

  // Indicators
  renderIndicators(data.indicators || {});

  // Risk
  const risk = data.risk_assessment || {};
  const riskEl = document.getElementById("riskLevel");
  riskEl.textContent = (risk.level || "MEDIUM") + " RISK";
  riskEl.className = "risk-level " + (risk.level || "MEDIUM");
  document.getElementById("riskNotes").textContent = risk.notes || "";

  // Entry details
  const tfAnalysis = data.timeframe_analysis || {};
  document.getElementById("optimalEntry").textContent = tfAnalysis.optimal_entry || "--";
  document.getElementById("keyLevels").textContent = tfAnalysis.key_levels || "";

  // Footer
  const tokens = data.input_tokens && data.output_tokens
    ? `Tokens: ${data.input_tokens} in / ${data.output_tokens} out`
    : "";
  const model = data.model_used ? `Model: ${data.model_used}` : "";
  const now = new Date().toLocaleTimeString();
  document.getElementById("analysisFooter").textContent =
    [now, model, tokens].filter(Boolean).join(" · ");
}

/* ==============================
   Indicators
   ============================== */
const INDICATOR_CONFIG = {
  candlestick_patterns: { label: "Candlestick Patterns", icon: "🕯" },
  macd:                 { label: "MACD (12,26,9)", icon: "📊" },
  ema_alignment:        { label: "EMA 8/15/35", icon: "〰" },
  stochastic:           { label: "Stochastic (14,3,3)", icon: "⚡" },
  zigzag:               { label: "ZigZag", icon: "🔀" },
  vortex:               { label: "Vortex (14)", icon: "🌀" },
};

function renderIndicators(indicators) {
  const grid = document.getElementById("indicatorsGrid");
  grid.innerHTML = "";

  Object.entries(INDICATOR_CONFIG).forEach(([key, cfg]) => {
    const data = indicators[key];
    if (!data) return;

    const sig = (data.signal || "NEUTRAL").toUpperCase();
    const desc = data.description || "";
    const strength = data.strength || "";

    let extraHTML = "";

    if (key === "candlestick_patterns" && data.patterns_detected?.length) {
      const tags = data.patterns_detected.map(p => `<span class="ind-tag">${p}</span>`).join("");
      extraHTML = `<div class="ind-extra">${tags}</div>`;
    }
    if (key === "macd") {
      const parts = [data.histogram, data.crossover !== "NONE" ? data.crossover : null, data.divergence !== "NONE" ? `DIV: ${data.divergence}` : null]
        .filter(Boolean).map(p => `<span class="ind-tag">${p}</span>`).join("");
      if (parts) extraHTML = `<div class="ind-extra">${parts}</div>`;
    }
    if (key === "ema_alignment") {
      const parts = [
        data.ema8_position ? `EMA8: ${data.ema8_position.replace("_PRICE", "")}` : null,
        data.ema15_position ? `EMA15: ${data.ema15_position.replace("_PRICE", "")}` : null,
        data.ema35_position ? `EMA35: ${data.ema35_position.replace("_PRICE", "")}` : null,
        data.alignment ? data.alignment : null,
      ].filter(Boolean).map(p => `<span class="ind-tag">${p}</span>`).join("");
      if (parts) extraHTML = `<div class="ind-extra">${parts}</div>`;
    }
    if (key === "stochastic") {
      const parts = [
        data.k_value ? `%K: ${data.k_value}` : null,
        data.zone ? data.zone : null,
        data.crossover !== "NONE" ? data.crossover : null,
      ].filter(Boolean).map(p => `<span class="ind-tag">${p}</span>`).join("");
      if (parts) extraHTML = `<div class="ind-extra">${parts}</div>`;
    }
    if (key === "zigzag") {
      const parts = [data.trend_structure, data.last_pivot ? `Last: ${data.last_pivot}` : null]
        .filter(Boolean).map(p => `<span class="ind-tag">${p}</span>`).join("");
      if (parts) extraHTML = `<div class="ind-extra">${parts}</div>`;
    }
    if (key === "vortex") {
      const parts = [
        data.vi_plus ? `VI+: ${data.vi_plus}` : null,
        data.vi_minus ? `VI-: ${data.vi_minus}` : null,
        data.crossover !== "NONE" ? data.crossover : null,
      ].filter(Boolean).map(p => `<span class="ind-tag">${p}</span>`).join("");
      if (parts) extraHTML = `<div class="ind-extra">${parts}</div>`;
    }

    const el = document.createElement("div");
    el.className = "indicator-item";
    el.innerHTML = `
      <div class="ind-header">
        <span class="ind-name">${cfg.label}</span>
        <span class="ind-signal ${sig}">${sig}</span>
      </div>
      ${strength ? `<div class="ind-strength">${strength}</div>` : ""}
      <div class="ind-desc">${desc}</div>
      ${extraHTML}
    `;
    grid.appendChild(el);
  });
}

/* ==============================
   Loading State
   ============================== */
function setLoading(isLoading) {
  analyzeBtn.disabled = isLoading;
  analyzeBtn.classList.toggle("loading", isLoading);
  btnText.style.display = isLoading ? "none" : "inline";
  btnSpinner.style.display = isLoading ? "block" : "none";
  statusDot.className = "status-dot" + (isLoading ? " loading" : "");
  statusText.textContent = isLoading ? "Analyzing..." : "Ready";
}

/* ==============================
   Toast
   ============================== */
let toastTimer = null;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 4000);
}
