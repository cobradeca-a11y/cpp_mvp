from __future__ import annotations

import re
from typing import Any

CHORD_RE = re.compile(r"^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?\d*(?:/[A-G](?:#|b)?)?$")
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
        "version": "audit-23",
        "inputs": {
            "omr_status": source.get("omr_status", ""),
            "ocr_status": ocr.get("status", source.get("ocr_status", "")),
            "systems_count": len(systems),
            "measures_count": len(measures),
            "text_blocks_count": len(text_blocks),
        },
        "text_blocks_index": [],
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

    for idx, block in enumerate(text_blocks, start=1):
        text = str(block.get("text", "")).strip()
        if not text:
            continue

        classification = classify_ocr_text(text)
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
        elif classification == "possible_lyric":
            fusion["possible_lyrics"].append(candidate)
        elif classification == "possible_navigation":
            fusion["possible_navigation"].append(candidate)

    return fusion


def sync_initial_fusion(protocol: dict[str, Any]) -> dict[str, Any]:
    protocol["fusion"] = build_initial_fusion(protocol)
    return protocol


def classify_ocr_text(text: str) -> str:
    cleaned = normalize_token(text)
    if not cleaned:
        return "unknown"

    if cleaned in INSTRUMENT_TERMS or any(part in INSTRUMENT_TERMS for part in cleaned.split(".")):
        return "instrument_label"

    if cleaned in NAVIGATION_TERMS:
        return "possible_navigation"

    compact = text.strip().replace(" ", "")
    if CHORD_RE.match(compact):
        return "possible_chord"

    if has_letter(text) and len(cleaned) > 1:
        return "possible_lyric"

    return "unknown"


def normalize_token(text: str) -> str:
    return text.strip().lower().replace("_", "").strip(".,;:!?()[]{}")


def has_letter(text: str) -> bool:
    return any(ch.isalpha() for ch in text)
