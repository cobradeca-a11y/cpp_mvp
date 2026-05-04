const BUILD = 'audit-59-cache-v1';
const STORAGE_KEY = 'cpp_professional_omr_protocol_v1';
const $ = id => document.getElementById(id);

let mods = {};
let protocol = fallbackLoadProtocol();
let selectedFile = null;
let measureIndex = 0;
let ocrIndex = 0;
let reviewIndex = 0;

function emptyProtocol() {
  return {
    cpp_version: 'professional-omr-1.0',
    source: { file_name: '', file_type: '', omr_status: 'pending', ocr_status: 'pending', ocr_engine: '', validation_status: 'pending' },
    music: { title: '', key: '', meter_default: '', tempo: '', composer: '', arranger: '' },
    pages: [], systems: [], measures: [], review: [],
    outputs: { technical_chord_sheet: '', playable_chord_sheet: '', uncertainty_report: '', detection_report: '' },
  };
}

function sanitizeLegacyProtocol(value) {
  const merged = { ...emptyProtocol(), ...(value || {}) };
  merged.source = { ...emptyProtocol().source, ...(value?.source || {}) };
  merged.music = { ...emptyProtocol().music, ...(value?.music || {}) };
  const hasLoadedFile = Boolean(merged.source?.file_name) || (Array.isArray(merged.measures) && merged.measures.length > 0);
  if (!hasLoadedFile && merged.music?.meter_default === '3/4') merged.music.meter_default = '';
  return merged;
}

function fallbackLoadProtocol() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeLegacyProtocol(JSON.parse(raw)) : emptyProtocol();
  } catch {
    return emptyProtocol();
  }
}

