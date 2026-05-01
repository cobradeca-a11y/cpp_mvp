import { buildExecutionOrder } from "./navigation-engine.js";

export function generatePlayableChordSheet(protocol) {
  const lines = [];
  lines.push(`${protocol.music.title || "Sem título"}`);
  lines.push(`Tom: ${protocol.music.key || ""}`);
  if (protocol.navigation.status === "visual_only") lines.push("Aviso: ordem de execução não confirmada; usando ordem visual.");
  lines.push("");

  const order = buildExecutionOrder(protocol);
  for (const ref of order) {
    const m = protocol.measures.find(x => x.measure_id === ref.measure_id);
    if (!m) continue;
    const result = renderMeasurePlayable(m);
    if (result.lyric.trim() || result.chords.trim()) {
      lines.push(result.chords);
      lines.push(result.lyric);
    } else {
      const chordOnly = (m.markers || []).filter(x => x.type === "chord").map(x => x.value).join(" ");
      if (chordOnly) lines.push(chordOnly, "[pausa/preparação]");
    }
  }
  const out = lines.join("\n");
  protocol.outputs.playable_chord_sheet = out;
  return out;
}

function renderMeasurePlayable(m) {
  const sylls = (m.markers || []).filter(x => x.type === "syllable").sort((a,b)=>a.x-b.x);
  const aligns = (m.alignments || []).slice().sort((a,b) => {
    const ca = m.markers.find(x=>x.marker_id===a.chord_marker_id);
    const cb = m.markers.find(x=>x.marker_id===b.chord_marker_id);
    return (ca?.x || 0) - (cb?.x || 0);
  });

  const width = Math.max(24, Math.round((m.bbox?.w || 240) / 8));
  let lyricArr = Array(width).fill(" ");
  let chordArr = Array(width).fill(" ");

  for (const s of sylls) {
    const pos = Math.max(0, Math.min(width-1, Math.round((s.x / (m.bbox.w || 1)) * (width-1))));
    writeAt(lyricArr, pos, s.value);
  }

  for (const a of aligns) {
    const c = m.markers.find(x => x.marker_id === a.chord_marker_id);
    if (!c) continue;
    const pos = Math.max(0, Math.min(width-1, Math.round((c.x / (m.bbox.w || 1)) * (width-1))));
    writeAt(chordArr, pos, c.value + (a.confidence === "incerto" ? "?" : ""));
  }

  return { chords: chordArr.join("").trimEnd(), lyric: lyricArr.join("").trimEnd() };
}

function writeAt(arr, pos, text) {
  for (let i=0; i<text.length && pos+i<arr.length; i++) arr[pos+i] = text[i];
}
