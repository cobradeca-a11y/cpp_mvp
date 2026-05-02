export function timeGridForMeter(meter = "3/4") {
  if (meter === "2/4") return ["1", "e", "2", "e"];
  if (meter === "4/4") return ["1", "e", "2", "e", "3", "e", "4", "e"];
  if (meter === "6/8") return ["1", "la", "li", "2", "la", "li"];
  return ["1", "e", "2", "e", "3", "e"];
}

export function beatFromX(x, measureWidth, meter = "3/4") {
  const grid = timeGridForMeter(meter);
  if (!measureWidth || measureWidth <= 0) return grid[0];
  const idx = Math.max(0, Math.min(grid.length - 1, Math.round((x / measureWidth) * (grid.length - 1))));
  return grid[idx];
}

export function normalizeChord(text = "") {
  return String(text).trim()
    .replaceAll("‹", "m")
    .replaceAll("©", "#")
    .replaceAll("¨", "b")
    .replaceAll("♯", "#")
    .replaceAll("♭", "b")
    .replaceAll("º", "°")
    .replaceAll("o", "°")
    .replaceAll("ø", "m7(b5)")
    .replaceAll("Œ„Š", "maj")
    .replaceAll("„ˆˆ", "add")
    .replaceAll("M7", "maj7")
    .replaceAll("7M", "maj7")
    .replaceAll("–", "-")
    .replace(/\s+/g, "");
}

export function isChordSymbol(text = "") {
  const t = normalizeChord(text);
  if (!t || t.length > 28) return false;

  // Raiz + acidente opcional + qualidade/extensões/alterações + baixo opcional.
  // Aceita: D, Bm, Em7(add11), A7/G, D/F#, C/D, Dm7(b5)/Ab, Gsus4, C°7, F#dim.
  const root = "[A-G](?:#|b)?";
  const qual = "(?:m|min|maj|dim|aug|sus|add|°)?";
  const ext = "(?:maj)?\\d*";
  const parens = "(?:\\([^)]{1,12}\\))*";
  const tail = "(?:(?:sus|add|dim|aug|maj|min|m)?\\d*)*";
  const bass = `(?:/${root})?`;
  const re = new RegExp(`^${root}${qual}${ext}${tail}${parens}${bass}$`);
  return re.test(t);
}

export function isNavigationText(text = "") {
  const t = String(text).trim();
  return /\b(D\.?\s*S\.?|D\.?\s*C\.?|Coda|Fine|Segno|Al\s*Coda|To\s*Coda|Da\s*Capo|Dal\s*Segno)\b/i.test(t);
}

export function normalizeNavigation(text = "") {
  const t = String(text).trim().replace(/\s+/g, " ");
  if (/D\.?\s*S\.?/i.test(t)) return "D.S.";
  if (/D\.?\s*C\.?/i.test(t)) return "D.C.";
  if (/Al\s*Coda|To\s*Coda/i.test(t)) return "Al Coda";
  if (/Coda/i.test(t)) return "Coda";
  if (/Fine/i.test(t)) return "Fine";
  if (/Segno/i.test(t)) return "Segno";
  return t;
}

export function looksLikeLyric(text = "") {
  const t = String(text).trim();
  if (!t) return false;
  if (isChordSymbol(t) || isNavigationText(t)) return false;
  if (/^\d+$/.test(t)) return false;
  if (/^[#b♯♭n]+$/.test(t)) return false;
  if (/^[().,;:!?-]+$/.test(t)) return false;
  return /[A-Za-zÀ-ÿ]/.test(t);
}

export function splitLyricText(text = "") {
  // Mantém sílabas simples, hifens musicais e elisões.
  return String(text)
    .replace(/[–—]/g, "-")
    .split(/\s+/)
    .flatMap(part => {
      if (!part) return [];
      if (part.includes("_")) return [part];
      const raw = part.split(/(-)/).filter(Boolean);
      const out = [];
      for (let i = 0; i < raw.length; i++) {
        if (raw[i] === "-") continue;
        const nextIsHyphen = raw[i+1] === "-";
        out.push(nextIsHyphen ? raw[i] + "-" : raw[i]);
      }
      return out.length ? out : [part];
    })
    .filter(Boolean);
}

export function confidenceRank(c) {
  return { "certo": 0, "provável": 1, "incerto": 2, "ilegível": 3 }[c] ?? 1;
}

export function worstConfidence(values) {
  if (!values.length) return "provável";
  return values.sort((a,b) => confidenceRank(b)-confidenceRank(a))[0];
}

export function confidenceFromDistance(px, measureWidth) {
  const r = Math.abs(px) / Math.max(1, measureWidth);
  if (r <= 0.045) return "certo";
  if (r <= 0.12) return "provável";
  return "incerto";
}
