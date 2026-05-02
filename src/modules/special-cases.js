export function addSpecialCase(measure, type, message, severity = "medium") {
  measure.special_cases ||= [];
  measure.special_cases.push({ type, severity, message });
  if (severity !== "low") {
    measure.alignment_warnings ||= [];
    measure.alignment_warnings.push({ type, severity, message });
  }
}

export function registerManualSpecialCase(measure, type) {
  const messages = {
    anacrusis: "Anacruse marcada/revisada.",
    melisma: "Melisma marcado/revisado.",
    elision: "Elisão marcada/revisada.",
    displaced_chord: "Acorde visualmente deslocado.",
    ambiguous_navigation: "Navegação ambígua."
  };
  addSpecialCase(measure, type, messages[type] || type, "medium");
}
