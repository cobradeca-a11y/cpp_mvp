export function generateTechnicalChordSheet(protocol) {
  const lines = [];
  lines.push(`CIFRA TÉCNICA — ${protocol.music.title || "Sem título"}`);
  lines.push(`Tom: ${protocol.music.key || ""} | Compasso padrão: ${protocol.music.meter_default || ""} | Andamento: ${protocol.music.tempo || ""}`);
  lines.push("");

  appendChordLayerSeparationSection(lines, protocol);
  appendApprovedLyricsSection(lines, protocol);
  appendApprovedChordCandidatesSection(lines, protocol);

  const measures = (protocol.measures || []).slice().sort((a,b) => a.number - b.number);
  for (const m of measures) {
    const chords = (m.alignments || []).map(a => {
      const cm = (m.markers || []).find(x => x.marker_id === a.chord_marker_id);
      return { beat: a.beat, value: cm?.value || "?", conf: a.confidence };
    });
    const sylls = (m.markers || []).filter(x => x.type === "syllable").map(x => ({ beat: x.beat, value: x.value }));
    lines.push(`[Compasso ${m.number}] ${m.meter}${m.is_anacrusis ? " / anacruse" : ""}`);
    lines.push(`Tempo:    ${(m.time_grid || []).map(x => String(x).padEnd(8)).join("")}`);
    lines.push(`Acorde:   ${formatByGrid(m.time_grid, chords)}`);
    lines.push(`Sílaba:   ${formatByGrid(m.time_grid, sylls)}`);
    lines.push(`Lacunas:  ${formatMeasureGaps(protocol, m)}`);
    lines.push(`Conf.:    ${m.confidence || "provável"}`);
    if (m.alignment_warnings?.length) lines.push(`Obs.:     ${m.alignment_warnings.map(w => w.message || w.type).join("; ")}`);
    lines.push("");
  }
  const out = lines.join("\n");
  protocol.outputs.technical_chord_sheet = out;
  return out;
}

function appendChordLayerSeparationSection(lines, protocol) {
  const detectedChords = getDetectedChordBlocks(protocol);
  const approvedChords = getApprovedChordBlocks(protocol);
  const playableStatus = getPlayableChordLayerStatus(protocol, approvedChords);

  lines.push("CAMADAS DE CIFRA — AUDITORIA 42");
  lines.push("Regra: cifra detectada ≠ cifra aprovada ≠ cifra tocável.");
  lines.push(`Cifra detectada: ${detectedChords.length} candidato(s) OCR/Fusion.`);
  lines.push(`Cifra aprovada: ${approvedChords.length} candidato(s) com aprovação humana.`);
  lines.push(`Cifra tocável: ${playableStatus}`);
  lines.push("Obs.: nenhuma camada é promovida automaticamente para outra.");
  lines.push("");
}

function getPlayableChordLayerStatus(protocol, approvedChords) {
  if (!approvedChords.length) return "bloqueada — sem cifra aprovada";
  const measureAssociations = protocol.ocr_measure_associations?.associations || [];
  const hasAssignedMeasure = measureAssociations.some(item => item.association_status === "assigned_to_measure" && item.confidence_score > 0);
  if (!hasAssignedMeasure) return "bloqueada — sem alinhamento OCR→compasso confiável";
  return "pendente de geração tocável validada";
}

function appendApprovedLyricsSection(lines, protocol) {
  const approvedLyrics = getApprovedLyricBlocks(protocol);
  lines.push("LETRA APROVADA — AUDITORIA 40");
  lines.push("Fonte: somente blocos OCR com classificação aprovada por revisão humana.");

  if (!approvedLyrics.length) {
    lines.push("[lacuna] Nenhuma letra OCR aprovada para uso técnico.");
    lines.push("Obs.: letra não será inventada nem alinhada a compasso sem revisão/evidência suficiente.");
    lines.push("");
    return;
  }

  for (const block of approvedLyrics) {
    const page = block.page || "?";
    const id = block.fusion_id || "sem_id";
    const text = block.normalized_text || block.text || "";
    lines.push(`[OCR ${id} | pág. ${page}] ${text}`);
  }
  lines.push("Obs.: estes textos ainda não implicam alinhamento com sistema ou compasso.");
  lines.push("");
}

