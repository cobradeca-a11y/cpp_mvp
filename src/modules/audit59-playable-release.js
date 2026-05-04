const AUDIT59_BUILD = "audit-59-cache-v1";
const STORAGE_KEY = "cpp_professional_omr_protocol_v1";

function byId(id) { return document.getElementById(id); }
function asArray(value) { return Array.isArray(value) ? value : []; }
function safeJsonParse(raw, fallback = {}) { try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
function loadProtocol() { return safeJsonParse(localStorage.getItem(STORAGE_KEY), {}); }
function saveProtocol(protocol) { localStorage.setItem(STORAGE_KEY, JSON.stringify(protocol || {})); }
function uid(prefix) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`; }

function measureId(measure, index) { return measure?.measure_id || measure?.id || `m${String(index + 1).padStart(3, "0")}`; }
function findMeasure(protocol, id) { return asArray(protocol.measures).find((measure, index) => String(measureId(measure, index)) === String(id) || String(measure?.number ?? measure?.measure_number) === String(id)); }

function measureHasApprovedEvidence(measure) {
  const chords = asArray(measure?.approved_evidence?.chords);
  const lyrics = asArray(measure?.approved_evidence?.lyrics);
  const lacunae = asArray(measure?.lacunae).filter(gap => !gap?.resolved);
  return { approved_chords: chords.length, approved_lyrics: lyrics.length, unresolved_lacunae: lacunae.length };
}

function buildTemplate(protocol = loadProtocol()) {
  const measures = asArray(protocol.measures).map((measure, index) => {
    const evidence = measureHasApprovedEvidence(measure);
    return {
      measure_id: measureId(measure, index),
      number: measure?.number ?? measure?.measure_number ?? index + 1,
      review_status: measure?.review_status || "pending",
      geometry_status: measure?.geometry?.status || "pending",
      approved_chords: evidence.approved_chords,
      approved_lyrics: evidence.approved_lyrics,
      unresolved_lacunae: evidence.unresolved_lacunae,
      playable_release_status: measure?.playable_release?.status || "not_released"
    };
  });
  return JSON.stringify({
    instructions: "Edite actions[] somente para compassos revisados. Esta auditoria não aprova cifra/letra; apenas registra liberação final explícita para cifra tocável.",
    allowed_actions: ["release_measure_for_playable", "block_measure_playable", "revoke_playable_release"],
    measures,
    actions: [
      { action: "block_measure_playable", measure_id: measures[0]?.measure_id || "m001", reason: "pendente de revisão humana suficiente" }
    ]
  }, null, 2);
}

function applyAction(protocol, action) {
  const kind = String(action?.action || "").trim();
  const measure = findMeasure(protocol, action?.measure_id);
  const result = { action: kind, measure_id: action?.measure_id || null, applied: false, reason: "" };
  const allowed = ["release_measure_for_playable", "block_measure_playable", "revoke_playable_release"];
  if (!allowed.includes(kind)) { result.reason = "unsupported_action"; return result; }
  if (!measure) { result.reason = "measure_not_found"; return result; }

  const evidence = measureHasApprovedEvidence(measure);
  const now = new Date().toISOString();
  const releaseId = uid("playable_release");
  const review = {
    id: uid("rev"),
    timestamp: now,
    audit: "audit-59",
    type: "playable_release_review",
    source: "human_review",
    measure_id: measure.measure_id || measure.id || action.measure_id,
    measure_number: measure.number ?? measure.measure_number ?? null,
    decision: kind,
    reason: action?.reason || "",
    evidence_snapshot: evidence,
    effects: {
      modifies_protocol: true,
      modifies_ocr_raw_text: false,
      infers_lyrics: false,
      infers_harmony: false,
      aligns_ocr_to_measure_without_geometry: false,
      marks_playable_ready_automatically: false,
      applies_human_review_without_user_action: false
    }
  };

  if (kind === "release_measure_for_playable") {
    if (!action?.explicit_confirmation) {
      result.reason = "missing_explicit_confirmation";
      return result;
    }
    measure.playable_release = {
      id: releaseId,
      status: "released_for_playable",
      source: "human_final_release",
      audit: "audit-59",
      released_at: now,
      reason: action?.reason || "liberação humana explícita",
      evidence_snapshot: evidence,
      review_required: false,
      automatic: false
    };
    review.release_id = releaseId;
    result.applied = true;
    result.reason = "released_by_explicit_human_confirmation";
  }

  if (kind === "block_measure_playable") {
    measure.playable_release = {
      id: releaseId,
      status: "blocked_for_playable",
      source: "human_final_release",
      audit: "audit-59",
      blocked_at: now,
      reason: action?.reason || "bloqueado por revisão humana",
      evidence_snapshot: evidence,
      review_required: true,
      automatic: false
    };
    review.release_id = releaseId;
    result.applied = true;
    result.reason = "blocked_by_human_review";
  }

  if (kind === "revoke_playable_release") {
    measure.playable_release = {
      id: releaseId,
      status: "revoked_playable_release",
      source: "human_final_release",
      audit: "audit-59",
      revoked_at: now,
      reason: action?.reason || "liberação revogada por revisão humana",
      evidence_snapshot: evidence,
      review_required: true,
      automatic: false
    };
    review.release_id = releaseId;
    result.applied = true;
    result.reason = "release_revoked_by_human_review";
  }

  protocol.review ||= [];
  protocol.review.push(review);
  return result;
}

function applyPlayableRelease() {
  const protocol = loadProtocol();
  const raw = byId("playableReleaseInput")?.value || "";
  const parsed = safeJsonParse(raw, null);
  const actions = Array.isArray(parsed) ? parsed : asArray(parsed?.actions || (parsed ? [parsed] : []));
  protocol.playable_release_contract ||= {};
  protocol.playable_release_contract.audit_59 = { version: "audit-59", applied_at: new Date().toISOString(), rule: "Playable release requires explicit human action. No automatic promotion." };
  const results = actions.map(action => applyAction(protocol, action));
  saveProtocol(protocol);
  return buildReport(protocol, results, true);
}

function buildReport(protocol = loadProtocol(), results = [], saved = false) {
  const measures = asArray(protocol.measures);
  const reviews = asArray(protocol.review).filter(item => item?.audit === "audit-59");
  const source = protocol.source || {};
  return {
    export_type: "cpp_playable_release_report",
    audit: "audit-59",
    generated_at: new Date().toISOString(),
    frontend: { build: AUDIT59_BUILD },
    source: { file_name: source.file_name || "", file_type: source.file_type || "", omr_status: source.omr_status || "pending", ocr_status: source.ocr_status || protocol?.ocr?.status || "pending" },
    summary: {
      protocol_saved: saved,
      measures_total: measures.length,
      audit59_reviews: reviews.length,
      released_for_playable: measures.filter(m => m?.playable_release?.status === "released_for_playable").length,
      blocked_for_playable: measures.filter(m => m?.playable_release?.status === "blocked_for_playable").length,
      revoked_playable_release: measures.filter(m => m?.playable_release?.status === "revoked_playable_release").length,
      actions_applied: results.filter(item => item.applied).length,
      actions_rejected: results.filter(item => !item.applied).length,
      automatic_releases: measures.filter(m => m?.playable_release?.automatic === true).length
    },
    results,
    safety_contract: {
      modifies_protocol: true,
      modification_scope: "human_playable_release_only",
      modifies_ocr_raw_text: false,
      infers_lyrics: false,
      infers_harmony: false,
      aligns_ocr_to_measure_without_geometry: false,
      marks_playable_ready_automatically: false,
      applies_human_review_without_user_action: false
    }
  };
}

function humanReport(report) {
  return [
    "MODO PRONTO PARA CIFRA TOCÁVEL — AUDITORIA 59", "",
    `Arquivo: ${report.source.file_name || "nenhum protocolo salvo"}`,
    `Build: ${report.frontend.build}`,
    `Protocolo salvo: ${report.summary.protocol_saved ? "sim" : "não"}`, "",
    "Resumo:",
    `- Compassos: ${report.summary.measures_total}`,
    `- Revisões audit-59: ${report.summary.audit59_reviews}`,
    `- Liberados para cifra tocável: ${report.summary.released_for_playable}`,
    `- Bloqueados para cifra tocável: ${report.summary.blocked_for_playable}`,
    `- Liberações revogadas: ${report.summary.revoked_playable_release}`,
    `- Ações aplicadas: ${report.summary.actions_applied}`,
    `- Ações rejeitadas: ${report.summary.actions_rejected}`,
    `- Liberações automáticas: ${report.summary.automatic_releases}`, "",
    "Contrato:",
    "- Somente liberação humana explícita.",
    "- Não promove cifra detectada para tocável automaticamente.",
    "- Não altera OCR bruto.",
    "- Não infere letra.",
    "- Não infere harmonia.",
    "- Não associa OCR a compasso sem confirmação."
  ].join("\n");
}

function downloadText(filename, text, mime = "application/json;charset=utf-8") { const blob = new Blob([text], { type: mime }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
function timestamp() { return new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12); }

function createPanel() {
  if (byId("playableReleaseAudit59")) return;
  const previous = byId("measureEvidenceReviewAudit585");
  const anchor = previous || document.querySelector("main");
  if (!anchor) return;
  const section = document.createElement("section");
  section.id = "playableReleaseAudit59";
  section.className = "panel active";
  section.innerHTML = `<h2>3M. Pronto para cifra tocável</h2><p class="hint">Auditoria 59: libera, bloqueia ou revoga prontidão tocável somente por decisão humana explícita. Não promove evidências automaticamente.</p><div class="toolbar sticky"><button id="btnPlayableReleaseTemplate" class="ghost">Gerar template</button><button id="btnApplyPlayableRelease" class="primary">Aplicar liberação/bloqueio</button><button id="btnExportPlayableRelease" class="ghost">Exportar relatório JSON</button></div><textarea id="playableReleaseInput" class="report" style="width:100%;min-height:220px" placeholder='Cole JSON manual com actions[]'></textarea><pre id="playableReleaseOutput" class="report small-report">Liberação tocável ainda não aplicada.</pre>`;
  anchor.insertAdjacentElement("afterend", section);
}

function bindButtons() {
  const template = byId("btnPlayableReleaseTemplate");
  const apply = byId("btnApplyPlayableRelease");
  const exp = byId("btnExportPlayableRelease");
  if (template) template.onclick = event => { event.preventDefault(); const input = byId("playableReleaseInput"); if (input) input.value = buildTemplate(loadProtocol()); };
  if (apply) apply.onclick = event => { event.preventDefault(); const report = applyPlayableRelease(); const out = byId("playableReleaseOutput"); if (out) out.textContent = `${humanReport(report)}\n\nJSON:\n${JSON.stringify(report, null, 2)}`; };
  if (exp) exp.onclick = event => { event.preventDefault(); const report = buildReport(loadProtocol(), [], false); const text = JSON.stringify(report, null, 2); const out = byId("playableReleaseOutput"); if (out) out.textContent = `${humanReport(report)}\n\nJSON:\n${text}`; downloadText(`cpp_pronto_cifra_tocavel_audit59_${timestamp()}.json`, text); };
}

function markBuild() { window.CPP_ACTIVE_BUILD = AUDIT59_BUILD; const build = byId("frontendBuild"); if (build) build.textContent = `Frontend build: ${AUDIT59_BUILD}`; }
function initAudit59PlayableRelease() { markBuild(); createPanel(); bindButtons(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAudit59PlayableRelease); else initAudit59PlayableRelease();
