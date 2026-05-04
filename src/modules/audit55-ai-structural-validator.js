const AUDIT55_BUILD = "audit-55-cache-v1";
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

function count(arrayLike) {
  return Array.isArray(arrayLike) ? arrayLike.length : 0;
}

function pushIssue(issues, severity, code, message, evidence = {}) {
  issues.push({ severity, code, message, evidence, action: "pending_human_review" });
}

function validateProtocolStructure(protocol) {
  const issues = [];
  const source = protocol?.source || {};
  const ocr = protocol?.ocr || {};
  const fusion = protocol?.fusion || {};
  const measures = Array.isArray(protocol?.measures) ? protocol.measures : [];
  const textBlocks = Array.isArray(ocr.text_blocks) ? ocr.text_blocks : [];
  const indexed = Array.isArray(fusion.text_blocks_index) ? fusion.text_blocks_index : [];
  const review = Array.isArray(protocol?.review) ? protocol.review : [];

  if (!protocol?.cpp_version) {
    pushIssue(issues, "warning", "missing_cpp_version", "Protocolo sem cpp_version explícito.");
  }

  if (!source.file_name) {
    pushIssue(issues, "warning", "missing_source_file", "Nome do arquivo de origem ausente.");
  }

  if (source.omr_status !== "success" && source.omr_status !== "musicxml_parsed") {
    pushIssue(issues, "warning", "omr_not_success", "OMR não está em estado success/musicxml_parsed.", { omr_status: source.omr_status || "" });
  }

  if ((source.ocr_status || ocr.status) === "success" && textBlocks.length === 0) {
    pushIssue(issues, "warning", "ocr_success_without_blocks", "OCR marcado como success, mas sem text_blocks.");
  }

  if (textBlocks.length > 0 && indexed.length === 0) {
    pushIssue(issues, "warning", "ocr_blocks_not_indexed", "Há blocos OCR, mas o Fusion não possui índice textual.", {
      ocr_text_blocks: textBlocks.length,
      fusion_indexed_blocks: indexed.length,
    });
  }

  if (textBlocks.length > 0 && indexed.length > 0 && textBlocks.length !== indexed.length) {
    pushIssue(issues, "info", "ocr_fusion_count_diff", "Quantidade de blocos OCR difere do índice Fusion.", {
      ocr_text_blocks: textBlocks.length,
      fusion_indexed_blocks: indexed.length,
    });
  }

  if (measures.length === 0) {
    pushIssue(issues, "warning", "no_measures", "Nenhum compasso importado no protocolo.");
  }

  if (fusion.status === "evidence_indexed_needs_layout_mapping") {
    pushIssue(issues, "info", "layout_mapping_pending", "Fusion indexou evidências, mas OCR→sistema/compasso permanece pendente até geometria confiável.", {
      fusion_status: fusion.status,
      fusion_version: fusion.version || "",
    });
  }

  if (review.length === 0) {
    pushIssue(issues, "info", "no_human_review", "Nenhuma decisão humana registrada ainda.");
  }

  const ocrMeasureAssigned = indexed.filter(block => block?.measure_association?.status === "assigned").length;
  if (ocrMeasureAssigned === 0 && textBlocks.length > 0) {
    pushIssue(issues, "info", "no_ocr_measure_assignment", "Nenhum bloco OCR está atribuído a compasso. Isso é esperado sem geometria confiável.", {
      ocr_text_blocks: textBlocks.length,
    });
  }

  return issues;
}

