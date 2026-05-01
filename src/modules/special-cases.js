export function addSpecialCase(measure,type,message,severity='medium'){
  measure.special_cases ||= [];
  measure.special_cases.push({type,severity,message});
  measure.review_required = true;
  return measure;
}
export function addWarning(measure,type,message,severity='medium'){
  measure.alignment_warnings ||= [];
  measure.alignment_warnings.push({type,severity,message});
  if(severity!=='low') measure.review_required = true;
  return measure;
}
export function scanManualSpecialCases(measure){
  measure.alignment_warnings ||= [];
  const hasRest = (measure.markers||[]).some(m=>m.type==='rest');
  if(measure.is_anacrusis && !measure.special_cases?.some(s=>s.type==='anacrusis')) addSpecialCase(measure,'anacrusis','Compasso marcado como anacruse.');
  if(hasRest && !measure.alignment_warnings.some(w=>w.type==='rest_present')) addWarning(measure,'rest_present','Há pausa/preparação marcada neste compasso.','low');
  return measure;
}
