const AUDIT66_BUILD = "audit-66-cache-v2";
const STORAGE_KEY = "cpp_professional_omr_protocol_v1";

function byId(id) { return document.getElementById(id); }
function asArray(value) { return Array.isArray(value) ? value : []; }
function loadProtocol() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; } }
function saveProtocol(protocol) { localStorage.setItem(STORAGE_KEY, JSON.stringify(protocol || {})); }
function now() { return new Date().toISOString(); }
function measureId(measure, index) { return measure?.measure_id || measure?.id || `m${String(index).padStart(3, "0")}`; }
function measureLabel(measure, index) { return `Compasso ${measure?.number ?? measure?.measure_number ?? index}`; }

function valuesFrom(elements) { return asArray(elements).map(item => item?.value || item?.text || "").filter(Boolean); }
function approvedValues(measure, kind) { return [...new Set(asArray(measure?.approved_evidence?.[kind]).map(item => item?.text || item?.value || "").filter(Boolean))]; }
function musicXmlValues(measure, kind) {
  const detected = measure?.detected_elements || {};
  if (kind === "chords") return valuesFrom(detected.chords);
  if (kind === "lyrics") return valuesFrom(detected.syllables);
  if (kind === "notes") return valuesFrom(detected.note_heads);
  if (kind === "rests") return valuesFrom(detected.rests);
  if (kind === "navigation") return valuesFrom(detected.navigation);
  return [];
}
function ocrCandidateBlocks(protocol) { return asArray(protocol?.fusion?.text_blocks_index).filter(block => block?.text || block?.normalized_text); }
function isChord(block) { return block?.classification === "possible_chord" || Boolean(block?.chord_analysis); }
function isLyric(block) { return ["possible_lyric", "lyric_syllable_fragment", "lyric_hyphen_or_continuation"].includes(block?.classification); }
function collectUnassignedOcr(protocol) {
  const blocks = ocrCandidateBlocks(protocol);
  return {
    chords: blocks.filter(isChord).map(block => block.normalized_text || block.text).filter(Boolean),
    lyrics: blocks.filter(isLyric).map(block => block.normalized_text || block.text).filter(Boolean),
    navigation: blocks.filter(block => block.classification === "possible_navigation").map(block => block.normalized_text || block.text).filter(Boolean),
  };
}

function measureSummary(measure, index) {
  const approvedChords = approvedValues(measure, "chords");
  const approvedLyrics = approvedValues(measure, "lyrics");
  const xmlChords = musicXmlValues(measure, "chords");
  const xmlLyrics = musicXmlValues(measure, "lyrics");
  const notes = musicXmlValues(measure, "notes");
  const rests = musicXmlValues(measure, "rests");
  const navigation = musicXmlValues(measure, "navigation");
  const lacunae = asArray(measure?.lacunae);
  const chords = approvedChords.length ? approvedChords : xmlChords;
  const lyrics = approvedLyrics.length ? approvedLyrics : xmlLyrics;
  const confidence = approvedChords.length || approvedLyrics.length ? "confirmed_by_human" : (xmlChords.length || xmlLyrics.length || notes.length || rests.length) ? "structured_musicxml" : "pending";
  return {
    measure_id: measureId(measure, index),
    label: measureLabel(measure, index),
    number: measure?.number ?? measure?.measure_number ?? index,
    meter: measure?.meter || "",
    chords,
    lyrics,
    notes_count: notes.length,
    rests_count: rests.length,
    navigation,
    lacunae_count: lacunae.length,
    chord_source: approvedChords.length ? "human_review" : xmlChords.length ? "musicxml" : "none",
    lyric_source: approvedLyrics.length ? "human_review" : xmlLyrics.length ? "musicxml" : "none",
    confidence,
  };
}

