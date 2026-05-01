export const STORAGE_KEY = "cpp_mvp_semiauto_protocol_v1";

export function createInitialProtocol() {
  return {
    cpp_version: "mvp-semi-auto-1.0",
    source: { file_name: "", file_type: "", pages: 0 },
    music: { title: "", key: "", meter_default: "3/4", tempo: "", composer: "", arranger: "" },
    pages: [],
    systems: [],
    measures: [],
    system_analysis: [],
    navigation: { visual_markers: [], execution_order: [], status: "visual_only" },
    review: [],
    ui_state: { current_measure_id: "", selected_marker_type: "", selected_marker_ids: [], cursor_position: { x: 0, y: 0 }, undo_stack: [] },
    outputs: { technical_chord_sheet: "", playable_chord_sheet: "", uncertainty_report: "", detection_report: "" }
  };
}

export function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function saveProtocol(protocol) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(protocol));
}

export function loadProtocol() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : createInitialProtocol();
  } catch {
    return createInitialProtocol();
  }
}

export function updateById(list, idKey, id, patch) {
  const i = list.findIndex(x => x[idKey] === id);
  if (i >= 0) list[i] = { ...list[i], ...patch };
}

export function addRevision(protocol, action, target_id, old_value, new_value) {
  protocol.review.push({
    id: uid("rev"),
    timestamp: new Date().toISOString(),
    action,
    target_id,
    old_value,
    new_value
  });
}

export function pushUndo(protocol, action) {
  protocol.ui_state.undo_stack.push({ ...action, timestamp: Date.now() });
  if (protocol.ui_state.undo_stack.length > 100) protocol.ui_state.undo_stack.shift();
}

export function getMeasure(protocol, measureId) {
  return protocol.measures.find(m => m.measure_id === measureId);
}

export function getSystem(protocol, systemId) {
  return protocol.systems.find(s => s.system_id === systemId);
}

export function exportJson(protocol) {
  return JSON.stringify(protocol, null, 2);
}
