import { uid, markerById } from './cpp-json.js';
import { updateMeasureConfidence } from './confidence-engine.js';

export function createAlignment(measure, data){
  if(!markerById(measure, data.chord_marker_id)) throw new Error('Selecione um marcador de acorde válido.');
  const type=data.alignment_type||'chord_on_syllable';
  const allowNoSyllable=['chord_on_rest','chord_before_syllable','chord_at_measure_start'].includes(type);
  if(!allowNoSyllable && data.syllable_marker_id && !markerById(measure,data.syllable_marker_id)) throw new Error('Sílaba inválida.');
  if(!allowNoSyllable && !data.syllable_marker_id) throw new Error('Este tipo de alinhamento exige sílaba.');
  const chord=markerById(measure,data.chord_marker_id);
  const alignment={alignment_id:uid('al'),alignment_type:type,chord_marker_id:data.chord_marker_id,syllable_marker_id:data.syllable_marker_id||'',note_marker_id:data.note_marker_id||'',beat:data.beat||chord.beat||'',confidence:data.confidence||'certo',review_required:false,simultaneous_event:!!data.simultaneous_event,observation:data.observation||''};
  if(!alignment.beat){alignment.confidence='incerto'; alignment.review_required=true;}
  if(!alignment.note_marker_id && alignment.syllable_marker_id && alignment.confidence==='certo') alignment.confidence='provável';
  measure.alignments.push(alignment);
  updateMeasureConfidence(measure);
  return alignment;
}
export function removeAlignment(measure, alignmentId){
  const before=measure.alignments.length;
  measure.alignments=measure.alignments.filter(a=>a.alignment_id!==alignmentId);
  updateMeasureConfidence(measure);
  return before!==measure.alignments.length;
}
export function removeMarkerAndDependents(measure, markerId){
  measure.markers=measure.markers.filter(m=>m.marker_id!==markerId);
  measure.alignments=measure.alignments.filter(a=>![a.chord_marker_id,a.syllable_marker_id,a.note_marker_id].includes(markerId));
  updateMeasureConfidence(measure);
}
