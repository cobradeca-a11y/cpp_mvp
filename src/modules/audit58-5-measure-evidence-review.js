const AUDIT585_BUILD = "audit-58-5-cache-v1";
const STORAGE_KEY = "cpp_professional_omr_protocol_v1";

function byId(id) { return document.getElementById(id); }
function asArray(value) { return Array.isArray(value) ? value : []; }
function safeJsonParse(raw, fallback = {}) { try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
function loadProtocol() { return safeJsonParse(localStorage.getItem(STORAGE_KEY), {}); }
function saveProtocol(protocol) { localStorage.setItem(STORAGE_KEY, JSON.stringify(protocol || {})); }
function uid(prefix) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`; }
function esc(value) { return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }

function measureId(measure, index) { return measure?.measure_id || measure?.id || `m${String(index + 1).padStart(3, "0")}`; }
function blockId(block, index) { return block?.fusion_id || block?.id || `ocr_${String(index + 1).padStart(3, "0")}`; }
function blockText(block) { return block?.raw_text || block?.text || ""; }
function blockAssignedTo(block, measure) {
  const assoc = block?.measure_association || {};
  const mId = measure?.measure_id || measure?.id;
  const mNumber = measure?.number ?? measure?.measure_number;
  return assoc?.status === "assigned" && (String(assoc.measure_id || assoc.id || '') === String(mId || '') || String(assoc.measure_number || assoc.number || '') === String(mNumber || ''));
}
function isChordCandidate(block) { return Boolean(block?.chord_analysis) || String(block?.classification || '').includes('chord'); }
function isLyricCandidate(block) { return String(block?.classification || '').includes('lyric') || String(block?.classification || '').includes('text'); }

function summarizeProtocol(protocol = loadProtocol()) {
  const measures = asArray(protocol.measures);
  const blocks = asArray(protocol?.fusion?.text_blocks_index);
  const reviews = asArray(protocol.review).filter(item => item?.audit === "audit-58.5");
  return {
    measures: measures.map((measure, index) => ({ measure_id: measureId(measure, index), number: measure?.number ?? measure?.measure_number ?? index + 1, review_status: measure?.review_status || 'pending' })),
    existing_assigned_candidates: measures.map((measure, index) => {
      const id = measureId(measure, index);
      const candidates = blocks.filter(block => blockAssignedTo(block, measure)).map((block, bIndex) => ({ target_id: blockId(block, bIndex), text: blockText(block), classification: block?.classification || '', chord_candidate: isChordCandidate(block), lyric_candidate: isLyricCandidate(block) }));
      return { measure_id: id, candidates };
    }).filter(item => item.candidates.length > 0),
    unassigned_global_candidates: blocks.filter(block => isChordCandidate(block) || isLyricCandidate(block)).slice(0, 250).map((block, index) => ({ target_id: blockId(block, index), text: blockText(block), classification: block?.classification || '', chord_candidate: isChordCandidate(block), lyric_candidate: isLyricCandidate(block), warning: 'Não associado a compasso sem confirmação humana explícita.' })),
    audit58_5_reviews: reviews.length,
  };
}

function buildTemplate(protocol = loadProtocol()) {
  const summary = summarizeProtocol(protocol);
  return JSON.stringify({
    instructions: "Edite actions[] manualmente. Não aprove texto/cifra que você não conferiu visualmente.",
    allowed_actions: ["approve_chord_for_measure", "reject_chord_for_measure", "approve_lyric_for_measure", "reject_lyric_for_measure", "mark_gap"],
    gap_types: ["no_visible_chord", "no_approved_chord", "no_approved_lyric", "ocr_illegible", "measure_needs_visual_review", "other"],
    measures: summary.measures,
    existing_assigned_candidates: summary.existing_assigned_candidates,
    unassigned_global_candidates: summary.unassigned_global_candidates,
    actions: [
      { action: "mark_gap", measure_id: summary.measures[0]?.measure_id || "m001", gap_type: "measure_needs_visual_review", note: "pendente de revisão visual" }
    ]
  }, null, 2);
}

function findMeasure(protocol, id) {
  return asArray(protocol.measures).find((measure, index) => String(measureId(measure, index)) === String(id) || String(measure?.number ?? measure?.measure_number) === String(id));
}
function findBlock(protocol, id) {
  return asArray(protocol?.fusion?.text_blocks_index).find((block, index) => String(blockId(block, index)) === String(id));
}

function applyAction(protocol, action) {
  const kind = String(action?.action || '').trim();
  const measure = findMeasure(protocol, action?.measure_id);
  const result = { action: kind, measure_id: action?.measure_id || null, target_id: action?.target_id || null, applied: false, reason: '' };
  const allowed = ["approve_chord_for_measure", "reject_chord_for_measure", "approve_lyric_for_measure", "reject_lyric_for_measure", "mark_gap"];
  if (!allowed.includes(kind)) { result.reason = 'unsupported_action'; return result; }
  if (!measure) { result.reason = 'measure_not_found'; return result; }

  const review = {
    id: uid('rev'),
    timestamp: new Date().toISOString(),
    audit: 'audit-58.5',
    type: kind === 'mark_gap' ? 'measure_gap_review' : 'measure_evidence_review',
    source: 'human_review',
    measure_id: measure.measure_id || measure.id || action.measure_id,
    measure_number: measure.number ?? measure.measure_number ?? null,
    decision: kind,
    target_id: action?.target_id || null,
    note: action?.note || '',
    effects: {
      modifies_protocol: true,
      modifies_ocr_raw_text: false,
      infers_lyrics: false,
      infers_harmony: false,
      aligns_ocr_to_measure_without_geometry: false,
      marks_playable_ready_automatically: false,
    }
  };

  if (kind === 'mark_gap') {
    measure.lacunae ||= [];
    const gap = { id: uid('gap'), type: action?.gap_type || 'other', note: action?.note || '', source: 'human_review', audit: 'audit-58.5', created_at: review.timestamp, resolved: false };
    measure.lacunae.push(gap);
    review.gap = gap;
    protocol.review ||= [];
    protocol.review.push(review);
    result.applied = true;
    result.reason = 'gap_marked';
    return result;
  }

  const block = findBlock(protocol, action?.target_id);
  if (!block) { result.reason = 'target_block_not_found'; return result; }
  review.raw_text_preserved = blockText(block);
  review.classification = block.classification || '';

  measure.approved_evidence ||= { chords: [], lyrics: [], rejected: [] };
  if (kind === 'approve_chord_for_measure') {
    measure.approved_evidence.chords.push({ target_id: action.target_id, raw_text: blockText(block), source: 'human_review', audit: 'audit-58.5', approved_at: review.timestamp });
    review.approved_layer = 'detected_chord_to_approved_chord_for_measure';
  }
  if (kind === 'approve_lyric_for_measure') {
    measure.approved_evidence.lyrics.push({ target_id: action.target_id, raw_text: blockText(block), source: 'human_review', audit: 'audit-58.5', approved_at: review.timestamp });
    review.approved_layer = 'detected_text_to_approved_lyric_for_measure';
  }
  if (kind === 'reject_chord_for_measure' || kind === 'reject_lyric_for_measure') {
    measure.approved_evidence.rejected.push({ target_id: action.target_id, raw_text: blockText(block), reason: action?.reason || '', source: 'human_review', audit: 'audit-58.5', rejected_at: review.timestamp });
  }

  protocol.review ||= [];
  protocol.review.push(review);
  result.applied = true;
  result.reason = 'human_measure_evidence_review_recorded';
  return result;
}

function applyReviews() {
  const protocol = loadProtocol();
  const raw = byId('measureEvidenceReviewInput')?.value || '';
  const parsed = safeJsonParse(raw, null);
  const actions = Array.isArray(parsed) ? parsed : asArray(parsed?.actions || (parsed ? [parsed] : []));
  protocol.review ||= [];
  protocol.evidence_review_contract ||= {};
  protocol.evidence_review_contract.audit_58_5 = { version: 'audit-58.5', applied_at: new Date().toISOString(), rule: 'Human review of chord/lyric/gap evidence by measure. No automatic inference.' };
  const results = actions.map(action => applyAction(protocol, action));
  saveProtocol(protocol);
  return buildReport(protocol, results, true);
}

function buildReport(protocol = loadProtocol(), results = [], saved = false) {
  const measures = asArray(protocol.measures);
  const reviews = asArray(protocol.review).filter(item => item?.audit === 'audit-58.5');
  const source = protocol.source || {};
  return {
    export_type: 'cpp_measure_evidence_review_report',
    audit: 'audit-58.5',
    generated_at: new Date().toISOString(),
    frontend: { build: AUDIT585_BUILD },
    source: { file_name: source.file_name || '', file_type: source.file_type || '', omr_status: source.omr_status || 'pending', ocr_status: source.ocr_status || protocol?.ocr?.status || 'pending' },
    summary: {
      protocol_saved: saved,
      measures_total: measures.length,
      audit58_5_reviews: reviews.length,
      approved_chord_evidence: measures.reduce((sum, measure) => sum + asArray(measure?.approved_evidence?.chords).length, 0),
      approved_lyric_evidence: measures.reduce((sum, measure) => sum + asArray(measure?.approved_evidence?.lyrics).length, 0),
      rejected_evidence: measures.reduce((sum, measure) => sum + asArray(measure?.approved_evidence?.rejected).length, 0),
      lacunae_marked: measures.reduce((sum, measure) => sum + asArray(measure?.lacunae).filter(gap => gap?.audit === 'audit-58.5').length, 0),
      actions_applied: results.filter(item => item.applied).length,
      actions_rejected: results.filter(item => !item.applied).length,
      playable_ready_auto_marked: 0,
    },
    results,
    safety_contract: {
      modifies_protocol: true,
      modification_scope: 'human_measure_evidence_review_only',
      modifies_ocr_raw_text: false,
      infers_lyrics: false,
      infers_harmony: false,
      aligns_ocr_to_measure_without_geometry: false,
      marks_playable_ready_automatically: false,
      applies_human_review_without_user_action: false,
    }
  };
}

function humanReport(report) {
  return [
    'REVISÃO DEDICADA DE CIFRAS/LETRAS/LACUNAS POR COMPASSO — AUDITORIA 58.5', '',
    `Arquivo: ${report.source.file_name || 'nenhum protocolo salvo'}`,
    `Build: ${report.frontend.build}`,
    `Protocolo salvo: ${report.summary.protocol_saved ? 'sim' : 'não'}`, '',
    'Resumo:',
    `- Compassos: ${report.summary.measures_total}`,
    `- Revisões audit-58.5: ${report.summary.audit58_5_reviews}`,
    `- Cifras aprovadas por compasso: ${report.summary.approved_chord_evidence}`,
    `- Letras aprovadas por compasso: ${report.summary.approved_lyric_evidence}`,
    `- Evidências rejeitadas: ${report.summary.rejected_evidence}`,
    `- Lacunas marcadas: ${report.summary.lacunae_marked}`,
    `- Ações aplicadas: ${report.summary.actions_applied}`,
    `- Ações rejeitadas: ${report.summary.actions_rejected}`,
    `- Pronto para cifra tocável automático: ${report.summary.playable_ready_auto_marked}`, '',
    'Contrato:',
    '- Somente revisão humana explícita por JSON.',
    '- Preserva OCR bruto.',
    '- Não infere letra.',
    '- Não infere harmonia.',
    '- Não associa OCR a compasso sem confirmação.',
    '- Não marca pronto para cifra tocável.'
  ].join('\n');
}

function downloadText(filename, text, mime = 'application/json;charset=utf-8') { const blob = new Blob([text], { type: mime }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
function timestamp() { return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12); }

function createPanel() {
  if (byId('measureEvidenceReviewAudit585')) return;
  const previous = byId('manualBarlineAdjustmentAudit584');
  const anchor = previous || document.querySelector('main');
  if (!anchor) return;
  const section = document.createElement('section');
  section.id = 'measureEvidenceReviewAudit585';
  section.className = 'panel active';
  section.innerHTML = `<h2>3L. Revisão de cifras/letras/lacunas por compasso</h2><p class="hint">Auditoria 58.5: aprova/rejeita evidências OCR por compasso ou marca lacunas. Não infere letra, harmonia nem alinhamento.</p><div class="toolbar sticky"><button id="btnMeasureEvidenceTemplate" class="ghost">Gerar template</button><button id="btnApplyMeasureEvidenceReview" class="primary">Aplicar revisão</button><button id="btnExportMeasureEvidenceReview" class="ghost">Exportar relatório JSON</button></div><textarea id="measureEvidenceReviewInput" class="report" style="width:100%;min-height:220px" placeholder='Cole JSON manual com actions[]'></textarea><pre id="measureEvidenceReviewOutput" class="report small-report">Revisão dedicada ainda não aplicada.</pre>`;
  anchor.insertAdjacentElement('afterend', section);
}

function bindButtons() {
  const template = byId('btnMeasureEvidenceTemplate');
  const apply = byId('btnApplyMeasureEvidenceReview');
  const exp = byId('btnExportMeasureEvidenceReview');
  if (template) template.onclick = event => { event.preventDefault(); const input = byId('measureEvidenceReviewInput'); if (input) input.value = buildTemplate(loadProtocol()); };
  if (apply) apply.onclick = event => { event.preventDefault(); const report = applyReviews(); const out = byId('measureEvidenceReviewOutput'); if (out) out.textContent = `${humanReport(report)}\n\nJSON:\n${JSON.stringify(report, null, 2)}`; };
  if (exp) exp.onclick = event => { event.preventDefault(); const report = buildReport(loadProtocol(), [], false); const text = JSON.stringify(report, null, 2); const out = byId('measureEvidenceReviewOutput'); if (out) out.textContent = `${humanReport(report)}\n\nJSON:\n${text}`; downloadText(`cpp_revisao_evidencias_compasso_audit58_5_${timestamp()}.json`, text); };
}

function markBuild() { window.CPP_ACTIVE_BUILD = AUDIT585_BUILD; const build = byId('frontendBuild'); if (build) build.textContent = `Frontend build: ${AUDIT585_BUILD}`; }
function initAudit585MeasureEvidenceReview() { markBuild(); createPanel(); bindButtons(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAudit585MeasureEvidenceReview); else initAudit585MeasureEvidenceReview();
