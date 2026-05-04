const AUDIT582_BUILD = "audit-58-2-cache-v1";
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

function saveProtocol(protocol) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(protocol || {}, null, 0));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeBBoxCandidate(value) {
  if (!value || typeof value !== "object") return null;

  if (value.bbox) return normalizeBBoxCandidate(value.bbox);
  if (value.bounding_box) return normalizeBBoxCandidate(value.bounding_box);
  if (value.geometry?.bbox) return normalizeBBoxCandidate(value.geometry.bbox);
  if (value.geometry?.bounding_box) return normalizeBBoxCandidate(value.geometry.bounding_box);

  const x = finiteNumber(value.x ?? value.left);
  const y = finiteNumber(value.y ?? value.top);
  const w = finiteNumber(value.w ?? value.width);
  const h = finiteNumber(value.h ?? value.height);
  const right = finiteNumber(value.right);
  const bottom = finiteNumber(value.bottom);

  if (x !== null && y !== null && w !== null && h !== null && w > 0 && h > 0) {
    return { x, y, w, h };
  }

  if (x !== null && y !== null && right !== null && bottom !== null && right > x && bottom > y) {
    return { x, y, w: right - x, h: bottom - y };
  }

  return null;
}

function confidenceFrom(item, hasBBox) {
  const geometry = item?.geometry || {};
  const raw = finiteNumber(geometry.confidence ?? item?.geometry_confidence ?? item?.confidence_score);
  if (raw !== null) {
    if (raw <= 1) return Math.max(0, Math.min(1, raw));
    return Math.max(0, Math.min(1, raw / 100));
  }
  return hasBBox ? 0.5 : 0;
}

function sourceFrom(item, hasBBox) {
  const geometry = item?.geometry || {};
  if (geometry.source) return geometry.source;
  if (item?.geometry_source) return item.geometry_source;
  if (item?.bbox || item?.bounding_box || item?.geometry?.bbox || item?.geometry?.bounding_box) return "existing_protocol_geometry";
  return hasBBox ? "existing_coordinate_fields" : "missing_no_reliable_geometry_available";
}

function statusFrom(item, confidence, hasBBox) {
  const geometry = item?.geometry || {};
  const raw = String(geometry.status || item?.geometry_status || "").toLowerCase();
  if (!hasBBox) return "pending";
  if (raw === "reliable" || confidence >= 0.75) return "reliable";
  if (raw === "approximate" || confidence > 0) return "approximate";
  return "present_unrated";
}

function normalizeGeometry(item, fallback = {}) {
  const bbox = normalizeBBoxCandidate(item);
  const confidence = confidenceFrom(item, !!bbox);
  const status = statusFrom(item, confidence, !!bbox);
  return {
    page: item?.page ?? item?.page_number ?? fallback.page ?? null,
    system_id: item?.system_id || item?.system || fallback.system_id || null,
    bbox,
    source: sourceFrom(item, !!bbox),
    confidence,
    status,
    review_required: status !== "reliable",
    audit: "audit-58.2",
  };
}

function systemById(protocol) {
  return asArray(protocol?.systems).reduce((acc, system) => {
    const id = system?.system_id || system?.id;
    if (id) acc[id] = system;
    return acc;
  }, {});
}

function normalizePageGeometry(protocol) {
  let changed = 0;
  protocol.pages = asArray(protocol.pages).map((page, index) => {
    const next = { ...page };
    const geometry = normalizeGeometry(page, { page: page?.page ?? page?.page_number ?? index + 1 });
    if (JSON.stringify(next.geometry || null) !== JSON.stringify(geometry)) changed += 1;
    next.geometry = geometry;
    return next;
  });
  return changed;
}

function normalizeSystemGeometry(protocol) {
  let changed = 0;
  protocol.systems = asArray(protocol.systems).map((system, index) => {
    const next = { ...system };
    const geometry = normalizeGeometry(system, { page: system?.page ?? system?.page_number ?? null, system_id: system?.system_id || system?.id || `system-${index + 1}` });
    if (JSON.stringify(next.geometry || null) !== JSON.stringify(geometry)) changed += 1;
    next.geometry = geometry;
    next.system_id ||= system?.id || `s${String(index + 1).padStart(3, "0")}`;
    return next;
  });
  return changed;
}