function fallbackSaveProtocol(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeLegacyProtocol(value || emptyProtocol())));
}\n
function esc(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function toast(message) {
  const box = $('toast');
  if (!box) return;
  box.textContent = message;
  box.classList.remove('hidden');
  setTimeout(() => box.classList.add('hidden'), 2400);
}

function classifyError(error, context = {}) {
  const message = String(error?.message || error || 'Erro desconhecido.');
  return [
    '[Erro operacional]',
    `Código: ${context.category || 'frontend_error'}`,
    `Mensagem: ${message}`,
    `Contexto: ${JSON.stringify(sanitizeContext(context), null, 2)}`,
    `Data: ${new Date().toISOString()}`,
  ].join('\n');
}

function sanitizeContext(context = {}) {
  const out = { ...context };
  delete out.credentials; delete out.token; delete out.password; delete out.rawProtocol; delete out.fileContent;
  return out;
}

function logError(error, context = {}) {
  const box = $('frontendErrorLog');
  if (!box) return;
  const previous = box.textContent?.trim();
  const text = classifyError(error, context);
  box.textContent = previous && previous !== 'Nenhum erro operacional registrado nesta sessão.' ? `${text}\n\n---\n\n${previous}` : text;
}

function bindSafe(id, handler) {
  const el = $(id);
  if (!el) return;
  el.onclick = async event => {
    event?.preventDefault?.();
    try {
      await handler(event);
    } catch (error) {
      logError(error, { category: 'button_error', button_id: id });
      toast('Erro operacional no botão.');
    }
  };
}

function fileBaseName(name = '') {
  return String(name).replace(/\.[^.]+$/, '').trim();
}

function fallbackGetKind(file) {
  if (!file) return '';
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.musicxml') || name.endsWith('.xml') || name.endsWith('.mxl')) return 'musicxml';
  if (file.type?.startsWith('image/') || /\.(png|jpg|jpeg|webp)$/i.test(name)) return 'image';
  return 'unknown';
}

function validateSelectedFile(file) {
  if (mods.validateFile) return mods.validateFile(file);
  const kind = fallbackGetKind(file);
  if (!file) return { ok: false, message: 'Nenhum arquivo selecionado.' };
  if (!['pdf', 'image', 'musicxml'].includes(kind)) return { ok: false, message: 'Tipo não aceito. Use PDF, JPG, PNG, WEBP, MusicXML, XML ou MXL.' };
  return { ok: true, kind, message: 'Arquivo aceito para OMR profissional.' };
}

function saveProtocolSafe() {
  try {
    if (mods.saveProtocol) mods.saveProtocol(sanitizeLegacyProtocol(protocol));
    else fallbackSaveProtocol(protocol);
  } catch (error) {
    logError(error, { category: 'storage_error', operation: 'saveProtocol' });
    fallbackSaveProtocol(protocol);
  }
}

function loadProtocolSafe() {
  try {
    protocol = mods.loadProtocol ? sanitizeLegacyProtocol(mods.loadProtocol()) : fallbackLoadProtocol();
  } catch (error) {
    logError(error, { category: 'storage_error', operation: 'loadProtocol' });
    protocol = fallbackLoadProtocol();
  }
}

function measures() { return Array.isArray(protocol?.measures) ? protocol.measures : []; }
function blocks() { return Array.isArray(protocol?.fusion?.text_blocks_index) ? protocol.fusion.text_blocks_index : []; }
function reviews() { return Array.isArray(protocol?.review) ? protocol.review : []; }

function measureText(measure) {
  if (mods.measureFeedback) return mods.measureFeedback(measure);
  if (!measure) return 'Nenhum compasso importado.';
  return [`[Compasso ${measure.number || ''}]`, `Status: ${measure.confidence || 'provável'}`, `Revisão: ${measure.review_status || 'pending'}`, `Compasso: ${measure.meter || ''}`].join('\n');
}

function renderMeasures() {
  const list = $('measuresList');
  const detail = $('measureFeedback');
  if (!list || !detail) return;
  const data = measures();
  list.innerHTML = '';
  if (!data.length) {
    measureIndex = 0;
    detail.textContent = 'Nenhum compasso carregado.';
    return;
  }
  measureIndex = Math.min(Math.max(measureIndex, 0), data.length - 1);
  data.forEach((measure, index) => {
    const item = document.createElement('div');
    item.className = `item ${index === measureIndex ? 'active' : ''}`;
    item.innerHTML = `<div class="row"><b>Compasso ${esc(measure.number || index + 1)}</b><span>${esc(measure.confidence || 'provável')}</span></div><small>${esc(measure.meter || '')} — ${esc(measure.review_status || 'pending')}</small>`;
    item.onclick = () => { measureIndex = index; renderMeasures(); };
    list.appendChild(item);
  });
  detail.textContent = measureText(data[measureIndex]);
}

function renderBlocks() {
  const list = $('ocrBlocksList');
  const detail = $('ocrBlockDetails');
  if (!list || !detail) return;
  const data = blocks();
  list.innerHTML = '';
  if (!data.length) {
    ocrIndex = 0;
    detail.textContent = 'Nenhum bloco OCR carregado.';
    return;
  }
  ocrIndex = Math.min(Math.max(ocrIndex, 0), data.length - 1);
  data.forEach((block, index) => {
    const item = document.createElement('div');
    item.className = `item ${index === ocrIndex ? 'active' : ''}`;
    item.innerHTML = `<div class="row"><b>${esc(block.text || '[vazio]')}</b><span>${esc(block.classification || '—')}</span></div><small>${esc(block.fusion_id || '')} — ${esc(block.human_review?.status || 'pendente')}</small>`;
    item.onclick = () => { ocrIndex = index; renderBlocks(); };
    list.appendChild(item);
  });
  const block = data[ocrIndex];
  detail.innerHTML = `<div class="ocr-detail-grid"><div><span class="detail-label">ID</span><strong>${esc(block.fusion_id || '—')}</strong></div><div><span class="detail-label">Página</span><strong>${esc(block.page || '—')}</strong></div><div><span class="detail-label">Classificação</span><strong>${esc(block.classification || '—')}</strong></div><div><span class="detail-label">Revisão</span><strong>${esc(block.human_review?.status || 'pendente')}</strong></div></div><h4>Texto OCR bruto preservado</h4><pre class="ocr-raw">${esc(block.text || '')}</pre><h4>Texto normalizado conservador</h4><pre class="ocr-normalized">${esc(block.normalized_text || '')}</pre><h4>Análise de cifra candidata</h4><pre class="inline-json">${esc(JSON.stringify(block.chord_analysis || null, null, 2))}</pre>`;
}

function renderReviews() {
  const list = $('reviewHistoryList');
  const detail = $('reviewHistoryDetails');
  if (!list || !detail) return;
  const data = reviews();
  list.innerHTML = '';
  if (!data.length) {
    reviewIndex = 0;
    detail.textContent = 'Nenhuma decisão humana registrada.';
    return;
  }
  reviewIndex = Math.min(Math.max(reviewIndex, 0), data.length - 1);
  data.forEach((review, index) => {
    const item = document.createElement('div');
    item.className = `item ${index === reviewIndex ? 'active' : ''}`;
    item.innerHTML = `<div class="row"><b>${esc(review.audit || 'auditoria')}</b><span>${esc(review.decision || review.action || '—')}</span></div><small>${esc(review.type || '—')}</small>`;
    item.onclick = () => { reviewIndex = index; renderReviews(); };
    list.appendChild(item);
  });
  detail.innerHTML = `<pre class="inline-json">${esc(JSON.stringify(data[reviewIndex], null, 2))}</pre>`;
}

function technicalSheet() { return mods.generateTechnicalChordSheet ? mods.generateTechnicalChordSheet(protocol) : 'Cifra técnica indisponível: módulo não carregado.'; }
function playableSheet() { return mods.generatePlayableChordSheet ? mods.generatePlayableChordSheet(protocol) : 'Cifra tocável indisponível: módulo não carregado.'; }
function uncertaintyReport() { return mods.globalUncertaintyReport ? mods.globalUncertaintyReport(protocol) : 'Relatório de incertezas indisponível: módulo não carregado.'; }
function detectReport() { return mods.detectionReport ? mods.detectionReport(protocol) : 'Relatório de detecção indisponível: módulo não carregado.'; }
function multipageReport() { return mods.generateMultipageAuditExportText ? mods.generateMultipageAuditExportText(protocol) : JSON.stringify({ export_type: 'cpp_multipage_audit_export', version: 'audit-50-fallback', protocol }, null, 2); }

function generateOutputsSafe() {
  protocol.outputs ||= {};
  protocol.outputs.technical_chord_sheet = technicalSheet();
  protocol.outputs.playable_chord_sheet = playableSheet();
  protocol.outputs.uncertainty_report = uncertaintyReport();
  protocol.outputs.detection_report = detectReport();
  setText('technicalOutput', protocol.outputs.technical_chord_sheet);
  setText('playableOutput', protocol.outputs.playable_chord_sheet);
  setText('uncertaintyOutput', protocol.outputs.uncertainty_report);
  setText('detectionOutput', protocol.outputs.detection_report);
  saveProtocolSafe();
}

function refreshAll() {
  renderMeasures();
  renderBlocks();
  renderReviews();
  generateOutputsSafe();
}

function downloadSafe(filename, text, mime = 'text/plain;charset=utf-8') {
  if (mods.downloadText) return mods.downloadText(filename, text, mime);
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function versionedSafe(base, ext) {
  if (mods.versioned) return mods.versioned(base, ext);
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  return `${base}_${stamp}.${ext}`;
}

async function clearCache() {
  toast('Limpando cache do app...');
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  protocol = emptyProtocol();
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(reg => reg.unregister()));
  }
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('cpp-professional-omr-')).map(key => caches.delete(key)));
  }
  location.reload();
}

