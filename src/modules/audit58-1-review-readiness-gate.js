const AUDIT581_BUILD = "audit-58-1-cache-v1";
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

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasBox(value) {
  if (!value || typeof value !== "object") return false;
  if (value.bbox || value.bounding_box || value.geometry?.bbox || value.geometry?.bounding_box) return true;
  const keys = ["x", "y", "w", "h", "width", "height", "left", "top", "right", "bottom"];
  return keys.some(key => value[key] !== undefined);
}

function geometryStatus(item) {
  if (!item) return "missing";
  const geometry = item.geometry || item;
  if (!hasBox(item) && !hasBox(geometry)) return "missing";
  const confidence = Number(geometry.confidence ?? item.geometry_confidence ?? item.confidence_score ?? NaN);
  const status = String(geometry.status || item.geometry_status || "").toLowerCase();
  if (status === "reliable" || confidence >= 0.75) return "reliable";
  if (status === "approximate" || Number.isFinite(confidence)) return "approximate";
  return "present_unrated";
}

function countByStatus(items) {
  return asArray(items).reduce((acc, item) => {
    const status = geometryStatus(item);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, { missing: 0, approximate: 0, reliable: 0, present_unrated: 0 });
}

function measureIdentity(measure, index) {
  return {
    id: measure?.measure_id || measure?.id || `measure-${measure?.number ?? index + 1}`,
    number: measure?.number ?? measure?.measure_number ?? index + 1,
    system_id: measure?.system_id || measure?.system || null,
    page: measure?.page ?? measure?.page_number ?? null,
  };
}

function isMeasureReviewed(review, identity) {
  const target = String(review?.target_id ?? review?.measure_id ?? "");
  return review?.type === "measure_review" && (
    target === String(identity.id) ||
    target === String(identity.number) ||
    review?.measure_number === identity.number ||
    review?.number === identity.number
  );
}

function humanMeasureReviewStatus(reviewItems, measure, identity) {
  const reviews = asArray(reviewItems).filter(item => isMeasureReviewed(item, identity));
  const decisions = reviews.map(item => String(item.decision || item.action || "").toLowerCase());
  const status = String(measure?.review_status || "").toLowerCase();

  if (decisions.includes("accept") || decisions.includes("approved") || status === "approved" || status === "accepted") {
    return { status: "approved", reviews: reviews.length, decisions };
  }
  if (decisions.includes("uncertain") || decisions.includes("rejected") || status === "needs_fix" || status === "uncertain") {
    return { status: "blocked_by_human_review", reviews: reviews.length, decisions };
  }
  if (reviews.length > 0) return { status: "reviewed_without_final_approval", reviews: reviews.length, decisions };
  return { status: "missing", reviews: 0, decisions: [] };
}

function ocrMeasureAssignments(blocks) {
  const assigned = asArray(blocks).filter(block => block?.measure_association?.status === "assigned");
  const confirmed = assigned.filter(block => block?.measure_human_review?.status === "measure_state_confirmed");
  const rejected = assigned.filter(block => block?.measure_human_review?.status === "measure_state_rejected");
  return {
    assigned: assigned.length,
    confirmed: confirmed.length,
    rejected: rejected.length,
  };
}

function buildReadinessGateReport() {
  const protocol = loadProtocol();
  const source = protocol?.source || {};
  const measures = asArray(protocol?.measures);
  const systems = asArray(protocol?.systems);
  const pages = asArray(protocol?.pages);
  const blocks = asArray(protocol?.fusion?.text_blocks_index);
  const review = asArray(protocol?.review);

  const pageGeometry = countByStatus(pages);
  const systemGeometry = countByStatus(systems);
  const measureGeometry = countByStatus(measures);
  const ocrGeometry = countByStatus(blocks);
  const ocrMeasure = ocrMeasureAssignments(blocks);

  const measure_readiness = measures.map((measure, index) => {
    const identity = measureIdentity(measure, index);
    const geometry = geometryStatus(measure);
    const human = humanMeasureReviewStatus(review, measure, identity);
    const blockers = [];

    if (geometry !== "reliable") blockers.push("measure_geometry_not_reliable");
    if (human.status !== "approved") blockers.push("human_measure_review_not_approved");

    return {
      measure_id: identity.id,
      measure_number: identity.number,
      page: identity.page,
      system_id: identity.system_id,
      geometry_status: geometry,
      human_review_status: human.status,
      human_reviews: human.reviews,
      ready_for_playable_chord_sheet: false,
      can_be_marked_ready_by_system: false,
      blockers,
    };
  });

  const totalBlockers = measure_readiness.reduce((sum, item) => sum + item.blockers.length, 0);

  return {
    export_type: "cpp_review_readiness_gate_report",
    audit: "audit-58.1",
    generated_at: new Date().toISOString(),
    frontend: { build: AUDIT581_BUILD },
    source: {
      file_name: source.file_name || "",
      file_type: source.file_type || "",
      omr_status: source.omr_status || "pending",
      ocr_status: source.ocr_status || protocol?.ocr?.status || "pending",
    },
    summary: {
      pages: pages.length,
      systems: systems.length,
      measures: measures.length,
      ocr_blocks: blocks.length,
      page_geometry: pageGeometry,
      system_geometry: systemGeometry,
      measure_geometry: measureGeometry,
      ocr_geometry: ocrGeometry,
      ocr_measure_assignments: ocrMeasure,
      human_reviews_total: review.length,
      measure_ready_count: 0,
      measure_blockers_total: totalBlockers,
      playable_ready_auto_marked: 0,
      global_status: totalBlockers === 0 && measures.length > 0 ? "eligible_for_explicit_human_final_release" : "blocked_pending_review_or_geometry",
    },
    measure_readiness,
    required_next_actions: [
      "Validar geometria confiável por compasso antes de qualquer associação automática.",
      "Realizar revisão humana visual/musical compasso a compasso.",
      "Confirmar explicitamente a liberação final antes de qualquer modo pronto para cifra tocável.",
    ],
    safety_contract: {
      modifies_protocol: false,
      modifies_ocr_raw_text: false,
      infers_lyrics: false,
      infers_harmony: false,
      aligns_ocr_to_measure_without_geometry: false,
      marks_playable_ready_automatically: false,
      applies_human_review_without_user_action: false,
      report_only: true,
    },
  };
}

function humanReport(report) {
  const lines = [
    "GATE DE REVISÃO E INTEGRIDADE GEOMÉTRICA — AUDITORIA 58.1",
    "",
    `Arquivo: ${report.source.file_name || "nenhum protocolo salvo"}`,
    `Build: ${report.frontend.build}`,
    `Status global: ${report.summary.global_status}`,
    "",
    "Resumo geométrico:",
    `- Páginas: ${report.summary.pages}`,
    `- Sistemas: ${report.summary.systems}`,
    `- Compassos: ${report.summary.measures}`,
    `- Blocos OCR: ${report.summary.ocr_blocks}`,
    `- Geometria de compassos confiável: ${report.summary.measure_geometry.reliable || 0}`,
    `- Geometria de compassos aproximada: ${report.summary.measure_geometry.approximate || 0}`,
    `- Geometria de compassos ausente: ${report.summary.measure_geometry.missing || 0}`,
    "",
    "Revisão e prontidão:",
    `- Revisões humanas totais: ${report.summary.human_reviews_total}`,
    `- Compassos prontos: ${report.summary.measure_ready_count}`,
    `- Bloqueios por compasso: ${report.summary.measure_blockers_total}`,
    `- Pronto para cifra tocável marcado automaticamente: ${report.summary.playable_ready_auto_marked}`,
    "",
    "Ações necessárias:",
    ...report.required_next_actions.map(item => `- ${item}`),
    "",
    "Contrato:",
    "- Apenas leitura, diagnóstico e exportação.",
    "- Não altera protocolo.",
    "- Não aplica revisão humana sem ação do usuário.",
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
  if (byId("reviewReadinessGateAudit581")) return;
  const previous = byId("measureConfidenceScoreAudit58");
  const anchor = previous || document.querySelector("main");
  if (!anchor) return;

  const section = document.createElement("section");
  section.id = "reviewReadinessGateAudit581";
  section.className = "panel active";
  section.innerHTML = `
    <h2>3H. Gate de revisão e integridade geométrica</h2>
    <p class="hint">Auditoria 58.1: diagnostica geometria, revisão humana e bloqueios antes de qualquer modo pronto para cifra tocável. Não aprova nada automaticamente.</p>
    <div class="toolbar sticky">
      <button id="btnRunReviewReadinessGate" class="primary">Gerar gate de revisão</button>
      <button id="btnExportReviewReadinessGate" class="ghost">Exportar gate JSON</button>
    </div>
    <pre id="reviewReadinessGateOutput" class="report small-report">Gate de revisão ainda não gerado.</pre>
  `;
  anchor.insertAdjacentElement("afterend", section);
}

function bindButtons() {
  const run = byId("btnRunReviewReadinessGate");
  const exp = byId("btnExportReviewReadinessGate");

  if (run) {
    run.onclick = event => {
      event.preventDefault();
      const report = buildReadinessGateReport();
      const out = byId("reviewReadinessGateOutput");
      if (out) out.textContent = `${humanReport(report)}\n\nJSON:\n${JSON.stringify(report, null, 2)}`;
    };
  }

  if (exp) {
    exp.onclick = event => {
      event.preventDefault();
      const report = buildReadinessGateReport();
      const text = JSON.stringify(report, null, 2);
      const out = byId("reviewReadinessGateOutput");
      if (out) out.textContent = `${humanReport(report)}\n\nJSON:\n${text}`;
      downloadText(`cpp_gate_revisao_geometria_audit58_1_${timestamp()}.json`, text);
    };
  }
}

function markBuild() {
  window.CPP_ACTIVE_BUILD = AUDIT581_BUILD;
  const build = byId("frontendBuild");
  if (build) build.textContent = `Frontend build: ${AUDIT581_BUILD}`;
}

function initAudit581ReviewReadinessGate() {
  markBuild();
  createPanel();
  bindButtons();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAudit581ReviewReadinessGate);
} else {
  initAudit581ReviewReadinessGate();
}
