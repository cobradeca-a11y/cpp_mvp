import { buildExecutionOrder } from "./navigation-engine.js";

export function generatePlayableChordSheet(protocol) {
  const lines = [];
  lines.push(`${protocol.music.title || "Sem título"}`);
  lines.push(`Tom: ${protocol.music.key || ""}`);
  lines.push("");
  lines.push("AVISO: cifra tocável provisória.");
  lines.push("Esta saída usa apenas relações já registradas no cpp_protocol.json.");
  lines.push("O alinhamento profissional definitivo depende do motor de fusão MusicXML + OCR.");
  if (protocol.navigation?.status === "visual_only") lines.push("Ordem de execução não confirmada; usando ordem visual/importada.");
  lines.push("");

  const order = buildExecutionOrder(protocol);
  for (const ref of order) {
    const m = protocol.measures.find(x => x.measure_id === ref.measure_id);
    if (!m) continue;
    const result = renderMeasurePlayableProvisional(m);
    if (result.chords || result.lyric) {
      lines.push(result.chords || "");
      lines.push(result.lyric || "");
      lines.push("");
    }
  }

  if (order.length === 0) lines.push("Nenhum compasso importado para geração de cifra tocável.");

  const out = lines.join("\n").trimEnd();
  protocol.outputs.playable_chord_sheet = out;
  return out;
}

function renderMeasurePlayableProvisional(measure) {
  const markers = measure.markers || [];
  const alignments = measure.alignments || [];
  const syllables = markers.filter(x => x.type === "syllable").map(x => x.value).join(" ");

  const alignedChords = alignments
    .map(alignment => markers.find(marker => marker.marker_id === alignment.chord_marker_id))
    .filter(Boolean)
    .map(marker => marker.value);

  const directChords = markers
    .filter(x => x.type === "chord")
    .map(x => x.value);

  const chords = [...new Set(alignedChords.length ? alignedChords : directChords)].join(" ");

  return {
    chords,
    lyric: syllables
  };
}
