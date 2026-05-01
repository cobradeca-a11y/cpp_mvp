import { setupFileInput, fileKind } from './modules/file-input.js';
import { renderPDFFile, renderImageFile } from './modules/pdf-renderer.js';
import { PageViewer } from './modules/page-viewer.js';
import { removeSystem, renumberSystems } from './modules/system-marker.js';
import { MeasureMarker, removeBarline } from './modules/measure-marker.js';
import { MeasureEditor } from './modules/measure-editor.js';
import { createInitialProtocol, saveLocal, loadLocal, getMeasure, markerById, validForChordSheets } from './modules/cpp-json.js';
import { generateTechnical } from './modules/chord-sheet-technical.js';
import { generatePlayable } from './modules/chord-sheet-playable.js';
import { uncertaintyReport, updateMeasureConfidence } from './modules/confidence-engine.js';
import { exportJson, exportTechnical, exportPlayable, exportReport, exportAll } from './modules/export-output.js';
import { timeGridForMeter } from './modules/music-models.js';

let protocol = loadLocal() || createInitialProtocol();
let currentFile = null;
let currentExt = '';

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const saveStatus = $('#saveStatus');

const pageViewer = new PageViewer($('#pageCanvasWrap'), protocol, changed);
const measureMarker = new MeasureMarker($('#systemCanvasWrap'), protocol, changed);
const measureEditor = new MeasureEditor($('#measureCanvasWrap'), protocol, changed);

function changed(){
  renumberSystems(protocol);
  for(const m of protocol.measures){m.time_grid=timeGridForMeter(m.meter); updateMeasureConfidence(m);}
  saveLocal(protocol);
  saveStatus.textContent='Salvo localmente '+new Date().toLocaleTimeString();
  renderLists();
}

function pageById(id){return protocol.pages.find(p=>p.page_id===id)||protocol.pages[0]||null;}
function systemById(id){return protocol.systems.find(s=>s.system_id===id)||null;}
function currentPage(){return protocol.pages[0]||null;}

