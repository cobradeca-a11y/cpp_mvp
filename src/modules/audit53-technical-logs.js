const AUDIT53_BUILD = "audit-53-cache-v1";
const STORAGE_KEY = "cpp_professional_omr_protocol_v1";

function byId(id) {
  return document.getElementById(id);
}

function safeJsonParse(raw, fallback = null) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function loadProtocol() {
  return safeJsonParse(localStorage.getItem(STORAGE_KEY), {});
}

function sanitizeLogValue(value) {
  if (value == null) return value;
  if (typeof value === "string") {
    return value
      .replace(/(token|password|senha|secret|api[_-]?key)\s*[:=]\s*[^\s,;}]+/gi, "$1=[redacted]")
      .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]");
  }
  if (Array.isArray(value)) return value.map(sanitizeLogValue);
  if (typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (/token|password|senha|secret|api[_-]?key|credentials/i.test(key)) {
        out[key] = "[redacted]";
      } else {
        out[key] = sanitizeLogValue(item);
      }
    }
    return out;
  }
  return value;
}

function protocolSummary(protocol) {
  const ocrBlocks = Array.isArray(protocol?.ocr?.text_blocks) ? protocol.ocr.text_blocks.length : 0;
  const fusionBlocks = Array.isArray(protocol?.fusion?.text_blocks_index) ? protocol.fusion.text_blocks_index.length : 0;
  const measures = Array.isArray(protocol?.measures) ? protocol.measures.length : 0;
  const review = Array.isArray(protocol?.review) ? protocol.review.length : 0;

  return {
    cpp_version: protocol?.cpp_version || "",
    source: {
      file_name: protocol?.source?.file_name || "",
      file_type: protocol?.source?.file_type || "",
      omr_status: protocol?.source?.omr_status || "",
      omr_engine: protocol?.source?.omr_engine || "",
      ocr_status: protocol?.source?.ocr_status || protocol?.ocr?.status || "",
      ocr_engine: protocol?.source?.ocr_engine || protocol?.ocr?.engine || "",
      validation_status: protocol?.source?.validation_status || "",
    },
    music: {
      title: protocol?.music?.title || "",
      key: protocol?.music?.key || "",
      meter_default: protocol?.music?.meter_default || "",
      tempo: protocol?.music?.tempo || "",
    },
    counts: {
      pages: Array.isArray(protocol?.pages) ? protocol.pages.length : 0,
      systems: Array.isArray(protocol?.systems) ? protocol.systems.length : 0,
      measures,
      ocr_text_blocks: ocrBlocks,
      fusion_text_blocks: fusionBlocks,
      review_decisions: review,
      possible_chords: Array.isArray(protocol?.ocr?.possible_chords) ? protocol.ocr.possible_chords.length : 0,
      possible_lyrics: Array.isArray(protocol?.ocr?.possible_lyrics) ? protocol.ocr.possible_lyrics.length : 0,
    },
    statuses: {
      fusion_status: protocol?.fusion?.status || "",
      fusion_version: protocol?.fusion?.version || "",
      navigation_status: protocol?.navigation?.status || "",
      validation_status: protocol?.validation?.validation_status || "",
    },
    warnings: {
      ocr: Array.isArray(protocol?.ocr?.warnings) ? protocol.ocr.warnings : [],
      fusion: Array.isArray(protocol?.fusion?.warnings) ? protocol.fusion.warnings : [],
    },
  };
}

function collectTechnicalLog() {
  const protocol = loadProtocol();
  const payload = {
    export_type: "cpp_technical_log_export",
    audit: "audit-53",
    generated_at: new Date().toISOString(),
    frontend: {
      build: AUDIT53_BUILD,
      user_agent: navigator.userAgent,
      language: navigator.language,
      online: navigator.onLine,
      location_origin: window.location.origin,
    },
    backend: {
      configured_url: byId("backendUrl")?.value || "",
      health_panel: byId("backendStatus")?.textContent || "",
    },
    processing: {
      status_panel: byId("processingStatus")?.textContent || "",
      queue_state_panel: byId("processingStateReport")?.textContent || "",
      cancel_panel: byId("processingCancelStatus")?.textContent || "",
    },
    operational_log: {
      frontend_error_log: byId("frontendErrorLog")?.textContent || "",
    },
    protocol_summary: protocolSummary(protocol),
    safety_contract: {
      changes_musical_evidence: false,
      changes_ocr_raw_text: false,
      infers_lyrics: false,
      infers_harmony: false,
      aligns_ocr_to_measure_without_geometry: false,
    },
  };
  return sanitizeLogValue(payload);
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
  if (byId("technicalLogsAudit53")) return;
  const errorSection = byId("frontendErrorLog")?.closest?.("section");
  const anchor = errorSection || document.querySelector("main");
  if (!anchor) return;

  const section = document.createElement("section");
  section.id = "technicalLogsAudit53";
  section.className = "panel active";
  section.innerHTML = `
    <h2>3B. Logs técnicos exportáveis</h2>
    <p class="hint">Auditoria 53: exporta diagnóstico técnico sanitizado sem alterar o protocolo musical.</p>
    <div class="toolbar sticky">
      <button id="btnExportTechnicalLog" class="primary">Exportar log técnico JSON</button>
      <button id="btnPreviewTechnicalLog" class="ghost">Pré-visualizar log técnico</button>
    </div>
    <pre id="technicalLogPreview" class="report small-report">Nenhum log técnico gerado nesta sessão.</pre>
  `;
  anchor.insertAdjacentElement("afterend", section);
}

function bindButtons() {
  const exportButton = byId("btnExportTechnicalLog");
  const previewButton = byId("btnPreviewTechnicalLog");

  if (previewButton) {
    previewButton.onclick = event => {
      event.preventDefault();
      const payload = collectTechnicalLog();
      const preview = JSON.stringify(payload, null, 2);
      const target = byId("technicalLogPreview");
      if (target) target.textContent = preview;
    };
  }

  if (exportButton) {
    exportButton.onclick = event => {
      event.preventDefault();
      const payload = collectTechnicalLog();
      const text = JSON.stringify(payload, null, 2);
      const target = byId("technicalLogPreview");
      if (target) target.textContent = text;
      downloadText(`cpp_log_tecnico_audit53_${timestamp()}.json`, text);
    };
  }
}

function markBuild() {
  const build = byId("frontendBuild");
  if (build) build.textContent = `Frontend build: ${AUDIT53_BUILD}`;
}

function initAudit53TechnicalLogs() {
  markBuild();
  createPanel();
  bindButtons();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAudit53TechnicalLogs);
} else {
  initAudit53TechnicalLogs();
}
