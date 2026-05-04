export function generateTechnicalChordSheet(protocol) {
  const lines = [];
  lines.push(`CIFRA TÉCNICA — ${protocol.music.title || "Sem título"}`);
  lines.push(`Tom: ${protocol.music.key || ""} | Compasso padrão: ${protocol.music.meter_default || ""} | Andamento: ${protocol.music.tempo || ""}`);
  lines.push("");

  appendApprovedLyricsSection(lines, protocol);

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
    lines.push(`Conf.:    ${m.confidence || "provável"}`);
    if (m.alignment_warnings?.length) lines.push(`Obs.:     ${m.alignment_warnings.map(w => w.message || w.type).join("; ")}`);
    lines.push("");
  }
  const out = lines.join("\n");
  protocol.outputs.technical_chord_sheet = out;
  return out;
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

function getApprovedLyricBlocks(protocol) {
  const blocks = protocol.fusion?.text_blocks_index || [];
  return blocks.filter(block => {
    const status = block.human_review?.status;
    const classification = block.classification;
    return status === "classification_approved" && isLyricLikeClassification(classification);
  });
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
