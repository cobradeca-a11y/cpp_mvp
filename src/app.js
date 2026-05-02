import { createInitialProtocol, loadProtocol, saveProtocol, exportJson } from "./modules/cpp-json.js";
import { validateFile } from "./modules/file-input.js";
import { analyzeWithProfessionalOmr, checkProfessionalOmrBackend } from "./modules/professional-omr-client.js";
import { measureFeedback, detectionReport } from "./modules/feedback-engine.js";
import { acceptMeasure, markMeasureUncertain } from "./modules/measure-review.js";
import { generateTechnicalChordSheet } from "./modules/chord-sheet-technical.js";
import { generatePlayableChordSheet } from "./modules/chord-sheet-playable.js";
import { globalUncertaintyReport } from "./modules/confidence-engine.js";
import { downloadText, versioned } from "./modules/export-output.js";

let protocol = loadProtocol();
let selectedFile = null;
let currentMeasureIndex = 0;

const $ = id => document.getElementById(id);

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 2600);
}

function persist() {
  saveProtocol(protocol);
}

function setStatus(message) {
  $("processingStatus").textContent = message;
}

function currentMeasure() {
  return protocol.measures?.[currentMeasureIndex] || null;
}

function refreshReview() {
  const list = $("measuresList");
  list.innerHTML = "";

  if (!protocol.measures?.length) {
    $("measureFeedback").textContent = "Nenhum compasso carregado. Processe uma partitura com OMR profissional.";
    return;
  }

  protocol.measures.forEach((m, index) => {
    const div = document.createElement("div");
    div.className = `item ${index === currentMeasureIndex ? "active" : ""}`;
    div.innerHTML = `<div class="row"><b>Compasso ${m.number}</b><span>${m.confidence || "provável"}</span></div>
      <small>${m.meter || ""} — ${m.review_status || "pending"}</small>`;
    div.onclick = () => {
      currentMeasureIndex = index;
      refreshReview();
    };
    list.appendChild(div);
  });

  $("measureFeedback").textContent = measureFeedback(currentMeasure());
}

function applyUserMusicMetadata() {
  protocol.music ||= {};
  if ($("musicTitle").value.trim()) protocol.music.title = $("musicTitle").value.trim();
  if ($("musicKey").value.trim()) protocol.music.key = $("musicKey").value.trim();
  if ($("meterDefault").value.trim()) protocol.music.meter_default = $("meterDefault").value.trim();
  if ($("tempo").value.trim()) protocol.music.tempo = $("tempo").value.trim();
}

function generateOutputs() {
  const tech = generateTechnicalChordSheet(protocol);
  const play = generatePlayableChordSheet(protocol);
  const unc = globalUncertaintyReport(protocol);
  const det = detectionReport(protocol);
  protocol.outputs ||= {};
  protocol.outputs.technical_chord_sheet = tech;
  protocol.outputs.playable_chord_sheet = play;
  protocol.outputs.uncertainty_report = unc;
  protocol.outputs.detection_report = det;
  $("technicalOutput").textContent = tech;
  $("playableOutput").textContent = play;
  $("uncertaintyOutput").textContent = unc;
  $("detectionOutput").textContent = det;
  persist();
}

async function processWithProfessionalOmr() {
  const valid = validateFile(selectedFile);
  if (!valid.ok) {
    toast(valid.message);
    $("fileInfo").textContent = valid.message;
    return;
  }

  const backendUrl = $("backendUrl").value.trim() || "http://localhost:8787";
  $("btnProfessionalOmr").disabled = true;
  $("btnProfessionalOmr").textContent = "Processando...";
  setStatus("Enviando arquivo ao backend OMR profissional...");

  try {
    const result = await analyzeWithProfessionalOmr({ file: selectedFile, backendUrl });
    protocol = result || createInitialProtocol();
    applyUserMusicMetadata();
    currentMeasureIndex = 0;
    persist();

    const status = protocol.source?.omr_status || "processado";
    const engine = protocol.source?.omr_engine || "OMR profissional";
    const measures = protocol.measures?.length || 0;

    setStatus(`Processamento concluído.\nMotor: ${engine}\nStatus: ${status}\nCompassos importados: ${measures}`);
    refreshReview();
    generateOutputs();
    toast("OMR profissional concluído.");
  } catch (err) {
    console.error(err);
    setStatus(`Erro no processamento profissional.\n${err.message}\n\nVerifique se o backend está rodando e se o Audiveris está configurado.`);
    toast("Erro no OMR profissional.");
  } finally {
    $("btnProfessionalOmr").disabled = false;
    $("btnProfessionalOmr").textContent = "Processar com OMR Profissional";
  }
}

