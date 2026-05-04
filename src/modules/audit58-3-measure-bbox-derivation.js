const AUDIT583_BUILD = "audit-58-3-cache-v2";
const STORAGE_KEY = "cpp_professional_omr_protocol_v1";

function byId(id) { return document.getElementById(id); }
function safeJsonParse(raw, fallback = {}) { try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
function loadProtocol() { return safeJsonParse(localStorage.getItem(STORAGE_KEY), {}); }
function saveProtocol(protocol) { localStorage.setItem(STORAGE_KEY, JSON.stringify(protocol || {})); }
function asArray(value) { return Array.isArray(value) ? value : []; }
function n(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }

function bboxFrom(value) {
  if (!value || typeof value !== "object") return null;
  if (value.geometry?.bbox) return bboxFrom(value.geometry.bbox);
  if (value.bbox) return bboxFrom(value.bbox);
  if (value.bounding_box) return bboxFrom(value.bounding_box);
  const x = n(value.x ?? value.left);
  const y = n(value.y ?? value.top);
  const w = n(value.w ?? value.width);
  const h = n(value.h ?? value.height);
  const right = n(value.right);
  const bottom = n(value.bottom);
  if (x !== null && y !== null && w !== null && h !== null && w > 0 && h > 0) return { x, y, w, h };
  if (x !== null && y !== null && right !== null && bottom !== null && right > x && bottom > y) return { x, y, w: right - x, h: bottom - y };
  return null;
}

function normalizeBBox(bbox) {
  if (!bbox) return null;
  return { x: Math.round(bbox.x * 100) / 100, y: Math.round(bbox.y * 100) / 100, w: Math.round(bbox.w * 100) / 100, h: Math.round(bbox.h * 100) / 100 };
}

function systemId(system, index) { return system?.system_id || system?.id || `s${String(index + 1).padStart(3, "0")}`; }
function measureSystemId(measure) { return measure?.system_id || measure?.system || null; }
function measurePage(measure, system) { return measure?.page ?? measure?.page_number ?? system?.page ?? system?.page_number ?? system?.geometry?.page ?? null; }

function collectBarlineXs(system) {
  const raw = [
    ...asArray(system?.barline_x_positions),
    ...asArray(system?.barlines).map(item => typeof item === "number" ? item : item?.x ?? item?.left),
    ...asArray(system?.vertical_lines).filter(item => item?.type === "barline" || item?.role === "barline").map(item => item.x ?? item.left),
    ...asArray(system?.geometry?.barline_x_positions),
    ...asArray(system?.geometry?.barlines).map(item => typeof item === "number" ? item : item?.x ?? item?.left),
  ].map(n).filter(value => value !== null);
  return [...new Set(raw)].sort((a, b) => a - b);
}

function deriveFromBarlines(systemBBox, barlineXs, index, total) {
  if (!systemBBox || barlineXs.length < 2) return null;
  const xMin = systemBBox.x;
  const xMax = systemBBox.x + systemBBox.w;
  const usable = barlineXs.filter(x => x >= xMin - 3 && x <= xMax + 3);
  if (usable.length >= total + 1 && index < usable.length - 1) {
    const left = usable[index];
    const right = usable[index + 1];
    if (right > left) return { bbox: normalizeBBox({ x: left, y: systemBBox.y, w: right - left, h: systemBBox.h }), source: "barline_positions_from_protocol", confidence: 0.82, status: "reliable", review_required: true };
  }
  return null;
}

function groupMeasuresBySystem(protocol) {
  const groups = new Map();
  asArray(protocol.measures).forEach((measure, index) => {
    const key = measureSystemId(measure) || "__missing_system__";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ measure, index });
  });
  return groups;
}