async function checkBackend() {
  const backendUrl = $('backendUrl')?.value?.trim() || 'http://localhost:8787';
  setText('backendStatus', 'Verificando backend...');
  try {
    if (mods.checkProfessionalOmrBackend) {
      setText('backendStatus', JSON.stringify(await mods.checkProfessionalOmrBackend(backendUrl), null, 2));
    } else {
      const response = await fetch(`${backendUrl.replace(/\/$/, '')}/health`);
      setText('backendStatus', JSON.stringify(await response.json(), null, 2));
    }
    toast('Backend verificado.');
  } catch (error) {
    setText('backendStatus', `Backend indisponível.\n${error.message || error}`);
    logError(error, { category: 'backend', operation: 'health_check', backendUrl });
    toast('Backend indisponível.');
  }
}

async function processOmr() {
  const file = selectedFile || $('fileInput')?.files?.[0] || null;
  const valid = validateSelectedFile(file);
  if (!valid.ok) {
    setText('fileInfo', valid.message);
    logError(new Error(valid.message), { category: 'file' });
    toast(valid.message);
    return;
  }
  const btn = $('btnProfessionalOmr');
  const backendUrl = $('backendUrl')?.value?.trim() || 'http://localhost:8787';
  if (btn) { btn.disabled = true; btn.textContent = 'Processando...'; }
  setText('processingStatus', 'Enviando arquivo ao backend OMR profissional...');
  try {
    if (mods.analyzeWithProfessionalOmr) protocol = await mods.analyzeWithProfessionalOmr({ file, backendUrl });
    else {
      const form = new FormData(); form.append('file', file);
      const response = await fetch(`${backendUrl.replace(/\/$/, '')}/api/omr/analyze`, { method: 'POST', body: form });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      protocol = await response.json();
    }
    protocol.music ||= {};
    protocol.music.title ||= fileBaseName(file.name) || 'Sem título';
    saveProtocolSafe();
    setText('processingStatus', ['Processamento concluído.', `Arquivo: ${protocol.source?.file_name || file.name}`, `Status OMR: ${protocol.source?.omr_status || 'pending'}`, `Status OCR: ${protocol.source?.ocr_status || protocol.ocr?.status || 'pending'}`, `Blocos OCR: ${protocol.ocr?.text_blocks?.length || 0}`, `Compassos importados: ${protocol.measures?.length || 0}`].join('\n'));
    measureIndex = 0; ocrIndex = 0; reviewIndex = 0;
    refreshAll();
    toast('Processamento profissional concluído.');
  } catch (error) {
    setText('processingStatus', `Erro no processamento profissional.\n${error.message || error}`);
    logError(error, { category: 'backend', operation: 'analyze', backendUrl, file_name: file?.name || '' });
    toast('Erro no OMR profissional.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Processar com OMR Profissional'; }
  }
}

