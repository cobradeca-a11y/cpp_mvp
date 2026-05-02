import { uid } from "./cpp-json.js";

export function createAlignment(measure, data) {
  if (!measure) return null;
  const chord = measure.markers.find(m => m.marker_id === data.chord_marker_id && m.type === "chord");
  if (!chord) return null;
  const requiresNoSyllable = ["chord_on_rest", "chord_before_syllable", "chord_at_measure_start"].includes(data.alignment_type);
  const syll = data.syllable_marker_id ? measure.markers.find(m => m.marker_id === data.syllable_marker_id) : null;
  const note = data.note_marker_id ? measure.markers.find(m => m.marker_id === data.note_marker_id) : null;

  let confidence = "incerto";
  if (chord && data.beat && syll && note) confidence = "certo";
  else if (chord && data.beat && syll) confidence = "provável";
  else if (chord && data.beat && requiresNoSyllable) confidence = "provável";

  return {
    alignment_id: uid("al"),
    alignment_type: data.alignment_type || "chord_on_syllable",
    chord_marker_id: chord.marker_id,
    syllable_marker_id: syll?.marker_id || "",
    note_marker_id: note?.marker_id || "",
    beat: data.beat || chord.beat || "",
    confidence,
    review_required: confidence !== "certo",
    simultaneous_event: !!data.simultaneous_event,
    source: data.source || "manual",
    observation: data.observation || ""
  };
}

export function addManualAlignment(measure, alignment) {
  const al = createAlignment(measure, alignment);
  if (al) measure.alignments.push(al);
  return al;
}
