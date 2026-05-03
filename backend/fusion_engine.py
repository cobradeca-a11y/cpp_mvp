from __future__ import annotations

import re
from collections import Counter
from typing import Any

CHORD_RE = re.compile(
    r"^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?\d*(?:\([^)]*\))?(?:/[A-G](?:#|b)?)?$"
)
INSTRUMENT_TERMS = {
    "ob",
    "viol",
    "viola",
    "bc",
    "cemb",
    "vl",
    "vln",
    "vc",
    "fl",
    "sop",
    "alt",
    "ten",
    "bass",
}
NAVIGATION_TERMS = {
    "d.c",
    "dc",
    "d.s",
    "ds",
    "coda",
    "fine",
    "segno",
    "dal",
    "al",
}
EDITORIAL_TERMS = {
    "tr",
    "a2",
    "a 2",
    "solo",
    "tutti",
    "unis",
    "unisono",
}
SHORT_LYRIC_WORDS = {
    "als",
    "die",
    "ein",
    "ist",
    "und",
    "was",
    "der",
    "das",
    "den",
    "dem",
    "des",
    "zu",
    "im",
    "in",
    "am",
    "an",
    "du",
    "er",
    "es",
    "so",
}
PUNCTUATION_TOKENS = {".", ",", ";", ":", "!", "?", "(", ")", "[", "]", "{", "}"}
CONTINUATION_TOKENS = {"-", "–", "—", "_"}
MUSIC_SYMBOL_NOISE_TOKENS = {"។", "·", "•", "*"}


def build_initial_fusion(protocol: dict[str, Any]) -> dict[str, Any]:
    """Build a conservative MusicXML + OCR evidence index.

    Audit 23 does not align text to measures yet because Audiveris/MusicXML
    output currently has no reliable page/system bounding boxes in the CPP
    protocol. The goal is to preserve evidence, classify obvious candidates,
    and mark every spatial assignment as pending instead of inventing matches.
    """
    ocr = protocol.get("ocr") or {}
    source = protocol.get("source") or {}
    systems = protocol.get("systems") or []
    measures = protocol.get("measures") or []
    text_blocks = ocr.get("text_blocks") if isinstance(ocr.get("text_blocks"), list) else []

    fusion = {
        "status": "not_applicable",
        "engine": "initial_musicxml_ocr_fusion",
        "version": "audit-25",
        "inputs": {
            "omr_status": source.get("omr_status", ""),
            "ocr_status": ocr.get("status", source.get("ocr_status", "")),
            "systems_count": len(systems),
            "measures_count": len(measures),
            "text_blocks_count": len(text_blocks),
        },
        "text_blocks_index": [],
        "classification_counts": {},
        "possible_chords": [],
        "possible_lyrics": [],
        "possible_navigation": [],
        "warnings": [],
    }

    if not text_blocks:
        fusion["status"] = "no_ocr_text"
        fusion["warnings"].append("Nenhum bloco OCR disponível para fusão inicial.")
        return fusion

    if not measures:
        fusion["status"] = "ocr_only_no_measures"
        fusion["warnings"].append("OCR possui texto, mas não há compassos MusicXML para relacionar.")
    else:
        fusion["status"] = "evidence_indexed_needs_layout_mapping"
        fusion["warnings"].append(
            "Blocos OCR indexados. Relação com sistema/compasso permanece pendente até existir geometria MusicXML/layout confiável."
        )

    classification_counts: Counter[str] = Counter()

    for idx, block in enumerate(text_blocks, start=1):
        text = str(block.get("text", "")).strip()
        if not text:
            continue

        classification = classify_ocr_text(text)
        classification_counts[classification] += 1
        fusion_id = f"fx{idx:04d}"
        indexed = {
            "fusion_id": fusion_id,
            "text": text,
            "classification": classification,
            "bbox": block.get("bbox", {}),
            "page": block.get("page", 1),
            "source": "ocr",
            "assignment": {
                "system_id": None,
                "measure_id": None,
                "status": "unassigned_no_musicxml_layout",
            },
        }
        fusion["text_blocks_index"].append(indexed)

        candidate = {
            "fusion_id": fusion_id,
            "text": text,
            "bbox": block.get("bbox", {}),
            "page": block.get("page", 1),
            "assignment_status": "unassigned_no_musicxml_layout",
        }
        if classification == "possible_chord":
            fusion["possible_chords"].append(candidate)
        elif classification in {"possible_lyric", "lyric_syllable_fragment"}:
            fusion["possible_lyrics"].append(candidate)
        elif classification == "possible_navigation":
            fusion["possible_navigation"].append(candidate)

    fusion["classification_counts"] = dict(sorted(classification_counts.items()))
    return fusion


