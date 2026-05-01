const rank={certo:0,manual:0,'provável':1,incerto:2,'ilegível':3};
export function worse(a='certo',b='certo'){return (rank[b]??1)>(rank[a]??1)?b:a;}
export function scoreAlignment(alignment, measure){
  let c=alignment.confidence||'certo';
  if(!alignment.chord_marker_id || !alignment.beat) c='incerto';
  if(!alignment.note_marker_id && alignment.syllable_marker_id) c=worse(c,'provável');
  if(!alignment.syllable_marker_id && !['chord_on_rest','chord_before_syllable','chord_at_measure_start'].includes(alignment.alignment_type)) c='incerto';
  return c;
}
export function updateMeasureConfidence(measure){
  let c='certo';
  const aligns=measure.alignments||[];
  if(!aligns.length) c='provável';
  for(const a of aligns){a.confidence=scoreAlignment(a,measure); c=worse(c,a.confidence);}
  measure.confidence=c;
  measure.review_required=['incerto','ilegível'].includes(c) || measure.review_required===true;
  return measure;
}
export function uncertaintyReport(protocol){
  const lines=['RELATÓRIO DE INCERTEZAS',''];
  const uncertain=protocol.measures.filter(m=>m.review_required || ['provável','incerto','ilegível'].includes(m.confidence));
  const pct=protocol.measures.length?Math.round((uncertain.length/protocol.measures.length)*100):0;
  lines.push(`Compassos totais: ${protocol.measures.length}`);
  lines.push(`Compassos com atenção: ${uncertain.length} (${pct}%)`);
  if(pct>20) lines.push('AVISO: mais de 20% dos compassos têm incerteza. Revise antes da cifra final.');
  lines.push('');
  for(const m of uncertain){lines.push(`[Compasso ${m.number}] Conf.: ${m.confidence} Status: ${m.review_status||'pending'}`);(m.alignment_warnings||[]).forEach(w=>lines.push(`- ${w.type}: ${w.message}`));(m.special_cases||[]).forEach(s=>lines.push(`- ${s.type}: ${s.message}`)); if(m.notes) lines.push(`- Obs.: ${m.notes}`); lines.push('');}
  return lines.join('\n');
}