function reviewMeasure(action) {
  const measure = measures()[measureIndex];
  if (!measure) return toast('Nenhum compasso carregado.');
  if (action === 'accept') {
    if (mods.acceptMeasure) mods.acceptMeasure(measure);
    else { measure.review_status = 'approved'; measure.review_required = false; }
  }
  if (action === 'uncertain') {
    if (mods.markMeasureUncertain) mods.markMeasureUncertain(measure);
    else { measure.review_status = 'needs_fix'; measure.review_required = true; measure.confidence = 'incerto'; }
  }
  protocol.review ||= [];
  protocol.review.push({ id: `measure-${action}-${Date.now()}`, audit: 'audit-50-ui', type: 'measure_review', target_id: measure.measure_id || measure.id || null, decision: action, reviewed_at: new Date().toISOString(), effects: { evidence_changed: false } });
  saveProtocolSafe();
  refreshAll();
  toast(action === 'accept' ? 'Compasso aceito.' : 'Compasso marcado como incerto.');
}

function reviewBlock(type, decision, audit) {
  const block = blocks()[ocrIndex];
  if (!block) return toast('Nenhum bloco OCR carregado.');
  protocol.review ||= [];
  const review = { id: `${type}-${Date.now()}`, audit, type, target_id: block.fusion_id || null, decision, original_text: block.text || '', normalized_text: block.normalized_text || '', reviewed_at: new Date().toISOString(), effects: { evidence_changed: false, alignment_changed: false } };
  protocol.review.push(review);
  if (type === 'ocr_classification_review') block.human_review = { status: decision === 'approved' ? 'classification_approved' : 'classification_rejected', decision, review_id: review.id };
  if (type === 'ocr_system_association_review') block.system_human_review = { status: decision === 'confirmed' ? 'system_state_confirmed' : 'system_state_rejected', decision, review_id: review.id };
  if (type === 'ocr_measure_association_review') block.measure_human_review = { status: decision === 'confirmed' ? 'measure_state_confirmed' : 'measure_state_rejected', decision, review_id: review.id };
  saveProtocolSafe();
  refreshAll();
  toast('Decisão humana registrada.');
}

async function loadModules() {
  const results = await Promise.allSettled([
    import('./modules/cpp-json.js'), import('./modules/file-input.js'), import('./modules/professional-omr-client.js'), import('./modules/feedback-engine.js'), import('./modules/measure-review.js'), import('./modules/chord-sheet-technical.js'), import('./modules/chord-sheet-playable.js'), import('./modules/confidence-engine.js'), import('./modules/export-output.js'), import('./modules/multipage-audit-export.js'), import('./modules/error-reporting.js'),
  ]);
  for (const result of results) {
    if (result.status === 'fulfilled') Object.assign(mods, result.value);
    else logError(result.reason, { category: 'module_import' });
  }
  loadProtocolSafe();
}

