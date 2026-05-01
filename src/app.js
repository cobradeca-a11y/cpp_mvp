import { createInitialProtocol, loadProtocol, saveProtocol, exportJson, getMeasure, uid, pushUndo } from "./modules/cpp-json.js";
import { validateFile, getFileKind } from "./modules/file-input.js";
import { renderPdfFile, renderImageFile } from "./modules/pdf-renderer.js";
import { assessPageQuality } from "./modules/preprocessing.js";
import { renderPageViewer } from "./modules/page-viewer.js";
import { removeSystem, renumberSystems } from "./modules/system-marker.js";
import { renderSystemViewer } from "./modules/measure-generator.js";
import { analyzeSystem } from "./modules/system-analyzer.js";
import { systemFeedback, measureFeedback, detectionReport } from "./modules/feedback-engine.js";
import { renderMeasureReview, acceptMeasure, markMeasureUncertain, createSelectedAlignment } from "./modules/measure-review.js";
import { generateTechnicalChordSheet } from "./modules/chord-sheet-technical.js";
import { generatePlayableChordSheet } from "./modules/chord-sheet-playable.js";
import { globalUncertaintyReport } from "./modules/confidence-engine.js";
import { downloadText, versioned } from "./modules/export-output.js";

let protocol = loadProtocol();
let currentPage = null;
let currentSystem = null;
let currentMeasure = null;
let pageCtl = null;
let systemCtl = null;
let measureCtl = null;
let pageZoom = 0.55;

const $ = id => document.getElementById(id);

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 2600);
}

function persist() { saveProtocol(protocol); }

function switchTab(name) {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === `tab-${name}`));
}

function refreshSystemsList() {
  const box = $("systemsList");
  box.innerHTML = "";
  for (const s of protocol.systems) {
    const div = document.createElement("div");
    div.className = `item ${currentSystem?.system_id === s.system_id ? "active" : ""}`;
    div.innerHTML = `<div class="row"><b>Sistema ${s.number}</b><span>${s.status || "pendente"}</span></div>
      <small>x:${s.bbox.x} y:${s.bbox.y} w:${s.bbox.w} h:${s.bbox.h}</small>
      <div class="toolbar"><button data-open="${s.system_id}">Abrir</button><button data-del="${s.system_id}">Excluir</button></div>`;
    box.appendChild(div);
  }
  box.querySelectorAll("[data-open]").forEach(b => b.onclick = () => openSystem(b.dataset.open));
  box.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    removeSystem(protocol, b.dataset.del);
    renumberSystems(protocol);
    persist();
    refreshPage();
    refreshSystemsList();
  });
}

function refreshPage() {
  currentPage = protocol.pages[0] || null;
  pageCtl = renderPageViewer({
    container: $("pageViewer"),
    protocol,
    page: currentPage,
    toast,
    onSystemsChange: () => { persist(); refreshSystemsList(); }
  });
  pageCtl?.setZoom(pageZoom);
}

async function openSystem(systemId) {
  currentSystem = protocol.systems.find(s => s.system_id === systemId);
  currentPage = protocol.pages.find(p => p.page_id === currentSystem.page_id);
  $("currentSystemInfo").textContent = `Sistema ${currentSystem.number} — ${currentSystem.status || "pendente"}`;
  switchTab("system");
  systemCtl = await renderSystemViewer({
    container: $("systemViewer"),
    protocol,
    page: currentPage,
    system: currentSystem,
    toast,
    onChange: () => { persist(); refreshBarsAndMeasures(); }
  });
  refreshBarsAndMeasures();
  $("systemFeedback").textContent = systemFeedback(protocol, currentSystem.system_id);
}

