const BUILD = 'audit-65-cache-v2';
const STORAGE_KEY = 'cpp_professional_omr_protocol_v1';
const $ = id => document.getElementById(id);

let selectedFile = null;
let protocol = loadProtocol();
let measureIndex = 0;
let ocrIndex = 0;
let reviewIndex = 0;

function emptyProtocol() {
  return {
    cpp_version: 'professional-omr-1.0',
    source: { file_name: '', file_type: '', omr_status: 'pending', ocr_status: 'pending', validation_status: 'pending' },
    music: { title: '', key: '', meter_default: '', tempo: '', composer: '', arranger: '' },
    pages: [],
    systems: [],
    measures: [],
    review: [],
    outputs: { technical_chord_sheet: '', playable_chord_sheet: '', uncertainty_report: '', detection_report: '' }
  };
}

function sanitizeProtocol(value) {
  const base = emptyProtocol();
  const merged = { ...base, ...(value || {}) };
  merged.source = { ...base.source, ...(value?.source || {}) };
  merged.music = { ...base.music, ...(value?.music || {}) };
  merged.outputs = { ...base.outputs, ...(value?.outputs || {}) };
  merged.pages = Array.isArray(merged.pages) ? merged.pages : [];
  merged.systems = Array.isArray(merged.systems) ? merged.systems : [];
  merged.measures = Array.isArray(merged.measures) ? merged.measures : [];
  merged.review = Array.isArray(merged.review) ? merged.review : [];
  const hasLoadedFile = Boolean(merged.source.file_name) || merged.measures.length > 0;
  if (!hasLoadedFile && merged.music.meter_default === '3/4') merged.music.meter_default = '';
  return merged;
}

function loadProtocol() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeProtocol(JSON.parse(raw)) : emptyProtocol();
  } catch {
    return emptyProtocol();
  }
}

function saveProtocol(value = protocol) {
  protocol = sanitizeProtocol(value);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(protocol));
}

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

function logError(error, context = {}) {
  const box = $('frontendErrorLog');
  if (!box) return;
  const msg = String(error?.message || error || 'Erro desconhecido.');
  const entry = [
    '[Erro operacional]',
    `Código: ${context.category || 'frontend_error'}`,
    `Mensagem: ${msg}`,
    `Contexto: ${JSON.stringify(context, null, 2)}`,
    `Data: ${new Date().toISOString()}`
  ].join('\n');
  const previous = box.textContent?.trim();
  box.textContent = previous && previous !== 'Nenhum erro operacional registrado nesta sessão.' ? `${entry}\n\n---\n\n${previous}` : entry;
}

function bindSafe(id, handler) {
  const el = $(id);
  if (!el) return;
  el.onclick = async event => {
    event?.preventDefault?.();
    try { await handler(event); }
    catch (error) { logError(error, { category: 'button_error', button_id: id }); toast('Erro operacional no botão.'); }
  };
}

function fileKind(file) {
  if (!file) return '';
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.musicxml') || name.endsWith('.xml') || name.endsWith('.mxl')) return 'musicxml';
  if (file.type?.startsWith('image/') || /\.(png|jpg|jpeg|webp)$/i.test(name)) return 'image';
  return 'unknown';
}

function fileBaseName(name = '') {
  return String(name).replace(/\.[^.]+$/, '').trim();
}

function measures() { return Array.isArray(protocol.measures) ? protocol.measures : []; }
function blocks() { return Array.isArray(protocol?.fusion?.text_blocks_index) ? protocol.fusion.text_blocks_index : []; }
function reviews() { return Array.isArray(protocol.review) ? protocol.review : []; }

function renderMeasures() {
  const list = $('measuresList');
  const detail = $('measureFeedback');
  if (!list || !detail) return;
  const data = measures();
  list.innerHTML = '';
  if (!data.length) { detail.textContent = 'Nenhum compasso carregado.'; return; }
  measureIndex = Math.min(Math.max(measureIndex, 0), data.length - 1);
  data.forEach((measure, index) => {
    const item = document.createElement('div');
    item.className = `item ${index === measureIndex ? 'active' : ''}`;
    item.innerHTML = `<div class="row"><b>Compasso ${esc(measure.number || measure.measure_number || index + 1)}</b><span>${esc(measure.confidence || 'provável')}</span></div><small>${esc(measure.review_status || 'pending')}</small>`;
    item.onclick = () => { measureIndex = index; renderMeasures(); };
    list.appendChild(item);
  });
  const m = data[measureIndex];
  detail.textContent = JSON.stringify({ measure_id: m.measure_id || m.id || null, number: m.number || m.measure_number || measureIndex + 1, review_status: m.review_status || 'pending', geometry: m.geometry || null, playable_release: m.playable_release || null }, null, 2);
}