function hydrateButtons() {
  bindSafe('btnCheckBackend', checkBackend);
  bindSafe('btnClearFrontendCache', clearCache);
  bindSafe('btnProfessionalOmr', processOmr);
  bindSafe('btnPrevMeasure', () => { measureIndex = Math.max(0, measureIndex - 1); renderMeasures(); });
  bindSafe('btnNextMeasure', () => { measureIndex = Math.min(Math.max(measures().length - 1, 0), measureIndex + 1); renderMeasures(); });
  bindSafe('btnAcceptMeasure', () => reviewMeasure('accept'));
  bindSafe('btnMarkUncertain', () => reviewMeasure('uncertain'));
  bindSafe('btnPrevOcrBlock', () => { ocrIndex = Math.max(0, ocrIndex - 1); renderBlocks(); });
  bindSafe('btnNextOcrBlock', () => { ocrIndex = Math.min(Math.max(blocks().length - 1, 0), ocrIndex + 1); renderBlocks(); });
  bindSafe('btnApproveOcrClassification', () => reviewBlock('ocr_classification_review', 'approved', 'audit-36'));
  bindSafe('btnRejectOcrClassification', () => reviewBlock('ocr_classification_review', 'rejected', 'audit-36'));
  bindSafe('btnConfirmOcrSystemState', () => reviewBlock('ocr_system_association_review', 'confirmed', 'audit-37'));
  bindSafe('btnRejectOcrSystemState', () => reviewBlock('ocr_system_association_review', 'rejected', 'audit-37'));
  bindSafe('btnConfirmOcrMeasureState', () => reviewBlock('ocr_measure_association_review', 'confirmed', 'audit-38'));
  bindSafe('btnRejectOcrMeasureState', () => reviewBlock('ocr_measure_association_review', 'rejected', 'audit-38'));
  bindSafe('btnGenerateOutputs', () => { generateOutputsSafe(); toast('Saídas geradas.'); });
  bindSafe('btnExportJson', () => downloadSafe(versionedSafe('protocolo_cpp', 'json'), mods.exportJson ? mods.exportJson(protocol) : JSON.stringify(protocol, null, 2), 'application/json;charset=utf-8'));
  bindSafe('btnExportTech', () => downloadSafe(versionedSafe('cifra_tecnica', 'txt'), protocol.outputs?.technical_chord_sheet || technicalSheet()));
  bindSafe('btnExportPlayable', () => downloadSafe(versionedSafe('cifra_tocavel', 'txt'), protocol.outputs?.playable_chord_sheet || playableSheet()));
  bindSafe('btnExportUncertainty', () => downloadSafe(versionedSafe('relatorio_incertezas', 'txt'), protocol.outputs?.uncertainty_report || uncertaintyReport()));
  bindSafe('btnExportDetection', () => downloadSafe(versionedSafe('relatorio_deteccao', 'txt'), protocol.outputs?.detection_report || detectReport()));
  bindSafe('btnExportMultipageAudit', () => downloadSafe(versionedSafe('exportacao_multipagina_auditavel', 'json'), multipageReport(), 'application/json;charset=utf-8'));
  bindSafe('btnExportAll', () => downloadSafe(versionedSafe('cpp_pacote_exportacao', 'json'), JSON.stringify({ protocol, outputs: protocol.outputs || {}, multipage_audit_export: JSON.parse(multipageReport()) }, null, 2), 'application/json;charset=utf-8'));
  bindSafe('btnExportErrorLog', () => downloadSafe(versionedSafe('log_erros_operacionais', 'txt'), $('frontendErrorLog')?.textContent || 'Nenhum erro operacional registrado nesta sessão.'));
  bindSafe('btnClearErrorLog', () => setText('frontendErrorLog', 'Nenhum erro operacional registrado nesta sessão.'));
}

function hydrateFileInput() {
  const input = $('fileInput');
  if (!input) return;
  input.onchange = event => {
    selectedFile = event.target.files?.[0] || null;
    const valid = validateSelectedFile(selectedFile);
    setText('fileInfo', selectedFile ? `${selectedFile.name} — ${valid.message}` : 'Nenhum arquivo selecionado.');
    if (selectedFile) {
      const title = $('musicTitle'); const key = $('musicKey'); const meter = $('meterDefault'); const tempo = $('tempo');
      if (title) title.value = fileBaseName(selectedFile.name);
      if (key) key.value = '';
      if (meter) meter.value = '';
      if (tempo) tempo.value = '';
    }
  };
}

async function initAudit50() {
  setText('frontendBuild', `Frontend build: ${BUILD}`);
  hydrateButtons();
  hydrateFileInput();
  const meter = $('meterDefault');
  if (meter && !selectedFile) meter.value = '';
  window.addEventListener('error', event => logError(event.error || event.message, { category: 'frontend_runtime', source: event.filename, line: event.lineno }));
  window.addEventListener('unhandledrejection', event => logError(event.reason || 'Promise rejeitada sem tratamento', { category: 'frontend_promise' }));
  await loadModules();
  refreshAll();
  if (meter && !protocol?.source?.file_name) meter.value = '';
  setText('processingStatus', 'Aguardando arquivo.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initAudit50().catch(error => logError(error, { category: 'frontend_init' })));
} else {
  initAudit50().catch(error => logError(error, { category: 'frontend_init' }));
}
