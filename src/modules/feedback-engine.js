import { musicalConfidenceReport } from "./confidence-engine.js";

function pendingReason(measure) {
  const reviewStatus = measure.review_status || "pending";
  const confidence = measure.confidence || "provável";

  if (["incerto", "ilegível"].includes(confidence)) {
    return `revisão por baixa confiança (${confidence})`;
  }

  if (reviewStatus === "needs_fix") {
    return "revisão obrigatória marcada pelo usuário";
  }

  if (reviewStatus === "approved" && measure.review_required !== true) {
    return "";
  }

  if (reviewStatus === "pending") {
    return `revisão pendente (${confidence})`;
  }

  if (measure.review_required === true) {
    return `revisão necessária (${confidence})`;
  }

  return "";
}

function classificationCountsLines(fusion) {
  const counts = fusion.classification_counts || {};
  const entries = Object.entries(counts).filter(([, value]) => Number(value) > 0);

  if (!entries.length) {
    return ["- Classificações OCR/Fusion: nenhuma categoria registrada."];
  }

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

  const lines = ["- Classificações OCR/Fusion:"];
  entries.forEach(([key, value]) => {
    lines.push(`  - ${labels[key] || key}: ${value}`);
  });
  return lines;
}

function fusionSummary(protocol) {
  const fusion = protocol.fusion || {};
  const ocr = protocol.ocr || {};
  const lines = [];

  lines.push("Evidências OCR/Fusion:");
  lines.push(`- Status OCR: ${ocr.status || protocol.source?.ocr_status || "pending"}`);
  lines.push(`- Motor OCR: ${ocr.engine || protocol.source?.ocr_engine || "não configurado"}`);
  lines.push(`- Blocos OCR: ${ocr.text_blocks?.length || 0}`);

  if (fusion.engine) {
    lines.push(`- Status Fusion: ${fusion.status || "pending"}`);
    lines.push(`- Motor Fusion: ${fusion.engine}`);
    lines.push(`- Versão Fusion: ${fusion.version || "não informada"}`);
    lines.push(`- Blocos indexados: ${fusion.text_blocks_index?.length || 0}`);
    lines.push(`- Cifras candidatas: ${fusion.possible_chords?.length || 0}`);
    lines.push(`- Textos/letras candidatos: ${fusion.possible_lyrics?.length || 0}`);
    lines.push(`- Navegação candidata: ${fusion.possible_navigation?.length || 0}`);
    lines.push(...classificationCountsLines(fusion));
  } else {
    lines.push("- Fusion: ainda não disponível no protocolo.");
  }

  if (fusion.warnings?.length) fusion.warnings.forEach(w => lines.push(`- Aviso Fusion: ${w}`));
  if (ocr.warnings?.length) ocr.warnings.forEach(w => lines.push(`- Aviso OCR: ${w}`));

  return lines;
}

export function systemFeedback(protocol, systemId) {
  const system = protocol.systems.find(s => s.system_id === systemId);
  if (!system) return "Nenhum sistema selecionado/importado.";

  const s = system.detected_summary || {};
  const fusion = protocol.fusion || {};
  const hasFusion = Boolean(fusion.engine);
  const lines = [
    `Sistema ${system.number || system.system_id} importado.`,
    `Status: ${system.status || "musicxml_imported"}`,
    ""
  ];

  lines.push("Evidências estruturais:");
  if (s.meter) lines.push(`- Fórmula de compasso: ${s.meter} (MusicXML)`);
  if (s.key_signature) lines.push(`- Armadura/Tom: ${s.key_signature} (MusicXML)`);
  if (s.tempo) lines.push(`- Andamento: ${s.tempo}`);
  lines.push(`- Compassos importados: ${s.measure_count || protocol.measures.filter(m => m.system_id === systemId).length}`);

  if (s.chords?.length) lines.push(`- Cifras/acordes: ${[...new Set(s.chords)].join(", ")}`);
  if (s.lyrics?.length) lines.push(`- Texto/letra: ${s.lyrics.slice(0, 35).join(" ")}`);
  if (s.navigation?.length) lines.push(`- Navegação registrada: ${[...new Set(s.navigation)].join(", ")}`);

  if (!s.chords?.length && !s.lyrics?.length && !s.navigation?.length) {
    if (hasFusion) {
      lines.push("- Nenhum texto/cifra foi atribuído a compassos ainda. OCR/Fusion já indexou evidências, mas o alinhamento por compasso permanece pendente.");
    } else {
      lines.push("- Nenhum texto/cifra complementar registrado ainda. OCR/fusão ainda não executados.");
    }
  }

  lines.push("");
  lines.push(...fusionSummary(protocol));

  lines.push("");
  const measures = protocol.measures.filter(m => m.system_id === systemId).sort((a, b) => a.number - b.number);
  lines.push("Resumo por compasso:");
  for (const m of measures) {
    const d = m.detected_elements || {};
    const parts = [];
    if (d.chords?.length) parts.push(`acordes ${d.chords.map(x => x.value).join("/")}`);
    if (d.syllables?.length) parts.push(`texto ${d.syllables.map(x => x.value).join(" ")}`);
    if (d.note_heads?.length) parts.push(`${d.note_heads.length} nota(s) importada(s)`);
    if (d.rests?.length) parts.push(`${d.rests.length} pausa(s) importada(s)`);
    if (d.navigation?.length) parts.push(`nav ${d.navigation.map(x => x.value).join("/")}`);
    lines.push(`- Compasso ${m.number}: ${m.confidence || "provável"}${parts.length ? " — " + parts.join("; ") : ""}`);
  }

  lines.push("");
  lines.push("Pendências:");
  const pend = measures
    .map(m => ({ measure: m, reason: pendingReason(m) }))
    .filter(item => item.reason);

  if (!pend.length) lines.push("- Nenhuma pendência crítica registrada.");
  for (const item of pend) {
    lines.push(`- Compasso ${item.measure.number}: ${item.reason}`);
  }
  if (hasFusion && fusion.status === "evidence_indexed_needs_layout_mapping") {
    lines.push("- Fusion: relacionar blocos OCR a sistema/compasso ainda exige geometria MusicXML/layout confiável.");
  }
  if (s.warnings?.length) s.warnings.forEach(w => lines.push(`- ${w}`));

  return lines.join("\n");
}