function buildAutomaticProduct(protocol = loadProtocol()) {
  const measures = asArray(protocol.measures).map(measureSummary);
  const unassigned = collectUnassignedOcr(protocol);
  const lyricsText = measures.flatMap(m => m.lyrics).join(" ").replace(/\s+/g, " ").trim();
  const chordMeasures = measures.filter(m => m.chords.length);
  const lyricMeasures = measures.filter(m => m.lyrics.length);
  const noteMeasures = measures.filter(m => m.notes_count || m.rests_count);
  const blocked = measures.filter(m => m.confidence === "pending");

  const readableLines = [];
  readableLines.push("RELATÓRIO AUTOMÁTICO DE DETECÇÃO E PRODUTO MUSICAL");
  readableLines.push("");
  readableLines.push(`Arquivo: ${protocol?.source?.file_name || ""}`);
  readableLines.push(`Motor OMR: ${protocol?.source?.omr_engine || "Audiveris/MusicXML"}`);
  readableLines.push(`Status OMR: ${protocol?.source?.omr_status || "pending"}`);
  readableLines.push(`Motor OCR: ${protocol?.source?.ocr_engine || protocol?.ocr?.engine || "não configurado"}`);
  readableLines.push(`Status OCR: ${protocol?.source?.ocr_status || protocol?.ocr?.status || "pending"}`);
  readableLines.push(`Validação: ${protocol?.source?.validation_status || protocol?.validation?.validation_status || "pending"}`);
  readableLines.push("");
  readableLines.push("Evidências estruturais:");
  readableLines.push(`- Fórmula de compasso: ${protocol?.music?.meter_default || "pendente"}`);
  readableLines.push(`- Armadura/Tom: ${protocol?.music?.key || "pendente"}`);
  readableLines.push(`- Andamento: ${protocol?.music?.tempo || "pendente"}`);
  readableLines.push(`- Compassos importados: ${measures.length}`);
  readableLines.push(`- Compassos com cifras estruturadas/aprovadas: ${chordMeasures.length}`);
  readableLines.push(`- Compassos com texto/letra estruturada/aprovada: ${lyricMeasures.length}`);
  readableLines.push(`- Compassos com notas/pausas MusicXML: ${noteMeasures.length}`);
  if (lyricsText) readableLines.push(`- Texto/letra: ${lyricsText}`);
  readableLines.push("");
  readableLines.push("Resumo por compasso:");
  measures.forEach(m => {
    const bits = [];
    if (m.chords.length) bits.push(`cifra ${m.chords.join(" ")}`);
    if (m.lyrics.length) bits.push(`texto ${m.lyrics.join(" ")}`);
    if (m.notes_count) bits.push(`${m.notes_count} nota(s) importada(s)`);
    if (m.rests_count) bits.push(`${m.rests_count} pausa(s) importada(s)`);
    if (m.navigation.length) bits.push(`navegação ${m.navigation.join(" ")}`);
    if (m.lacunae_count) bits.push(`${m.lacunae_count} lacuna(s)`);
    readableLines.push(`- ${m.label}: ${m.confidence} — ${bits.length ? bits.join("; ") : "sem evidência musical estruturada"}`);
  });
  readableLines.push("");
  readableLines.push("Cifra/guia estrutural automática:");
  if (chordMeasures.length || lyricMeasures.length) {
    measures.forEach(m => {
      if (!m.chords.length && !m.lyrics.length) return;
      const chords = m.chords.length ? `[${m.chords.join(" ")}] ` : "";
      const lyric = m.lyrics.length ? m.lyrics.join(" ") : "";
      readableLines.push(`${m.label}: ${chords}${lyric}`.trim());
    });
  } else {
    readableLines.push("- Nenhuma cifra/letra estruturada por compasso disponível para montar guia automático.");
  }
  readableLines.push("");
  readableLines.push("Pendências automáticas:");
  if (!unassigned.chords.length && !unassigned.lyrics.length && !blocked.length) readableLines.push("- Nenhuma pendência crítica registrada.");
  else {
    if (unassigned.chords.length) readableLines.push(`- Cifras OCR globais não associadas automaticamente: ${[...new Set(unassigned.chords)].slice(0, 40).join(", ")}`);
    if (unassigned.lyrics.length) readableLines.push(`- Textos/letras OCR globais não associados automaticamente: ${[...new Set(unassigned.lyrics)].slice(0, 60).join(" ")}`);
    if (blocked.length) readableLines.push(`- Compassos sem evidência estrutural suficiente: ${blocked.map(m => m.label).join(", ")}`);
  }
  readableLines.push("- Regra: revisão humana prevalece; OCR bruto permanece preservado; nada é inventado.");

  const playableStatus = measures.every(m => m.confidence !== "pending") && (chordMeasures.length || lyricMeasures.length) ? "automatic_structural_product_ready_for_review" : "automatic_product_with_pending_evidence";
  return {
    export_type: "cpp_automatic_musical_product",
    audit: "audit-66.1",
    generated_at: now(),
    frontend: { build: AUDIT66_BUILD },
    source: { file_name: protocol?.source?.file_name || "", file_type: protocol?.source?.file_type || "", omr_status: protocol?.source?.omr_status || "pending", ocr_status: protocol?.source?.ocr_status || protocol?.ocr?.status || "pending" },
    summary: { measures_total: measures.length, chord_measures: chordMeasures.length, lyric_measures: lyricMeasures.length, note_or_rest_measures: noteMeasures.length, pending_measures: blocked.length, unassigned_ocr_chords: unassigned.chords.length, unassigned_ocr_lyrics: unassigned.lyrics.length, playable_status: playableStatus, automatic_process: true, integrated_after_processing: true, human_review_precedence: true },
    music: protocol?.music || {},
    measures,
    unassigned_ocr_candidates: unassigned,
    readable_report: readableLines.join("\n"),
    safety_contract: { modifies_protocol: true, modification_scope: "automatic_structural_product_generation_only", modifies_ocr_raw_text: false, preserves_ocr_raw_text: true, infers_lyrics: false, infers_harmony: false, aligns_ocr_to_measure_without_geometry: false, marks_playable_ready_automatically: false, uses_musicxml_structural_evidence: true, uses_human_review_when_available: true, keeps_unassigned_ocr_as_pending: true },
  };
}

