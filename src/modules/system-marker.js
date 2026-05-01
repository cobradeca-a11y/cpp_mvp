export function removeSystem(protocol, systemId) {
  protocol.systems = protocol.systems.filter(s => s.system_id !== systemId);
  protocol.measures = protocol.measures.filter(m => m.system_id !== systemId);
}

export function renumberSystems(protocol) {
  const byPage = {};
  protocol.systems.forEach(s => {
    byPage[s.page_id] ||= [];
    byPage[s.page_id].push(s);
  });
  Object.values(byPage).forEach(list => {
    list.sort((a,b) => a.bbox.y - b.bbox.y).forEach((s,i) => s.number = i + 1);
  });
}