function deriveMeasureBBoxes() {
  const protocol = loadProtocol();
  protocol.measures = asArray(protocol.measures);
  protocol.systems = asArray(protocol.systems);
  protocol.geometry_contract ||= {};
  protocol.geometry_contract.audit_58_3 = { version: "audit-58.3", applied_at: new Date().toISOString(), rule: "Derive measure bbox only from existing measure bbox or explicit barline evidence.", fallback_policy: "No even-width geometric inference. Keep pending when barlines are unavailable." };
  const systems = new Map(protocol.systems.map((system, index) => [systemId(system, index), system]));
  const groups = groupMeasuresBySystem(protocol);
  const derivations = [];
  groups.forEach((items, key) => {
    const system = systems.get(key) || {};
    const systemBBox = bboxFrom(system);
    const barlineXs = collectBarlineXs(system);
    const total = items.length;
    items.forEach(({ measure, index }, localIndex) => {
      measure.measure_id ||= measure.id || `m${String(index + 1).padStart(3, "0")}`;
      measure.number ??= measure.measure_number ?? index + 1;
      measure.system_id ||= key === "__missing_system__" ? null : key;
      measure.page = measurePage(measure, system);
      measure.geometry ||= {};
      const existing = bboxFrom(measure);
      if (existing) {
        measure.geometry = { ...measure.geometry, page: measure.page, system_id: measure.system_id, bbox: normalizeBBox(existing), source: measure.geometry.source || "existing_measure_bbox_preserved", confidence: Math.max(Number(measure.geometry.confidence || 0.75), 0.75), status: measure.geometry.status || "reliable", review_required: measure.geometry.review_required ?? true, audit: "audit-58.3" };
        derivations.push({ measure_id: measure.measure_id, method: "preserved_existing_measure_bbox", status: measure.geometry.status });
        return;
      }
      const derived = deriveFromBarlines(systemBBox, barlineXs, localIndex, total);
      if (derived) {
        measure.geometry = { ...measure.geometry, page: measure.page, system_id: measure.system_id, bbox: derived.bbox, source: derived.source, confidence: derived.confidence, status: derived.status, review_required: derived.review_required, audit: "audit-58.3" };
        derivations.push({ measure_id: measure.measure_id, method: derived.source, status: derived.status });
      } else {
        measure.geometry = { ...measure.geometry, page: measure.page, system_id: measure.system_id, bbox: null, source: "pending_no_explicit_barline_or_measure_bbox", confidence: 0, status: "pending", review_required: true, audit: "audit-58.3" };
        derivations.push({ measure_id: measure.measure_id, method: "pending_no_explicit_barline_or_measure_bbox", status: "pending" });
      }
    });
  });
  saveProtocol(protocol);
  return buildReport(protocol, derivations, true);
}

function buildReport(protocol = loadProtocol(), derivations = [], saved = false) {
  const measures = asArray(protocol.measures);
  const source = protocol.source || {};
  const summary = measures.reduce((acc, measure) => {
    const status = measure?.geometry?.status || "missing";
    acc[status] = (acc[status] || 0) + 1;
    if (measure?.geometry?.bbox) acc.with_bbox += 1;
    if (measure?.geometry?.source === "barline_positions_from_protocol") acc.from_barlines += 1;
    if (measure?.geometry?.source === "existing_measure_bbox_preserved") acc.preserved_existing += 1;
    if (measure?.geometry?.source === "system_bbox_even_measure_distribution") acc.blocked_even_split_legacy += 1;
    return acc;
  }, { reliable: 0, approximate: 0, pending: 0, present_unrated: 0, missing: 0, with_bbox: 0, from_barlines: 0, preserved_existing: 0, blocked_even_split_legacy: 0 });
  return { export_type: "cpp_measure_bbox_derivation_report", audit: "audit-58.3", generated_at: new Date().toISOString(), frontend: { build: AUDIT583_BUILD }, source: { file_name: source.file_name || "", file_type: source.file_type || "", omr_status: source.omr_status || "pending", ocr_status: source.ocr_status || protocol?.ocr?.status || "pending" }, summary: { protocol_saved: saved, measures_total: measures.length, ...summary, from_even_split: 0, review_required: measures.filter(measure => measure?.geometry?.review_required !== false).length }, derivations: derivations.slice(0, 300), safety_contract: { modifies_protocol: true, modification_scope: "metadata_only_measure_geometry_bbox", modifies_ocr_raw_text: false, infers_lyrics: false, infers_harmony: false, uses_existing_barline_or_system_geometry_only: false, uses_explicit_barline_or_existing_measure_bbox_only: true, disables_even_width_measure_inference: true, aligns_ocr_to_measure_without_geometry: false, marks_playable_ready_automatically: false, applies_human_review_without_user_action: false } };
}

