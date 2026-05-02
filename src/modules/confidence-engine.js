function confidenceRank(value) {
  return { certo: 0, provável: 1, incerto: 2, ilegível: 3 }[value] ?? 1;
}

function worstConfidence(values) {
  if (!values.length) return "provável";
  return values.slice().sort((a, b) => confidenceRank(b) - confidenceRank(a))[0];
}

export function scoreMeasureConfidence(measure) {
  if (!measure) return "incerto";

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
  measure.review_required = ["incerto", "ilegível"].includes(measure.confidence) || hasHighWarning;
  return measure.confidence;
}

export function scoreSystemConfidence(protocol, systemId) {
  const measures = protocol.measures.filter(m => m.system_id === systemId);
  measures.forEach(scoreMeasureConfidence);

  const uncertain = measures.filter(m => ["incerto", "ilegível"].includes(m.confidence)).length;
  const probable = measures.filter(m => m.confidence === "provável").length;
  const system = protocol.systems.find(s => s.system_id === systemId);

  if (system) {
    system.confidence = uncertain ? "incerto" : (probable ? "provável" : "certo");
    system.detected_summary ||= {};
    system.detected_summary.warnings ||= [];
    if (uncertain) system.detected_summary.warnings.push(`${uncertain} compasso(s) incerto(s).`);
    if (probable) system.detected_summary.warnings.push(`${probable} compasso(s) com revisão recomendada.`);
  }
}

function shouldReportMeasureUncertainty(measure) {
  const reviewStatus = measure.review_status || "pending";
  if (reviewStatus === "approved" && measure.review_required !== true) return false;

  return (
    measure.review_required === true ||
    ["provável", "incerto", "ilegível"].includes(measure.confidence) ||
    reviewStatus === "needs_fix"
  );
}

function appendReviewInstruction(lines, measure) {
  const reviewStatus = measure.review_status || "pending";

  if (reviewStatus === "approved") {
    lines.push("- Leitura aprovada pelo usuário.");
    return;
  }

  if (reviewStatus === "needs_fix") {
    lines.push("- Compasso marcado como incerto pelo usuário. Revisão obrigatória antes da exportação final.");
    return;
  }

  lines.push("- Revisar leitura importada do MusicXML.");
}

export function globalUncertaintyReport(protocol) {
  const lines = ["RELATÓRIO DE INCERTEZAS", ""];

  for (const measure of protocol.measures || []) {
    if (!shouldReportMeasureUncertainty(measure)) continue;

    lines.push(`Compasso ${measure.number}: ${measure.confidence || "provável"}`);
    lines.push(`Status de revisão: ${measure.review_status || "pending"}`);

    if (measure.alignments?.length) {
      measure.alignments.forEach(alignment => {
        lines.push(`- Alinhamento ${alignment.alignment_type}: ${alignment.confidence || "provável"} (${alignment.source || "musicxml"})`);
      });
    }

    (measure.alignment_warnings || []).forEach(warning => {
      lines.push(`- ${warning.message || warning.type}`);
    });

    if (!measure.alignments?.length && !measure.alignment_warnings?.length) {
      appendReviewInstruction(lines, measure);
    }

    lines.push("");
  }

  if (lines.length === 2) lines.push("Nenhuma incerteza registrada.");
  return lines.join("\n");
}
