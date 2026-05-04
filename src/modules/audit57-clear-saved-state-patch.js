const AUDIT57_CLEAR_BUILD = "audit-57-cache-v2";
const PROTOCOL_STORAGE_KEY = "cpp_professional_omr_protocol_v1";

function byId(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const el = byId(id);
  if (el) el.textContent = value;
}

function clearInput(id) {
  const el = byId(id);
  if (el) el.value = "";
}

async function unregisterServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map(reg => reg.unregister()));
}

async function clearCppCaches() {
  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith("cpp-professional-omr-")).map(key => caches.delete(key)));
}

function clearSavedProtocolState() {
  localStorage.removeItem(PROTOCOL_STORAGE_KEY);
  sessionStorage.removeItem(PROTOCOL_STORAGE_KEY);
}

function clearVisibleMusicState() {
  clearInput("fileInput");
  clearInput("musicTitle");
  clearInput("musicKey");
  clearInput("meterDefault");
  clearInput("tempo");

  setText("fileInfo", "Nenhum arquivo selecionado.");
  setText("processingStatus", "Aguardando arquivo.");
  setText("measureFeedback", "Nenhum compasso carregado.");
  setText("ocrBlockDetails", "Nenhum bloco OCR carregado.");
  setText("reviewHistoryDetails", "Nenhuma decisão humana registrada.");
  setText("technicalOutput", "");
  setText("playableOutput", "");
  setText("uncertaintyOutput", "");
  setText("detectionOutput", "");
  setText("frontendErrorLog", "Nenhum erro operacional registrado nesta sessão.");

  const metadata = byId("musicMetadataStatusAudit56");
  if (metadata) {
    metadata.textContent = [
      "Metadados musicais do protocolo",
      "Tom: pendente — nenhum protocolo carregado",
      "Compasso padrão: pendente — nenhum protocolo carregado",
      "Andamento: pendente — nenhum protocolo carregado",
      "Regra: não inferir tom, compasso ou andamento sem evidência explícita no MusicXML/protocolo.",
      "Audit: audit-57-clear-state",
    ].join("\n");
  }

  ["measuresList", "ocrBlocksList", "reviewHistoryList"].forEach(id => {
    const el = byId(id);
    if (el) el.innerHTML = "";
  });
}

async function clearAppCacheAndSavedState(event) {
  event?.preventDefault?.();
  event?.stopImmediatePropagation?.();
  event?.stopPropagation?.();

  clearSavedProtocolState();
  clearVisibleMusicState();
  await unregisterServiceWorkers();
  await clearCppCaches();
  location.reload();
}

function bindClearButton() {
  const button = byId("btnClearFrontendCache");
  if (!button) return;
  button.addEventListener("click", clearAppCacheAndSavedState, true);
}

function markBuild() {
  window.CPP_ACTIVE_BUILD = AUDIT57_CLEAR_BUILD;
  const build = byId("frontendBuild");
  if (build) build.textContent = `Frontend build: ${AUDIT57_CLEAR_BUILD}`;
}

function loadAuditGeometryReleaseExportAndReviewPatches() {
  setTimeout(() => {
    import("./audit58-3-measure-bbox-derivation.js").catch(() => {});
    import("./audit58-4-manual-barline-adjustment.js").catch(() => {});
    import("./audit58-5-measure-evidence-review.js").catch(() => {});
    import("./audit59-playable-release.js").catch(() => {});
    import("./audit60-final-export-package.js").catch(() => {});
    import("./audit65-assisted-musical-review-desk.js").catch(() => {});
  }, 250);
}

function initAudit57ClearSavedStatePatch() {
  markBuild();
  bindClearButton();
  loadAuditGeometryReleaseExportAndReviewPatches();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAudit57ClearSavedStatePatch);
} else {
  initAudit57ClearSavedStatePatch();
}