function buildValidationReport() {
  const protocol = loadProtocol();
  const source = protocol?.source || {};
  const ocr = protocol?.ocr || {};
  const fusion = protocol?.fusion || {};
  const issues = validateProtocolStructure(protocol);
  const blocking = issues.filter(issue => issue.severity === "error").length;
  const warnings = issues.filter(issue => issue.severity === "warning").length;
  const infos = issues.filter(issue => issue.severity === "info").length;

  return {
    export_type: "cpp_ai_structural_validation",
    audit: "audit-55",
    generated_at: new Date().toISOString(),
    validator: {
      mode: "structural_rule_based_placeholder",
      applies_changes: false,
      uses_external_ai: false,
      purpose: "preparar camada de IA validadora sem modificar o protocolo",
    },
    source: {
      file_name: source.file_name || "",
      file_type: source.file_type || "",
      omr_status: source.omr_status || "",
      ocr_status: source.ocr_status || ocr.status || "",
      fusion_status: fusion.status || "",
      validation_status: source.validation_status || protocol?.validation?.validation_status || "pending",
    },
    counts: {
      pages: count(protocol?.pages),
      systems: count(protocol?.systems),
      measures: count(protocol?.measures),
      ocr_text_blocks: count(ocr.text_blocks),
      fusion_text_blocks: count(fusion.text_blocks_index),
      human_review_decisions: count(protocol?.review),
    },
    issue_summary: {
      errors: blocking,
      warnings,
      info: infos,
      total: issues.length,
    },
    issues,
    recommendations: issues.map(issue => ({
      code: issue.code,
      recommendation: issue.action,
      automatic_change: false,
    })),
    safety_contract: {
      modifies_protocol: false,
      modifies_ocr_raw_text: false,
      infers_lyrics: false,
      infers_harmony: false,
      aligns_ocr_to_measure_without_geometry: false,
      requires_human_review_for_uncertain_evidence: true,
    },
  };
}

function humanReport(report) {
  const lines = [
    "IA VALIDADORA ESTRUTURAL — AUDITORIA 55",
    "",
    "Modo: validação estrutural sem alteração automática",
    `Arquivo: ${report.source.file_name || "nenhum protocolo salvo"}`,
    `OMR: ${report.source.omr_status || "não informado"}`,
    `OCR: ${report.source.ocr_status || "não informado"}`,
    `Fusion: ${report.source.fusion_status || "não informado"}`,
    `Compassos: ${report.counts.measures}`,
    `Blocos OCR: ${report.counts.ocr_text_blocks}`,
    `Blocos Fusion: ${report.counts.fusion_text_blocks}`,
    `Decisões humanas: ${report.counts.human_review_decisions}`,
    "",
    "Resumo:",
    `- Erros: ${report.issue_summary.errors}`,
    `- Warnings: ${report.issue_summary.warnings}`,
    `- Informativos: ${report.issue_summary.info}`,
    "",
    "Achados:",
  ];

  if (!report.issues.length) {
    lines.push("- Nenhum achado estrutural relevante.");
  } else {
    report.issues.forEach(issue => {
      lines.push(`- [${issue.severity}] ${issue.code}: ${issue.message}`);
    });
  }

  lines.push("", "Contrato:");
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
  if (byId("aiStructuralValidatorAudit55")) return;
  const diag = byId("fullDiagnosticsAudit54");
  const anchor = diag || document.querySelector("main");
  if (!anchor) return;

  const section = document.createElement("section");
  section.id = "aiStructuralValidatorAudit55";
  section.className = "panel active";
  section.innerHTML = `
    <h2>3D. IA validadora estrutural</h2>
    <p class="hint">Auditoria 55: validação estrutural assistida, sem aplicar mudanças automáticas no protocolo.</p>
    <div class="toolbar sticky">
      <button id="btnRunAiStructuralValidation" class="primary">Executar validação estrutural</button>
      <button id="btnExportAiStructuralValidation" class="ghost">Exportar validação JSON</button>
    </div>
    <pre id="aiStructuralValidationOutput" class="report small-report">Validação estrutural ainda não executada.</pre>
  `;
  anchor.insertAdjacentElement("afterend", section);
}

function bindButtons() {
  const run = byId("btnRunAiStructuralValidation");
  const exp = byId("btnExportAiStructuralValidation");

  if (run) {
    run.onclick = event => {
      event.preventDefault();
      const report = buildValidationReport();
      const out = byId("aiStructuralValidationOutput");
      if (out) out.textContent = `${humanReport(report)}\n\nJSON:\n${JSON.stringify(report, null, 2)}`;
    };
  }

  if (exp) {
    exp.onclick = event => {
      event.preventDefault();
      const report = buildValidationReport();
      const text = JSON.stringify(report, null, 2);
      const out = byId("aiStructuralValidationOutput");
      if (out) out.textContent = `${humanReport(report)}\n\nJSON:\n${text}`;
      downloadText(`cpp_validacao_estrutural_audit55_${timestamp()}.json`, text);
    };
  }
}

function markBuild() {
  const build = byId("frontendBuild");
  if (build) build.textContent = `Frontend build: ${AUDIT55_BUILD}`;
}

function initAudit55StructuralValidator() {
  markBuild();
  createPanel();
  bindButtons();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAudit55StructuralValidator);
} else {
  initAudit55StructuralValidator();
}
