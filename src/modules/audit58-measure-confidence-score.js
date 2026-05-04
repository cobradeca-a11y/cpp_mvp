const AUDIT58_BUILD = "audit-58-cache-v1";
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

function count(value) {
  return asArray(value).length;
}

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function measureIdentity(measure, index) {
  const number = measure?.number ?? measure?.measure_number ?? index + 1;
  return {
    id: measure?.measure_id || measure?.id || `measure-${number}`,
    number,
    system_id: measure?.system_id || measure?.system || null,
    page: measure?.page ?? measure?.page_number ?? null,
  };
}

function mapConfidenceToScore(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value <= 1) return Math.round(value * 100);
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  const text = normalizeText(value);
  if (!text) return 55;
  if (["high", "alta", "confirmed", "validado", "approved", "aceito", "confiavel", "confiável"].includes(text)) return 90;
  if (["medium", "media", "média", "provavel", "provável", "probable"].includes(text)) return 70;
  if (["low", "baixa", "uncertain", "incerto", "needs_review", "needs_fix", "pendente"].includes(text)) return 40;
  if (["missing", "failed", "erro", "error", "rejected", "rejeitado"].includes(text)) return 20;
  return 55;
}

function omrMeasureScore(measure) {
  const hasMeasure = !!measure;
  if (!hasMeasure) {
    return {
      score: 0,
      status: "missing_measure",
      evidence: "Compasso ausente no protocolo.",
    };
  }

  const base = mapConfidenceToScore(measure.confidence ?? measure.confidence_score ?? measure.status);
  const hasGeometry = !!(measure.bbox || measure.bounding_box || measure.geometry || measure.x !== undefined || measure.left !== undefined);
  const hasMeter = !!measure.meter;
  const deductions = [];
  let score = base;

  if (!hasGeometry) {
    score = Math.min(score, 75);
    deductions.push("geometria_do_compasso_nao_disponivel");
  }

  if (!hasMeter) {
    score = Math.min(score, 80);
    deductions.push("compasso_metrico_nao_disponivel");
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    status: hasGeometry ? "available_with_geometry" : "available_without_geometry",
    evidence: {
      confidence_raw: measure.confidence ?? measure.confidence_score ?? measure.status ?? null,
      has_geometry: hasGeometry,
      has_meter: hasMeter,
      deductions,
    },
  };
}

function isReviewForMeasure(review, identity) {
  const target = String(review?.target_id ?? review?.measure_id ?? review?.id ?? "");
  const number = String(identity.number ?? "");
  const id = String(identity.id ?? "");
  return target === id || target === number || review?.measure_number === identity.number || review?.number === identity.number;
}

function humanReviewScore(reviewItems = [], measure, identity) {
  const directReviews = asArray(reviewItems).filter(item => item?.type === "measure_review" && isReviewForMeasure(item, identity));
  const status = normalizeText(measure?.review_status || "");
  const decisions = directReviews.map(item => normalizeText(item.decision || item.action));

  if (decisions.includes("accept") || decisions.includes("approved") || status === "approved" || status === "accepted") {
    return {
      score: 100,
      status: "human_approved",
      evidence: { reviews: directReviews.length, decisions, measure_review_status: measure?.review_status || null },
    };
  }

  if (decisions.includes("uncertain") || decisions.includes("rejected") || status === "needs_fix" || status === "uncertain") {
    return {
      score: 30,
      status: "human_marked_uncertain_or_rejected",
      evidence: { reviews: directReviews.length, decisions, measure_review_status: measure?.review_status || null },
    };
  }

  if (directReviews.length > 0) {
    return {
      score: 60,
      status: "human_review_present_without_final_approval",
      evidence: { reviews: directReviews.length, decisions, measure_review_status: measure?.review_status || null },
    };
  }

  return {
    score: null,
    status: "human_review_absent",
    evidence: { reviews: 0, measure_review_status: measure?.review_status || "pending" },
  };
}

function blockAssignedToMeasure(block, identity) {
  const assoc = block?.measure_association || block?.measure || {};
  if (assoc?.status !== "assigned" && block?.measure_association?.status !== "assigned") return false;

  const assocId = String(assoc.measure_id ?? assoc.target_id ?? assoc.id ?? "");
  const assocNumber = String(assoc.measure_number ?? assoc.number ?? block?.measure_number ?? "");
  return assocId === String(identity.id) || assocNumber === String(identity.number);
}

