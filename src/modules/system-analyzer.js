import { uid } from "./cpp-json.js";
import { isChordSymbol, normalizeChord, looksLikeLyric, isNavigationText, beatFromX, timeGridForMeter } from "./music-models.js";
import { createAlignment } from "./alignment-engine.js";
import { scoreSystemConfidence } from "./confidence-engine.js";

export function analyzeSystem(protocol, page, system) {
  const measures = protocol.measures.filter(m => m.system_id === system.system_id).sort((a,b)=>a.bbox.x-b.bbox.x);
  const textItems = (page.text_items || []).filter(t =>
    t.x >= system.bbox.x - 4 &&
    t.x <= system.bbox.x + system.bbox.w + 4 &&
    t.y >= system.bbox.y - 30 &&
    t.y <= system.bbox.y + system.bbox.h + 30
  ).map(t => ({ ...t, lx: t.x - system.bbox.x, ly: t.y - system.bbox.y }));

  const summary = {
    meter: protocol.music.meter_default || "3/4",
    key_signature: protocol.music.key || "",
    tempo: protocol.music.tempo || "",
    measure_count: measures.length,
    chords: [],
    lyrics: [],
    navigation: [],
    warnings: []
  };

  for (const measure of measures) {
    measure.detected_elements = { chords: [], syllables: [], note_heads: [], rests: [], navigation: [], special_cases: [] };
    measure.markers = measure.markers.filter(m => m.source === "manual" || m.source === "corrected");
    measure.alignments = measure.alignments.filter(a => a.source === "manual" || a.source === "corrected");
    measure.time_grid = timeGridForMeter(measure.meter);

    const items = textItems.filter(t => t.lx >= measure.bbox.x - 10 && t.lx <= measure.bbox.x + measure.bbox.w + 10);
    const chordItems = items.filter(t => isChordSymbol(t.str));
    const navItems = items.filter(t => isNavigationText(t.str));
    const lyricItems = items.filter(t => looksLikeLyric(t.str));

    for (const t of chordItems) {
      const val = normalizeChord(t.str);
      const localX = Math.max(0, Math.min(measure.bbox.w, t.lx - measure.bbox.x));
      const beat = beatFromX(localX, measure.bbox.w, measure.meter);
      const marker = {
        marker_id: uid("mk"),
        type: "chord",
        value: val,
        x: Math.round(localX),
        y: Math.round(t.ly),
        beat,
        confidence: "provável",
        source: "auto",
        duration: "",
        extra: { raw: t.str }
      };
      measure.markers.push(marker);
      measure.detected_elements.chords.push(marker);
      if (!summary.chords.includes(val)) summary.chords.push(val);
    }

    for (const t of lyricItems) {
      const txt = String(t.str).trim();
      if (!txt || isChordSymbol(txt) || isNavigationText(txt)) continue;
      const localX = Math.max(0, Math.min(measure.bbox.w, t.lx - measure.bbox.x));
      const beat = beatFromX(localX, measure.bbox.w, measure.meter);
      const marker = {
        marker_id: uid("mk"),
        type: "syllable",
        value: txt,
        x: Math.round(localX),
        y: Math.round(t.ly),
        beat,
        confidence: "provável",
        source: "auto",
        duration: "",
        extra: { raw: t.str }
      };
      measure.markers.push(marker);
      measure.detected_elements.syllables.push(marker);
      if (summary.lyrics.length < 40) summary.lyrics.push(txt);
    }

    for (const t of navItems) {
      const marker = {
        marker_id: uid("mk"),
        type: "navigation",
        value: t.str.trim(),
        x: Math.round(t.lx - measure.bbox.x),
        y: Math.round(t.ly),
        beat: beatFromX(t.lx - measure.bbox.x, measure.bbox.w, measure.meter),
        confidence: "provável",
        source: "auto",
        extra: {}
      };
      measure.markers.push(marker);
      measure.detected_elements.navigation.push(marker);
      summary.navigation.push(marker.value);
    }

    autoAlignMeasure(measure);

    if (measure.is_anacrusis) {
      measure.special_cases.push({ type: "anacrusis", severity: "medium", message: "Compasso inicial curto/anacruse provável." });
      measure.detected_elements.special_cases.push("anacruse provável");
    }

    if (!measure.detected_elements.chords.length && !measure.detected_elements.syllables.length) {
      measure.confidence = "incerto";
      measure.review_required = true;
      measure.alignment_warnings.push({ type: "empty_measure_detection", severity: "medium", message: "Nenhum acorde/sílaba detectado." });
    }
  }

  system.status = "analyzed";
  system.detected_summary = summary;
  protocol.system_analysis = protocol.system_analysis.filter(a => a.system_id !== system.system_id);
  protocol.system_analysis.push({
    system_id: system.system_id,
    timestamp: new Date().toISOString(),
    summary
  });

  scoreSystemConfidence(protocol, system.system_id);
  return summary;
}

function autoAlignMeasure(measure) {
  const chords = measure.markers.filter(m => m.type === "chord");
  const syllables = measure.markers.filter(m => m.type === "syllable");
  for (const chord of chords) {
    const nearestSyll = syllables.slice().sort((a,b) => Math.abs(a.x - chord.x) - Math.abs(b.x - chord.x))[0];
    const type = nearestSyll ? "chord_on_syllable" : "chord_at_measure_start";
    const al = createAlignment(measure, {
      alignment_type: type,
      chord_marker_id: chord.marker_id,
      syllable_marker_id: nearestSyll?.marker_id || "",
      note_marker_id: "",
      beat: chord.beat,
      source: "auto"
    });
    if (al) measure.alignments.push(al);
  }
}