function appendApprovedChordCandidatesSection(lines, protocol) {
  const approvedChords = getApprovedChordBlocks(protocol);
  lines.push("CIFRAS APROVADAS — AUDITORIA 41");
  lines.push("Fonte: somente cifras candidatas OCR aprovadas por revisão humana.");

  if (!approvedChords.length) {
    lines.push("[lacuna] Nenhuma cifra OCR aprovada para uso técnico.");
    lines.push("Obs.: harmonia não será inferida; cifra detectada não vira cifra final sem aprovação humana.");
    lines.push("");
    return;
  }

  for (const block of approvedChords) {
    const page = block.page || "?";
    const id = block.fusion_id || "sem_id";
    const text = block.normalized_text || block.text || "";
    const analysis = block.chord_analysis ? formatChordAnalysisSummary(block.chord_analysis) : "análise estrutural indisponível";
    lines.push(`[OCR ${id} | pág. ${page}] ${text} — ${analysis}`);
  }
  lines.push("Obs.: cifras aprovadas permanecem sem alinhamento automático com sistema ou compasso.");
  lines.push("");
}

function formatMeasureGaps(protocol, measure) {
  const gaps = getMeasureGaps(protocol, measure);
  if (!gaps.length) return "nenhuma lacuna técnica detectada nesta camada";
  return gaps.map(gap => gap.label).join("; ");
}

function getMeasureGaps(protocol, measure) {
  const gaps = [];
  const approvedLyrics = getApprovedLyricBlocks(protocol);
  const approvedChords = getApprovedChordBlocks(protocol);
  const measureAssociations = protocol.ocr_measure_associations?.associations || [];
  const measureId = measure.id || measure.measure_id || null;
  const measureNumber = measure.number;
  const hasReliableMeasureAssociation = measureAssociations.some(item => {
    const sameId = measureId && item.candidate_measure_id === measureId;
    const sameNumber = measureNumber !== undefined && item.candidate_measure_number === measureNumber;
    return item.association_status === "assigned_to_measure" && item.confidence_score > 0 && (sameId || sameNumber);
  });

  if (!approvedLyrics.length) gaps.push({ code: "missing_approved_lyrics", label: "sem letra aprovada" });
  if (!approvedChords.length) gaps.push({ code: "missing_approved_chords", label: "sem cifra aprovada" });
  if (!hasReliableMeasureAssociation) gaps.push({ code: "missing_reliable_ocr_measure_alignment", label: "sem alinhamento OCR→compasso confiável" });
  return gaps;
}

function getDetectedChordBlocks(protocol) {
  const blocks = protocol.fusion?.text_blocks_index || [];
  return blocks.filter(block => block.classification === "possible_chord");
}

function getApprovedLyricBlocks(protocol) {
  const blocks = protocol.fusion?.text_blocks_index || [];
  return blocks.filter(block => {
    const status = block.human_review?.status;
    const classification = block.classification;
    return status === "classification_approved" && isLyricLikeClassification(classification);
  });
}

function getApprovedChordBlocks(protocol) {
  const blocks = protocol.fusion?.text_blocks_index || [];
  return blocks.filter(block => {
    const status = block.human_review?.status;
    return status === "classification_approved" && block.classification === "possible_chord";
  });
}

function formatChordAnalysisSummary(analysis) {
  const parts = [];
  if (analysis.kind) parts.push(`tipo=${analysis.kind}`);
  if (analysis.root) parts.push(`raiz=${analysis.root}`);
  if (analysis.extension) parts.push(`extensão=${analysis.extension}`);
  if (analysis.bass) parts.push(`baixo=${analysis.bass}`);
  return parts.length ? parts.join(", ") : "análise estrutural sem campos principais";
}

function isLyricLikeClassification(classification) {
  return [
    "possible_lyric",
    "lyric_syllable_fragment",
    "lyric_hyphen_or_continuation",
  ].includes(classification);
}

function formatByGrid(grid = [], items = []) {
  return grid.map(g => {
    const found = items.filter(i => i.beat === g).map(i => i.value + (i.conf === "incerto" ? "?" : "")).join("/");
    return (found || "").padEnd(8);
  }).join("");
}
