const AUDIT584_BUILD = "audit-58-4-cache-v1";
const STORAGE_KEY = "cpp_professional_omr_protocol_v1";

function byId(id) { return document.getElementById(id); }
function asArray(value) { return Array.isArray(value) ? value : []; }
function n(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function safeJsonParse(raw, fallback = {}) { try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
function loadProtocol() { return safeJsonParse(localStorage.getItem(STORAGE_KEY), {}); }
function saveProtocol(protocol) { localStorage.setItem(STORAGE_KEY, JSON.stringify(protocol || {})); }
function uid(prefix) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`; }

function normalizeBBox(value) {
  if (!value || typeof value !== "object") return null;
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

function systemId(system, index) { return system?.system_id || system?.id || `s${String(index + 1).padStart(3, "0")}`; }
function measureSystemId(measure) { return measure?.system_id || measure?.system || null; }

function measuresForSystem(protocol, targetSystemId) {
  return asArray(protocol.measures)
    .map((measure, index) => ({ measure, index }))
    .filter(({ measure }) => measureSystemId(measure) === targetSystemId);
}

function buildTemplate(protocol = loadProtocol()) {
  const systems = asArray(protocol.systems);
  const lines = systems.map((system, index) => {
    const id = systemId(system, index);
    const measures = measuresForSystem(protocol, id);
    return { system_id: id, page: system?.page ?? system?.page_number ?? system?.geometry?.page ?? null, measures: measures.length, required_barlines: measures.length + 1, example: { system_id: id, page: system?.page ?? 1, system_bbox: { x: 0, y: 0, w: 0, h: 0 }, barline_x_positions: [] } };
  });
  return JSON.stringify({ instructions: "Preencha system_bbox e barline_x_positions apenas com coordenadas revisadas manualmente.", systems: lines }, null, 2);
}

function validateAction(action) {
  const system_id = String(action?.system_id || "").trim();
  const page = action?.page ?? null;
  const system_bbox = normalizeBBox(action?.system_bbox || action?.bbox || action?.geometry?.bbox);
  const xs = asArray(action?.barline_x_positions || action?.barlines)
    .map(item => typeof item === "number" ? item : item?.x ?? item?.left)
    .map(n)
    .filter(value => value !== null)
    .sort((a, b) => a - b);
  return { system_id, page, system_bbox, barline_x_positions: [...new Set(xs)] };
}

function addReview(protocol, payload) {
  protocol.review ||= [];
  protocol.review.push({ id: uid("rev"), timestamp: new Date().toISOString(), source: "human_review", audit: "audit-58.4", ...payload });
}

function applyManualAction(protocol, action) {
  const normalized = validateAction(action);
  const result = { system_id: normalized.system_id, applied: false, reason: "", measures_updated: 0, barlines: normalized.barline_x_positions.length };

  if (!normalized.system_id) { result.reason = "missing_system_id"; return result; }
  if (!normalized.system_bbox) { result.reason = "missing_manual_system_bbox"; return result; }

  const systemIndex = asArray(protocol.systems).findIndex((system, index) => systemId(system, index) === normalized.system_id);
  if (systemIndex < 0) { result.reason = "system_not_found"; return result; }

  const measures = measuresForSystem(protocol, normalized.system_id);
  if (!measures.length) { result.reason = "no_measures_for_system"; return result; }
  if (normalized.barline_x_positions.length < measures.length + 1) {
    result.reason = "not_enough_manual_barlines_for_measures";
    return result;
  }

  protocol.systems[systemIndex].geometry = {
    ...(protocol.systems[systemIndex].geometry || {}),
    page: normalized.page ?? protocol.systems[systemIndex]?.page ?? protocol.systems[systemIndex]?.page_number ?? null,
    system_id: normalized.system_id,
    bbox: normalized.system_bbox,
    source: "human_barline_review",
    confidence: 0.95,
    status: "human_reviewed",
    review_required: false,
    audit: "audit-58.4",
    barline_x_positions: normalized.barline_x_positions,
  };

  measures.forEach(({ measure }, localIndex) => {
    const left = normalized.barline_x_positions[localIndex];
    const right = normalized.barline_x_positions[localIndex + 1];
    if (!(right > left)) return;
    measure.geometry = {
      ...(measure.geometry || {}),
      page: normalized.page ?? protocol.systems[systemIndex].geometry.page,
      system_id: normalized.system_id,
      bbox: { x: left, y: normalized.system_bbox.y, w: right - left, h: normalized.system_bbox.h },
      source: "human_barline_review",
      confidence: 0.95,
      status: "human_reviewed",
      review_required: false,
      audit: "audit-58.4",
    };
    measure.measure_id ||= measure.id || `m${String(localIndex + 1).padStart(3, "0")}`;
    measure.page = measure.geometry.page;
    measure.system_id = normalized.system_id;
    result.measures_updated += 1;
  });

  addReview(protocol, { type: "manual_barline_geometry_review", target_id: normalized.system_id, decision: "confirmed_manual_geometry", new_value: normalized, effects: { modifies_geometry: true, modifies_ocr_raw_text: false, infers_lyrics: false, infers_harmony: false, aligns_ocr_to_measure_without_geometry: false, marks_playable_ready_automatically: false } });

  result.applied = result.measures_updated > 0;
  result.reason = result.applied ? "applied_human_barline_geometry" : "no_valid_measure_intervals";
  return result;
}

function applyManualAdjustments() {
  const protocol = loadProtocol();
  const raw = byId("manualBarlineAdjustmentInput")?.value || "";
  const parsed = safeJsonParse(raw, null);
  const actions = Array.isArray(parsed) ? parsed : asArray(parsed?.systems || parsed?.actions || (parsed ? [parsed] : []));
  protocol.geometry_contract ||= {};
  protocol.geometry_contract.audit_58_4 = { version: "audit-58.4", applied_at: new Date().toISOString(), rule: "Manual barline/system bbox review only. No automatic geometric inference." };

  const results = actions.map(action => applyManualAction(protocol, action));
  saveProtocol(protocol);
  return buildReport(protocol, results, true);
}

function buildReport(protocol = loadProtocol(), results = [], saved = false) {
  const measures = asArray(protocol.measures);
  const systems = asArray(protocol.systems);
  const source = protocol.source || {};
  const manualMeasures = measures.filter(measure => measure?.geometry?.source === "human_barline_review");
  const manualSystems = systems.filter(system => system?.geometry?.source === "human_barline_review");
  return { export_type: "cpp_manual_barline_adjustment_report", audit: "audit-58.4", generated_at: new Date().toISOString(), frontend: { build: AUDIT584_BUILD }, source: { file_name: source.file_name || "", file_type: source.file_type || "", omr_status: source.omr_status || "pending", ocr_status: source.ocr_status || protocol?.ocr?.status || "pending" }, summary: { protocol_saved: saved, systems_total: systems.length, measures_total: measures.length, manual_systems: manualSystems.length, manual_measure_bboxes: manualMeasures.length, actions_applied: results.filter(item => item.applied).length, actions_rejected: results.filter(item => !item.applied).length, playable_ready_auto_marked: 0 }, results, safety_contract: { modifies_protocol: true, modification_scope: "human_geometry_metadata_only", modifies_ocr_raw_text: false, infers_lyrics: false, infers_harmony: false, uses_automatic_geometry_inference: false, aligns_ocr_to_measure_without_geometry: false, marks_playable_ready_automatically: false, applies_human_review_without_user_action: false } };
}

function humanReport(report) {
  return ["AJUSTE MANUAL RÁPIDO DE BARRAS/COMPASSOS — AUDITORIA 58.4", "", `Arquivo: ${report.source.file_name || "nenhum protocolo salvo"}`, `Build: ${report.frontend.build}`, `Protocolo salvo: ${report.summary.protocol_saved ? "sim" : "não"}`, "", "Resumo:", `- Sistemas: ${report.summary.systems_total}`, `- Compassos: ${report.summary.measures_total}`, `- Sistemas com geometria manual: ${report.summary.manual_systems}`, `- Compassos com bbox manual: ${report.summary.manual_measure_bboxes}`, `- Ações aplicadas: ${report.summary.actions_applied}`, `- Ações rejeitadas: ${report.summary.actions_rejected}`, `- Pronto para cifra tocável automático: ${report.summary.playable_ready_auto_marked}`, "", "Contrato:", "- Usa somente coordenadas inseridas/confirmadas manualmente.", "- Não usa inferência geométrica automática.", "- Não altera OCR bruto.", "- Não infere letra.", "- Não infere harmonia.", "- Não associa OCR a compasso sem confirmação.", "- Não marca pronto para cifra tocável."].join("\n");
}

function downloadText(filename, text, mime = "application/json;charset=utf-8") { const blob = new Blob([text], { type: mime }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
function timestamp() { return new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12); }

function createPanel() {
  if (byId("manualBarlineAdjustmentAudit584")) return;
  const previous = byId("measureBboxDerivationAudit583");
  const anchor = previous || document.querySelector("main");
  if (!anchor) return;
  const section = document.createElement("section");
  section.id = "manualBarlineAdjustmentAudit584";
  section.className = "panel active";
  section.innerHTML = `<h2>3K. Ajuste manual rápido de barras/compassos</h2><p class="hint">Auditoria 58.4: registra barras e bbox de sistema confirmados manualmente. Não faz inferência geométrica automática.</p><div class="toolbar sticky"><button id="btnManualBarlineTemplate" class="ghost">Gerar template</button><button id="btnApplyManualBarlineAdjustment" class="primary">Aplicar ajuste manual</button><button id="btnExportManualBarlineAdjustment" class="ghost">Exportar relatório JSON</button></div><textarea id="manualBarlineAdjustmentInput" class="report" style="width:100%;min-height:180px" placeholder='Cole JSON manual: {"systems":[{"system_id":"s001","page":1,"system_bbox":{"x":0,"y":0,"w":0,"h":0},"barline_x_positions":[0,100,200]}]}'></textarea><pre id="manualBarlineAdjustmentOutput" class="report small-report">Ajuste manual ainda não aplicado.</pre>`;
  anchor.insertAdjacentElement("afterend", section);
}

function bindButtons() {
  const template = byId("btnManualBarlineTemplate");
  const apply = byId("btnApplyManualBarlineAdjustment");
  const exp = byId("btnExportManualBarlineAdjustment");
  if (template) template.onclick = event => { event.preventDefault(); const input = byId("manualBarlineAdjustmentInput"); if (input) input.value = buildTemplate(loadProtocol()); };
  if (apply) apply.onclick = event => { event.preventDefault(); const report = applyManualAdjustments(); const out = byId("manualBarlineAdjustmentOutput"); if (out) out.textContent = `${humanReport(report)}\n\nJSON:\n${JSON.stringify(report, null, 2)}`; };
  if (exp) exp.onclick = event => { event.preventDefault(); const report = buildReport(loadProtocol(), [], false); const text = JSON.stringify(report, null, 2); const out = byId("manualBarlineAdjustmentOutput"); if (out) out.textContent = `${humanReport(report)}\n\nJSON:\n${text}`; downloadText(`cpp_ajuste_manual_barras_audit58_4_${timestamp()}.json`, text); };
}

function markBuild() { window.CPP_ACTIVE_BUILD = AUDIT584_BUILD; const build = byId("frontendBuild"); if (build) build.textContent = `Frontend build: ${AUDIT584_BUILD}`; }
function initAudit584ManualBarlineAdjustment() { markBuild(); createPanel(); bindButtons(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAudit584ManualBarlineAdjustment); else initAudit584ManualBarlineAdjustment();
