export function buildExecutionOrder(protocol) {
  if (protocol.navigation.status === "manual_confirmed" || protocol.navigation.status === "auto_resolved") {
    return protocol.navigation.execution_order;
  }
  const order = protocol.measures
    .slice()
    .sort((a,b) => a.number - b.number)
    .map(m => ({ measure_id: m.measure_id, repeat_instance: 1 }));
  protocol.navigation.execution_order = order;
  protocol.navigation.status = "visual_only";
  return order;
}
