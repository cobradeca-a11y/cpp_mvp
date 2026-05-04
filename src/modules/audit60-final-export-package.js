const AUDIT60_BUILD = "audit-60-cache-v1";
const STORAGE_KEY = "cpp_professional_omr_protocol_v1";

function byId(id) { return document.getElementById(id); }
function asArray(value) { return Array.isArray(value) ? value : []; }
function safeJsonParse(raw, fallback = {}) { try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
function loadProtocol() { return safeJsonParse(localStorage.getItem(STORAGE_KEY), {}); }
function timestamp() { return new Date().toISOString(); }
function fileStamp() { return timestamp().replace(/[-:T]/g, "").slice(0, 12); }

function downloadText(filename, text, mime = "application/json;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function countMeasureStatus(protocol) {
  const measures = asArray(protocol.measures);
  return measures.reduce((acc, measure) => {
    const geometryStatus = measure?.geometry?.status || "pending";
    const playableStatus = measure?.playable_release?.status || "not_released";
    acc.geometry[geometryStatus] = (acc.geometry[geometryStatus] || 0) + 1;
    acc.playable[playableStatus] = (acc.playable[playableStatus] || 0) + 1;
    acc.lacunae += asArray(measure?.lacunae).length;
    acc.approved_chords += asArray(measure?.approved_evidence?.chords).length;
    acc.approved_lyrics += asArray(measure?.approved_evidence?.lyrics).length;
    acc.rejected_evidence += asArray(measure?.approved_evidence?.rejected).length;
    return acc;
  }, { geometry: {}, playable: {}, lacunae: 0, approved_chords: 0, approved_lyrics: 0, rejected_evidence: 0 });
}

function reviewCounts(protocol) {
  return asArray(protocol.review).reduce((acc, review) => {
    const audit = review?.audit || "unknown";
    acc.by_audit[audit] = (acc.by_audit[audit] || 0) + 1;
    acc.total += 1;
    return acc;
  }, { total: 0, by_audit: {} });
}

function buildFinalPackage(protocol = loadProtocol()) {
  const source = protocol.source || {};
  const measureStatus = countMeasureStatus(protocol);
  const reviews = reviewCounts(protocol);
  const generatedAt = timestamp();

  return {
    export_type: "cpp_final_export_package",
    audit: "audit-60",
    generated_at: generatedAt,
    frontend: { build: AUDIT60_BUILD },
    source: {
      file_name: source.file_name || "",
      file_type: source.file_type || "",
      pages: source.pages || asArray(protocol.pages).length || 0,
      omr_status: source.omr_status || "pending",
      ocr_status: source.ocr_status || protocol?.ocr?.status || "pending"
    },
    summary: {
      pages_total: asArray(protocol.pages).length,
      systems_total: asArray(protocol.systems).length,
      measures_total: asArray(protocol.measures).length,
      ocr_blocks_total: asArray(protocol?.fusion?.text_blocks_index).length || asArray(protocol?.ocr?.text_blocks).length,
      review_total: reviews.total,
      review_by_audit: reviews.by_audit,
      measure_geometry: measureStatus.geometry,
      playable_release: measureStatus.playable,
      approved_chord_evidence: measureStatus.approved_chords,
      approved_lyric_evidence: measureStatus.approved_lyrics,
      rejected_evidence: measureStatus.rejected_evidence,
      lacunae_total: measureStatus.lacunae,
      automatic_playable_releases: asArray(protocol.measures).filter(m => m?.playable_release?.automatic === true).length
    },
    protocol_snapshot: protocol,
    reports: {
      technical_chord_sheet: protocol?.outputs?.technical_chord_sheet || "",
      playable_chord_sheet: protocol?.outputs?.playable_chord_sheet || "",
      uncertainty_report: protocol?.outputs?.uncertainty_report || "",
      detection_report: protocol?.outputs?.detection_report || ""
    },
    safety_contract: {
      modifies_protocol: false,
      modification_scope: "export_only_final_package",
      modifies_ocr_raw_text: false,
      preserves_ocr_raw_text: true,
      infers_lyrics: false,
      infers_harmony: false,
      aligns_ocr_to_measure_without_geometry: false,
      marks_playable_ready_automatically: false,
      applies_human_review_without_user_action: false
    }
  };
}

function humanReport(pkg) {
  const s = pkg.summary;
  return [
    "PACOTE DE EXPORTAÇÃO FINAL — AUDITORIA 60",
    "",
    `Arquivo: ${pkg.source.file_name || "nenhum protocolo salvo"}`,
    `Build: ${pkg.frontend.build}`,
    "",
    "Resumo:",
    `- Páginas: ${s.pages_total}`,
    `- Sistemas: ${s.systems_total}`,
    `- Compassos: ${s.measures_total}`,
    `- Blocos OCR/Fusion: ${s.ocr_blocks_total}`,
    `- Revisões humanas: ${s.review_total}`,
    `- Cifras aprovadas: ${s.approved_chord_evidence}`,
    `- Letras aprovadas: ${s.approved_lyric_evidence}`,
    `- Evidências rejeitadas: ${s.rejected_evidence}`,
    `- Lacunas: ${s.lacunae_total}`,
    `- Liberações tocáveis automáticas: ${s.automatic_playable_releases}`,
    "",
    "Contrato:",
    "- Exportação somente leitura.",
    "- Preserva OCR bruto no protocolo_snapshot.",
    "- Não infere letra.",
    "- Não infere harmonia.",
    "- Não associa OCR a compasso sem geometria/revisão.",
    "- Não marca pronto para cifra tocável automaticamente."
  ].join("\n");
}

function createPanel() {
  if (byId("finalExportPackageAudit60")) return;
  const previous = byId("playableReleaseAudit59");
  const anchor = previous || document.querySelector("main");
  if (!anchor) return;
  const section = document.createElement("section");
  section.id = "finalExportPackageAudit60";
  section.className = "panel active";
  section.innerHTML = `<h2>3N. Pacote de exportação final</h2><p class="hint">Auditoria 60: consolida protocolo, relatórios, revisões, lacunas e prontidão tocável em um pacote auditável. Não altera o protocolo.</p><div class="toolbar sticky"><button id="btnPreviewFinalPackage" class="ghost">Pré-visualizar pacote</button><button id="btnExportFinalPackage" class="primary">Exportar pacote final JSON</button></div><pre id="finalExportPackageOutput" class="report small-report">Pacote final ainda não gerado.</pre>`;
  anchor.insertAdjacentElement("afterend", section);
}

function bindButtons() {
  const preview = byId("btnPreviewFinalPackage");
  const exp = byId("btnExportFinalPackage");
  if (preview) preview.onclick = event => {
    event.preventDefault();
    const pkg = buildFinalPackage(loadProtocol());
    const out = byId("finalExportPackageOutput");
    if (out) out.textContent = `${humanReport(pkg)}\n\nJSON:\n${JSON.stringify(pkg, null, 2)}`;
  };
  if (exp) exp.onclick = event => {
    event.preventDefault();
    const pkg = buildFinalPackage(loadProtocol());
    const text = JSON.stringify(pkg, null, 2);
    const out = byId("finalExportPackageOutput");
    if (out) out.textContent = `${humanReport(pkg)}\n\nJSON:\n${text}`;
    downloadText(`cpp_pacote_final_audit60_${fileStamp()}.json`, text);
  };
}

function markBuild() {
  window.CPP_ACTIVE_BUILD = AUDIT60_BUILD;
  const build = byId("frontendBuild");
  if (build) build.textContent = `Frontend build: ${AUDIT60_BUILD}`;
}

function initAudit60FinalExportPackage() {
  markBuild();
  createPanel();
  bindButtons();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAudit60FinalExportPackage);
else initAudit60FinalExportPackage();
