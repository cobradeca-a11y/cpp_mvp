from __future__ import annotations

import re
import unicodedata
from collections import Counter
from statistics import median
from typing import Any

CHORD_RE = re.compile(
    r"^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?\d*(?:\([^)]*\))?(?:/[A-G](?:#|b)?)?$"
)
CHORD_ANALYSIS_RE = re.compile(
    r"^(?P<root>[A-G])(?P<accidental>#|b)?"
    r"(?P<quality>maj|min|dim|aug|sus|add|m)?"
    r"(?P<extension>\d*)"
    r"(?P<alterations>\([^)]*\))?"
    r"(?:/(?P<bass_root>[A-G])(?P<bass_accidental>#|b)?)?$"
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

    Audit 29 adds structured analysis for possible chord OCR candidates while
    preserving raw OCR text. It does not infer harmony, complete missing chords,
    or align text to systems/measures.
    """
    ocr = protocol.get("ocr") or {}
    source = protocol.get("source") or {}
    systems = protocol.get("systems") or []
    measures = protocol.get("measures") or []
    text_blocks = ocr.get("text_blocks") if isinstance(ocr.get("text_blocks"), list) else []

    fusion = {
        "status": "not_applicable",
        "engine": "initial_musicxml_ocr_fusion",
        "version": "audit-29",
        "inputs": {
            "omr_status": source.get("omr_status", ""),
            "ocr_status": ocr.get("status", source.get("ocr_status", "")),
            "systems_count": len(systems),
            "measures_count": len(measures),
            "text_blocks_count": len(text_blocks),
        },
        "text_blocks_index": [],
        "text_line_groups": [],
        "text_region_groups": [],
        "classification_counts": {},
        "region_counts": {},
        "normalization_counts": {},
        "chord_candidate_counts": {},
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
    normalization_counts: Counter[str] = Counter()
    chord_candidate_counts: Counter[str] = Counter()

    for idx, block in enumerate(text_blocks, start=1):
        text = str(block.get("text", "")).strip()
        if not text:
            continue

        classification = classify_ocr_text(text)
        normalized = normalize_ocr_evidence(text, classification)
        chord_analysis = analyze_chord_candidate(normalized["normalized_text"]) if classification == "possible_chord" else None
        classification_counts[classification] += 1
        normalization_counts[normalized["normalization_status"]] += 1
        if chord_analysis:
            chord_candidate_counts[chord_analysis["pattern_status"]] += 1
        fusion_id = f"fx{idx:04d}"
        indexed = {
            "fusion_id": fusion_id,
            "text": text,
            "normalized_text": normalized["normalized_text"],
            "normalization_status": normalized["normalization_status"],
            "normalization_notes": normalized["normalization_notes"],
            "classification": classification,
            "bbox": block.get("bbox", {}),
            "page": block.get("page", 1),
            "source": "ocr",
            "assignment": pending_assignment(),
        }
        if chord_analysis:
            indexed["chord_analysis"] = chord_analysis
        fusion["text_blocks_index"].append(indexed)

        candidate = {
            "fusion_id": fusion_id,
            "text": text,
            "normalized_text": normalized["normalized_text"],
            "bbox": block.get("bbox", {}),
            "page": block.get("page", 1),
            "assignment_status": "unassigned_no_musicxml_layout",
        }
        if chord_analysis:
            candidate["chord_analysis"] = chord_analysis
        if classification == "possible_chord":
            fusion["possible_chords"].append(candidate)
        elif classification in {"possible_lyric", "lyric_syllable_fragment"}:
            fusion["possible_lyrics"].append(candidate)
        elif classification == "possible_navigation":
            fusion["possible_navigation"].append(candidate)

    fusion["classification_counts"] = dict(sorted(classification_counts.items()))
    fusion["normalization_counts"] = dict(sorted(normalization_counts.items()))
    fusion["chord_candidate_counts"] = dict(sorted(chord_candidate_counts.items()))
    fusion["text_line_groups"] = group_ocr_blocks_by_visual_line(fusion["text_blocks_index"])
    fusion["text_region_groups"] = group_text_lines_by_functional_region(fusion["text_line_groups"])
    fusion["region_counts"] = count_regions(fusion["text_region_groups"])
    return fusion


def sync_initial_fusion(protocol: dict[str, Any]) -> dict[str, Any]:
    protocol["fusion"] = build_initial_fusion(protocol)
    return protocol


def pending_assignment() -> dict[str, Any]:
    return {
        "system_id": None,
        "measure_id": None,
        "status": "unassigned_no_musicxml_layout",
    }


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


def normalize_ocr_evidence(text: str, classification: str) -> dict[str, Any]:
    raw = text.strip()
    normalized = unicodedata.normalize("NFC", raw)
    normalized = normalize_quotes_and_dashes(normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    notes = []

    if normalized != raw:
        notes.append("unicode_or_spacing_normalized")

    if classification == "lyric_hyphen_or_continuation":
        return {
            "normalized_text": "-",
            "normalization_status": "continuation_token",
            "normalization_notes": notes + ["treated_as_lyric_continuation_marker"],
        }

    if classification == "punctuation":
        return {
            "normalized_text": normalized,
            "normalization_status": "punctuation_preserved",
            "normalization_notes": notes + ["punctuation_not_used_as_text"],
        }

    if classification == "music_symbol_noise":
        return {
            "normalized_text": normalized,
            "normalization_status": "noise_preserved",
            "normalization_notes": notes + ["symbol_noise_not_used_as_text"],
        }

    lyric_probe = strip_outer_punctuation(normalized)
    if classification in {"possible_lyric", "lyric_syllable_fragment"} or is_likely_normalized_lyric_candidate(lyric_probe):
        lyric_text = normalize_german_sharp_s(lyric_probe)
        if lyric_text != normalized:
            notes.append("lyric_text_cleaned")
        return {
            "normalized_text": lyric_text,
            "normalization_status": "normalized_text_candidate" if lyric_text else "empty_after_normalization",
            "normalization_notes": notes,
        }

    if classification == "possible_chord":
        chord_text = compact_token(normalized)
        if chord_text != normalized:
            notes.append("chord_spacing_compacted")
        return {
            "normalized_text": chord_text,
            "normalization_status": "normalized_chord_candidate",
            "normalization_notes": notes,
        }

    if classification in {"instrument_label", "editorial_text", "possible_navigation"}:
        return {
            "normalized_text": normalized,
            "normalization_status": "normalized_metadata_candidate",
            "normalization_notes": notes,
        }

    return {
        "normalized_text": normalized,
        "normalization_status": "preserved_unclassified",
        "normalization_notes": notes,
    }


def analyze_chord_candidate(text: str) -> dict[str, Any]:
    normalized = compact_token(text)
    match = CHORD_ANALYSIS_RE.match(normalized)
    if not match:
        return {
            "pattern_status": "unparsed_chord_candidate",
            "normalized_chord": normalized,
            "root": None,
            "accidental": None,
            "quality": None,
            "extension": None,
            "alterations": None,
            "bass": None,
            "has_slash_bass": False,
            "confidence": "low",
            "notes": ["regex_classified_but_structure_not_parsed"],
        }

    data = match.groupdict()
    bass = None
    if data.get("bass_root"):
        bass = f"{data['bass_root']}{data.get('bass_accidental') or ''}"

    has_quality = bool(data.get("quality"))
    has_extension = bool(data.get("extension"))
    has_alterations = bool(data.get("alterations"))
    has_slash = bool(bass)
    if has_slash:
        pattern_status = "slash_bass_chord_candidate"
    elif has_alterations:
        pattern_status = "altered_or_added_tone_chord_candidate"
    elif has_quality or has_extension:
        pattern_status = "qualified_chord_candidate"
    else:
        pattern_status = "root_only_chord_candidate"

    return {
        "pattern_status": pattern_status,
        "normalized_chord": normalized,
        "root": data.get("root"),
        "accidental": data.get("accidental"),
        "quality": data.get("quality"),
        "extension": data.get("extension") or None,
        "alterations": data.get("alterations"),
        "bass": bass,
        "has_slash_bass": has_slash,
        "confidence": "conservative",
        "notes": ["ocr_chord_candidate_only_no_harmonic_inference"],
    }


def is_likely_normalized_lyric_candidate(text: str) -> bool:
    cleaned = normalize_token(text)
    if cleaned in SHORT_LYRIC_WORDS:
        return True
    return is_likely_lyric_word(text, cleaned) or is_likely_lyric_fragment(text, cleaned)


def normalize_quotes_and_dashes(text: str) -> str:
    return (
        text.replace("–", "-")
        .replace("—", "-")
        .replace("−", "-")
        .replace("’", "'")
        .replace("‘", "'")
        .replace("“", '"')
        .replace("”", '"')
    )


def strip_outer_punctuation(text: str) -> str:
    return text.strip().strip(".,;:!?()[]{}")


def normalize_german_sharp_s(text: str) -> str:
    return text.replace("ẞ", "ß")


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


def group_ocr_blocks_by_visual_line(indexed_blocks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    blocks_with_bounds = []
    for block in indexed_blocks:
        bounds = bbox_bounds(block.get("bbox", {}))
        if bounds is None:
            continue
        x_min, y_min, x_max, y_max = bounds
        height = max(1.0, y_max - y_min)
        blocks_with_bounds.append({
            "block": block,
            "bounds": bounds,
            "center_y": (y_min + y_max) / 2,
            "height": height,
            "page": block.get("page", 1),
        })

    if not blocks_with_bounds:
        return []

    median_height = median(item["height"] for item in blocks_with_bounds)
    y_tolerance = max(6.0, median_height * 0.65)
    grouped: list[dict[str, Any]] = []

    for item in sorted(blocks_with_bounds, key=lambda row: (row["page"], row["center_y"], row["bounds"][0])):
        target = None
        for group in grouped:
            if group["page"] != item["page"]:
                continue
            if abs(group["center_y"] - item["center_y"]) <= y_tolerance:
                target = group
                break

        if target is None:
            target = {"page": item["page"], "center_y": item["center_y"], "items": []}
            grouped.append(target)

        target["items"].append(item)
        target["center_y"] = sum(row["center_y"] for row in target["items"]) / len(target["items"])

    line_groups = []
    for line_idx, group in enumerate(sorted(grouped, key=lambda row: (row["page"], row["center_y"])), start=1):
        items = sorted(group["items"], key=lambda row: row["bounds"][0])
        text_blocks = [item["block"] for item in items]
        bounds = merge_bounds([item["bounds"] for item in items])
        classifications = Counter(block["classification"] for block in text_blocks)
        page = group["page"]
        line_groups.append({
            "line_id": f"fl{line_idx:04d}",
            "page": page,
            "text": " ".join(block["text"] for block in text_blocks).strip(),
            "normalized_text": join_normalized_text(text_blocks),
            "text_block_ids": [block["fusion_id"] for block in text_blocks],
            "classifications": dict(sorted(classifications.items())),
            "bbox": bounds_to_bbox(bounds),
            "assignment": pending_assignment(),
        })

    return line_groups


def join_normalized_text(text_blocks: list[dict[str, Any]]) -> str:
    values = []
    for block in text_blocks:
        normalized = str(block.get("normalized_text", "")).strip()
        if normalized:
            values.append(normalized)
    return " ".join(values).strip()


def group_text_lines_by_functional_region(text_line_groups: list[dict[str, Any]]) -> list[dict[str, Any]]:
    region_groups = []
    for idx, line in enumerate(text_line_groups, start=1):
        region = classify_text_line_region(line)
        region_groups.append({
            "region_id": f"fr{idx:04d}",
            "region_type": region["region_type"],
            "confidence": region["confidence"],
            "reason": region["reason"],
            "page": line.get("page", 1),
            "line_ids": [line["line_id"]],
            "text": line.get("text", ""),
            "normalized_text": line.get("normalized_text", ""),
            "classifications": line.get("classifications", {}),
            "bbox": line.get("bbox", {}),
            "assignment": pending_assignment(),
        })
    return region_groups


def classify_text_line_region(line: dict[str, Any]) -> dict[str, str]:
    classifications = line.get("classifications", {}) or {}
    text = str(line.get("text", "")).strip()
    total = sum(int(value) for value in classifications.values()) or 1

    instrument_score = classifications.get("instrument_label", 0) / total
    lyric_score = (classifications.get("possible_lyric", 0) + classifications.get("lyric_syllable_fragment", 0)) / total
    chord_score = classifications.get("possible_chord", 0) / total
    editorial_score = (classifications.get("editorial_text", 0) + classifications.get("possible_navigation", 0)) / total
    noise_score = (
        classifications.get("punctuation", 0)
        + classifications.get("music_symbol_noise", 0)
        + classifications.get("lyric_hyphen_or_continuation", 0)
    ) / total

    if instrument_score >= 0.5:
        return {"region_type": "instrument_region", "confidence": "conservative", "reason": "predominant_instrument_labels"}
    if chord_score >= 0.5:
        return {"region_type": "chord_region", "confidence": "conservative", "reason": "predominant_possible_chords"}
    if lyric_score >= 0.5:
        return {"region_type": "lyric_region", "confidence": "conservative", "reason": "predominant_lyric_text_or_fragments"}
    if editorial_score >= 0.5:
        return {"region_type": "editorial_region", "confidence": "conservative", "reason": "predominant_editorial_or_navigation_text"}
    if noise_score >= 0.5:
        return {"region_type": "noise_region", "confidence": "conservative", "reason": "predominant_punctuation_or_noise"}
    if text:
        return {"region_type": "unknown_text_region", "confidence": "low", "reason": "mixed_or_insufficient_evidence"}
    return {"region_type": "unknown_region", "confidence": "low", "reason": "empty_or_unclassified_line"}


def count_regions(region_groups: list[dict[str, Any]]) -> dict[str, int]:
    return dict(sorted(Counter(region["region_type"] for region in region_groups).items()))


def bbox_bounds(bbox: Any) -> tuple[float, float, float, float] | None:
    if not isinstance(bbox, dict):
        return None

    if isinstance(bbox.get("vertices"), list):
        points = bbox["vertices"]
        xs = [point.get("x") for point in points if isinstance(point, dict) and point.get("x") is not None]
        ys = [point.get("y") for point in points if isinstance(point, dict) and point.get("y") is not None]
        if xs and ys:
            return float(min(xs)), float(min(ys)), float(max(xs)), float(max(ys))

    keys = {"x", "y", "width", "height"}
    if keys.issubset(bbox):
        x = float(bbox["x"])
        y = float(bbox["y"])
        return x, y, x + float(bbox["width"]), y + float(bbox["height"])

    alt_keys = {"x_min", "y_min", "x_max", "y_max"}
    if alt_keys.issubset(bbox):
        return float(bbox["x_min"]), float(bbox["y_min"]), float(bbox["x_max"]), float(bbox["y_max"])

    return None


def merge_bounds(bounds_list: list[tuple[float, float, float, float]]) -> tuple[float, float, float, float]:
    return (
        min(bounds[0] for bounds in bounds_list),
        min(bounds[1] for bounds in bounds_list),
        max(bounds[2] for bounds in bounds_list),
        max(bounds[3] for bounds in bounds_list),
    )


def bounds_to_bbox(bounds: tuple[float, float, float, float]) -> dict[str, float]:
    x_min, y_min, x_max, y_max = bounds
    return {
        "x_min": x_min,
        "y_min": y_min,
        "x_max": x_max,
        "y_max": y_max,
        "width": x_max - x_min,
        "height": y_max - y_min,
    }