function normalizeMeasureGeometry(protocol) {
  const systems = systemById(protocol);
  let changed = 0;
  protocol.measures = asArray(protocol.measures).map((measure, index) => {
    const next = { ...measure };
    const system = systems[measure?.system_id] || systems[measure?.system] || {};
    const fallback = {
      page: measure?.page ?? measure?.page_number ?? system?.page ?? system?.page_number ?? system?.geometry?.page ?? null,
      system_id: measure?.system_id || measure?.system || system?.system_id || system?.id || null,
    };
    const geometry = normalizeGeometry(measure, fallback);
    if (JSON.stringify(next.geometry || null) !== JSON.stringify(geometry)) changed += 1;
    next.geometry = geometry;
    next.page = geometry.page;
    next.system_id = geometry.system_id;
    next.measure_id ||= next.id || `m${String(index + 1).padStart(3, "0")}`;
    next.number ??= next.measure_number ?? index + 1;
    return next;
  });
  return changed;
}

function normalizeOcrGeometry(protocol) {
  let changed = 0;
  const fusion = protocol.fusion || {};
  fusion.text_blocks_index = asArray(fusion.text_blocks_index).map((block, index) => {
    const next = { ...block };
    const geometry = normalizeGeometry(block, { page: block?.page ?? block?.page_number ?? null });
    if (JSON.stringify(next.geometry || null) !== JSON.stringify(geometry)) changed += 1;
    next.geometry = geometry;
    next.fusion_id ||= next.id || `ocr_${String(index + 1).padStart(3, "0")}`;
    return next;
  });
  protocol.fusion = fusion;
  return changed;
}

