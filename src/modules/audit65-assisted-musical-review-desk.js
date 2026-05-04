const AUDIT65_BUILD = "audit-65-cache-v2";
const STORAGE_KEY = "cpp_professional_omr_protocol_v1";

function byId(id) { return document.getElementById(id); }
function asArray(value) { return Array.isArray(value) ? value : []; }
function safeJsonParse(raw, fallback = {}) { try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
function loadProtocol() { return safeJsonParse(localStorage.getItem(STORAGE_KEY), {}); }
function saveProtocol(protocol) { localStorage.setItem(STORAGE_KEY, JSON.stringify(protocol || {})); }
function uid(prefix) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`; }
function now() { return new Date().toISOString(); }
function esc(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function measureId(measure, index) { return measure?.measure_id || measure?.id || `m${String(index).padStart(3, "0")}`; }
function getMeasures(protocol) { return asArray(protocol.measures).map((measure, index) => ({ id: measureId(measure, index), number: measure?.number ?? measure?.measure_number ?? index, label: `Compasso ${measure?.number ?? measure?.measure_number ?? index}`, raw: measure })); }
function getFusionBlocks(protocol) { const fusion = asArray(protocol?.fusion?.text_blocks_index); if (fusion.length) return fusion; return asArray(protocol?.ocr?.text_blocks).map((block, index) => ({ ...block, fusion_id: block?.fusion_id || block?.id || `fx${String(index + 1).padStart(4, "0")}`, classification: block?.classification || block?.type || "ocr_text" })); }
function isChordCandidate(block) { return block?.chord_candidate === true || block?.classification === "possible_chord" || Boolean(block?.chord_analysis); }
function isLyricCandidate(block) { if (isChordCandidate(block)) return false; return block?.lyric_candidate === true || ["possible_lyric", "lyric_syllable_fragment", "lyric_hyphen_or_continuation"].includes(block?.classification); }
function makeCandidate(block, index) { const kind = isChordCandidate(block) ? "chord" : isLyricCandidate(block) ? "lyric" : "other"; return { id: block?.fusion_id || block?.id || `fx${String(index + 1).padStart(4, "0")}`, text: block?.text || block?.raw_text || block?.normalized_text || "", kind, classification: block?.classification || "ocr_text", page: block?.page || block?.page_number || null, system_id: block?.system_id || block?.assignment?.system_id || null, measure_id: block?.measure_id || block?.assignment?.measure_id || null, warning: block?.assignment?.status || "Não associado a compasso sem confirmação humana explícita.", raw: block }; }
function buildCandidates(protocol) { return getFusionBlocks(protocol).map(makeCandidate).filter(candidate => candidate.text && ["chord", "lyric"].includes(candidate.kind)); }
function candidateLabel(candidate) { const type = candidate.kind === "chord" ? "Cifra" : "Texto/letra"; return `${type}: ${candidate.text}`; }
function selectedCandidate() { const select = byId("audit65CandidateSelect"); if (!select) return null; const protocol = loadProtocol(); return buildCandidates(protocol).find(candidate => candidate.id === select.value) || null; }
function selectedMeasureId() { return byId("audit65MeasureSelect")?.value || ""; }
function selectedSectionLabel() { return byId("audit65SectionInput")?.value?.trim() || ""; }

function appendQuestionPreview() {
  const candidate = selectedCandidate();
  const measure = selectedMeasureId();
  const out = byId("audit65QuestionPreview");
  if (!out) return;
  if (!candidate) { out.textContent = "Selecione um candidato detectado pelo CPP."; return; }
  const measureText = measure ? ` ao ${measure}` : " a um compasso";
  out.textContent = `${candidateLabel(candidate)} — confirmar associação${measureText}?\n\nVocê vê o texto musical; o CPP registra o ID técnico por trás.`;
}

function ensureReviewContainers(protocol) {
  protocol.review ||= [];
  protocol.assisted_review ||= {};
  protocol.assisted_review.audit_65 ||= { version: "audit-65.1", created_at: now(), description: "Mesa de revisão musical assistida com prévia musical acumulada." };
}
function findMeasure(protocol, measure_id) { return asArray(protocol.measures).find((measure, index) => String(measureId(measure, index)) === String(measure_id)); }

function buildLivePreview(protocol = loadProtocol()) {
  const measures = getMeasures(protocol);
  const lines = [];
  const sectionByMeasure = {};
  asArray(protocol.review).filter(r => r?.audit === "audit-65" && r?.measure_id).forEach(r => { if (r.section && !sectionByMeasure[r.measure_id]) sectionByMeasure[r.measure_id] = r.section; });
  let currentSection = "";
  measures.forEach((entry) => {
    const measure = entry.raw || {};
    const chords = asArray(measure?.approved_evidence?.chords).filter(item => item?.source === "audit65_human_visual_confirmation").map(item => item.text).filter(Boolean);
    const lyrics = asArray(measure?.approved_evidence?.lyrics).filter(item => item?.source === "audit65_human_visual_confirmation").map(item => item.text).filter(Boolean);
    const gaps = asArray(measure?.lacunae).filter(item => item?.source === "audit65_human_gap");
    if (!chords.length && !lyrics.length && !gaps.length) return;
    const section = sectionByMeasure[entry.id];
    if (section && section !== currentSection) { currentSection = section; lines.push(`\n[${section.toUpperCase()}]`); }
    const chordText = chords.length ? chords.join("  ") : "—";
    const lyricText = lyrics.length ? ` | texto: ${lyrics.join(" ")}` : "";
    const gapText = gaps.length ? ` | lacuna: ${gaps.length}` : "";
    lines.push(`${entry.label}: ${chordText}${lyricText}${gapText}`);
  });
  return lines.length ? lines.join("\n").trim() : "Nenhuma cifra/letra/lacuna confirmada ainda. A prévia aparece aqui conforme você confirma.";
}

function renderLivePreview() {
  const out = byId("audit65LivePreview");
  if (out) out.textContent = buildLivePreview(loadProtocol());
}

function applyDecision(decision) {
  const protocol = loadProtocol();
  ensureReviewContainers(protocol);
  const candidate = selectedCandidate();
  const measure_id = selectedMeasureId();
  const section = selectedSectionLabel();
  const note = byId("audit65NoteInput")?.value?.trim() || "";
  const result = { decision, applied: false, reason: "", candidate: candidate ? { id: candidate.id, text: candidate.text, kind: candidate.kind } : null, measure_id };
  if (!candidate && decision !== "mark_gap") { result.reason = "candidate_not_selected"; return { protocol, result }; }

  const review = { id: uid("audit65_review"), audit: "audit-65", type: "assisted_musical_review", timestamp: now(), source: "human_visual_confirmation", decision, candidate_text: candidate?.text || null, candidate_kind: candidate?.kind || null, candidate_classification: candidate?.classification || null, target_id: candidate?.id || null, measure_id: measure_id || null, section: section || null, note, human_label: candidate ? candidateLabel(candidate) : "Lacuna", effects: { modifies_protocol: true, modifies_ocr_raw_text: false, infers_lyrics: false, infers_harmony: false, aligns_ocr_to_measure_without_geometry: false, marks_playable_ready_automatically: false, applies_human_review_without_user_action: false } };

  if (decision === "confirm_for_measure") {
    if (!measure_id) { result.reason = "measure_not_selected"; return { protocol, result }; }
    const measure = findMeasure(protocol, measure_id);
    if (!measure) { result.reason = "measure_not_found"; return { protocol, result }; }
    measure.approved_evidence ||= {};
    if (candidate.kind === "chord") {
      measure.approved_evidence.chords ||= [];
      measure.approved_evidence.chords.push({ target_id: candidate.id, text: candidate.text, source: "audit65_human_visual_confirmation", review_id: review.id, confirmed_at: review.timestamp, section: section || null, note });
    } else {
      measure.approved_evidence.lyrics ||= [];
      measure.approved_evidence.lyrics.push({ target_id: candidate.id, text: candidate.text, source: "audit65_human_visual_confirmation", review_id: review.id, confirmed_at: review.timestamp, section: section || null, note });
    }
    result.applied = true; result.reason = "confirmed_by_human_visual_review";
  }
  if (decision === "reject_candidate") { protocol.rejected_candidates ||= []; protocol.rejected_candidates.push({ target_id: candidate.id, text: candidate.text, kind: candidate.kind, source: "audit65_human_visual_rejection", review_id: review.id, rejected_at: review.timestamp, note }); result.applied = true; result.reason = "rejected_by_human_visual_review"; }
  if (decision === "mark_uncertain") { protocol.uncertain_candidates ||= []; protocol.uncertain_candidates.push({ target_id: candidate.id, text: candidate.text, kind: candidate.kind, measure_id: measure_id || null, source: "audit65_human_uncertain", review_id: review.id, marked_at: review.timestamp, note }); result.applied = true; result.reason = "marked_uncertain_by_human"; }
  if (decision === "mark_gap") { if (!measure_id) { result.reason = "measure_not_selected"; return { protocol, result }; } const measure = findMeasure(protocol, measure_id); if (!measure) { result.reason = "measure_not_found"; return { protocol, result }; } measure.lacunae ||= []; measure.lacunae.push({ id: uid("gap"), type: "measure_needs_visual_review", source: "audit65_human_gap", review_id: review.id, created_at: review.timestamp, section: section || null, note: note || "lacuna marcada pela mesa de revisão musical assistida" }); result.applied = true; result.reason = "gap_marked_by_human"; }
  if (result.applied) { protocol.review.push(review); saveProtocol(protocol); }
  return { protocol, result };
}

function buildReport(protocol = loadProtocol(), results = []) {
  const candidates = buildCandidates(protocol); const reviews = asArray(protocol.review).filter(review => review?.audit === "audit-65"); const measures = asArray(protocol.measures);
  const approvedChords = measures.reduce((sum, measure) => sum + asArray(measure?.approved_evidence?.chords).filter(item => item?.source === "audit65_human_visual_confirmation").length, 0);
  const approvedLyrics = measures.reduce((sum, measure) => sum + asArray(measure?.approved_evidence?.lyrics).filter(item => item?.source === "audit65_human_visual_confirmation").length, 0);
  const lacunae = measures.reduce((sum, measure) => sum + asArray(measure?.lacunae).filter(item => item?.source === "audit65_human_gap").length, 0);
  return { export_type: "cpp_assisted_musical_review_report", audit: "audit-65.1", generated_at: now(), frontend: { build: AUDIT65_BUILD }, source: { file_name: protocol?.source?.file_name || "", file_type: protocol?.source?.file_type || "", omr_status: protocol?.source?.omr_status || "pending", ocr_status: protocol?.source?.ocr_status || protocol?.ocr?.status || "pending" }, summary: { measures_total: measures.length, candidates_total: candidates.length, chord_candidates: candidates.filter(c => c.kind === "chord").length, lyric_candidates: candidates.filter(c => c.kind === "lyric").length, audit65_reviews: reviews.length, approved_chords_by_human: approvedChords, approved_lyrics_by_human: approvedLyrics, rejected_candidates_by_human: asArray(protocol.rejected_candidates).filter(item => item?.source === "audit65_human_visual_rejection").length, uncertain_candidates_by_human: asArray(protocol.uncertain_candidates).filter(item => item?.source === "audit65_human_uncertain").length, lacunae_marked_by_human: lacunae, actions_applied: results.filter(r => r.applied).length, actions_rejected: results.filter(r => !r.applied).length, exposes_internal_ids_to_user: false, live_preview_available: true }, live_preview: buildLivePreview(protocol), results, safety_contract: { modifies_protocol: true, modification_scope: "human_assisted_musical_review_only", modifies_ocr_raw_text: false, preserves_ocr_raw_text: true, infers_lyrics: false, infers_harmony: false, aligns_ocr_to_measure_without_geometry: false, marks_playable_ready_automatically: false, applies_human_review_without_user_action: false } };
}
function humanReport(report) { return ["MESA DE REVISÃO MUSICAL ASSISTIDA — AUDITORIA 65.1", "", `Arquivo: ${report.source.file_name || "nenhum protocolo salvo"}`, `Build: ${report.frontend.build}`, "", "Resumo:", `- Compassos: ${report.summary.measures_total}`, `- Candidatos totais: ${report.summary.candidates_total}`, `- Cifras candidatas: ${report.summary.chord_candidates}`, `- Textos/letras candidatos: ${report.summary.lyric_candidates}`, `- Revisões audit-65: ${report.summary.audit65_reviews}`, `- Cifras aprovadas por humano: ${report.summary.approved_chords_by_human}`, `- Letras aprovadas por humano: ${report.summary.approved_lyrics_by_human}`, `- IDs técnicos expostos ao usuário: ${report.summary.exposes_internal_ids_to_user ? "sim" : "não"}`, "", "Prévia musical acumulada:", report.live_preview, "", "Contrato:", "- O CPP pergunta em cima do que detectou como provável.", "- A prévia mostra somente o que o humano confirmou.", "- OCR bruto preservado.", "- Sem inferir letra.", "- Sem inferir harmonia.", "- Sem marcar pronto para cifra tocável automaticamente."].join("\n"); }

function populatePanel() {
  const protocol = loadProtocol(); const candidates = buildCandidates(protocol); const measures = getMeasures(protocol); const candidateSelect = byId("audit65CandidateSelect"); const measureSelect = byId("audit65MeasureSelect"); const list = byId("audit65CandidateList");
  if (candidateSelect) candidateSelect.innerHTML = `<option value="">Selecione candidato detectado...</option>` + candidates.map(candidate => `<option value="${esc(candidate.id)}">${esc(candidate.kind === "chord" ? "Cifra" : "Texto/letra")}: ${esc(candidate.text)}</option>`).join("");
  if (measureSelect) measureSelect.innerHTML = `<option value="">Selecione compasso...</option>` + measures.map(measure => `<option value="${esc(measure.id)}">${esc(measure.label)}</option>`).join("");
  if (list) { const top = candidates.slice(0, 120); list.innerHTML = top.map(candidate => `<button type="button" class="ghost audit65-chip" data-candidate-id="${esc(candidate.id)}">${esc(candidate.kind === "chord" ? "🎼" : "📝")} ${esc(candidate.text)}</button>`).join(" "); list.querySelectorAll("button[data-candidate-id]").forEach(button => { button.onclick = () => { if (candidateSelect) candidateSelect.value = button.dataset.candidateId; appendQuestionPreview(); }; }); }
  appendQuestionPreview(); renderLivePreview();
}

function createPanel() {
  if (byId("assistedMusicalReviewAudit65")) return;
  const previous = byId("finalExportPackageAudit60") || byId("playableReleaseAudit59"); const anchor = previous || document.querySelector("main"); if (!anchor) return;
  const section = document.createElement("section"); section.id = "assistedMusicalReviewAudit65"; section.className = "panel active";
  section.innerHTML = `<h2>3O. Mesa de revisão musical assistida</h2><p class="hint">Auditoria 65.1: o CPP pergunta com base no que detectou como provável. Você confirma, rejeita, marca dúvida ou lacuna em linguagem musical; os IDs técnicos ficam escondidos no protocolo.</p><div class="card"><h3>Candidatos detectados</h3><div id="audit65CandidateList" class="toolbar"></div></div><div class="grid2"><label>Candidato OCR detectado<select id="audit65CandidateSelect"></select></label><label>Compasso de destino<select id="audit65MeasureSelect"></select></label><label>Seção/trecho opcional<input id="audit65SectionInput" placeholder="Ex.: Introdução, Coro, Final" /></label><label>Observação humana<input id="audit65NoteInput" placeholder="Ex.: confirmado visualmente no PDF" /></label></div><pre id="audit65QuestionPreview" class="report small-report">Selecione um candidato detectado.</pre><div class="toolbar sticky"><button id="btnAudit65Confirm" class="ok">Confirmar neste compasso</button><button id="btnAudit65Reject" class="warn">Rejeitar candidato</button><button id="btnAudit65Uncertain" class="ghost">Marcar dúvida</button><button id="btnAudit65Gap" class="ghost">Marcar lacuna no compasso</button><button id="btnAudit65Refresh" class="ghost">Atualizar candidatos</button><button id="btnAudit65Export" class="primary">Exportar relatório JSON</button></div><div class="card"><h3>Prévia musical acumulada</h3><pre id="audit65LivePreview" class="output">A prévia aparece aqui conforme você confirma.</pre></div><pre id="audit65Output" class="report small-report">Nenhuma revisão audit-65 aplicada.</pre>`;
  anchor.insertAdjacentElement("afterend", section);
}

function bindButtons() {
  const candidateSelect = byId("audit65CandidateSelect"); const measureSelect = byId("audit65MeasureSelect"); if (candidateSelect) candidateSelect.onchange = appendQuestionPreview; if (measureSelect) measureSelect.onchange = appendQuestionPreview;
  [["btnAudit65Confirm", "confirm_for_measure"], ["btnAudit65Reject", "reject_candidate"], ["btnAudit65Uncertain", "mark_uncertain"], ["btnAudit65Gap", "mark_gap"]].forEach(([id, decision]) => { const button = byId(id); if (!button) return; button.onclick = event => { event.preventDefault(); const { protocol, result } = applyDecision(decision); const report = buildReport(protocol, [result]); const out = byId("audit65Output"); if (out) out.textContent = `${humanReport(report)}\n\nJSON:\n${JSON.stringify(report, null, 2)}`; populatePanel(); renderLivePreview(); }; });
  const refresh = byId("btnAudit65Refresh"); if (refresh) refresh.onclick = event => { event.preventDefault(); populatePanel(); renderLivePreview(); };
  const exp = byId("btnAudit65Export"); if (exp) exp.onclick = event => { event.preventDefault(); const report = buildReport(loadProtocol(), []); const text = JSON.stringify(report, null, 2); const out = byId("audit65Output"); if (out) out.textContent = `${humanReport(report)}\n\nJSON:\n${text}`; const blob = new Blob([text], { type: "application/json;charset=utf-8" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `cpp_mesa_revisao_musical_audit65_${now().replace(/[-:T]/g, "").slice(0, 12)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
}
function markBuild() { window.CPP_ACTIVE_BUILD = AUDIT65_BUILD; const build = byId("frontendBuild"); if (build) build.textContent = `Frontend build: ${AUDIT65_BUILD}`; }
function initAudit65AssistedMusicalReviewDesk() { markBuild(); createPanel(); populatePanel(); bindButtons(); renderLivePreview(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAudit65AssistedMusicalReviewDesk); else initAudit65AssistedMusicalReviewDesk();
