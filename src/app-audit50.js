import { loadProtocol, saveProtocol, exportJson } from './modules/cpp-json.js';
import { validateFile } from './modules/file-input.js';
import { analyzeWithProfessionalOmr, checkProfessionalOmrBackend } from './modules/professional-omr-client.js';
import { measureFeedback, detectionReport } from './modules/feedback-engine.js';
import { acceptMeasure, markMeasureUncertain } from './modules/measure-review.js';
import { generateTechnicalChordSheet } from './modules/chord-sheet-technical.js';
import { generatePlayableChordSheet } from './modules/chord-sheet-playable.js';
import { globalUncertaintyReport } from './modules/confidence-engine.js';
import { downloadText, versioned } from './modules/export-output.js';
import { generateMultipageAuditExportText } from './modules/multipage-audit-export.js';
import { appendOperationalError, exportOperationalErrorLogText } from './modules/error-reporting.js';

const BUILD = 'audit-50-cache-v3';
const $ = id => document.getElementById(id);
let protocol = loadProtocol();
let selectedFile = null;
let measureIndex = 0;
let ocrIndex = 0;
let reviewIndex = 0;

function say(msg){ const t=$('toast'); if(t){ t.textContent=msg; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'),2200); } }
function setText(id,msg){ const el=$(id); if(el) el.textContent=msg; }
function err(error, context={}){ appendOperationalError($('frontendErrorLog'), error, context); }
function esc(v){ return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
function baseName(name=''){ return name.replace(/\.[^.]+$/, '').trim(); }
function measures(){ return Array.isArray(protocol.measures) ? protocol.measures : []; }
function blocks(){ return Array.isArray(protocol.fusion?.text_blocks_index) ? protocol.fusion.text_blocks_index : []; }
function reviews(){ return Array.isArray(protocol.review) ? protocol.review : []; }
function save(){ saveProtocol(protocol); }
function bind(id, fn){ const el=$(id); if(el) el.onclick = async e => { e?.preventDefault?.(); try { await fn(); } catch(error){ err(error,{category:'button',button:id}); say('Erro operacional no botão.'); } }; }

function outputs(){
  protocol.outputs ||= {};
  protocol.outputs.technical_chord_sheet = generateTechnicalChordSheet(protocol);
  protocol.outputs.playable_chord_sheet = generatePlayableChordSheet(protocol);
  protocol.outputs.uncertainty_report = globalUncertaintyReport(protocol);
  protocol.outputs.detection_report = detectionReport(protocol);
  setText('technicalOutput', protocol.outputs.technical_chord_sheet);
  setText('playableOutput', protocol.outputs.playable_chord_sheet);
  setText('uncertaintyOutput', protocol.outputs.uncertainty_report);
  setText('detectionOutput', protocol.outputs.detection_report);
  save();
}

function renderMeasures(){
  const list=$('measuresList'), detail=$('measureFeedback'); if(!list||!detail) return;
  list.innerHTML=''; const data=measures();
  if(!data.length){ detail.textContent='Nenhum compasso carregado.'; return; }
  measureIndex=Math.min(Math.max(measureIndex,0),data.length-1);
  data.forEach((m,i)=>{ const item=document.createElement('div'); item.className=`item ${i===measureIndex?'active':''}`; item.innerHTML=`<div class="row"><b>Compasso ${esc(m.number||i+1)}</b><span>${esc(m.confidence||'provável')}</span></div><small>${esc(m.meter||'')} — ${esc(m.review_status||'pending')}</small>`; item.onclick=()=>{measureIndex=i;renderMeasures();}; list.appendChild(item); });
  detail.textContent = measureFeedback(data[measureIndex]);
}

function renderBlocks(){
  const list=$('ocrBlocksList'), detail=$('ocrBlockDetails'); if(!list||!detail) return;
  list.innerHTML=''; const data=blocks();
  if(!data.length){ detail.textContent='Nenhum bloco OCR carregado.'; return; }
  ocrIndex=Math.min(Math.max(ocrIndex,0),data.length-1);
  data.forEach((b,i)=>{ const item=document.createElement('div'); item.className=`item ${i===ocrIndex?'active':''}`; item.innerHTML=`<div class="row"><b>${esc(b.text||'[vazio]')}</b><span>${esc(b.classification||'—')}</span></div><small>${esc(b.fusion_id||'')} — ${esc(b.human_review?.status||'pendente')}</small>`; item.onclick=()=>{ocrIndex=i;renderBlocks();}; list.appendChild(item); });
  const b=data[ocrIndex];
  detail.innerHTML=`<div class="ocr-detail-grid"><div><span class="detail-label">ID</span><strong>${esc(b.fusion_id||'—')}</strong></div><div><span class="detail-label">Página</span><strong>${esc(b.page||'—')}</strong></div><div><span class="detail-label">Classificação</span><strong>${esc(b.classification||'—')}</strong></div><div><span class="detail-label">Revisão</span><strong>${esc(b.human_review?.status||'pendente')}</strong></div></div><h4>Texto OCR bruto preservado</h4><pre class="ocr-raw">${esc(b.text||'')}</pre><h4>Texto normalizado conservador</h4><pre class="ocr-normalized">${esc(b.normalized_text||'')}</pre><h4>Análise de cifra candidata</h4><pre class="inline-json">${esc(JSON.stringify(b.chord_analysis||null,null,2))}</pre>`;
}

function renderReviews(){
  const list=$('reviewHistoryList'), detail=$('reviewHistoryDetails'); if(!list||!detail) return;
  list.innerHTML=''; const data=reviews();
  if(!data.length){ detail.textContent='Nenhuma decisão humana registrada.'; return; }
  reviewIndex=Math.min(Math.max(reviewIndex,0),data.length-1);
  data.forEach((r,i)=>{ const item=document.createElement('div'); item.className=`item ${i===reviewIndex?'active':''}`; item.innerHTML=`<div class="row"><b>${esc(r.audit||'auditoria')}</b><span>${esc(r.decision||r.action||'—')}</span></div><small>${esc(r.type||'—')}</small>`; item.onclick=()=>{reviewIndex=i;renderReviews();}; list.appendChild(item); });
  detail.innerHTML=`<pre class="inline-json">${esc(JSON.stringify(data[reviewIndex],null,2))}</pre>`;
}
function refresh(){ renderMeasures(); renderBlocks(); renderReviews(); outputs(); }

async function clearCache(){
  say('Limpando cache do app...');
  if('serviceWorker' in navigator){ const regs=await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r=>r.unregister())); }
  if('caches' in window){ const keys=await caches.keys(); await Promise.all(keys.filter(k=>k.startsWith('cpp-professional-omr-')).map(k=>caches.delete(k))); }
  location.reload();
}

async function processOmr(){
  const file = selectedFile || $('fileInput')?.files?.[0] || null;
  const valid = validateFile(file);
  if(!valid.ok){ setText('fileInfo',valid.message); err(new Error(valid.message),{category:'file'}); say(valid.message); return; }
  const btn=$('btnProfessionalOmr'), backendUrl=$('backendUrl')?.value?.trim() || 'http://localhost:8787';
  btn.disabled=true; btn.textContent='Processando...'; setText('processingStatus','Enviando arquivo ao backend OMR profissional...');
  try{
    protocol = await analyzeWithProfessionalOmr({file, backendUrl});
    protocol.music ||= {}; protocol.music.title ||= baseName(file.name) || 'Sem título'; save();
    setText('processingStatus',[`Processamento concluído.`,`Arquivo: ${protocol.source?.file_name||file.name}`,`Status OMR: ${protocol.source?.omr_status||'pending'}`,`Status OCR: ${protocol.source?.ocr_status||protocol.ocr?.status||'pending'}`,`Blocos OCR: ${protocol.ocr?.text_blocks?.length||0}`,`Compassos importados: ${protocol.measures?.length||0}`].join('\n'));
    measureIndex=0; ocrIndex=0; reviewIndex=0; refresh(); say('Processamento profissional concluído.');
  }catch(error){ setText('processingStatus',`Erro no processamento profissional.\n${error.message||error}`); err(error,{category:'backend',operation:'analyze',backendUrl,file_name:file?.name||''}); say('Erro no OMR profissional.'); }
  finally{ btn.disabled=false; btn.textContent='Processar com OMR Profissional'; }
}

function reviewMeasure(action){ const m=measures()[measureIndex]; if(!m) return say('Nenhum compasso carregado.'); if(action==='accept') acceptMeasure(m); if(action==='uncertain') markMeasureUncertain(m); protocol.review ||= []; protocol.review.push({id:`measure-${action}-${Date.now()}`,audit:'audit-50-ui',type:'measure_review',target_id:m.measure_id||m.id||null,decision:action,reviewed_at:new Date().toISOString(),effects:{evidence_changed:false}}); save(); refresh(); say(action==='accept'?'Compasso aceito.':'Compasso marcado como incerto.'); }
function reviewBlock(type,decision,audit){ const b=blocks()[ocrIndex]; if(!b) return say('Nenhum bloco OCR carregado.'); protocol.review ||= []; const r={id:`${type}-${Date.now()}`,audit,type,target_id:b.fusion_id||null,decision,original_text:b.text||'',normalized_text:b.normalized_text||'',reviewed_at:new Date().toISOString(),effects:{evidence_changed:false,alignment_changed:false}}; protocol.review.push(r); if(type==='ocr_classification_review') b.human_review={status:decision==='approved'?'classification_approved':'classification_rejected',decision,review_id:r.id}; if(type==='ocr_system_association_review') b.system_human_review={status:decision==='confirmed'?'system_state_confirmed':'system_state_rejected',decision,review_id:r.id}; if(type==='ocr_measure_association_review') b.measure_human_review={status:decision==='confirmed'?'measure_state_confirmed':'measure_state_rejected',decision,review_id:r.id}; save(); refresh(); say('Decisão humana registrada.'); }

function init(){
  setText('frontendBuild',`Frontend build: ${BUILD}`);
  $('fileInput').onchange=e=>{ selectedFile=e.target.files?.[0]||null; const valid=validateFile(selectedFile); setText('fileInfo',selectedFile?`${selectedFile.name} — ${valid.message}`:'Nenhum arquivo selecionado.'); if(selectedFile){ $('musicTitle').value=baseName(selectedFile.name); $('musicKey').value=''; $('meterDefault').value=''; $('tempo').value=''; } };
  bind('btnCheckBackend',async()=>{ const backendUrl=$('backendUrl')?.value?.trim()||'http://localhost:8787'; setText('backendStatus','Verificando backend...'); try{ setText('backendStatus',JSON.stringify(await checkProfessionalOmrBackend(backendUrl),null,2)); say('Backend verificado.'); }catch(error){ setText('backendStatus',`Backend indisponível.\n${error.message||error}`); err(error,{category:'backend',operation:'health_check',backendUrl}); say('Backend indisponível.'); } });
  bind('btnClearFrontendCache',clearCache); bind('btnProfessionalOmr',processOmr);
  bind('btnPrevMeasure',()=>{ measureIndex=Math.max(0,measureIndex-1); renderMeasures(); }); bind('btnNextMeasure',()=>{ measureIndex=Math.min(Math.max(measures().length-1,0),measureIndex+1); renderMeasures(); }); bind('btnAcceptMeasure',()=>reviewMeasure('accept')); bind('btnMarkUncertain',()=>reviewMeasure('uncertain'));
  bind('btnPrevOcrBlock',()=>{ ocrIndex=Math.max(0,ocrIndex-1); renderBlocks(); }); bind('btnNextOcrBlock',()=>{ ocrIndex=Math.min(Math.max(blocks().length-1,0),ocrIndex+1); renderBlocks(); });
  bind('btnApproveOcrClassification',()=>reviewBlock('ocr_classification_review','approved','audit-36')); bind('btnRejectOcrClassification',()=>reviewBlock('ocr_classification_review','rejected','audit-36')); bind('btnConfirmOcrSystemState',()=>reviewBlock('ocr_system_association_review','confirmed','audit-37')); bind('btnRejectOcrSystemState',()=>reviewBlock('ocr_system_association_review','rejected','audit-37')); bind('btnConfirmOcrMeasureState',()=>reviewBlock('ocr_measure_association_review','confirmed','audit-38')); bind('btnRejectOcrMeasureState',()=>reviewBlock('ocr_measure_association_review','rejected','audit-38'));
  bind('btnGenerateOutputs',()=>{ outputs(); say('Saídas geradas.'); }); bind('btnExportJson',()=>downloadText(versioned('protocolo_cpp','json'),exportJson(protocol),'application/json;charset=utf-8')); bind('btnExportTech',()=>downloadText(versioned('cifra_tecnica','txt'),protocol.outputs?.technical_chord_sheet||generateTechnicalChordSheet(protocol))); bind('btnExportPlayable',()=>downloadText(versioned('cifra_tocavel','txt'),protocol.outputs?.playable_chord_sheet||generatePlayableChordSheet(protocol))); bind('btnExportUncertainty',()=>downloadText(versioned('relatorio_incertezas','txt'),protocol.outputs?.uncertainty_report||globalUncertaintyReport(protocol))); bind('btnExportDetection',()=>downloadText(versioned('relatorio_deteccao','txt'),protocol.outputs?.detection_report||detectionReport(protocol))); bind('btnExportMultipageAudit',()=>downloadText(versioned('exportacao_multipagina_auditavel','json'),generateMultipageAuditExportText(protocol),'application/json;charset=utf-8')); bind('btnExportAll',()=>downloadText(versioned('cpp_pacote_exportacao','json'),JSON.stringify({protocol,outputs:protocol.outputs||{},multipage_audit_export:JSON.parse(generateMultipageAuditExportText(protocol))},null,2),'application/json;charset=utf-8'));
  bind('btnExportErrorLog',()=>downloadText(versioned('log_erros_operacionais','txt'),exportOperationalErrorLogText($('frontendErrorLog')))); bind('btnClearErrorLog',()=>setText('frontendErrorLog','Nenhum erro operacional registrado nesta sessão.'));
  window.addEventListener('error',e=>err(e.error||e.message,{category:'frontend_runtime',source:e.filename,line:e.lineno})); window.addEventListener('unhandledrejection',e=>err(e.reason||'Promise rejeitada sem tratamento',{category:'frontend_promise'}));
  refresh(); setText('processingStatus','Aguardando arquivo.');
}
try{ init(); }catch(error){ err(error,{category:'frontend_init'}); setText('processingStatus',`Erro ao inicializar frontend.\n${error.message||error}`); }
