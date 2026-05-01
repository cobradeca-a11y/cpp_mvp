export function systemFeedback(protocol, systemId) {
  const system = protocol.systems.find(s => s.system_id === systemId);
  if (!system) return "Nenhum sistema selecionado.";
  const s = system.detected_summary || {};
  const lines = [`Sistema ${system.number} analisado.`, ""];
  lines.push("Detectado:");
  if (s.meter) lines.push(`- Fórmula: ${s.meter}`);
  if (s.key_signature) lines.push(`- Armadura/Tom: ${s.key_signature}`);
  if (s.tempo) lines.push(`- Andamento: ${s.tempo}`);
  lines.push(`- Compassos encontrados: ${s.measure_count || protocol.measures.filter(m => m.system_id === systemId).length}`);
  if (s.chords?.length) lines.push(`- Acordes encontrados: ${[...new Set(s.chords)].join(", ")}`);
  if (s.lyrics?.length) lines.push(`- Texto/sílabas encontrados: ${s.lyrics.slice(0, 20).join(" ")}`);
  if (s.navigation?.length) lines.push(`- Navegação encontrada: ${[...new Set(s.navigation)].join(", ")}`);
  lines.push("");
  const pend = protocol.measures.filter(m => m.system_id === systemId && (m.review_required || m.confidence !== "certo"));
  lines.push("Pendências:");
  if (!pend.length) lines.push("- Nenhuma pendência crítica.");
  for (const m of pend) lines.push(`- Compasso ${m.number}: ${m.confidence}`);
  if (s.warnings?.length) s.warnings.forEach(w => lines.push(`- ${w}`));
  return lines.join("\n");
}

export function measureFeedback(measure) {
  if (!measure) return "Nenhum compasso aberto.";
  const d = measure.detected_elements || {};
  const lines = [`[Compasso ${measure.number}]`, `Status: ${measure.confidence || "provável"}`, `Compasso: ${measure.meter}${measure.is_anacrusis ? " / anacruse provável" : ""}`, ""];
  if (d.chords?.length) lines.push(`Acordes detectados: ${d.chords.map(x => x.value).join(", ")}`);
  if (d.syllables?.length) lines.push(`Sílabas/texto detectados: ${d.syllables.map(x => x.value).join(" ")}`);
  if (d.note_heads?.length) lines.push(`Cabeças de nota detectadas: ${d.note_heads.length}`);
  if (d.rests?.length) lines.push(`Pausas detectadas: ${d.rests.length}`);
  if (d.navigation?.length) lines.push(`Navegação detectada: ${d.navigation.map(x => x.value).join(", ")}`);
  if (d.special_cases?.length) lines.push(`Casos especiais: ${d.special_cases.join(", ")}`);
  if (measure.alignments?.length) lines.push(`Alinhamentos: ${measure.alignments.length}`);
  if (measure.alignment_warnings?.length) {
    lines.push("");
    lines.push("Observações:");
    measure.alignment_warnings.forEach(w => lines.push(`- ${w.message || w.type}`));
  }
  lines.push("");
  lines.push("Ações: Aceitar leitura / Editar leitura / Marcar incerto / Próximo compasso.");
  return lines.join("\n");
}

export function detectionReport(protocol) {
  const lines = ["RELATÓRIO DE DETECÇÃO", ""];
  for (const s of protocol.systems) {
    lines.push(systemFeedback(protocol, s.system_id), "");
  }
  return lines.join("\n");
}