function renderBlocks() {
  const list = $('ocrBlocksList');
  const detail = $('ocrBlockDetails');
  if (!list || !detail) return;
  const data = blocks();
  list.innerHTML = '';
  if (!data.length) { detail.textContent = 'Nenhum bloco OCR carregado.'; return; }
  ocrIndex = Math.min(Math.max(ocrIndex, 0), data.length - 1);
  data.forEach((block, index) => {
    const item = document.createElement('div');
    item.className = `item ${index === ocrIndex ? 'active' : ''}`;
    item.innerHTML = `<div class="row"><b>${esc(block.text || block.raw_text || '[vazio]')}</b><span>${esc(block.classification || '—')}</span></div><small>${esc(block.fusion_id || block.id || '')}</small>`;
    item.onclick = () => { ocrIndex = index; renderBlocks(); };
    list.appendChild(item);
  });
  detail.innerHTML = `<pre class="inline-json">${esc(JSON.stringify(data[ocrIndex], null, 2))}</pre>`;
}

function renderReviews() {
  const list = $('reviewHistoryList');
  const detail = $('reviewHistoryDetails');
  if (!list || !detail) return;
  const data = reviews();
  list.innerHTML = '';
  if (!data.length) { detail.textContent = 'Nenhuma decisão humana registrada.'; return; }
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

function generateOutputs() {
  protocol.outputs ||= {};
  protocol.outputs.technical_chord_sheet = protocol.outputs.technical_chord_sheet || `CIFRA TÉCNICA — ${protocol.music?.title || 'Sem título'}\nTom: ${protocol.music?.key || ''} | Compasso padrão: ${protocol.music?.meter_default || ''} | Andamento: ${protocol.music?.tempo || ''}\n\nSaída técnica depende de evidências aprovadas.`;
  protocol.outputs.playable_chord_sheet = protocol.outputs.playable_chord_sheet || `${protocol.music?.title || 'Sem título'}\n\nCifra tocável bloqueada até liberação humana explícita.`;
  protocol.outputs.uncertainty_report = protocol.outputs.uncertainty_report || 'RELATÓRIO DE INCERTEZAS\n\nSem saída recalculada nesta sessão.';
  protocol.outputs.detection_report = protocol.outputs.detection_report || 'RELATÓRIO DE DETECÇÃO\n\nSem saída recalculada nesta sessão.';
  setText('technicalOutput', protocol.outputs.technical_chord_sheet);
  setText('playableOutput', protocol.outputs.playable_chord_sheet);
  setText('uncertaintyOutput', protocol.outputs.uncertainty_report);
  setText('detectionOutput', protocol.outputs.detection_report);
}

function refreshAll() {
  protocol = loadProtocol();
  renderMeasures();
  renderBlocks();
  renderReviews();
  generateOutputs();
}

function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function versioned(base, ext) {
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  return `${base}_${stamp}.${ext}`;
}

async function clearCache() {
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
  const response = await fetch(`${backendUrl.replace(/\/$/, '')}/health`);
  setText('backendStatus', JSON.stringify(await response.json(), null, 2));
}

async function processOmr() {
  const file = selectedFile || $('fileInput')?.files?.[0] || null;
  if (!file) { toast('Nenhum arquivo selecionado.'); return; }
  const kind = fileKind(file);
  if (!['pdf', 'image', 'musicxml'].includes(kind)) { toast('Tipo não aceito.'); return; }
  const backendUrl = $('backendUrl')?.value?.trim() || 'http://localhost:8787';
  const btn = $('btnProfessionalOmr');
  if (btn) { btn.disabled = true; btn.textContent = 'Processando...'; }
  setText('processingStatus', 'Enviando arquivo ao backend OMR profissional...');
  try {
    const form = new FormData();
    form.append('file', file);
    const response = await fetch(`${backendUrl.replace(/\/$/, '')}/api/omr/analyze`, { method: 'POST', body: form });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    protocol = sanitizeProtocol(await response.json());
    protocol.music ||= {};
    protocol.music.title ||= fileBaseName(file.name) || 'Sem título';
    saveProtocol(protocol);
    setText('processingStatus', ['Processamento concluído.', `Arquivo: ${protocol.source?.file_name || file.name}`, `Status OMR: ${protocol.source?.omr_status || 'pending'}`, `Status OCR: ${protocol.source?.ocr_status || protocol.ocr?.status || 'pending'}`, `Compassos importados: ${protocol.measures?.length || 0}`].join('\n'));
    measureIndex = 0; ocrIndex = 0; reviewIndex = 0;
    refreshAll();
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Processar com OMR Profissional'; }
  }
}

function addReview(type, decision) {
  const m = measures()[measureIndex];
  if (!m) return;
  protocol.review ||= [];
  protocol.review.push({ id: `${type}-${Date.now()}`, audit: 'audit-65-shell', type, target_id: m.measure_id || m.id || null, decision, reviewed_at: new Date().toISOString(), effects: { evidence_changed: false } });
  if (decision === 'accept') m.review_status = 'approved';
  if (decision === 'uncertain') m.review_status = 'needs_fix';
  saveProtocol(protocol);
  refreshAll();
}

function bindButtons() {
  bindSafe('btnCheckBackend', checkBackend);
  bindSafe('btnClearFrontendCache', clearCache);
  bindSafe('btnProfessionalOmr', processOmr);
  bindSafe('btnPrevMeasure', () => { measureIndex = Math.max(0, measureIndex - 1); renderMeasures(); });
  bindSafe('btnNextMeasure', () => { measureIndex = Math.min(Math.max(measures().length - 1, 0), measureIndex + 1); renderMeasures(); });
  bindSafe('btnAcceptMeasure', () => addReview('measure_review', 'accept'));
  bindSafe('btnMarkUncertain', () => addReview('measure_review', 'uncertain'));
  bindSafe('btnPrevOcrBlock', () => { ocrIndex = Math.max(0, ocrIndex - 1); renderBlocks(); });
  bindSafe('btnNextOcrBlock', () => { ocrIndex = Math.min(Math.max(blocks().length - 1, 0), ocrIndex + 1); renderBlocks(); });
  bindSafe('btnApproveOcrClassification', () => toast('Use revisão dedicada por JSON para esta etapa.'));
  bindSafe('btnRejectOcrClassification', () => toast('Use revisão dedicada por JSON para esta etapa.'));
  bindSafe('btnConfirmOcrSystemState', () => toast('Use revisão dedicada por JSON para esta etapa.'));
  bindSafe('btnRejectOcrSystemState', () => toast('Use revisão dedicada por JSON para esta etapa.'));
  bindSafe('btnConfirmOcrMeasureState', () => toast('Use revisão dedicada por JSON para esta etapa.'));
  bindSafe('btnRejectOcrMeasureState', () => toast('Use revisão dedicada por JSON para esta etapa.'));
  bindSafe('btnGenerateOutputs', () => { generateOutputs(); saveProtocol(protocol); });
  bindSafe('btnExportJson', () => downloadText(versioned('protocolo_cpp', 'json'), JSON.stringify(protocol, null, 2), 'application/json;charset=utf-8'));
  bindSafe('btnExportTech', () => downloadText(versioned('cifra_tecnica', 'txt'), $('technicalOutput')?.textContent || ''));
  bindSafe('btnExportPlayable', () => downloadText(versioned('cifra_tocavel', 'txt'), $('playableOutput')?.textContent || ''));
  bindSafe('btnExportUncertainty', () => downloadText(versioned('relatorio_incertezas', 'txt'), $('uncertaintyOutput')?.textContent || ''));
  bindSafe('btnExportDetection', () => downloadText(versioned('relatorio_deteccao', 'txt'), $('detectionOutput')?.textContent || ''));
  bindSafe('btnExportMultipageAudit', () => downloadText(versioned('exportacao_multipagina_auditavel', 'json'), JSON.stringify({ protocol }, null, 2), 'application/json;charset=utf-8'));
  bindSafe('btnExportAll', () => downloadText(versioned('cpp_pacote_exportacao', 'json'), JSON.stringify({ protocol, outputs: protocol.outputs || {} }, null, 2), 'application/json;charset=utf-8'));
  bindSafe('btnExportErrorLog', () => downloadText(versioned('log_erros_operacionais', 'txt'), $('frontendErrorLog')?.textContent || ''));
  bindSafe('btnClearErrorLog', () => setText('frontendErrorLog', 'Nenhum erro operacional registrado nesta sessão.'));
}

function bindFileInput() {
  const input = $('fileInput');
  if (!input) return;
  input.onchange = event => {
    selectedFile = event.target.files?.[0] || null;
    setText('fileInfo', selectedFile ? `${selectedFile.name} — Arquivo aceito para OMR profissional.` : 'Nenhum arquivo selecionado.');
    if (selectedFile) {
      const title = $('musicTitle');
      const key = $('musicKey');
      const meter = $('meterDefault');
      const tempo = $('tempo');
      if (title) title.value = fileBaseName(selectedFile.name);
      if (key) key.value = '';
      if (meter) meter.value = '';
      if (tempo) tempo.value = '';
    }
  };
}

function init() {
  setText('frontendBuild', `Frontend build: ${BUILD}`);
  bindButtons();
  bindFileInput();
  const meter = $('meterDefault');
  if (meter && !protocol?.source?.file_name) meter.value = '';
  refreshAll();
  setText('processingStatus', 'Aguardando arquivo.');
  window.addEventListener('error', event => logError(event.error || event.message, { category: 'frontend_runtime' }));
  window.addEventListener('unhandledrejection', event => logError(event.reason || 'Promise rejeitada sem tratamento', { category: 'frontend_promise' }));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
