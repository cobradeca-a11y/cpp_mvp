const AUDIT56_BUILD = "audit-56-cache-v1";
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

function addSuggestion(suggestions, severity, code, title, rationale, target, proposedAction) {
  suggestions.push({
    severity,
    code,
    title,
    rationale,
    target,
    proposed_action: proposedAction,
    automatic_apply: false,
    status: "suggested_pending_human_review",
  });
}

function buildSuggestions(protocol) {
  const suggestions = [];
  const ocrBlocks = Array.isArray(protocol?.ocr?.text_blocks) ? protocol.ocr.text_blocks : [];
  const indexedBlocks = Array.isArray(protocol?.fusion?.text_blocks_index) ? protocol.fusion.text_blocks_index : [];
  const review = Array.isArray(protocol?.review) ? protocol.review : [];
  const measures = Array.isArray(protocol?.measures) ? protocol.measures : [];
  const fusionStatus = protocol?.fusion?.status || "";
  const validationStatus = protocol?.validation?.validation_status || protocol?.source?.validation_status || "pending";

  if (fusionStatus === "evidence_indexed_needs_layout_mapping") {
    addSuggestion(
      suggestions,
      "info",
      "suggest_review_layout_mapping",
      "Revisar associação OCR→sistema/compasso",
      "Fusion indexou evidências, mas a relação OCR→sistema/compasso permanece pendente por falta de geometria confiável.",
      { section: "2A", field: "ocr_system_measure_association" },
      "Abrir revisão humana dos blocos OCR antes de qualquer uso em cifra técnica."
    );
  }

  if (ocrBlocks.length > 0 && review.length === 0) {
    addSuggestion(
      suggestions,
      "info",
      "suggest_start_human_review",
      "Iniciar revisão humana OCR",
      "Há blocos OCR disponíveis, mas nenhuma decisão humana registrada ainda.",
      { section: "2A", ocr_text_blocks: ocrBlocks.length },
      "Aprovar/rejeitar classificação OCR por bloco antes de promover texto para saída técnica."
    );
  }

  const possibleLyrics = indexedBlocks.filter(block => ["possible_lyric", "lyric_syllable_fragment"].includes(block?.classification)).length;
  if (possibleLyrics > 0) {
    addSuggestion(
      suggestions,
      "info",
      "suggest_review_possible_lyrics",
      "Revisar textos candidatos a letra",
      "Existem textos OCR classificados como possíveis letras ou fragmentos, mas isso não autoriza uso automático.",
      { section: "2A", possible_lyrics: possibleLyrics },
      "Manter como pendente até aprovação humana explícita."
    );
  }

  const possibleChords = count(protocol?.ocr?.possible_chords) || count(protocol?.fusion?.possible_chords);
  if (possibleChords > 0) {
    addSuggestion(
      suggestions,
      "warning",
      "suggest_review_possible_chords",
      "Revisar cifras candidatas sem inferir harmonia",
      "Foram detectadas cifras candidatas, mas cifra detectada não vira cifra aprovada sem revisão humana.",
      { section: "2A", possible_chords: possibleChords },
      "Revisar individualmente e aprovar apenas evidências explícitas."
    );
  }

  if (measures.length > 0 && validationStatus === "pending") {
    addSuggestion(
      suggestions,
      "info",
      "suggest_measure_review_queue",
      "Revisar compassos importados",
      "Compassos foram importados via MusicXML/OMR e permanecem com validação pendente.",
      { section: "2", measures: measures.length },
      "Usar Aceitar leitura / Marcar incerto por compasso conforme conferência humana."
    );
  }

  return suggestions;
}

