from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import Any

OCR_ENGINE_CMD = os.getenv("OCR_ENGINE_CMD", "").strip().strip('"')
OCR_SUPPORTED_FILE_TYPES = {"pdf", "png", "jpg", "jpeg", "webp"}
OCR_NOT_APPLICABLE_FILE_TYPES = {"xml", "musicxml", "mxl"}


def create_empty_ocr_contract(status: str = "pending", engine: str = "") -> dict[str, Any]:
    return {
        "status": status,
        "engine": engine,
        "text_blocks": [],
        "possible_chords": [],
        "possible_lyrics": [],
        "warnings": [],
    }


def build_ocr_contract(source_path: str | Path | None = None, source_name: str = "", file_type: str = "") -> dict[str, Any]:
    """Return an explicit OCR evidence contract without faking OCR results.

    Audit 21 deliberately creates the OCR layer contract only. It must not:
    - invent text blocks;
    - infer chords or lyrics by heuristics;
    - merge OCR with MusicXML;
    - mutate measures, meter, key, notes, rests or review state.

    A future audit may connect a real OCR provider here. Until then, this
    function reports whether OCR is not applicable or unavailable.
    """
    normalized_type = normalize_file_type(file_type or suffix_to_file_type(source_name))

    if normalized_type in OCR_NOT_APPLICABLE_FILE_TYPES:
        contract = create_empty_ocr_contract(status="not_applicable", engine="")
        contract["warnings"].append("OCR não aplicável para entrada MusicXML/MXL direta nesta etapa.")
        return contract

    if normalized_type not in OCR_SUPPORTED_FILE_TYPES:
        contract = create_empty_ocr_contract(status="not_applicable", engine="")
        contract["warnings"].append(f"OCR não aplicável para o tipo de arquivo: {normalized_type or 'desconhecido'}.")
        return contract

    if not OCR_ENGINE_CMD:
        contract = create_empty_ocr_contract(status="unavailable", engine="")
        contract["warnings"].append("OCR_ENGINE_CMD não configurado. OCR real ainda não foi executado.")
        return contract

    if not ocr_engine_available(OCR_ENGINE_CMD):
        contract = create_empty_ocr_contract(status="unavailable", engine=OCR_ENGINE_CMD)
        contract["warnings"].append("OCR_ENGINE_CMD configurado, mas o executável não está disponível neste ambiente.")
        return contract

    contract = create_empty_ocr_contract(status="pending", engine=OCR_ENGINE_CMD)
    contract["warnings"].append("Motor OCR disponível, mas execução real e fusão serão implementadas em auditoria posterior.")
    return contract


def sync_ocr_contract(protocol: dict[str, Any], ocr_contract: dict[str, Any]) -> dict[str, Any]:
    contract = normalize_ocr_contract(ocr_contract)
    protocol["ocr"] = contract
    protocol.setdefault("source", {})
    protocol["source"]["ocr_status"] = contract["status"]
    protocol["source"]["ocr_engine"] = contract["engine"]
    return protocol


def normalize_ocr_contract(ocr_contract: dict[str, Any] | None) -> dict[str, Any]:
    base = create_empty_ocr_contract()
    if not ocr_contract:
        return base
    merged = {**base, **ocr_contract}
    for key in ["text_blocks", "possible_chords", "possible_lyrics", "warnings"]:
        if not isinstance(merged.get(key), list):
            merged[key] = []
    merged["status"] = str(merged.get("status") or "pending")
    merged["engine"] = str(merged.get("engine") or "")
    return merged


def ocr_engine_available(command: str) -> bool:
    if not command:
        return False
    return shutil.which(command) is not None or Path(command).exists()


def suffix_to_file_type(source_name: str = "") -> str:
    suffix = Path(source_name).suffix.lower().replace(".", "")
    return normalize_file_type(suffix)


def normalize_file_type(file_type: str = "") -> str:
    cleaned = (file_type or "").lower().replace(".", "").strip()
    if cleaned == "xml":
        return "musicxml"
    return cleaned
