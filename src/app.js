import { createInitialProtocol, loadProtocol, saveProtocol, exportJson } from "./modules/cpp-json.js";
import { validateFile } from "./modules/file-input.js";
import { analyzeWithProfessionalOmr, checkProfessionalOmrBackend } from "./modules/professional-omr-client.js";
import { measureFeedback, detectionReport } from "./modules/feedback-engine.js";
import { acceptMeasure, markMeasureUncertain } from "./modules/measure-review.js";
import { generateTechnicalChordSheet } from "./modules/chord-sheet-technical.js";
import { generatePlayableChordSheet } from "./modules/chord-sheet-playable.js";
import { globalUncertaintyReport } from "./modules/confidence-engine.js";
import { downloadText, versioned } from "./modules/export-output.js";

const FRONTEND_BUILD = "audit-38-cache-v1";

let protocol = loadProtocol();
let selectedFile = null;
let currentMeasureIndex = 0;
let currentOcrBlockIndex = 0;

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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatJson(value) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return escapeHtml(value);
  return `<pre class="inline-json">${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
}

function formatClassificationCounts(fusion) {
  const counts = fusion.classification_counts || {};
  const entries = Object.entries(counts).filter(([, value]) => Number(value) > 0);
  if (!entries.length) return [];

  const labels = {
    instrument_label: "instrumentos",
    possible_lyric: "texto/letra provável",
    lyric_syllable_fragment: "fragmentos de sílaba",
    lyric_hyphen_or_continuation: "hífens/continuações",
    punctuation: "pontuação",
    music_symbol_noise: "ruído/símbolo musical",
    possible_chord: "cifras candidatas",
    editorial_text: "texto editorial",
    possible_navigation: "navegação candidata",
    unknown: "desconhecido",
  };

  return [
    "Classificações OCR/Fusion:",
    ...entries.map(([key, value]) => `- ${labels[key] || key}: ${value}`),
  ];
}

function buildProcessingSummary(protocol) {
  const source = protocol.source || {};
  const ocr = protocol.ocr || {};
  const fusion = protocol.fusion || {};
  const layout = protocol.layout || {};
  const alignment = protocol.alignment_report || {};
  const measures = protocol.measures?.length || 0;
  const textBlocks = ocr.text_blocks?.length || 0;
  const possibleChords = fusion.possible_chords?.length || 0;
  const possibleLyrics = fusion.possible_lyrics?.length || 0;

  const lines = [
    "Processamento concluído.",
    `Motor OMR: ${source.omr_engine || "Audiveris"}`,
    `Status OMR: ${source.omr_status || "pending"}`,
    `Compassos importados: ${measures}`,
    `Motor OCR: ${source.ocr_engine || ocr.engine || "não configurado"}`,
    `Status OCR: ${source.ocr_status || ocr.status || "pending"}`,
    `Blocos OCR: ${textBlocks}`,
    `Fusion: ${fusion.status || "not_available"}`,
  ];

  if (fusion.engine) lines.push(`Motor Fusion: ${fusion.engine}`);
  if (fusion.version) lines.push(`Versão Fusion: ${fusion.version}`);
  if (layout.version) lines.push(`Layout: ${layout.version} — ${layout.status || "not_available"}`);
  if (alignment.version) lines.push(`Relatório de alinhamento: ${alignment.version} — ${alignment.status || "not_available"}`);
  if (possibleChords || possibleLyrics) lines.push(`Candidatos OCR: ${possibleChords} cifra(s), ${possibleLyrics} texto(s)/sílaba(s).`);
  lines.push(...formatClassificationCounts(fusion));
  if (fusion.warnings?.length) {
    lines.push("Avisos Fusion:");
    fusion.warnings.forEach(w => lines.push(`- ${w}`));
  }
  if (alignment.blockers?.length) {
    lines.push("Bloqueios de alinhamento:");
    alignment.blockers.forEach(b => lines.push(`- ${b.code}: ${b.message}`));
  }
  if (ocr.warnings?.length) {
    lines.push("Avisos OCR:");
    ocr.warnings.forEach(w => lines.push(`- ${w}`));
  }

  return lines.join("\n");
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
    div.innerHTML = `<div class="row"><b>Compasso ${escapeHtml(m.number)}</b><span>${escapeHtml(m.confidence || "provável")}</span></div>
      <small>${escapeHtml(m.meter || "")} — ${escapeHtml(m.review_status || "pending")}</small>`;
    div.onclick = () => {
      currentMeasureIndex = index;
      refreshReview();
    };
    list.appendChild(div);
  });

  $("measureFeedback").textContent = measureFeedback(currentMeasure());
}

function getOcrBlocks() {
  return protocol.fusion?.text_blocks_index || [];
}

function findRegionForBlock(block) {
  const blockId = block?.fusion_id;
  if (!blockId) return null;
  return (protocol.fusion?.text_region_groups || []).find(region => Array.isArray(region.text_block_ids) && region.text_block_ids.includes(blockId)) || null;
}

function findSystemAssociation(region) {
  const regionId = region?.region_id;
  if (!regionId) return null;
  return (protocol.ocr_system_associations?.associations || []).find(item => item.region_id === regionId) || null;
}

function findMeasureAssociation(region) {
  const regionId = region?.region_id;
  if (!regionId) return null;
  return (protocol.ocr_measure_associations?.associations || []).find(item => item.region_id === regionId) || null;
}

function currentOcrBlock() {
  return getOcrBlocks()[currentOcrBlockIndex] || null;
}

function ensureReviewArray() {
  protocol.review = Array.isArray(protocol.review) ? protocol.review : [];
}

function makeHumanReviewDecision(block, decision) {
  const reviewedAt = new Date().toISOString();
  const review = {
    review_id: `ocr-classification-${block.fusion_id}-${Date.now()}`,
    audit: "audit-36",
    type: "ocr_classification_review",
    target_type: "fusion_text_block",
    target_id: block.fusion_id,
    decision,
    original_text: block.text,
    normalized_text: block.normalized_text,
    original_classification: block.classification,
    reviewed_by: "human_local_review",
    reviewed_at: reviewedAt,
    effects: {
      text_changed: false,
      normalized_text_changed: false,
      classification_changed: false,
      system_assignment_changed: false,
      measure_assignment_changed: false,
    },
  };

  ensureReviewArray();
  protocol.review.push(review);
  block.human_review = {
    status: decision === "approved" ? "classification_approved" : "classification_rejected",
    decision,
    reviewed_at: reviewedAt,
    review_id: review.review_id,
  };
  persist();
  refreshOcrReview();
  generateOutputs();
  toast(decision === "approved" ? "Classificação OCR aprovada." : "Classificação OCR rejeitada.");
}

function makeSystemReviewDecision(block, decision) {
  const region = findRegionForBlock(block);
  const systemAssociation = findSystemAssociation(region);
  const reviewedAt = new Date().toISOString();
  const review = {
    review_id: `ocr-system-${block.fusion_id}-${Date.now()}`,
    audit: "audit-37",
    type: "ocr_system_association_review",
    target_type: "fusion_text_region",
    target_id: region?.region_id || null,
    source_block_id: block.fusion_id,
    decision,
    original_text: block.text,
    normalized_text: block.normalized_text,
    original_region_type: region?.region_type || null,
    original_association_status: systemAssociation?.association_status || null,
    original_candidate_system_id: systemAssociation?.candidate_system_id || null,
    original_reason: systemAssociation?.reason || null,
    reviewed_by: "human_local_review",
    reviewed_at: reviewedAt,
    effects: {
      text_changed: false,
      normalized_text_changed: false,
      classification_changed: false,
      system_assignment_changed: false,
      measure_assignment_changed: false,
      candidate_system_id_changed: false,
    },
  };

  ensureReviewArray();
  protocol.review.push(review);
  block.system_human_review = {
    status: decision === "confirmed" ? "system_state_confirmed" : "system_state_rejected",
    decision,
    reviewed_at: reviewedAt,
    review_id: review.review_id,
    association_status_reviewed: systemAssociation?.association_status || null,
    candidate_system_id_preserved: systemAssociation?.candidate_system_id || null,
  };
  persist();
  refreshOcrReview();
  generateOutputs();
  toast(decision === "confirmed" ? "Estado OCR→sistema confirmado." : "Estado OCR→sistema rejeitado.");
}

function makeMeasureReviewDecision(block, decision) {
  const region = findRegionForBlock(block);
  const measureAssociation = findMeasureAssociation(region);
  const reviewedAt = new Date().toISOString();
  const review = {
    review_id: `ocr-measure-${block.fusion_id}-${Date.now()}`,
    audit: "audit-38",
    type: "ocr_measure_association_review",
    target_type: "fusion_text_region",
    target_id: region?.region_id || null,
    source_block_id: block.fusion_id,
    decision,
    original_text: block.text,
    normalized_text: block.normalized_text,
    original_region_type: region?.region_type || null,
    original_association_status: measureAssociation?.association_status || null,
    original_candidate_system_id: measureAssociation?.candidate_system_id || null,
    original_candidate_measure_id: measureAssociation?.candidate_measure_id || null,
    original_candidate_measure_number: measureAssociation?.candidate_measure_number || null,
    original_confidence_score: measureAssociation?.confidence_score ?? null,
    original_confidence_level: measureAssociation?.confidence_level || null,
    original_reason: measureAssociation?.reason || null,
    reviewed_by: "human_local_review",
    reviewed_at: reviewedAt,
    effects: {
      text_changed: false,
      normalized_text_changed: false,
      classification_changed: false,
      system_assignment_changed: false,
      measure_assignment_changed: false,
      candidate_system_id_changed: false,
      candidate_measure_id_changed: false,
      candidate_measure_number_changed: false,
      confidence_score_changed: false,
    },
  };

  ensureReviewArray();
  protocol.review.push(review);
  block.measure_human_review = {
    status: decision === "confirmed" ? "measure_state_confirmed" : "measure_state_rejected",
    decision,
    reviewed_at: reviewedAt,
    review_id: review.review_id,
    association_status_reviewed: measureAssociation?.association_status || null,
    candidate_measure_id_preserved: measureAssociation?.candidate_measure_id || null,
    candidate_measure_number_preserved: measureAssociation?.candidate_measure_number || null,
    confidence_score_preserved: measureAssociation?.confidence_score ?? null,
  };
  persist();
  refreshOcrReview();
  generateOutputs();
  toast(decision === "confirmed" ? "Estado OCR→compasso confirmado." : "Estado OCR→compasso rejeitado.");
}

function approveCurrentOcrClassification() {
  const block = currentOcrBlock();
  if (!block) return toast("Nenhum bloco OCR para aprovar.");
  makeHumanReviewDecision(block, "approved");
}

function rejectCurrentOcrClassification() {
  const block = currentOcrBlock();
  if (!block) return toast("Nenhum bloco OCR para rejeitar.");
  makeHumanReviewDecision(block, "rejected");
}

function confirmCurrentOcrSystemState() {
  const block = currentOcrBlock();
  if (!block) return toast("Nenhum bloco OCR para revisar.");
  makeSystemReviewDecision(block, "confirmed");
}

function rejectCurrentOcrSystemState() {
  const block = currentOcrBlock();
  if (!block) return toast("Nenhum bloco OCR para revisar.");
  makeSystemReviewDecision(block, "rejected");
}

function confirmCurrentOcrMeasureState() {
  const block = currentOcrBlock();
  if (!block) return toast("Nenhum bloco OCR para revisar.");
  makeMeasureReviewDecision(block, "confirmed");
}

function rejectCurrentOcrMeasureState() {
  const block = currentOcrBlock();
  if (!block) return toast("Nenhum bloco OCR para revisar.");
  makeMeasureReviewDecision(block, "rejected");
}

function renderOcrBlockDetails(block) {
  if (!block) return "Nenhum bloco OCR carregado.";

  const region = findRegionForBlock(block);
  const systemAssociation = findSystemAssociation(region);
  const measureAssociation = findMeasureAssociation(region);
  const chordAnalysis = block.chord_analysis || null;
  const humanReview = block.human_review || null;
  const systemHumanReview = block.system_human_review || null;
  const measureHumanReview = block.measure_human_review || null;

  return `
    <div class="ocr-detail-grid">
      <div><span class="detail-label">ID</span><strong>${escapeHtml(block.fusion_id || "—")}</strong></div>
      <div><span class="detail-label">Página</span><strong>${escapeHtml(block.page || "—")}</strong></div>
      <div><span class="detail-label">Classificação</span><strong>${escapeHtml(block.classification || "—")}</strong></div>
      <div><span class="detail-label">Normalização</span><strong>${escapeHtml(block.normalization_status || "—")}</strong></div>
    </div>

    <h4>Revisão humana da classificação</h4>
    <div class="evidence-box"><p><b>Status:</b> ${escapeHtml(humanReview?.status || "pendente")}</p><p><b>Decisão:</b> ${escapeHtml(humanReview?.decision || "—")}</p><p><b>Review ID:</b> ${escapeHtml(humanReview?.review_id || "—")}</p><p><b>Data:</b> ${escapeHtml(humanReview?.reviewed_at || "—")}</p></div>

    <h4>Revisão humana OCR→sistema</h4>
    <div class="evidence-box"><p><b>Status:</b> ${escapeHtml(systemHumanReview?.status || "pendente")}</p><p><b>Decisão:</b> ${escapeHtml(systemHumanReview?.decision || "—")}</p><p><b>Review ID:</b> ${escapeHtml(systemHumanReview?.review_id || "—")}</p><p><b>Associação revisada:</b> ${escapeHtml(systemHumanReview?.association_status_reviewed || "—")}</p><p><b>Sistema preservado:</b> ${escapeHtml(systemHumanReview?.candidate_system_id_preserved || "—")}</p><p><b>Data:</b> ${escapeHtml(systemHumanReview?.reviewed_at || "—")}</p></div>

    <h4>Revisão humana OCR→compasso</h4>
    <div class="evidence-box"><p><b>Status:</b> ${escapeHtml(measureHumanReview?.status || "pendente")}</p><p><b>Decisão:</b> ${escapeHtml(measureHumanReview?.decision || "—")}</p><p><b>Review ID:</b> ${escapeHtml(measureHumanReview?.review_id || "—")}</p><p><b>Associação revisada:</b> ${escapeHtml(measureHumanReview?.association_status_reviewed || "—")}</p><p><b>Compasso preservado:</b> ${escapeHtml(measureHumanReview?.candidate_measure_number_preserved || "—")}</p><p><b>Confiança preservada:</b> ${escapeHtml(measureHumanReview?.confidence_score_preserved ?? "—")}</p><p><b>Data:</b> ${escapeHtml(measureHumanReview?.reviewed_at || "—")}</p></div>

    <h4>Texto OCR bruto preservado</h4>
    <pre class="ocr-raw">${escapeHtml(block.text || "")}</pre>

    <h4>Texto normalizado conservador</h4>
    <pre class="ocr-normalized">${escapeHtml(block.normalized_text || "")}</pre>

    <h4>Região funcional</h4>
    <div class="evidence-box"><p><b>Região:</b> ${escapeHtml(region?.region_id || "não localizada")}</p><p><b>Tipo:</b> ${escapeHtml(region?.region_type || "—")}</p><p><b>Confiança:</b> ${escapeHtml(region?.confidence || "—")}</p><p><b>Motivo:</b> ${escapeHtml(region?.reason || "—")}</p></div>

    <h4>Associação OCR→sistema</h4>
    <div class="evidence-box blocked-box"><p><b>Status:</b> ${escapeHtml(systemAssociation?.association_status || "não disponível")}</p><p><b>Sistema candidato:</b> ${escapeHtml(systemAssociation?.candidate_system_id || "—")}</p><p><b>Motivo:</b> ${escapeHtml(systemAssociation?.reason || "—")}</p></div>

    <h4>Associação OCR→compasso</h4>
    <div class="evidence-box blocked-box"><p><b>Status:</b> ${escapeHtml(measureAssociation?.association_status || "não disponível")}</p><p><b>Compasso candidato:</b> ${escapeHtml(measureAssociation?.candidate_measure_number || "—")}</p><p><b>Confiança:</b> ${escapeHtml(measureAssociation?.confidence_score ?? "—")} / ${escapeHtml(measureAssociation?.confidence_level || "—")}</p><p><b>Motivo:</b> ${escapeHtml(measureAssociation?.reason || "—")}</p></div>

    <h4>Análise de cifra candidata</h4>
    ${formatJson(chordAnalysis)}

    <h4>BBox OCR</h4>
    ${formatJson(block.bbox || {})}

    <h4>Notas de normalização</h4>
    ${formatJson(block.normalization_notes || [])}
  `;
}

function refreshOcrReview() {
  const list = $("ocrBlocksList");
  const details = $("ocrBlockDetails");
  if (!list || !details) return;

  const blocks = getOcrBlocks();
  list.innerHTML = "";

  if (!blocks.length) {
    currentOcrBlockIndex = 0;
    details.textContent = "Nenhum bloco OCR carregado. Processe uma imagem/PDF com OCR ou importe protocolo com fusion.text_blocks_index.";
    return;
  }

  currentOcrBlockIndex = Math.min(Math.max(currentOcrBlockIndex, 0), blocks.length - 1);

  blocks.forEach((block, index) => {
    const region = findRegionForBlock(block);
    const measureAssociation = findMeasureAssociation(region);
    const reviewStatus = block.human_review?.status || "classificação pendente";
    const systemReviewStatus = block.system_human_review?.status || "sistema pendente";
    const measureReviewStatus = block.measure_human_review?.status || "compasso pendente";
    const div = document.createElement("div");
    div.className = `item ${index === currentOcrBlockIndex ? "active" : ""}`;
    div.innerHTML = `<div class="row"><b>${escapeHtml(block.text || "[vazio]")}</b><span>${escapeHtml(block.classification || "—")}</span></div>
      <small>${escapeHtml(block.fusion_id || "")}${region?.region_type ? ` — ${escapeHtml(region.region_type)}` : ""}${measureAssociation?.association_status ? ` — ${escapeHtml(measureAssociation.association_status)}` : ""} — ${escapeHtml(reviewStatus)} — ${escapeHtml(systemReviewStatus)} — ${escapeHtml(measureReviewStatus)}</small>`;
    div.onclick = () => {
      currentOcrBlockIndex = index;
      refreshOcrReview();
    };
    list.appendChild(div);
  });

  details.innerHTML = renderOcrBlockDetails(currentOcrBlock());
}

function fileBaseName(fileName = "") { return fileName.replace(/\.[^.]+$/, "").trim(); }
function detectedSummary() { return protocol.systems?.[0]?.detected_summary || {}; }

function syncMusicMetadataFromImport(file) {
  const summary = detectedSummary();
  const importedTitle = protocol.music?.title?.trim();
  const fileTitle = fileBaseName(file?.name || protocol.source?.file_name || "");
  protocol.music ||= {};
  protocol.music.title = importedTitle || fileTitle || "Sem título";
  protocol.music.key = summary.key_signature || protocol.music.key || "";
  protocol.music.meter_default = summary.meter || protocol.measures?.[0]?.meter || protocol.music.meter_default || "";
  protocol.music.tempo = summary.tempo || protocol.music.tempo || "";
  $("musicTitle").value = protocol.music.title || "";
  $("musicKey").value = protocol.music.key || "";
  $("meterDefault").value = protocol.music.meter_default || "";
  $("tempo").value = protocol.music.tempo || "";
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

async function clearFrontendCacheAndReload() {
  toast("Limpando cache do app...");
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => key.startsWith("cpp-professional-omr-")).map(key => caches.delete(key)));
    }
  } catch (err) { console.warn("Falha ao limpar cache do frontend", err); }
  window.location.reload();
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
    syncMusicMetadataFromImport(selectedFile);
    currentMeasureIndex = 0;
    currentOcrBlockIndex = 0;
    persist();
    setStatus(buildProcessingSummary(protocol));
    refreshReview();
    refreshOcrReview();
    generateOutputs();
    toast("Processamento profissional concluído.");
  } catch (err) {
    console.error(err);
    setStatus(`Erro no processamento profissional.\n${err.message}\n\nVerifique se o backend está rodando e se o Audiveris está configurado.`);
    toast("Erro no OMR profissional.");
  } finally {
    $("btnProfessionalOmr").disabled = false;
    $("btnProfessionalOmr").textContent = "Processar com OMR Profissional";
  }
}

function initBuildInfo() { if ($("frontendBuild")) $("frontendBuild").textContent = `Frontend build: ${FRONTEND_BUILD}`; }

function initEvents() {
  initBuildInfo();
  $("fileInput").onchange = ev => {
    selectedFile = ev.target.files?.[0] || null;
    const valid = validateFile(selectedFile);
    $("fileInfo").textContent = selectedFile ? `${selectedFile.name} — ${valid.message}` : "Nenhum arquivo selecionado.";
    if (selectedFile) {
      $("musicTitle").value = fileBaseName(selectedFile.name);
      $("musicKey").value = "";
      $("meterDefault").value = "";
      $("tempo").value = "";
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
  if ($("btnClearFrontendCache")) $("btnClearFrontendCache").onclick = clearFrontendCacheAndReload;
  $("btnProfessionalOmr").onclick = processWithProfessionalOmr;
  $("btnPrevMeasure").onclick = () => { if (protocol.measures?.length) { currentMeasureIndex = Math.max(0, currentMeasureIndex - 1); refreshReview(); } };
  $("btnNextMeasure").onclick = () => { if (protocol.measures?.length) { currentMeasureIndex = Math.min(protocol.measures.length - 1, currentMeasureIndex + 1); refreshReview(); } };
  if ($("btnPrevOcrBlock")) $("btnPrevOcrBlock").onclick = () => { const blocks = getOcrBlocks(); if (blocks.length) { currentOcrBlockIndex = Math.max(0, currentOcrBlockIndex - 1); refreshOcrReview(); } };
  if ($("btnNextOcrBlock")) $("btnNextOcrBlock").onclick = () => { const blocks = getOcrBlocks(); if (blocks.length) { currentOcrBlockIndex = Math.min(blocks.length - 1, currentOcrBlockIndex + 1); refreshOcrReview(); } };
  if ($("btnApproveOcrClassification")) $("btnApproveOcrClassification").onclick = approveCurrentOcrClassification;
  if ($("btnRejectOcrClassification")) $("btnRejectOcrClassification").onclick = rejectCurrentOcrClassification;
  if ($("btnConfirmOcrSystemState")) $("btnConfirmOcrSystemState").onclick = confirmCurrentOcrSystemState;
  if ($("btnRejectOcrSystemState")) $("btnRejectOcrSystemState").onclick = rejectCurrentOcrSystemState;
  if ($("btnConfirmOcrMeasureState")) $("btnConfirmOcrMeasureState").onclick = confirmCurrentOcrMeasureState;
  if ($("btnRejectOcrMeasureState")) $("btnRejectOcrMeasureState").onclick = rejectCurrentOcrMeasureState;
  $("btnAcceptMeasure").onclick = () => { const m = currentMeasure(); if (!m) return; acceptMeasure(m); persist(); refreshReview(); generateOutputs(); toast("Compasso aprovado."); };
  $("btnMarkUncertain").onclick = () => { const m = currentMeasure(); if (!m) return; markMeasureUncertain(m); persist(); refreshReview(); generateOutputs(); toast("Compasso marcado como incerto."); };
  $("btnGenerateOutputs").onclick = () => { applyUserMusicMetadata(); generateOutputs(); };
  $("btnExportJson").onclick = () => { applyUserMusicMetadata(); generateOutputs(); downloadText(versioned("cpp_protocol", "json"), exportJson(protocol), "application/json;charset=utf-8"); };
  $("btnExportTech").onclick = () => { applyUserMusicMetadata(); generateOutputs(); downloadText(versioned("cifra_tecnica", "txt"), protocol.outputs.technical_chord_sheet); };
  $("btnExportPlayable").onclick = () => { applyUserMusicMetadata(); generateOutputs(); downloadText(versioned("cifra_tocavel", "txt"), protocol.outputs.playable_chord_sheet); };
  $("btnExportUncertainty").onclick = () => { applyUserMusicMetadata(); generateOutputs(); downloadText(versioned("relatorio_incertezas", "txt"), protocol.outputs.uncertainty_report); };
  $("btnExportDetection").onclick = () => { applyUserMusicMetadata(); generateOutputs(); downloadText(versioned("relatorio_deteccao", "txt"), protocol.outputs.detection_report); };
  $("btnExportAll").onclick = () => {
    applyUserMusicMetadata();
    generateOutputs();
    downloadText(versioned("cpp_protocol", "json"), exportJson(protocol), "application/json;charset=utf-8");
    downloadText(versioned("cifra_tecnica", "txt"), protocol.outputs.technical_chord_sheet);
    downloadText(versioned("cifra_tocavel", "txt"), protocol.outputs.playable_chord_sheet);
    downloadText(versioned("relatorio_incertezas", "txt"), protocol.outputs.uncertainty_report);
    downloadText(versioned("relatorio_deteccao", "txt"), protocol.outputs.detection_report);
  };
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js?v=audit-38-cache-v1").catch(() => {});
  refreshReview();
  refreshOcrReview();
  generateOutputs();
}

initEvents();