function summarizeGeometry(items) {
  return asArray(items).reduce((acc, item) => {
    const status = item?.geometry?.status || "missing";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, { pending: 0, approximate: 0, reliable: 0, present_unrated: 0 });
}

function applyExplicitGeometryContract() {
  const protocol = loadProtocol();
  const before = JSON.stringify(protocol);
  protocol.geometry_contract ||= {};
  protocol.geometry_contract.audit_58_2 = {
    version: "audit-58.2",
    applied_at: new Date().toISOString(),
    rule: "Normalize explicit geometry fields without inventing coordinates.",
    bbox_policy: "bbox remains null when no reliable coordinate evidence exists.",
  };

  const changed = {
    pages: normalizePageGeometry(protocol),
    systems: normalizeSystemGeometry(protocol),
    measures: normalizeMeasureGeometry(protocol),
    ocr_blocks: normalizeOcrGeometry(protocol),
  };

  const report = buildGeometryContractReport(protocol, changed, before !== JSON.stringify(protocol));
  saveProtocol(protocol);
  return report;
}

function buildGeometryContractReport(protocol = loadProtocol(), changed = null, saved = false) {
  const pages = asArray(protocol.pages);
  const systems = asArray(protocol.systems);
  const measures = asArray(protocol.measures);
  const blocks = asArray(protocol?.fusion?.text_blocks_index);
  const source = protocol.source || {};
  return {
    export_type: "cpp_explicit_measure_geometry_contract_report",
    audit: "audit-58.2",
    generated_at: new Date().toISOString(),
    frontend: { build: AUDIT582_BUILD },
    source: {
      file_name: source.file_name || "",
      file_type: source.file_type || "",
      omr_status: source.omr_status || "pending",
      ocr_status: source.ocr_status || protocol?.ocr?.status || "pending",
    },
    summary: {
      protocol_saved: saved,
      changed,
      pages_total: pages.length,
      systems_total: systems.length,
      measures_total: measures.length,
      ocr_blocks_total: blocks.length,
      page_geometry: summarizeGeometry(pages),
      system_geometry: summarizeGeometry(systems),
      measure_geometry: summarizeGeometry(measures),
      ocr_geometry: summarizeGeometry(blocks),
      measures_with_explicit_geometry_object: measures.filter(item => item?.geometry && typeof item.geometry === "object").length,
      measures_with_reliable_bbox: measures.filter(item => item?.geometry?.status === "reliable" && item?.geometry?.bbox).length,
      measures_pending_geometry: measures.filter(item => item?.geometry?.status !== "reliable").length,
    },
    safety_contract: {
      modifies_protocol: true,
      modification_scope: "metadata_only_geometry_contract",
      modifies_ocr_raw_text: false,
      infers_lyrics: false,
      infers_harmony: false,
      invents_geometry_coordinates: false,
      aligns_ocr_to_measure_without_geometry: false,
      marks_playable_ready_automatically: false,
      applies_human_review_without_user_action: false,
    },
  };
}

function humanReport(report) {
  const lines = [
    "GEOMETRIA EXPLÍCITA POR COMPASSO — AUDITORIA 58.2",
    "",
    `Arquivo: ${report.source.file_name || "nenhum protocolo salvo"}`,
    `Build: ${report.frontend.build}`,
    `Protocolo salvo: ${report.summary.protocol_saved ? "sim" : "não"}`,
    "",
    "Resumo:",
    `- Compassos: ${report.summary.measures_total}`,
    `- Compassos com objeto geometry explícito: ${report.summary.measures_with_explicit_geometry_object}`,
    `- Compassos com bbox confiável: ${report.summary.measures_with_reliable_bbox}`,
    `- Compassos pendentes de geometria confiável: ${report.summary.measures_pending_geometry}`,
    "",
    "Geometria dos compassos:",
    `- reliable: ${report.summary.measure_geometry.reliable || 0}`,
    `- approximate: ${report.summary.measure_geometry.approximate || 0}`,
    `- present_unrated: ${report.summary.measure_geometry.present_unrated || 0}`,
    `- pending: ${report.summary.measure_geometry.pending || 0}`,
    "",
    "Contrato:",
    "- Acrescenta apenas metadados geométricos explícitos.",
    "- Não cria bbox quando não há evidência de coordenadas.",
    "- Não altera OCR bruto.",
    "- Não infere letra.",
    "- Não infere harmonia.",
    "- Não alinha OCR a compasso sem geometria confiável.",
    "- Não marca automaticamente como pronto para cifra tocável.",
  ];
  return lines.join("\n");
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
  if (byId("explicitMeasureGeometryAudit582")) return;
  const previous = byId("reviewReadinessGateAudit581");
  const anchor = previous || document.querySelector("main");
  if (!anchor) return;

  const section = document.createElement("section");
  section.id = "explicitMeasureGeometryAudit582";
  section.className = "panel active";
  section.innerHTML = `
    <h2>3I. Geometria explícita por compasso</h2>
    <p class="hint">Auditoria 58.2: normaliza page, system_id, bbox, source, confidence e status em cada compasso. Não inventa coordenadas quando não há evidência.</p>
    <div class="toolbar sticky">
      <button id="btnApplyExplicitMeasureGeometry" class="primary">Aplicar geometria explícita segura</button>
      <button id="btnExportExplicitMeasureGeometry" class="ghost">Exportar relatório JSON</button>
    </div>
    <pre id="explicitMeasureGeometryOutput" class="report small-report">Geometria explícita ainda não aplicada nesta sessão.</pre>
  `;
  anchor.insertAdjacentElement("afterend", section);
}

function bindButtons() {
  const apply = byId("btnApplyExplicitMeasureGeometry");
  const exp = byId("btnExportExplicitMeasureGeometry");

  if (apply) {
    apply.onclick = event => {
      event.preventDefault();
      const report = applyExplicitGeometryContract();
      const out = byId("explicitMeasureGeometryOutput");
      if (out) out.textContent = `${humanReport(report)}\n\nJSON:\n${JSON.stringify(report, null, 2)}`;
    };
  }

  if (exp) {
    exp.onclick = event => {
      event.preventDefault();
      const report = buildGeometryContractReport(loadProtocol(), null, false);
      const text = JSON.stringify(report, null, 2);
      const out = byId("explicitMeasureGeometryOutput");
      if (out) out.textContent = `${humanReport(report)}\n\nJSON:\n${text}`;
      downloadText(`cpp_geometria_explicitada_compassos_audit58_2_${timestamp()}.json`, text);
    };
  }
}

function markBuild() {
  window.CPP_ACTIVE_BUILD = AUDIT582_BUILD;
  const build = byId("frontendBuild");
  if (build) build.textContent = `Frontend build: ${AUDIT582_BUILD}`;
}

function initAudit582ExplicitMeasureGeometry() {
  markBuild();
  createPanel();
  bindButtons();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAudit582ExplicitMeasureGeometry);
} else {
  initAudit582ExplicitMeasureGeometry();
}
