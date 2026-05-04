const AUDIT50_WARNING_BUILD = "audit-50-cache-v5";
const STORAGE_KEY = "cpp_professional_omr_protocol_v1";

function byId(id) {
  return document.getElementById(id);
}

function loadProtocolFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function normalizeWarnings(protocol) {
  const warnings = protocol?.ocr?.warnings;
  if (!Array.isArray(warnings)) return [];
  return warnings.map(item => String(item || "").trim()).filter(Boolean);
}

function renderWarningsIfNeeded() {
  const status = byId("processingStatus");
  if (!status) return;

  const current = status.textContent || "";
  if (!current.includes("Processamento concluído.")) return;
  if (current.includes("Avisos OCR:")) return;

  const protocol = loadProtocolFromStorage();
  const ocrStatus = protocol?.source?.ocr_status || protocol?.ocr?.status || "";
  const warnings = normalizeWarnings(protocol);

  if (!warnings.length) return;
  if (ocrStatus !== "unavailable" && ocrStatus !== "failed" && ocrStatus !== "pending") return;

  const warningText = [
    "",
    "Avisos OCR:",
    ...warnings.map(warning => `- ${warning}`),
  ].join("\n");

  status.textContent = `${current.trim()}\n${warningText}`;
}

function markBuild() {
  const build = byId("frontendBuild");
  if (build) build.textContent = `Frontend build: ${AUDIT50_WARNING_BUILD}`;
}

function observeProcessingStatus() {
  const status = byId("processingStatus");
  if (!status) return;

  const observer = new MutationObserver(() => {
    window.setTimeout(renderWarningsIfNeeded, 0);
  });
  observer.observe(status, { childList: true, characterData: true, subtree: true });
  window.setTimeout(renderWarningsIfNeeded, 0);
}

function initAudit50WarningPanel() {
  markBuild();
  observeProcessingStatus();
  window.setTimeout(renderWarningsIfNeeded, 250);
  window.setTimeout(renderWarningsIfNeeded, 1000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAudit50WarningPanel);
} else {
  initAudit50WarningPanel();
}
