export function visualExecutionOrder(protocol){return protocol.measures.slice().sort((a,b)=>a.number-b.number).map(m=>({measure_id:m.measure_id,repeat_instance:1}));}
export function ensureExecutionOrder(protocol){
  if(!protocol.navigation.execution_order?.length){protocol.navigation.execution_order=visualExecutionOrder(protocol); protocol.navigation.status='visual_only';}
  return protocol.navigation.execution_order;
}
export function setManualExecutionOrder(protocol, ids){protocol.navigation.execution_order=ids.map((id,i)=>({measure_id:id,repeat_instance:i+1}));protocol.navigation.status='manual_confirmed';}
export function executionMeasures(protocol){ensureExecutionOrder(protocol); return protocol.navigation.execution_order.map(o=>protocol.measures.find(m=>m.measure_id===o.measure_id)).filter(Boolean);}