function humanReport(report) {
  return ["DETECÇÃO/DERIVAÇÃO DE BBOX POR COMPASSO — AUDITORIA 58.3", "", `Arquivo: ${report.source.file_name || "nenhum protocolo salvo"}`, `Build: ${report.frontend.build}`, `Protocolo salvo: ${report.summary.protocol_saved ? "sim" : "não"}`, "", "Resumo:", `- Compassos: ${report.summary.measures_total}`, `- Com bbox: ${report.summary.with_bbox}`, `- Reliable: ${report.summary.reliable}`, `- Approximate: ${report.summary.approximate}`, `- Pending: ${report.summary.pending}`, `- Preservados existentes: ${report.summary.preserved_existing}`, `- Derivados por barras explícitas: ${report.summary.from_barlines}`, `- Derivados por divisão aproximada do sistema: 0`, `- Exigem revisão: ${report.summary.review_required}`, "", "Contrato:", "- Usa apenas bbox de compasso existente ou barras explícitas do protocolo.", "- Não usa divisão uniforme do sistema por risco de inferência geométrica.", "- Não altera OCR bruto.", "- Não infere letra.", "- Não infere harmonia.", "- Não associa OCR a compasso sem geometria confiável.", "- Não marca automaticamente pronto para cifra tocável."].join("\n");
}

function downloadText(filename, text, mime = "application/json;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function timestamp() { return new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12); }

function createPanel() {
  if (byId("measureBboxDerivationAudit583")) return;
  const previous = byId("explicitMeasureGeometryAudit582");
  const anchor = previous || document.querySelector("main");
  if (!anchor) return;
  const section = document.createElement("section");
  section.id = "measureBboxDerivationAudit583";
  section.className = "panel active";
  section.innerHTML = `<h2>3J. Derivação real de bbox por compasso</h2><p class="hint">Auditoria 58.3: deriva bbox somente a partir de bbox existente ou barras explícitas no protocolo. Não usa divisão uniforme por sistema.</p><div class="toolbar sticky"><button id="btnDeriveMeasureBboxes" class="primary">Derivar bbox por compasso</button><button id="btnExportMeasureBboxDerivation" class="ghost">Exportar derivação JSON</button></div><pre id="measureBboxDerivationOutput" class="report small-report">Derivação de bbox ainda não executada nesta sessão.</pre>`;
  anchor.insertAdjacentElement("afterend", section);
}

function bindButtons() {
  const derive = byId("btnDeriveMeasureBboxes");
  const exp = byId("btnExportMeasureBboxDerivation");
  if (derive) derive.onclick = event => { event.preventDefault(); const report = deriveMeasureBBoxes(); const out = byId("measureBboxDerivationOutput"); if (out) out.textContent = `${humanReport(report)}\n\nJSON:\n${JSON.stringify(report, null, 2)}`; };
  if (exp) exp.onclick = event => { event.preventDefault(); const report = buildReport(loadProtocol(), [], false); const text = JSON.stringify(report, null, 2); const out = byId("measureBboxDerivationOutput"); if (out) out.textContent = `${humanReport(report)}\n\nJSON:\n${text}`; downloadText(`cpp_derivacao_bbox_compassos_audit58_3_${timestamp()}.json`, text); };
}

function markBuild() { window.CPP_ACTIVE_BUILD = AUDIT583_BUILD; const build = byId("frontendBuild"); if (build) build.textContent = `Frontend build: ${AUDIT583_BUILD}`; }
function initAudit583MeasureBboxDerivation() { markBuild(); createPanel(); bindButtons(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAudit583MeasureBboxDerivation); else initAudit583MeasureBboxDerivation();
