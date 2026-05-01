import { worstConfidence } from "./music-models.js";

export function scoreMeasureConfidence(measure) {
  const active = measure.alignments || [];
  if (!active.length) {
    measure.confidence = measure.detected_elements?.chords?.length || measure.detected_elements?.syllables?.length ? "provável" : "incerto";
  } else {
    measure.confidence = worstConfidence(active.map(a => a.confidence || "provável"));
  }
  measure.review_required = ["incerto", "ilegível"].includes(measure.confidence) || (measure.alignment_warnings || []).some(w => w.severity === "high");
  return measure.confidence;
}

export function scoreSystemConfidence(protocol, systemId) {
  const measures = protocol.measures.filter(m => m.system_id === systemId);
  measures.forEach(scoreMeasureConfidence);
  const uncertain = measures.filter(m => ["incerto","ilegível"].includes(m.confidence)).length;
  const system = protocol.systems.find(s => s.system_id === systemId);
  if (system) {
    system.confidence = measures.length && uncertain / measures.length > 0.2 ? "incerto" : "provável";
    if (uncertain) system.detected_summary?.warnings?.push(`${uncertain} compasso(s) incerto(s).`);
  }
}

export function globalUncertaintyReport(protocol) {
  const lines = ["RELATÓRIO DE INCERTEZAS", ""];
  for (const m of protocol.measures) {
    if (m.review_required || ["incerto","ilegível"].includes(m.confidence)) {
      lines.push(`Compasso ${m.number}: ${m.confidence}`);
      (m.alignment_warnings || []).forEach(w => lines.push(`- ${w.message || w.type}`));
      if (!m.alignment_warnings?.length) lines.push("- Revisar leitura/alinhamento.");
      lines.push("");
    }
  }
  if (lines.length === 2) lines.push("Nenhuma incerteza crítica registrada.");
  return lines.join("\n");
}