function refreshBarsAndMeasures() {
  const bars = $("barsList");
  bars.innerHTML = "";
  (currentSystem?.bars || []).forEach((b, i) => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<div class="row"><span>${b.type || "barline"} x:${b.x}</span><button data-i="${i}">Excluir</button></div>`;
    bars.appendChild(div);
  });
  bars.querySelectorAll("button[data-i]").forEach(btn => btn.onclick = () => {
    currentSystem.bars.splice(Number(btn.dataset.i), 1);
    systemCtl?.generateAutoBars?.(); 
  });

  const list = $("measuresList");
  list.innerHTML = "";
  const measures = protocol.measures.filter(m => m.system_id === currentSystem?.system_id).sort((a,b)=>a.bbox.x-b.bbox.x);
  measures.forEach(m => {
    const div = document.createElement("div");
    div.className = `item ${currentMeasure?.measure_id === m.measure_id ? "active" : ""}`;
    div.innerHTML = `<div class="row"><b>Compasso ${m.number}</b><span>${m.confidence}</span></div>
      <small>${m.meter}${m.is_anacrusis ? " / anacruse" : ""}</small>
      <div class="toolbar"><button data-open="${m.measure_id}">Revisar</button></div>`;
    list.appendChild(div);
  });
  list.querySelectorAll("[data-open]").forEach(b => b.onclick = () => openMeasure(b.dataset.open));
}

async function openMeasure(measureId) {
  currentMeasure = protocol.measures.find(m => m.measure_id === measureId);
  currentSystem = protocol.systems.find(s => s.system_id === currentMeasure.system_id);
  currentPage = protocol.pages.find(p => p.page_id === currentSystem.page_id);
  protocol.ui_state.current_measure_id = measureId;
  switchTab("review");
  measureCtl = await renderMeasureReview({
    container: $("measureCanvasWrap"),
    protocol,
    page: currentPage,
    system: currentSystem,
    measure: currentMeasure,
    toast,
    onChange: () => { persist(); refreshMeasureFeedback(); refreshMarkersList(); }
  });
  refreshMeasureFeedback();
  refreshMarkersList();
  persist();
}

function refreshMeasureFeedback() {
  $("measureFeedback").textContent = measureFeedback(currentMeasure);
}

function refreshMarkersList() {
  const box = $("markersList");
  if (!currentMeasure) return;
  box.innerHTML = "";
  (currentMeasure.markers || []).forEach(m => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<div class="row"><span>${m.type}: <b>${m.value}</b> (${m.beat})</span><button data-id="${m.marker_id}">Apagar</button></div>`;
    div.onclick = () => {
      currentMeasure._selectedMarkers ||= new Set();
      currentMeasure._selectedMarkers.has(m.marker_id) ? currentMeasure._selectedMarkers.delete(m.marker_id) : currentMeasure._selectedMarkers.add(m.marker_id);
      div.classList.toggle("active");
    };
    box.appendChild(div);
  });
  box.querySelectorAll("button[data-id]").forEach(btn => btn.onclick = ev => {
    ev.stopPropagation();
    const id = btn.dataset.id;
    currentMeasure.markers = currentMeasure.markers.filter(m => m.marker_id !== id);
    currentMeasure.alignments = currentMeasure.alignments.filter(a => a.chord_marker_id !== id && a.syllable_marker_id !== id && a.note_marker_id !== id);
    persist(); openMeasure(currentMeasure.measure_id);
  });
}

function generateOutputs() {
  const tech = generateTechnicalChordSheet(protocol);
  const play = generatePlayableChordSheet(protocol);
  const unc = globalUncertaintyReport(protocol);
  const det = detectionReport(protocol);
  protocol.outputs.uncertainty_report = unc;
  protocol.outputs.detection_report = det;
  $("technicalOutput").textContent = tech;
  $("playableOutput").textContent = play;
  $("uncertaintyOutput").textContent = unc;
  $("detectionOutput").textContent = det;
  persist();
}