export function measureFeedback(measure) {
  if (!measure) return "Nenhum compasso importado.";

  const d = measure.detected_elements || {};
  const lines = [
    `[Compasso ${measure.number}]`,
    `Status: ${measure.confidence || "provável"}`,
    `Revisão: ${measure.review_status || "pending"}`,
    `Origem: ${measure.source || "musicxml"}`,
    `Compasso: ${measure.meter}${measure.is_anacrusis ? " / anacruse" : ""}`,
    ""
  ];

  if (d.chords?.length) lines.push(`Acordes/cifras registrados: ${d.chords.map(x => `${x.value}(${x.source || "musicxml/ocr"})`).join(", ")}`);
  if (d.syllables?.length) lines.push(`Texto/letra registrado: ${d.syllables.map(x => x.value).join(" ")}`);
  if (d.note_heads?.length) lines.push(`Notas importadas do MusicXML: ${d.note_heads.length}`);
  if (d.rests?.length) lines.push(`Pausas importadas do MusicXML: ${d.rests.length}`);
  if (d.navigation?.length) lines.push(`Navegação registrada: ${d.navigation.map(x => x.value).join(", ")}`);
  if (d.special_cases?.length) lines.push(`Casos especiais: ${d.special_cases.join(", ")}`);

  if (!d.chords?.length && !d.syllables?.length && !d.note_heads?.length && !d.rests?.length && !d.navigation?.length) {
    lines.push("Nenhuma evidência estrutural registrada neste compasso.");
  }

  if (measure.alignments?.length) {
    lines.push("");
    lines.push("Relações registradas:");
    measure.alignments.forEach(a => lines.push(`- ${a.alignment_type} | beat ${a.beat || ""} | ${a.confidence || "provável"} | ${a.source || "musicxml/fusion"}`));
  }

  if (measure.alignment_warnings?.length) {
    lines.push("");
    lines.push("Pendências/observações:");
    measure.alignment_warnings.forEach(w => lines.push(`- ${w.message || w.type}`));
  }

  lines.push("");
  lines.push("Ações disponíveis: Aceitar leitura / Marcar incerto / Próximo compasso.");
  return lines.join("\n");
}

export function detectionReport(protocol) {
  const lines = ["RELATÓRIO DE DETECÇÃO E IMPORTAÇÃO", ""];
  lines.push(`Motor OMR: ${protocol.source?.omr_engine || "Audiveris"}`);
  lines.push(`Status OMR: ${protocol.source?.omr_status || "pending"}`);
  lines.push(`Motor OCR: ${protocol.source?.ocr_engine || protocol.ocr?.engine || "não configurado"}`);
  lines.push(`Status OCR: ${protocol.source?.ocr_status || protocol.ocr?.status || "pending"}`);
  lines.push(`Status Fusion: ${protocol.fusion?.status || "not_available"}`);
  lines.push(`Versão Fusion: ${protocol.fusion?.version || "não informada"}`);
  lines.push(`Validação: ${protocol.source?.validation_status || protocol.validation?.validation_status || "pending"}`);
  lines.push("");

  for (const s of protocol.systems || []) {
    lines.push(systemFeedback(protocol, s.system_id), "");
  }

  if (!protocol.systems?.length) {
    lines.push("Nenhum sistema importado ainda.");
    lines.push("");
    lines.push(...fusionSummary(protocol));
  }

  lines.push("");
  lines.push(musicalConfidenceReport(protocol));

  return lines.join("\n");
}