function initEvents() {
  $("fileInput").onchange = ev => {
    selectedFile = ev.target.files?.[0] || null;
    const valid = validateFile(selectedFile);
    $("fileInfo").textContent = selectedFile ? `${selectedFile.name} — ${valid.message}` : "Nenhum arquivo selecionado.";
    if (selectedFile && !$("musicTitle").value.trim()) {
      $("musicTitle").value = selectedFile.name.replace(/\.[^.]+$/, "");
    }
  };

  $("btnCheckBackend").onclick = async () => {
    const backendUrl = $("backendUrl").value.trim() || "http://localhost:8787";
    $("backendStatus").textContent = "Verificando backend...";
    try {
      const health = await checkProfessionalOmrBackend(backendUrl);
      $("backendStatus").textContent = JSON.stringify(health, null, 2);
      toast("Backend verificado.");
    } catch (err) {
      $("backendStatus").textContent = `Backend indisponível.\n${err.message}`;
      toast("Backend indisponível.");
    }
  };

  $("btnProfessionalOmr").onclick = processWithProfessionalOmr;

  $("btnPrevMeasure").onclick = () => {
    if (!protocol.measures?.length) return;
    currentMeasureIndex = Math.max(0, currentMeasureIndex - 1);
    refreshReview();
  };

  $("btnNextMeasure").onclick = () => {
    if (!protocol.measures?.length) return;
    currentMeasureIndex = Math.min(protocol.measures.length - 1, currentMeasureIndex + 1);
    refreshReview();
  };

  $("btnAcceptMeasure").onclick = () => {
    const m = currentMeasure();
    if (!m) return;
    acceptMeasure(m);
    persist();
    refreshReview();
    generateOutputs();
    toast("Compasso aprovado.");
  };

  $("btnMarkUncertain").onclick = () => {
    const m = currentMeasure();
    if (!m) return;
    markMeasureUncertain(m);
    persist();
    refreshReview();
    generateOutputs();
    toast("Compasso marcado como incerto.");
  };

  $("btnGenerateOutputs").onclick = generateOutputs;
  $("btnExportJson").onclick = () => { generateOutputs(); downloadText(versioned("cpp_protocol", "json"), exportJson(protocol), "application/json;charset=utf-8"); };
  $("btnExportTech").onclick = () => { generateOutputs(); downloadText(versioned("cifra_tecnica", "txt"), protocol.outputs.technical_chord_sheet); };
  $("btnExportPlayable").onclick = () => { generateOutputs(); downloadText(versioned("cifra_tocavel", "txt"), protocol.outputs.playable_chord_sheet); };
  $("btnExportUncertainty").onclick = () => { generateOutputs(); downloadText(versioned("relatorio_incertezas", "txt"), protocol.outputs.uncertainty_report); };
  $("btnExportDetection").onclick = () => { generateOutputs(); downloadText(versioned("relatorio_deteccao", "txt"), protocol.outputs.detection_report); };
  $("btnExportAll").onclick = () => {
    generateOutputs();
    downloadText(versioned("cpp_protocol", "json"), exportJson(protocol), "application/json;charset=utf-8");
    downloadText(versioned("cifra_tecnica", "txt"), protocol.outputs.technical_chord_sheet);
    downloadText(versioned("cifra_tocavel", "txt"), protocol.outputs.playable_chord_sheet);
    downloadText(versioned("relatorio_incertezas", "txt"), protocol.outputs.uncertainty_report);
    downloadText(versioned("relatorio_deteccao", "txt"), protocol.outputs.detection_report);
  };

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  refreshReview();
  generateOutputs();
}

initEvents();