function switchScreen(name){$$('.screen').forEach(s=>s.classList.remove('active')); $(`#screen-${name}`).classList.add('active'); $$('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.screen===name)); if(name==='page') pageViewer.setPage(currentPage()); if(name==='systems') renderSystemsScreen(); if(name==='measure') renderMeasureScreen(); if(name==='output') renderOutputScreen();}
$$('.tabs button').forEach(b=>b.addEventListener('click',()=>switchScreen(b.dataset.screen)));

setupFileInput({input:$('#fileInput'),onFile:async(file,ext)=>{currentFile=file; currentExt=ext; protocol=createInitialProtocol(); wireProtocol(); protocol.source.file_name=file.name; protocol.source.file_type=ext; $('#fileName').textContent=file.name; $('#fileType').textContent=ext; $('#qualityNotice').textContent='Arquivo aceito. Clique em iniciar análise.'; changed();}});

function wireProtocol(){pageViewer.protocol=protocol;measureMarker.protocol=protocol;measureEditor.protocol=protocol;}

$('#startAnalysisBtn').addEventListener('click', async()=>{
  if(!currentFile){alert('Carregue um arquivo primeiro.');return;}
  $('#qualityNotice').textContent='Renderizando...';
  try{
    const pages = fileKind(currentExt)==='pdf' ? await renderPDFFile(currentFile) : await renderImageFile(currentFile);
    protocol.pages=pages; protocol.source.pages=pages.length; $('#filePages').textContent=pages.length;
    protocol.music.title = currentFile.name.replace(/\.[^.]+$/,'');
    $('#qualityNotice').textContent=pages[0].width<1200?'Qualidade possivelmente baixa; continue com atenção.':'Boa qualidade inicial para zoom.';
    changed(); switchScreen('page');
  }catch(e){console.error(e); alert('Erro ao renderizar: '+e.message); $('#qualityNotice').textContent='Erro ao renderizar.';}
});

$('#pageZoom').addEventListener('input',e=>pageViewer.setZoom(e.target.value));
$('#newSystemBtn').addEventListener('click',()=>pageViewer.enableSystemSelection());
$('#clearSystemsBtn').addEventListener('click',()=>{if(confirm('Limpar sistemas e compassos?')){protocol.systems=[];protocol.measures=[];protocol.navigation.visual_markers=[];changed();pageViewer.render();}});

$('#systemSelect').addEventListener('change',renderSystemsScreen);
$('#meterSelect').addEventListener('change',()=>{});
$('#addBarlineModeBtn').addEventListener('click',()=>measureMarker.enableBarline());
$('#generateMeasuresBtn').addEventListener('click',()=>{measureMarker.generateMeasures($('#meterSelect').value); renderSystemsScreen();});

$('#measureSelect').addEventListener('change',renderMeasureScreen);
$('#measureZoom').addEventListener('input',e=>measureEditor.setZoom(e.target.value));
$('#lensZoom').addEventListener('input',e=>measureEditor.setLensZoom(e.target.value));
$('#undoBtn').addEventListener('click',()=>measureEditor.undo());
$('#approveMeasureBtn').addEventListener('click',()=>{measureEditor.approve();renderLists();});
$('#pendingMeasureBtn').addEventListener('click',()=>{measureEditor.pending();renderLists();});
$('#createAlignmentBtn').addEventListener('click',()=>{
  const measure=getMeasure(protocol,$('#measureSelect').value); if(!measure)return;
  const chord=$('#alignChord').value; const syl=$('#alignSyllable').value; const note=$('#alignNote').value;
  const data={chord_marker_id:chord,syllable_marker_id:syl,note_marker_id:note,alignment_type:$('#alignType').value,confidence:$('#alignConfidence').value,simultaneous_event:$('#simultaneousEvent').checked,observation:$('#alignObservation').value};
  measureEditor.createAlignment(data); fillAlignmentSelects();
});

$('#generateOutputsBtn').addEventListener('click',()=>generateOutputs());
$('#exportJsonBtn').addEventListener('click',()=>exportJson(protocol));
$('#exportTechnicalBtn').addEventListener('click',()=>{generateOutputs();exportTechnical(protocol);});
$('#exportPlayableBtn').addEventListener('click',()=>{generateOutputs();exportPlayable(protocol);});
$('#exportReportBtn').addEventListener('click',()=>{generateOutputs();exportReport(protocol);});
$('#exportAllBtn').addEventListener('click',()=>{generateOutputs();exportAll(protocol);});

function renderLists(){
  const systemsList=$('#systemsList'); if(systemsList){systemsList.innerHTML=''; for(const s of protocol.systems){const li=document.createElement('li'); li.innerHTML=`Sistema ${s.number} <small>${s.bbox.w}×${s.bbox.h}</small>`; const open=btn('Abrir',()=>{switchScreen('systems'); $('#systemSelect').value=s.system_id; renderSystemsScreen();}); const del=btn('Apagar',()=>{removeSystem(protocol,s.system_id);changed();pageViewer.render();}); li.append(open,del); systemsList.appendChild(li);}}
  fillSelect($('#systemSelect'),protocol.systems.map(s=>[s.system_id,`Sistema ${s.number}`]));
  fillSelect($('#measureSelect'),protocol.measures.slice().sort((a,b)=>a.number-b.number).map(m=>[m.measure_id,`Compasso ${m.number} (${m.meter})`]));
  renderSystemsScreen(false); renderMeasureLists();
}
function btn(label,fn){const b=document.createElement('button');b.textContent=label;b.addEventListener('click',fn);return b;}
function fillSelect(sel,items,empty='—'){if(!sel)return; const old=sel.value; sel.innerHTML=`<option value="">${empty}</option>`+items.map(([v,t])=>`<option value="${v}">${t}</option>`).join(''); if(items.some(i=>i[0]===old)) sel.value=old; else if(items.length) sel.value=items[0][0];}

function renderSystemsScreen(draw=true){
  const sid=$('#systemSelect')?.value || protocol.systems[0]?.system_id; const s=systemById(sid); const p=s?pageById(s.page_id):currentPage(); if(draw) measureMarker.setSystem(p,s);
  const bl=$('#barlinesList'); if(bl){bl.innerHTML=''; const bars=protocol.navigation.visual_markers.filter(n=>n.system_id===sid&&n.kind==='barline').sort((a,b)=>a.x-b.x); for(const b of bars){const li=document.createElement('li'); li.textContent=`${b.type} x:${b.x}`; li.appendChild(btn('Apagar',()=>{removeBarline(protocol,b.id);changed();renderSystemsScreen();})); bl.appendChild(li);}}
  const ml=$('#measuresList'); if(ml){ml.innerHTML=''; for(const m of protocol.measures.filter(m=>m.system_id===sid).sort((a,b)=>a.number-b.number)){const li=document.createElement('li'); li.innerHTML=`Compasso ${m.number} — ${m.meter} — ${m.confidence}`; li.appendChild(btn('Editar',()=>{switchScreen('measure'); $('#measureSelect').value=m.measure_id; renderMeasureScreen();})); const ana=btn(m.is_anacrusis?'Anacruse ✓':'Marcar anacruse',()=>{m.is_anacrusis=!m.is_anacrusis;changed();}); li.appendChild(ana); ml.appendChild(li);}}
}

function renderMeasureScreen(){const mid=$('#measureSelect')?.value || protocol.measures[0]?.measure_id; const m=getMeasure(protocol,mid); if(!m){measureEditor.setMeasure(null,null); return;} const sys=systemById(m.system_id); const p=pageById(sys?.page_id); measureEditor.setMeasure(p,m); renderMeasureLists(); fillAlignmentSelects();}
function renderMeasureLists(){
  const m=getMeasure(protocol,$('#measureSelect')?.value); const ul=$('#markersList'); if(ul){ul.innerHTML=''; if(m) for(const mk of m.markers){const li=document.createElement('li'); li.innerHTML=`<b>${mk.type}</b> ${mk.value} <small>beat:${mk.beat} x:${mk.x}</small>`; li.appendChild(btn('Editar',()=>measureEditor.editMarker(mk.marker_id))); li.appendChild(btn('Apagar',()=>measureEditor.deleteMarker(mk.marker_id))); ul.appendChild(li);}}
  const al=$('#alignmentsList'); if(al){al.innerHTML=''; if(m) for(const a of m.alignments){const ch=markerById(m,a.chord_marker_id); const sy=markerById(m,a.syllable_marker_id); const li=document.createElement('li'); li.innerHTML=`${ch?.value||'?'} → ${sy?.value||'[sem sílaba]'} beat:${a.beat} conf:${a.confidence}`; li.appendChild(btn('Apagar',()=>{m.alignments=m.alignments.filter(x=>x.alignment_id!==a.alignment_id);changed();renderMeasureScreen();})); al.appendChild(li);}}
}
function fillAlignmentSelects(){const m=getMeasure(protocol,$('#measureSelect')?.value); if(!m)return; fillSelect($('#alignChord'),m.markers.filter(x=>x.type==='chord').map(x=>[x.marker_id,`${x.value} (${x.beat})`]),'Acorde'); fillSelect($('#alignSyllable'),m.markers.filter(x=>x.type==='syllable').map(x=>[x.marker_id,`${x.value} (${x.beat})`]),'Sem sílaba'); fillSelect($('#alignNote'),m.markers.filter(x=>x.type==='note_head').map(x=>[x.marker_id,`${x.value} (${x.beat})`]),'Sem nota');}

function generateOutputs(){
  const check=validForChordSheets(protocol); if(!check.ok){alert('Campos mínimos ausentes: '+check.missing.slice(0,8).join(', '));}
  protocol.outputs.technical_chord_sheet=generateTechnical(protocol);
  protocol.outputs.playable_chord_sheet=generatePlayable(protocol);
  protocol.outputs.uncertainty_report=uncertaintyReport(protocol);
  saveLocal(protocol);
  renderOutputScreen();
}
function renderOutputScreen(){
  $('#technicalOutput').textContent=protocol.outputs.technical_chord_sheet||'Clique em “Gerar saídas”.';
  $('#playableOutput').textContent=protocol.outputs.playable_chord_sheet||'Clique em “Gerar saídas”.';
  $('#reportOutput').textContent=protocol.outputs.uncertainty_report||'Clique em “Gerar saídas”.';
}

if('serviceWorker' in navigator){navigator.serviceWorker.register('./service-worker.js').catch(()=>{});} 
wireProtocol(); changed(); switchScreen('upload');