function ocrAssociationScore(blocks = [], identity) {
  const assigned = asArray(blocks).filter(block => blockAssignedToMeasure(block, identity));

  if (!assigned.length) {
    return {
      score: null,
      status: "no_reliable_ocr_measure_assignment",
      evidence: {
        assigned_blocks: 0,
        reason: "Nenhum bloco OCR já estava atribuído a este compasso por evidência existente. Nenhum alinhamento novo foi feito.",
      },
    };
  }

  const confirmed = assigned.filter(block => block?.measure_human_review?.status === "measure_state_confirmed").length;
  const rejected = assigned.filter(block => block?.measure_human_review?.status === "measure_state_rejected").length;
  const score = rejected > 0 ? 35 : confirmed > 0 ? 85 : 65;

  return {
    score,
    status: confirmed > 0 ? "ocr_measure_assignment_human_confirmed" : rejected > 0 ? "ocr_measure_assignment_rejected_present" : "ocr_measure_assignment_present_unconfirmed",
    evidence: {
      assigned_blocks: assigned.length,
      confirmed_blocks: confirmed,
      rejected_blocks: rejected,
      classifications: assigned.reduce((acc, block) => {
        const key = block?.classification || "unknown";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    },
  };
}

function weightedFinalScore(parts) {
  const weighted = [];
  if (typeof parts.omr.score === "number") weighted.push({ value: parts.omr.score, weight: 0.7 });
  if (typeof parts.human.score === "number") weighted.push({ value: parts.human.score, weight: 0.2 });
  if (typeof parts.ocr.score === "number") weighted.push({ value: parts.ocr.score, weight: 0.1 });

  if (!weighted.length) return 0;
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  return Math.round(weighted.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight);
}

function scoreStatus(score, parts) {
  if (parts.human.status === "human_marked_uncertain_or_rejected") return "needs_human_review";
  if (parts.omr.status === "missing_measure") return "missing_measure";
  if (score >= 85) return "high_confidence_not_playable_ready";
  if (score >= 65) return "medium_confidence_review_recommended";
  return "low_confidence_needs_review";
}

function buildMeasureConfidenceReport() {
  const protocol = loadProtocol();
  const source = protocol?.source || {};
  const measures = asArray(protocol?.measures);
  const blocks = asArray(protocol?.fusion?.text_blocks_index);
  const review = asArray(protocol?.review);

  const measure_scores = measures.map((measure, index) => {
    const identity = measureIdentity(measure, index);
    const parts = {
      omr: omrMeasureScore(measure),
      human: humanReviewScore(review, measure, identity),
      ocr: ocrAssociationScore(blocks, identity),
    };
    const final_score = weightedFinalScore(parts);

    return {
      measure_id: identity.id,
      measure_number: identity.number,
      page: identity.page,
      system_id: identity.system_id,
      final_confidence_score: final_score,
      final_confidence_status: scoreStatus(final_score, parts),
      ready_for_playable_chord_sheet: false,
      requires_human_review: final_score < 85 || parts.human.status !== "human_approved",
      score_components: parts,
      safety_notes: [
        "Score calculado apenas para relatório/exportação.",
        "Não altera o protocolo CPP salvo.",
        "Não altera texto OCR bruto.",
        "Não infere letra nem harmonia.",
        "Não cria alinhamento OCR→compasso sem associação já existente.",
      ],
    };
  });

  const scores = measure_scores.map(item => item.final_confidence_score);
  const average = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;

  return {
    export_type: "cpp_measure_confidence_score_report",
    audit: "audit-58",
    generated_at: new Date().toISOString(),
    frontend: {
      build: AUDIT58_BUILD,
    },
    source: {
      file_name: source.file_name || "",
      file_type: source.file_type || "",
      omr_status: source.omr_status || "pending",
      ocr_status: source.ocr_status || protocol?.ocr?.status || "pending",
    },
    summary: {
      measures_total: measures.length,
      average_confidence_score: average,
      high_confidence: measure_scores.filter(item => item.final_confidence_score >= 85).length,
      medium_confidence: measure_scores.filter(item => item.final_confidence_score >= 65 && item.final_confidence_score < 85).length,
      low_confidence: measure_scores.filter(item => item.final_confidence_score < 65).length,
      requires_human_review: measure_scores.filter(item => item.requires_human_review).length,
      playable_ready_auto_marked: 0,
    },
    measure_scores,
    safety_contract: {
      modifies_protocol: false,
      modifies_ocr_raw_text: false,
      infers_lyrics: false,
      infers_harmony: false,
      aligns_ocr_to_measure_without_geometry: false,
      marks_playable_ready_automatically: false,
      report_only: true,
    },
  };
}

function humanReport(report) {
  const lines = [
    "SCORE FINAL DE CONFIANÇA POR COMPASSO — AUDITORIA 58",
    "",
    `Arquivo: ${report.source.file_name || "nenhum protocolo salvo"}`,
    `Build: ${report.frontend.build}`,
    "",
    "Resumo:",
    `- Compassos: ${report.summary.measures_total}`,
    `- Score médio: ${report.summary.average_confidence_score}`,
    `- Alta confiança: ${report.summary.high_confidence}`,
    `- Média confiança: ${report.summary.medium_confidence}`,
    `- Baixa confiança: ${report.summary.low_confidence}`,
    `- Requer revisão humana: ${report.summary.requires_human_review}`,
    `- Marcados automaticamente como prontos para cifra tocável: ${report.summary.playable_ready_auto_marked}`,
    "",
    "Compassos:",
  ];

  if (!report.measure_scores.length) {
    lines.push("- Nenhum compasso disponível no protocolo salvo.");
  } else {
    report.measure_scores.forEach(item => {
      lines.push(`- Compasso ${item.measure_number}: ${item.final_confidence_score}/100 — ${item.final_confidence_status} — revisão humana: ${item.requires_human_review ? "sim" : "não"}`);
    });
  }

  lines.push("", "Contrato:");
  lines.push("- Apenas leitura, relatório e exportação.");
  lines.push("- Não altera protocolo.");
  lines.push("- Não altera OCR bruto.");
  lines.push("- Não infere letra.");
  lines.push("- Não infere harmonia.");
  lines.push("- Não alinha OCR a compasso sem geometria confiável.");
  lines.push("- Não marca automaticamente como pronto para cifra tocável.");

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
  if (byId("measureConfidenceScoreAudit58")) return;
  const previous = byId("omrOcrReviewComparisonAudit57");
  const anchor = previous || document.querySelector("main");
  if (!anchor) return;

  const section = document.createElement("section");
  section.id = "measureConfidenceScoreAudit58";
  section.className = "panel active";
  section.innerHTML = `
    <h2>3G. Score final de confiança por compasso</h2>
    <p class="hint">Auditoria 58: calcula score por compasso apenas para leitura, relatório e exportação. Não altera protocolo nem libera cifra tocável automaticamente.</p>
    <div class="toolbar sticky">
      <button id="btnRunMeasureConfidenceScore" class="primary">Gerar score por compasso</button>
      <button id="btnExportMeasureConfidenceScore" class="ghost">Exportar score JSON</button>
    </div>
    <pre id="measureConfidenceScoreOutput" class="report small-report">Score por compasso ainda não gerado.</pre>
  `;
  anchor.insertAdjacentElement("afterend", section);
}

function bindButtons() {
  const run = byId("btnRunMeasureConfidenceScore");
  const exp = byId("btnExportMeasureConfidenceScore");

  if (run) {
    run.onclick = event => {
      event.preventDefault();
      const report = buildMeasureConfidenceReport();
      const out = byId("measureConfidenceScoreOutput");
      if (out) out.textContent = `${humanReport(report)}\n\nJSON:\n${JSON.stringify(report, null, 2)}`;
    };
  }

  if (exp) {
    exp.onclick = event => {
      event.preventDefault();
      const report = buildMeasureConfidenceReport();
      const text = JSON.stringify(report, null, 2);
      const out = byId("measureConfidenceScoreOutput");
      if (out) out.textContent = `${humanReport(report)}\n\nJSON:\n${text}`;
      downloadText(`cpp_score_confianca_compassos_audit58_${timestamp()}.json`, text);
    };
  }
}

function markBuild() {
  window.CPP_ACTIVE_BUILD = AUDIT58_BUILD;
  const build = byId("frontendBuild");
  if (build) build.textContent = `Frontend build: ${AUDIT58_BUILD}`;
}

function initAudit58MeasureConfidenceScore() {
  markBuild();
  createPanel();
  bindButtons();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAudit58MeasureConfidenceScore);
} else {
  initAudit58MeasureConfidenceScore();
}