function buildSuggestionReport() {
  const protocol = loadProtocol();
  const suggestions = buildSuggestions(protocol);
  const source = protocol?.source || {};

  return {
    export_type: "cpp_ai_suggestion_report",
    audit: "audit-56",
    generated_at: new Date().toISOString(),
    validator: {
      mode: "suggestions_only_no_auto_apply",
      applies_changes: false,
      uses_external_ai: false,
      description: "Camada conservadora de sugestões estruturais preparada para IA futura.",
    },
    source: {
      file_name: source.file_name || "",
      file_type: source.file_type || "",
      omr_status: source.omr_status || "",
      ocr_status: source.ocr_status || protocol?.ocr?.status || "",
      fusion_status: protocol?.fusion?.status || "",
    },
    summary: {
      suggestions: suggestions.length,
      warnings: suggestions.filter(item => item.severity === "warning").length,
      info: suggestions.filter(item => item.severity === "info").length,
      automatic_changes: 0,
    },
    suggestions,
    safety_contract: {
      applies_suggestions_automatically: false,
      modifies_protocol: false,
      modifies_ocr_raw_text: false,
      infers_lyrics: false,
      infers_harmony: false,
      aligns_ocr_to_measure_without_geometry: false,
      requires_human_review_for_all_suggestions: true,
    },
  };
}

function humanReport(report) {
  const lines = [
    "IA SUGERE CORREÇÕES — AUDITORIA 56",
    "",
    "Modo: sugestões somente; nenhuma aplicação automática",
    `Arquivo: ${report.source.file_name || "nenhum protocolo salvo"}`,
    `OMR: ${report.source.omr_status || "não informado"}`,
    `OCR: ${report.source.ocr_status || "não informado"}`,
    `Fusion: ${report.source.fusion_status || "não informado"}`,
    "",
    "Resumo:",
    `- Sugestões: ${report.summary.suggestions}`,
    `- Warnings: ${report.summary.warnings}`,
    `- Informativos: ${report.summary.info}`,
    `- Mudanças automáticas: ${report.summary.automatic_changes}`,
    "",
    "Sugestões:",
  ];

  if (!report.suggestions.length) {
    lines.push("- Nenhuma sugestão estrutural no estado atual.");
  } else {
    report.suggestions.forEach(item => {
      lines.push(`- [${item.severity}] ${item.code}: ${item.title}`);
      lines.push(`  Motivo: ${item.rationale}`);
      lines.push(`  Ação proposta: ${item.proposed_action}`);
      lines.push("  Aplicação automática: não");
    });
  }

  lines.push("", "Contrato:");
  lines.push("- Sugestões não são aplicadas automaticamente.");
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
  if (byId("aiSuggestionsAudit56")) return;
  const previous = byId("aiStructuralValidatorAudit55");
  const anchor = previous || document.querySelector("main");
  if (!anchor) return;

  const section = document.createElement("section");
  section.id = "aiSuggestionsAudit56";
  section.className = "panel active";
  section.innerHTML = `
    <h2>3E. IA sugere correções</h2>
    <p class="hint">Auditoria 56: gera sugestões estruturais, mas não aplica automaticamente nenhuma mudança.</p>
    <div class="toolbar sticky">
      <button id="btnRunAiSuggestions" class="primary">Gerar sugestões estruturais</button>
      <button id="btnExportAiSuggestions" class="ghost">Exportar sugestões JSON</button>
    </div>
    <pre id="aiSuggestionsOutput" class="report small-report">Sugestões ainda não geradas.</pre>
  `;
  anchor.insertAdjacentElement("afterend", section);
}

function bindButtons() {
  const run = byId("btnRunAiSuggestions");
  const exp = byId("btnExportAiSuggestions");

  if (run) {
    run.onclick = event => {
      event.preventDefault();
      const report = buildSuggestionReport();
      const out = byId("aiSuggestionsOutput");
      if (out) out.textContent = `${humanReport(report)}\n\nJSON:\n${JSON.stringify(report, null, 2)}`;
    };
  }

  if (exp) {
    exp.onclick = event => {
      event.preventDefault();
      const report = buildSuggestionReport();
      const text = JSON.stringify(report, null, 2);
      const out = byId("aiSuggestionsOutput");
      if (out) out.textContent = `${humanReport(report)}\n\nJSON:\n${text}`;
      downloadText(`cpp_sugestoes_estruturais_audit56_${timestamp()}.json`, text);
    };
  }
}

function markBuild() {
  const build = byId("frontendBuild");
  if (build) build.textContent = `Frontend build: ${AUDIT56_BUILD}`;
}

function initAudit56Suggestions() {
  markBuild();
  createPanel();
  bindButtons();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAudit56Suggestions);
} else {
  initAudit56Suggestions();
}
