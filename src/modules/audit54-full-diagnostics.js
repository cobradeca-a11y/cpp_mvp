const AUDIT54_BUILD = "audit-54-cache-v1";
const STORAGE_KEY = "cpp_professional_omr_protocol_v1";

const KNOWN_TEST_WARNING = {
  status: "present_non_blocking",
  source: "PyMuPDF/fitz",
  category: "DeprecationWarning",
  message: "SwigPyPacked/SwigPyObject/swigvarlink sem __module__",
  interpretation: "Aviso técnico não bloqueante observado no pytest após instalar PyMuPDF para OCR de PDF.",
  action: "Registrar e monitorar. Não bloquear validação enquanto pytest estiver 18 passed.",
};

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

function parseJsonPanel(text) {
  const value = String(text || "").trim();
  if (!value || !value.startsWith("{")) return null;
  return safeJsonParse(value, null);
}

function statusFromBackendPanel() {
  const parsed = parseJsonPanel(byId("backendStatus")?.textContent || "");
  if (!parsed) return { status: "not_checked", ok: false, message: "Backend ainda não verificado nesta sessão." };
  return {
    status: parsed.ok ? "ok" : "problem",
    ok: Boolean(parsed.ok),
    app: parsed.app || "",
    audiveris_available: Boolean(parsed.audiveris_available),
    audiveris_cmd: parsed.audiveris_cmd || "",
  };
}

function protocolDiagnostics(protocol) {
  const source = protocol?.source || {};
  const ocr = protocol?.ocr || {};
  const fusion = protocol?.fusion || {};
  const measures = Array.isArray(protocol?.measures) ? protocol.measures : [];
  const textBlocks = Array.isArray(ocr.text_blocks) ? ocr.text_blocks : [];
  const fusionBlocks = Array.isArray(fusion.text_blocks_index) ? fusion.text_blocks_index : [];

  return {
    source_file: source.file_name || "",
    omr: {
      status: source.omr_status || "pending",
      engine: source.omr_engine || "",
      ok: source.omr_status === "success" || source.omr_status === "musicxml_parsed",
    },
    ocr: {
      status: source.ocr_status || ocr.status || "pending",
      engine: source.ocr_engine || ocr.engine || "",
      text_blocks: textBlocks.length,
      ok: (source.ocr_status || ocr.status) === "success" || (source.ocr_status || ocr.status) === "not_applicable",
      warnings: Array.isArray(ocr.warnings) ? ocr.warnings : [],
    },
    fusion: {
      status: fusion.status || "",
      version: fusion.version || "",
      indexed_blocks: fusionBlocks.length,
      warnings: Array.isArray(fusion.warnings) ? fusion.warnings : [],
      needs_layout_mapping: fusion.status === "evidence_indexed_needs_layout_mapping",
    },
    musicxml: {
      measures: measures.length,
      systems: Array.isArray(protocol?.systems) ? protocol.systems.length : 0,
      pages: Array.isArray(protocol?.pages) ? protocol.pages.length : 0,
    },
    review: {
      decisions: Array.isArray(protocol?.review) ? protocol.review.length : 0,
      validation_status: protocol?.validation?.validation_status || source.validation_status || "pending",
    },
  };
}

function classifyOverall(diag) {
  if (!diag.backend.ok) return "atenção: backend não verificado";
  if (!diag.protocol.omr.ok) return "atenção: OMR não concluído";
  if (!diag.protocol.ocr.ok) return "atenção: OCR não concluído ou indisponível";
  if (diag.protocol.fusion.needs_layout_mapping) return "operacional com pendências esperadas de geometria/fusão";
  return "operacional";
}

function buildDiagnostics() {
  const protocol = loadProtocol();
  const backend = statusFromBackendPanel();
  const protocolInfo = protocolDiagnostics(protocol);
  const operationalLog = byId("frontendErrorLog")?.textContent || "";
  const hasOperationalErrors = operationalLog && operationalLog !== "Nenhum erro operacional registrado nesta sessão.";

  const diag = {
    export_type: "cpp_full_diagnostics",
    audit: "audit-54",
    generated_at: new Date().toISOString(),
    frontend: {
      build: AUDIT54_BUILD,
      online: navigator.onLine,
      origin: window.location.origin,
    },
    backend,
    protocol: protocolInfo,
    processing: {
      status_panel: byId("processingStatus")?.textContent || "",
      queue_state_panel: byId("processingStateReport")?.textContent || "",
      cancel_panel: byId("processingCancelStatus")?.textContent || "",
    },
    warnings: {
      tests: KNOWN_TEST_WARNING,
      operational_log_present: hasOperationalErrors,
      ocr: protocolInfo.ocr.warnings,
      fusion: protocolInfo.fusion.warnings,
    },
    safety_contract: {
      changes_musical_evidence: false,
      changes_ocr_raw_text: false,
      infers_lyrics: false,
      infers_harmony: false,
      aligns_ocr_to_measure_without_geometry: false,
      uncertain_evidence_requires_human_review: true,
    },
  };
  diag.overall_status = classifyOverall(diag);
  return diag;
}

