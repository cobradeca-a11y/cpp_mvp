const AUDIT57_BUILD = "audit-57-cache-v2";
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

function count(value) {
  return Array.isArray(value) ? value.length : 0;
}

function groupReviews(review = []) {
  const summary = {
    total: count(review),
    measure_reviews: 0,
    ocr_classification_reviews: 0,
    ocr_system_reviews: 0,
    ocr_measure_reviews: 0,
    approved: 0,
    rejected: 0,
    confirmed: 0,
    uncertain: 0,
  };

  review.forEach(item => {
    if (item?.type === "measure_review") summary.measure_reviews += 1;
    if (item?.type === "ocr_classification_review") summary.ocr_classification_reviews += 1;
    if (item?.type === "ocr_system_association_review") summary.ocr_system_reviews += 1;
    if (item?.type === "ocr_measure_association_review") summary.ocr_measure_reviews += 1;
    if (item?.decision === "approved" || item?.decision === "accept") summary.approved += 1;
    if (item?.decision === "rejected") summary.rejected += 1;
    if (item?.decision === "confirmed") summary.confirmed += 1;
    if (item?.decision === "uncertain") summary.uncertain += 1;
  });

  return summary;
}

function classificationCounts(blocks = []) {
  return blocks.reduce((acc, block) => {
    const key = block?.classification || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function buildComparison() {
  const protocol = loadProtocol();
  const source = protocol?.source || {};
  const music = protocol?.music || {};
  const ocr = protocol?.ocr || {};
  const fusion = protocol?.fusion || {};
  const measures = Array.isArray(protocol?.measures) ? protocol.measures : [];
  const blocks = Array.isArray(fusion?.text_blocks_index) ? fusion.text_blocks_index : [];
  const review = Array.isArray(protocol?.review) ? protocol.review : [];

  const measureMeters = [...new Set(measures.map(m => m?.meter).filter(Boolean))];
  const reviewSummary = groupReviews(review);
  const assignedToMeasure = blocks.filter(block => block?.measure_association?.status === "assigned").length;
  const assignedToSystem = blocks.filter(block => block?.system_association?.status === "assigned").length;

  const comparison = {
    export_type: "cpp_omr_ocr_review_comparison",
    audit: "audit-57",
    generated_at: new Date().toISOString(),
    frontend: {
      build: AUDIT57_BUILD,
    },
    source: {
      file_name: source.file_name || "",
      file_type: source.file_type || "",
      validation_status: source.validation_status || protocol?.validation?.validation_status || "pending",
    },
    omr_musicxml_layer: {
      status: source.omr_status || "pending",
      engine: source.omr_engine || "",
      pages: count(protocol?.pages),
      systems: count(protocol?.systems),
      measures: measures.length,
      meter_default: music.meter_default || "",
      meter_values_seen: measureMeters,
      key: music.key || "",
      tempo: music.tempo || "",
      evidence_status: measures.length > 0 ? "available" : "missing",
    },
    ocr_fusion_layer: {
      status: source.ocr_status || ocr.status || "pending",
      engine: source.ocr_engine || ocr.engine || "",
      ocr_text_blocks: count(ocr.text_blocks),
      fusion_indexed_blocks: blocks.length,
      possible_chords: count(ocr.possible_chords) || count(fusion.possible_chords),
      possible_lyrics: Object.entries(classificationCounts(blocks)).filter(([key]) => ["possible_lyric", "lyric_syllable_fragment"].includes(key)).reduce((sum, [, value]) => sum + value, 0),
      classification_counts: classificationCounts(blocks),
      assigned_to_system: assignedToSystem,
      assigned_to_measure: assignedToMeasure,
      mapping_status: fusion.status || "",
    },
    human_review_layer: reviewSummary,
    comparison_findings: [],
    safety_contract: {
      modifies_protocol: false,
      modifies_ocr_raw_text: false,
      infers_lyrics: false,
      infers_harmony: false,
      aligns_ocr_to_measure_without_geometry: false,
      comparison_only: true,
    },
  };

  if (comparison.omr_musicxml_layer.measures > 0 && comparison.ocr_fusion_layer.ocr_text_blocks > 0) {
    comparison.comparison_findings.push({
      severity: "info",
      code: "omr_and_ocr_available",
      message: "OMR/MusicXML e OCR/Fusion possuem evidências disponíveis para comparação.",
    });
  }

  if (comparison.ocr_fusion_layer.ocr_text_blocks === comparison.ocr_fusion_layer.fusion_indexed_blocks && comparison.ocr_fusion_layer.ocr_text_blocks > 0) {
    comparison.comparison_findings.push({
      severity: "info",
      code: "ocr_fusion_counts_match",
      message: "Quantidade de blocos OCR e blocos indexados no Fusion coincide.",
      evidence: {
        blocks: comparison.ocr_fusion_layer.ocr_text_blocks,
      },
    });
  }

  if (comparison.ocr_fusion_layer.assigned_to_measure === 0 && comparison.ocr_fusion_layer.ocr_text_blocks > 0) {
    comparison.comparison_findings.push({
      severity: "info",
      code: "ocr_measure_mapping_pending",
      message: "OCR ainda não está atribuído a compassos. Isso preserva a regra de não alinhar sem geometria confiável.",
    });
  }

  if (comparison.human_review_layer.total === 0) {
    comparison.comparison_findings.push({
      severity: "info",
      code: "human_review_absent",
      message: "Ainda não há revisão humana para comparar contra OMR/OCR.",
    });
  }

  if (!comparison.omr_musicxml_layer.key) {
    comparison.comparison_findings.push({
      severity: "info",
      code: "key_not_available",
      message: "Tom/armadura não está disponível no protocolo. Não será inferido.",
    });
  }

  if (!comparison.omr_musicxml_layer.tempo) {
    comparison.comparison_findings.push({
      severity: "info",
      code: "tempo_not_available",
      message: "Andamento não está disponível no protocolo. Não será inferido.",
    });
  }

  return comparison;
}

function humanReport(report) {
  const lines = [
    "COMPARAÇÃO OMR × OCR × REVISÃO HUMANA — AUDITORIA 57",
    "",
    `Arquivo: ${report.source.file_name || "nenhum protocolo salvo"}`,
    "",
    "Camada OMR/MusicXML:",
    `- Status: ${report.omr_musicxml_layer.status}`,
    `- Sistemas: ${report.omr_musicxml_layer.systems}`,
    `- Compassos: ${report.omr_musicxml_layer.measures}`,
    `- Tom: ${report.omr_musicxml_layer.key || "pendente — não inferido"}`,
    `- Compasso padrão: ${report.omr_musicxml_layer.meter_default || "pendente — não inferido"}`,
    `- Andamento: ${report.omr_musicxml_layer.tempo || "pendente — não inferido"}`,
    "",
    "Camada OCR/Fusion:",
    `- Status OCR: ${report.ocr_fusion_layer.status}`,
    `- Blocos OCR: ${report.ocr_fusion_layer.ocr_text_blocks}`,
    `- Blocos Fusion: ${report.ocr_fusion_layer.fusion_indexed_blocks}`,
    `- Textos/letras candidatos: ${report.ocr_fusion_layer.possible_lyrics}`,
    `- Cifras candidatas: ${report.ocr_fusion_layer.possible_chords}`,
    `- OCR→sistema atribuídos: ${report.ocr_fusion_layer.assigned_to_system}`,
    `- OCR→compasso atribuídos: ${report.ocr_fusion_layer.assigned_to_measure}`,
    "",
    "Camada revisão humana:",
    `- Decisões totais: ${report.human_review_layer.total}`,
    `- Revisões de compasso: ${report.human_review_layer.measure_reviews}`,
    `- Revisões OCR classificação: ${report.human_review_layer.ocr_classification_reviews}`,
    `- Revisões OCR→sistema: ${report.human_review_layer.ocr_system_reviews}`,
    `- Revisões OCR→compasso: ${report.human_review_layer.ocr_measure_reviews}`,
    "",
    "Achados comparativos:",
  ];

  if (!report.comparison_findings.length) {
    lines.push("- Nenhum achado comparativo relevante.");
  } else {
    report.comparison_findings.forEach(item => {
      lines.push(`- [${item.severity}] ${item.code}: ${item.message}`);
    });
  }

  lines.push("", "Contrato:");
  lines.push("- Comparação apenas leitura.");
  lines.push("- Não altera protocolo.");
  lines.push("- Não altera OCR bruto.");
  lines.push("- Não infere letra.");
  lines.push("- Não infere harmonia.");
  lines.push("- Não alinha OCR a compasso sem geometria confiável.");

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
  if (byId("omrOcrReviewComparisonAudit57")) return;
  const previous = byId("aiSuggestionsAudit56");
  const anchor = previous || document.querySelector("main");
  if (!anchor) return;

  const section = document.createElement("section");
  section.id = "omrOcrReviewComparisonAudit57";
  section.className = "panel active";
  section.innerHTML = `
    <h2>3F. Comparação OMR × OCR × revisão humana</h2>
    <p class="hint">Auditoria 57: compara camadas de evidência sem promover OCR para compasso, letra ou harmonia.</p>
    <div class="toolbar sticky">
      <button id="btnRunOmrOcrReviewComparison" class="primary">Gerar comparação</button>
      <button id="btnExportOmrOcrReviewComparison" class="ghost">Exportar comparação JSON</button>
    </div>
    <pre id="omrOcrReviewComparisonOutput" class="report small-report">Comparação ainda não gerada.</pre>
  `;
  anchor.insertAdjacentElement("afterend", section);
}

function bindButtons() {
  const run = byId("btnRunOmrOcrReviewComparison");
  const exp = byId("btnExportOmrOcrReviewComparison");

  if (run) {
    run.onclick = event => {
      event.preventDefault();
      const report = buildComparison();
      const out = byId("omrOcrReviewComparisonOutput");
      if (out) out.textContent = `${humanReport(report)}\n\nJSON:\n${JSON.stringify(report, null, 2)}`;
    };
  }

  if (exp) {
    exp.onclick = event => {
      event.preventDefault();
      const report = buildComparison();
      const text = JSON.stringify(report, null, 2);
      const out = byId("omrOcrReviewComparisonOutput");
      if (out) out.textContent = `${humanReport(report)}\n\nJSON:\n${text}`;
      downloadText(`cpp_comparacao_omr_ocr_revisao_audit57_${timestamp()}.json`, text);
    };
  }
}

function markBuild() {
  window.CPP_ACTIVE_BUILD = AUDIT57_BUILD;
  const build = byId("frontendBuild");
  if (build) build.textContent = `Frontend build: ${AUDIT57_BUILD}`;
}

function initAudit57Comparison() {
  markBuild();
  createPanel();
  bindButtons();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAudit57Comparison);
} else {
  initAudit57Comparison();
}
