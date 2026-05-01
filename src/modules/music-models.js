export function timeGridForMeter(meter = "3/4") {
  if (meter === "2/4") return ["1", "e", "2", "e"];
  if (meter === "4/4") return ["1", "e", "2", "e", "3", "e", "4", "e"];
  return ["1", "e", "2", "e", "3", "e"];
}

export function beatFromX(x, measureWidth, meter = "3/4") {
  const grid = timeGridForMeter(meter);
  if (!measureWidth || measureWidth <= 0) return grid[0];
  const idx = Math.max(0, Math.min(grid.length - 1, Math.round((x / measureWidth) * (grid.length - 1))));
  return grid[idx];
}

export function isChordSymbol(text = "") {
  const t = String(text).trim()
    .replaceAll("‹", "m")
    .replaceAll("©", "#")
    .replaceAll("¨", "b")
    .replaceAll("Œ„Š", "maj")
    .replaceAll("„ˆˆ", "add");
  if (!t) return false;
  if (t.length > 20) return false;
  return /^[A-G](#|b)?(m|maj|min|dim|aug|sus)?\d*(\([^)]+\))?(add\d+)?(\/[A-G](#|b)?)?$/.test(t)
      || /^[A-G](#|b)?\/[A-G](#|b)?$/.test(t);
}

export function normalizeChord(text = "") {
  return String(text).trim()
    .replaceAll("‹", "m")
    .replaceAll("©", "#")
    .replaceAll("¨", "b")
    .replaceAll("Œ„Š", "maj")
    .replaceAll("„ˆˆ", "add")
    .replaceAll("–", "-");
}

export function isNavigationText(text = "") {
  return /\b(D\.?S\.?|D\.?C\.?|Coda|Fine|Segno|Al\s*Coda|To\s*Coda)\b/i.test(String(text));
}

export function looksLikeLyric(text = "") {
  const t = String(text).trim();
  if (!t) return false;
  if (isChordSymbol(t) || isNavigationText(t)) return false;
  if (/^\d+$/.test(t)) return false;
  return /[A-Za-zÀ-ÿ]/.test(t);
}

export function confidenceRank(c) {
  return { "certo": 0, "provável": 1, "incerto": 2, "ilegível": 3 }[c] ?? 1;
}

export function worstConfidence(values) {
  if (!values.length) return "provável";
  return values.sort((a,b) => confidenceRank(b)-confidenceRank(a))[0];
}