function initEvents() {
  document.querySelectorAll(".tab").forEach(btn => btn.onclick = () => switchTab(btn.dataset.tab));

  $("fileInput").onchange = async ev => {
    const file = ev.target.files[0];
    const valid = validateFile(file);
    $("fileInfo").textContent = valid.message;
    if (!valid.ok) return;
    protocol = createInitialProtocol();
    protocol.source.file_name = file.name;
    protocol.source.file_type = valid.kind;
    protocol.music.title = $("musicTitle").value || file.name.replace(/\.[^.]+$/, "");
    protocol.music.key = $("musicKey").value;
    protocol.music.meter_default = $("meterDefault").value;
    protocol.music.tempo = $("tempo").value;
    try {
      toast("Renderizando arquivo...");
      protocol.pages = valid.kind === "pdf" ? await renderPdfFile(file, 3) : await renderImageFile(file);
      protocol.source.pages = protocol.pages.length;
      const q = assessPageQuality(protocol.pages[0]);
      $("fileInfo").textContent = `${file.name} — ${protocol.pages.length} página(s). Qualidade: ${q.status}. ${q.message}`;
      persist();
      refreshPage();
      refreshSystemsList();
      toast("Arquivo carregado.");
    } catch (err) {
      console.error(err);
      toast("Erro ao renderizar arquivo.");
    }
  };

  $("btnStart").onclick = () => { refreshPage(); refreshSystemsList(); switchTab("page"); };
  $("btnSelectSystem").onclick = () => pageCtl?.enableSelect(false);
  $("btnSystemTwoTap").onclick = () => pageCtl?.enableSelect(true);
  $("btnClearSystemDraft").onclick = () => pageCtl?.cancelSelect();
  $("pageZoomOut").onclick = () => { pageZoom = Math.max(0.2, pageZoom - 0.1); pageCtl?.setZoom(pageZoom); };
  $("pageZoomIn").onclick = () => { pageZoom = Math.min(2.5, pageZoom + 0.1); pageCtl?.setZoom(pageZoom); };

  $("btnGenerateMeasures").onclick = () => { if (!currentSystem) return toast("Abra um sistema."); systemCtl?.generateAutoBars(); refreshBarsAndMeasures(); };
  $("btnAddBar").onclick = () => systemCtl?.addBar();
  $("btnMoveBarLeft").onclick = () => systemCtl?.moveActive(-1);
  $("btnMoveBarRight").onclick = () => systemCtl?.moveActive(1);
  $("btnPositionBar").onclick = () => systemCtl?.positionActive();
  $("btnEditBar").onclick = () => systemCtl?.editActive();
  $("btnValidateBar").onclick = () => systemCtl?.validateActive();

  $("btnAnalyzeSystem").onclick = () => {
    if (!currentSystem) return toast("Abra um sistema.");
    const summary = analyzeSystem(protocol, currentPage, currentSystem);
    $("systemFeedback").textContent = systemFeedback(protocol, currentSystem.system_id);
    refreshBarsAndMeasures();
    persist();
    toast("Sistema analisado.");
  };

  $("btnPrevMeasure").onclick = () => {
    const list = protocol.measures.filter(m => m.system_id === currentSystem?.system_id).sort((a,b)=>a.number-b.number);
    const i = list.findIndex(m => m.measure_id === currentMeasure?.measure_id);
    if (i > 0) openMeasure(list[i-1].measure_id);
  };
  $("btnNextMeasure").onclick = () => {
    const list = protocol.measures.filter(m => m.system_id === currentSystem?.system_id).sort((a,b)=>a.number-b.number);
    const i = list.findIndex(m => m.measure_id === currentMeasure?.measure_id);
    if (i >= 0 && i < list.length-1) openMeasure(list[i+1].measure_id);
  };
  $("btnAcceptMeasure").onclick = () => { if (!currentMeasure) return; acceptMeasure(currentMeasure); persist(); refreshMeasureFeedback(); toast("Compasso aprovado."); };
  $("btnMarkUncertain").onclick = () => { if (!currentMeasure) return; markMeasureUncertain(currentMeasure); persist(); refreshMeasureFeedback(); toast("Compasso marcado como incerto."); };
  $("btnEditMeasure").onclick = () => { $("manualEdit").classList.toggle("hidden"); $("measureCanvasWrap").classList.toggle("manual-marker-mode"); };

  $("btnCreateAlignment").onclick = () => {
    if (!currentMeasure) return;
    const al = createSelectedAlignment(protocol, currentMeasure, $("alignmentType").value);
    if (al) { persist(); refreshMeasureFeedback(); toast("Alinhamento criado."); }
    else toast("Selecione pelo menos um acorde.");
  };

  $("btnUndo").onclick = () => {
    const act = protocol.ui_state.undo_stack.pop();
    if (!act) return toast("Nada para desfazer.");
    const m = getMeasure(protocol, act.measure_id);
    if (!m) return;
    if (act.type === "create_alignment") m.alignments = m.alignments.filter(a => a.alignment_id !== act.alignment_id);
    if (act.type === "create_marker") {
      const used = m.alignments.some(a => [a.chord_marker_id,a.syllable_marker_id,a.note_marker_id].includes(act.marker_id));
      if (!used) m.markers = m.markers.filter(x => x.marker_id !== act.marker_id);
    }
    persist(); openMeasure(m.measure_id); toast("Desfeito.");
  };

  $("btnGoOutput").onclick = () => { generateOutputs(); switchTab("output"); };
  $("btnGenerateOutputs").onclick = generateOutputs;
  $("btnExportJson").onclick = () => downloadText(versioned("cpp_protocol", "json"), exportJson(protocol), "application/json;charset=utf-8");
  $("btnExportTech").onclick = () => { generateOutputs(); downloadText(versioned("cifra_tecnica","txt"), protocol.outputs.technical_chord_sheet); };
  $("btnExportPlayable").onclick = () => { generateOutputs(); downloadText(versioned("cifra_tocavel","txt"), protocol.outputs.playable_chord_sheet); };
  $("btnExportUncertainty").onclick = () => { generateOutputs(); downloadText(versioned("relatorio_incertezas","txt"), protocol.outputs.uncertainty_report); };
  $("btnExportDetection").onclick = () => { generateOutputs(); downloadText(versioned("relatorio_deteccao","txt"), protocol.outputs.detection_report); };
  $("btnExportAll").onclick = () => {
    generateOutputs();
    downloadText(versioned("cpp_protocol", "json"), exportJson(protocol), "application/json;charset=utf-8");
    downloadText(versioned("cifra_tecnica","txt"), protocol.outputs.technical_chord_sheet);
    downloadText(versioned("cifra_tocavel","txt"), protocol.outputs.playable_chord_sheet);
    downloadText(versioned("relatorio_incertezas","txt"), protocol.outputs.uncertainty_report);
    downloadText(versioned("relatorio_deteccao","txt"), protocol.outputs.detection_report);
  };

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
}

initEvents();
if (protocol.pages?.length) { refreshPage(); refreshSystemsList(); }
