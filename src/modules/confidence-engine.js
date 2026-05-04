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

export function musicalConfidenceReport(protocol) {
  const lines = ["RELATÓRIO DE CONFIANÇA MUSICAL — AUDITORIA 44", ""];
  const measures = protocol.measures || [];
  const reviews = protocol.review || [];
  const fusionBlocks = protocol.fusion?.text_blocks_index || [];
  const measureAssociations = protocol.ocr_measure_associations?.associations || [];
  const systemAssociations = protocol.ocr_system_associations?.associations || [];

  const approvedLyrics = fusionBlocks.filter(block => block.human_review?.status === "classification_approved" && isLyricLikeClassification(block.classification));
  const approvedChords = fusionBlocks.filter(block => block.human_review?.status === "classification_approved" && block.classification === "possible_chord");
  const detectedChords = fusionBlocks.filter(block => block.classification === "possible_chord");
  const blockedSystem = systemAssociations.filter(item => String(item.association_status || "").startsWith("blocked_")).length;
  const blockedMeasure = measureAssociations.filter(item => String(item.association_status || "").startsWith("blocked_")).length;
  const reliableMeasureAssociations = measureAssociations.filter(item => item.association_status === "assigned_to_measure" && Number(item.confidence_score || 0) > 0).length;

  lines.push("Resumo geral");
  lines.push(`- Compassos: ${measures.length}`);
  lines.push(`- Blocos OCR/Fusion: ${fusionBlocks.length}`);
  lines.push(`- Cifras detectadas: ${detectedChords.length}`);
  lines.push(`- Letras aprovadas: ${approvedLyrics.length}`);
  lines.push(`- Cifras aprovadas: ${approvedChords.length}`);
  lines.push(`- Decisões humanas registradas: ${reviews.length}`);
  lines.push(`- OCR→sistema bloqueados: ${blockedSystem}`);
  lines.push(`- OCR→compasso bloqueados: ${blockedMeasure}`);
  lines.push(`- OCR→compasso confiáveis: ${reliableMeasureAssociations}`);
  lines.push("");

  lines.push("Camadas musicais");
  lines.push(`- Detectada: ${detectedChords.length ? "há evidência OCR/Fusion" : "sem cifra detectada"}`);
  lines.push(`- Aprovada: ${approvedChords.length ? "há cifra aprovada por humano" : "bloqueada — sem cifra aprovada"}`);
  lines.push(`- Tocável: ${getPlayableLayerConfidenceStatus(approvedChords, reliableMeasureAssociations)}`);
  lines.push("");

  lines.push("Lacunas por compasso");
  if (!measures.length) {
    lines.push("- [lacuna] Nenhum compasso disponível para avaliar.");
  } else {
    for (const measure of measures.slice().sort((a, b) => a.number - b.number)) {
      const gaps = getMeasureConfidenceGaps(protocol, measure, approvedLyrics, approvedChords, measureAssociations);
      lines.push(`- Compasso ${measure.number}: ${gaps.length ? gaps.join("; ") : "sem lacuna técnica nesta camada"}`);
    }
  }
  lines.push("");

  lines.push("Regra conservadora");
  lines.push("- Este relatório não preenche lacunas.");
  lines.push("- Este relatório não infere letra.");
  lines.push("- Este relatório não infere harmonia.");
  lines.push("- Este relatório não promove cifra detectada para aprovada ou tocável.");

  return lines.join("\n");
}

function getPlayableLayerConfidenceStatus(approvedChords, reliableMeasureAssociations) {
  if (!approvedChords.length) return "bloqueada — sem cifra aprovada";
  if (!reliableMeasureAssociations) return "bloqueada — sem alinhamento OCR→compasso confiável";
  return "pendente — exige geração tocável validada";
}

function getMeasureConfidenceGaps(protocol, measure, approvedLyrics, approvedChords, measureAssociations) {
  const gaps = [];
  const measureId = measure.id || measure.measure_id || null;
  const measureNumber = measure.number;
  const hasReliableMeasureAssociation = measureAssociations.some(item => {
    const sameId = measureId && item.candidate_measure_id === measureId;
    const sameNumber = measureNumber !== undefined && item.candidate_measure_number === measureNumber;
    return item.association_status === "assigned_to_measure" && Number(item.confidence_score || 0) > 0 && (sameId || sameNumber);
  });

  if (!approvedLyrics.length) gaps.push("sem letra aprovada");
  if (!approvedChords.length) gaps.push("sem cifra aprovada");
  if (!hasReliableMeasureAssociation) gaps.push("sem alinhamento OCR→compasso confiável");
  return gaps;
}

function isLyricLikeClassification(classification) {
  return [
    "possible_lyric",
    "lyric_syllable_fragment",
    "lyric_hyphen_or_continuation",
  ].includes(classification);
}
