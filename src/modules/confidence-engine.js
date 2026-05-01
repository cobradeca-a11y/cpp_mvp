import { worstConfidence } from "./music-models.js";

export function scoreMeasureConfidence(measure) {
  const active = measure.alignments || [];
  const warnings = measure.alignment_warnings || [];

  if (!active.length) {
    if (measure.detected_elements?.chords?.length || measure.detected_elements?.syllables?.length || measure.detected_elements?.note_heads?.length) {
      measure.confidence = "provável";
    } else {
      measure.confidence = "incerto";
    }
  } else {
    measure.confidence = worstConfidence(active.map(a => a.confidence || "provável"));
  }

  const hasHighWarning = warnings.some(w => w.severity === "high");
  const tooManyAutoNoReview = active.some(a => a.source === "auto" && a.confidence !== "certo");
  measure.review_required = ["incerto", "ilegível"].includes(measure.confidence) || hasHighWarning || tooManyAutoNoReview;
  return measure.confidence;
}

export function scoreSystemConfidence(protocol, systemId) {
  const measures = protocol.measures.filter(m => m.system_id === systemId);
  measures.forEach(scoreMeasureConfidence);
  const uncertain = measures.filter(m => ["incerto","ilegível"].includes(m.confidence)).length;
  const probable = measures.filter(m => m.confidence === "provável").length;
  const system = protocol.systems.find(s => s.system_id === systemId);

  if (system) {
    system.confidence = uncertain ? "incerto" : (probable ? "provável" : "certo");
    system.detected_summary ||= {};
    system.detected_summary.warnings ||= [];
    system.detected_summary.warnings = system.detected_summary.warnings.filter(w => !/compasso\(s\)/.test(w));
    if (uncertain) system.detected_summary.warnings.push(`${uncertain} compasso(s) incerto(s).`);
    if (probable) system.detected_summary.warnings.push(`${probable} compasso(s) com leitura provável e recomendação de revisão.`);
  }
}

export function globalUncertaintyReport(protocol) {
  const lines = ["RELATÓRIO DE INCERTEZAS", ""];
  for (const m of protocol.measures) {
    if (m.review_required || ["provável","incerto","ilegível"].includes(m.confidence)) {
      lines.push(`Compasso ${m.number}: ${m.confidence}`);
      lines.push(`Status de revisão: ${m.review_status || "pending"}`);
      if (m.alignments?.length) {
        m.alignments.forEach(a => lines.push(`- Alinhamento ${a.alignment_type}: ${a.confidence} (${a.source || "sem fonte"})`));
      }
      (m.alignment_warnings || []).forEach(w => lines.push(`- ${w.message || w.type}`));
      if (!m.alignment_warnings?.length && !m.alignments?.length) lines.push("- Revisar leitura/alinhamento.");
      lines.push("");
    }
  }
  if (lines.length === 2) lines.push("Nenhuma incerteza registrada.");
  return lines.join("\n");
}
