export function createInitialProtocol(){
  return {cpp_version:'mvp-1.0',source:{file_name:'',file_type:'',pages:0},music:{title:'',key:'',meter_default:'3/4',tempo:'',composer:'',arranger:''},pages:[],systems:[],measures:[],navigation:{visual_markers:[],execution_order:[],status:'visual_only'},review:[],ui_state:{current_measure_id:'',selected_marker_type:'chord',selected_marker_ids:[],cursor_position:{x:0,y:0},undo_stack:[]},outputs:{technical_chord_sheet:'',playable_chord_sheet:'',uncertainty_report:''}};
}
export function uid(prefix){return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`;}
export function saveLocal(protocol){localStorage.setItem('cpp_protocol_mvp',JSON.stringify(protocol));}
export function loadLocal(){try{return JSON.parse(localStorage.getItem('cpp_protocol_mvp')||'null');}catch{return null;}}
export function downloadText(filename, text, type='text/plain;charset=utf-8'){const blob=new Blob([text],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
export function downloadJSON(filename, data){downloadText(filename, JSON.stringify(data,null,2),'application/json;charset=utf-8');}
export function updateById(list,idKey,id,patch){const i=list.findIndex(x=>x[idKey]===id);if(i>=0) list[i]={...list[i],...patch};return list[i];}
export function addRevision(protocol, action, target_id, old_value='', new_value=''){protocol.review.push({id:uid('rev'),timestamp:new Date().toISOString(),action,target_id,old_value,new_value});}
export function pushUndo(protocol, entry){protocol.ui_state.undo_stack.push({...entry, timestamp:Date.now()}); if(protocol.ui_state.undo_stack.length>100) protocol.ui_state.undo_stack.shift();}
export function getMeasure(protocol, id){return protocol.measures.find(m=>m.measure_id===id)||null;}
export function markerById(measure,id){return (measure?.markers||[]).find(m=>m.marker_id===id)||null;}
export function validForChordSheets(protocol){const missing=[]; if(!protocol.music.title) missing.push('music.title'); if(!protocol.music.meter_default) missing.push('music.meter_default'); if(!protocol.measures.length) missing.push('measures[]'); for(const m of protocol.measures){for(const f of ['measure_id','number','meter','time_grid','markers','alignments']) if(m[f]===undefined) missing.push(`measure ${m.number}: ${f}`);} return {ok:missing.length===0, missing};}