def sync_initial_fusion(protocol: dict[str, Any]) -> dict[str, Any]:
    protocol["fusion"] = build_initial_fusion(protocol)
    return protocol


def classify_ocr_text(text: str) -> str:
    raw = text.strip()
    if not raw:
        return "unknown"

    compact = compact_token(raw)

    if raw in PUNCTUATION_TOKENS or compact in PUNCTUATION_TOKENS:
        return "punctuation"

    if raw in CONTINUATION_TOKENS or compact in CONTINUATION_TOKENS:
        return "lyric_hyphen_or_continuation"

    if raw in MUSIC_SYMBOL_NOISE_TOKENS or compact in MUSIC_SYMBOL_NOISE_TOKENS:
        return "music_symbol_noise"

    if is_music_symbol_noise(raw):
        return "music_symbol_noise"

    cleaned = normalize_token(raw)
    if not cleaned:
        return "unknown"

    if is_instrument_label(cleaned):
        return "instrument_label"

    if cleaned in NAVIGATION_TERMS:
        return "possible_navigation"

    if CHORD_RE.match(compact):
        return "possible_chord"

    if is_editorial_text(raw, cleaned, compact):
        return "editorial_text"

    if is_likely_lyric_word(raw, cleaned):
        return "possible_lyric"

    if is_likely_lyric_fragment(raw, cleaned):
        return "lyric_syllable_fragment"

    return "unknown"


def normalize_token(text: str) -> str:
    return text.strip().lower().replace("_", "").strip(".,;:!?()[]{}")


def compact_token(text: str) -> str:
    return re.sub(r"\s+", "", text.strip())


def has_letter(text: str) -> bool:
    return any(ch.isalpha() for ch in text)


def is_unicode_alpha_token(text: str, *, allow_internal_hyphen: bool = False) -> bool:
    if not text:
        return False

    for idx, ch in enumerate(text):
        if ch.isalpha():
            continue
        if allow_internal_hyphen and ch in {"-", "’", "'"} and 0 < idx < len(text) - 1:
            continue
        return False

    return has_letter(text)


def is_instrument_label(cleaned: str) -> bool:
    if cleaned in INSTRUMENT_TERMS:
        return True

    parts = [part for part in cleaned.split(".") if part]
    if parts and all(part in INSTRUMENT_TERMS or part == "u" for part in parts):
        return any(part in INSTRUMENT_TERMS for part in parts)

    if cleaned.startswith("u.") and cleaned[2:] in INSTRUMENT_TERMS:
        return True

    return False


def is_editorial_text(raw: str, cleaned: str, compact: str) -> bool:
    if cleaned in EDITORIAL_TERMS or compact.lower() in {term.replace(" ", "") for term in EDITORIAL_TERMS}:
        return True

    if re.fullmatch(r"\(?\s*a\s*\d+\s*\)?", raw.strip().lower()):
        return True

    if any(ch.isdigit() for ch in raw) and has_letter(raw):
        return True

    return False


def is_likely_lyric_word(raw: str, cleaned: str) -> bool:
    if cleaned in SHORT_LYRIC_WORDS:
        return True

    if not is_unicode_alpha_token(raw, allow_internal_hyphen=True):
        return False

    return len(cleaned) >= 5


def is_likely_lyric_fragment(raw: str, cleaned: str) -> bool:
    if cleaned in SHORT_LYRIC_WORDS:
        return False

    if not is_unicode_alpha_token(raw):
        return False

    return 2 <= len(cleaned) <= 4


def is_music_symbol_noise(raw: str) -> bool:
    if has_letter(raw) or any(ch.isdigit() for ch in raw):
        return False

    return any(not ch.isspace() and ch not in PUNCTUATION_TOKENS and ch not in CONTINUATION_TOKENS for ch in raw)
