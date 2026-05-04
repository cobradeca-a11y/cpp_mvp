const AUDIT56_CROSS_BUILD = "audit-56-cache-v2";
const STORAGE_KEY = "cpp_professional_omr_protocol_v1";

function byId(id) {
  return document.getElementById(id);
}

function safeJsonParse(raw, fallback = {}) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function loadProtocol() {
  return safeJsonParse(localStorage.getItem(STORAGE_KEY), {});
}

function currentBuild() {
  return window.CPP_ACTIVE_BUILD || AUDIT56_CROSS_BUILD;
}

function markActiveBuild() {
  window.CPP_ACTIVE_BUILD = AUDIT56_CROSS_BUILD;
  const build = byId("frontendBuild");
  if (build) build.textContent = `Frontend build: ${currentBuild()}`;
}

function fieldValue(value) {
  return String(value || "").trim();
}

function syncMusicMetadataFields() {
  const protocol = loadProtocol();
  const music = protocol?.music || {};

  const title = byId("musicTitle");
  const key = byId("musicKey");
  const meter = byId("meterDefault");
  const tempo = byId("tempo");

  if (title && fieldValue(music.title)) title.value = fieldValue(music.title);
  if (key) key.value = fieldValue(music.key);
  if (meter) meter.value = fieldValue(music.meter_default);
  if (tempo) tempo.value = fieldValue(music.tempo);

  renderMetadataStatus(music);
}

function renderMetadataStatus(music = {}) {
  let box = byId("musicMetadataStatusAudit56");
  const host = byId("tempo")?.closest?.(".card");
  if (!box && host) {
    box = document.createElement("pre");
    box.id = "musicMetadataStatusAudit56";
    box.className = "report small-report";
    host.appendChild(box);
  }
  if (!box) return;

  const key = fieldValue(music.key);
  const meter = fieldValue(music.meter_default);
  const tempo = fieldValue(music.tempo);

  box.textContent = [
    "Metadados musicais do protocolo",
    `Tom: ${key || "pendente — não detectado de forma confiável"}`,
    `Compasso padrão: ${meter || "pendente — não detectado de forma confiável"}`,
    `Andamento: ${tempo || "pendente — não detectado de forma confiável"}`,
    "Regra: não inferir tom, compasso ou andamento sem evidência explícita no MusicXML/protocolo.",
    "Audit: audit-56-cross-validation",
  ].join("\n");
}

function writeInputsBackToProtocol() {
  const protocol = loadProtocol();
  protocol.music ||= {};
  protocol.music.title = fieldValue(byId("musicTitle")?.value) || protocol.music.title || "";
  protocol.music.key = fieldValue(byId("musicKey")?.value);
  protocol.music.meter_default = fieldValue(byId("meterDefault")?.value);
  protocol.music.tempo = fieldValue(byId("tempo")?.value);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(protocol));
  renderMetadataStatus(protocol.music);
}

function bindMetadataInputs() {
  ["musicTitle", "musicKey", "meterDefault", "tempo"].forEach(id => {
    const input = byId(id);
    if (!input) return;
    input.addEventListener("change", writeInputsBackToProtocol);
    input.addEventListener("blur", writeInputsBackToProtocol);
  });
}

function observeProcessingCompletion() {
  const status = byId("processingStatus");
  if (!status) return;
  const syncIfDone = () => {
    const text = String(status.textContent || "").toLowerCase();
    if (text.includes("processamento concluído") || text.includes("processamento concluido")) {
      setTimeout(syncMusicMetadataFields, 100);
    }
  };
  new MutationObserver(syncIfDone).observe(status, { childList: true, characterData: true, subtree: true });
  syncIfDone();
}

function normalizeBuildLabelsInReports() {
  const build = currentBuild();
  const targets = [
    "technicalLogPreview",
    "fullDiagnosticsOutput",
    "aiStructuralValidationOutput",
    "aiSuggestionsOutput",
  ];
  targets.forEach(id => {
    const node = byId(id);
    if (!node || !node.textContent) return;
    node.textContent = node.textContent
      .replace(/Frontend: audit-5[3-6]-cache-v\d+/g, `Frontend: ${build}`)
      .replace(/"build": "audit-5[3-6]-cache-v\d+"/g, `"build": "${build}"`);
  });
}

function observeReportsForBuildLabels() {
  const observer = new MutationObserver(normalizeBuildLabelsInReports);
  ["technicalLogPreview", "fullDiagnosticsOutput", "aiStructuralValidationOutput", "aiSuggestionsOutput"].forEach(id => {
    const node = byId(id);
    if (node) observer.observe(node, { childList: true, characterData: true, subtree: true });
  });
}

function initAudit56CrossFileValidationPatch() {
  markActiveBuild();
  bindMetadataInputs();
  observeProcessingCompletion();
  observeReportsForBuildLabels();
  syncMusicMetadataFields();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAudit56CrossFileValidationPatch);
} else {
  initAudit56CrossFileValidationPatch();
}