function applyAutomaticProduct({ render = true } = {}) {
  const protocol = loadProtocol();
  const product = buildAutomaticProduct(protocol);
  protocol.outputs ||= {};
  protocol.outputs.automatic_musical_product = product.readable_report;
  protocol.outputs.detection_report = product.readable_report;
  protocol.automatic_product ||= {};
  protocol.automatic_product.audit_66 = product;
  saveProtocol(protocol);
  if (render) renderProduct(product);
  return product;
}
function renderProduct(product) {
  const out = byId("audit66Output");
  if (out) out.textContent = product.readable_report;
  const detection = byId("detectionOutput");
  if (detection) detection.textContent = product.readable_report;
}
function createPanel() {
  if (byId("automaticMusicalProductAudit66")) return;
  const previous = byId("assistedMusicalReviewAudit65") || byId("finalExportPackageAudit60") || document.querySelector("main");
  if (!previous) return;
  const section = document.createElement("section");
  section.id = "automaticMusicalProductAudit66";
  section.className = "panel active";
  section.innerHTML = `<h2>3P. Produto musical automático auditável</h2><p class="hint">Auditoria 66.1: gera automaticamente após o processamento e pode ser regenerado aqui. OCR não associado permanece como pendência.</p><div class="toolbar sticky"><button id="btnAudit66Generate" class="primary">Regenerar produto automático</button><button id="btnAudit66Export" class="ok">Exportar JSON auditável</button></div><pre id="audit66Output" class="output">Após processar a partitura, o produto automático aparece aqui.</pre>`;
  previous.insertAdjacentElement("afterend", section);
}
function downloadJson(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function bindButtons() {
  const generate = byId("btnAudit66Generate");
  if (generate) generate.onclick = event => { event.preventDefault(); applyAutomaticProduct(); };
  const exp = byId("btnAudit66Export");
  if (exp) exp.onclick = event => { event.preventDefault(); const product = applyAutomaticProduct(); downloadJson(`cpp_produto_musical_automatico_audit66_${now().replace(/[-:T]/g, "").slice(0, 12)}.json`, product); };
}
function markBuild() {
  window.CPP_ACTIVE_BUILD = AUDIT66_BUILD;
  window.CPP_GENERATE_AUTOMATIC_MUSICAL_PRODUCT = applyAutomaticProduct;
  const build = byId("frontendBuild");
  if (build) build.textContent = `Frontend build: ${AUDIT66_BUILD}`;
}
function initAudit66AutomaticMusicalProduct() {
  markBuild();
  createPanel();
  bindButtons();
  const existing = loadProtocol();
  if (existing?.source?.file_name || asArray(existing?.measures).length) applyAutomaticProduct();
}
document.addEventListener("cpp:protocol-processed", () => applyAutomaticProduct());
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAudit66AutomaticMusicalProduct);
else initAudit66AutomaticMusicalProduct();
