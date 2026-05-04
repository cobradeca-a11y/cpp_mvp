export const STORAGE_KEY = "cpp_professional_omr_protocol_v1";

export function createInitialProtocol() {
  return {
    cpp_version: "professional-omr-1.0",
    source: {
      file_name: "",
      file_type: "",
      pages: 0,
      omr_status: "pending",
      omr_engine: "Audiveris",
      ocr_status: "pending",
      ocr_engine: "",
      validation_status: "pending",
      message: ""
    },
    music: {
      title: "",
      key: "",
      meter_default: "",
      tempo: "",
      composer: "",
      arranger: ""
    },
    pages: [],
    systems: [],
    measures: [],
    navigation: {
      visual_markers: [],
      execution_order: [],
      status: "visual_only"
    },
    validation: {
      validation_status: "pending",
      overall_confidence: 0,
      issues: []
    },
    review: [],
    outputs: {
      technical_chord_sheet: "",
      playable_chord_sheet: "",
      uncertainty_report: "",
      detection_report: ""
    }
  };
}

export function normalizeProtocol(protocol) {
  const base = createInitialProtocol();
  const normalized = {
    ...base,
    ...(protocol || {}),
    source: { ...base.source, ...(protocol?.source || {}) },
    music: { ...base.music, ...(protocol?.music || {}) },
    navigation: { ...base.navigation, ...(protocol?.navigation || {}) },
    validation: { ...base.validation, ...(protocol?.validation || {}) },
    outputs: { ...base.outputs, ...(protocol?.outputs || {}) }
  };

  normalized.cpp_version = "professional-omr-1.0";
  normalized.pages ||= [];
  normalized.systems ||= [];
  normalized.measures ||= [];
  normalized.review ||= [];
  return normalized;
}

export function saveProtocol(protocol) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeProtocol(protocol)));
}

export function loadProtocol() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeProtocol(JSON.parse(raw)) : createInitialProtocol();
  } catch {
    return createInitialProtocol();
  }
}

export function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function updateById(list, idKey, id, patch) {
  const i = list.findIndex(x => x[idKey] === id);
  if (i >= 0) list[i] = { ...list[i], ...patch };
}

export function addRevision(protocol, action, target_id, old_value, new_value) {
  protocol.review ||= [];
  protocol.review.push({
    id: uid("rev"),
    timestamp: new Date().toISOString(),
    action,
    target_id,
    old_value,
    new_value,
    source: "human_review"
  });
}

export function getMeasure(protocol, measureId) {
  return protocol.measures.find(m => m.measure_id === measureId);
}

export function getSystem(protocol, systemId) {
  return protocol.systems.find(s => s.system_id === systemId);
}

export function exportJson(protocol) {
  return JSON.stringify(normalizeProtocol(protocol), null, 2);
}