function humanSummary(diag) {
  return [
    "DIAGNÓSTICO COMPLETO — AUDITORIA 54",
    "",
    `Status geral: ${diag.overall_status}`,
    `Frontend: ${diag.frontend.build}`,
    `Backend: ${diag.backend.status}`,
    `Audiveris disponível: ${diag.backend.audiveris_available ? "sim" : "não/não verificado"}`,
    `Arquivo: ${diag.protocol.source_file || "nenhum protocolo salvo"}`,
    `OMR: ${diag.protocol.omr.status}`,
    `OCR: ${diag.protocol.ocr.status} (${diag.protocol.ocr.text_blocks} bloco(s))`,
    `Fusion: ${diag.protocol.fusion.status || "não informado"}`,
    `Compassos: ${diag.protocol.musicxml.measures}`,
    `Decisões humanas: ${diag.protocol.review.decisions}`,
    "",
    "Warnings de teste:",
    `- ${diag.warnings.tests.category}: ${diag.warnings.tests.interpretation}`,
    `- Ação: ${diag.warnings.tests.action}`,
    "",
    "Contrato de segurança:",
    "- Não altera evidência musical.",
    "- Não altera OCR bruto.",
    "- Não infere letra.",
    "- Não infere harmonia.",
    "- Não alinha OCR a compasso sem geometria confiável.",
  ].join("\n");
}

function downloadText(filename, text, mime = "application/json;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function timestamp() {
  return new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
}

function createPanel() {
  if (byId("fullDiagnosticsAudit54")) return;
  const techLogs = byId("technicalLogsAudit53");
  const anchor = techLogs || document.querySelector("main");
  if (!anchor) return;

  const section = document.createElement("section");
  section.id = "fullDiagnosticsAudit54";
  section.className = "panel active";
  section.innerHTML = `
    <h2>3C. Modo diagnóstico completo</h2>
    <p class="hint">Auditoria 54: consolida diagnóstico de backend, OMR, OCR, Fusion, fila, cancelamento, logs e warnings não bloqueantes.</p>
    <div class="toolbar sticky">
      <button id="btnRunFullDiagnostics" class="primary">Gerar diagnóstico completo</button>
      <button id="btnExportFullDiagnostics" class="ghost">Exportar diagnóstico JSON</button>
    </div>
    <pre id="fullDiagnosticsOutput" class="report small-report">Diagnóstico completo ainda não gerado.</pre>
  `;
  anchor.insertAdjacentElement("afterend", section);
}

function bindButtons() {
  const run = byId("btnRunFullDiagnostics");
  const exp = byId("btnExportFullDiagnostics");

  if (run) {
    run.onclick = event => {
      event.preventDefault();
      const diag = buildDiagnostics();
      const out = byId("fullDiagnosticsOutput");
      if (out) out.textContent = `${humanSummary(diag)}\n\nJSON:\n${JSON.stringify(diag, null, 2)}`;
    };
  }

  if (exp) {
    exp.onclick = event => {
      event.preventDefault();
      const diag = buildDiagnostics();
      const text = JSON.stringify(diag, null, 2);
      const out = byId("fullDiagnosticsOutput");
      if (out) out.textContent = `${humanSummary(diag)}\n\nJSON:\n${text}`;
      downloadText(`cpp_diagnostico_completo_audit54_${timestamp()}.json`, text);
    };
  }
}

function markBuild() {
  const build = byId("frontendBuild");
  if (build) build.textContent = `Frontend build: ${AUDIT54_BUILD}`;
}

function initAudit54FullDiagnostics() {
  markBuild();
  createPanel();
  bindButtons();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAudit54FullDiagnostics);
} else {
  initAudit54FullDiagnostics();
}
