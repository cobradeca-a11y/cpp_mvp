from __future__ import annotations

import os
from pathlib import Path
from typing import Any

OCR_SUPPORTED_FILE_TYPES = {"pdf", "png", "jpg", "jpeg", "webp"}
OCR_IMAGE_FILE_TYPES = {"png", "jpg", "jpeg", "webp"}
OCR_NOT_APPLICABLE_FILE_TYPES = {"xml", "musicxml", "mxl"}
GOOGLE_VISION_ENGINE = "google_vision"


def configured_ocr_engine_cmd() -> str:
    # Auditoria 22: OCR_ENGINE is the public configuration name.
    # OCR_ENGINE_CMD remains accepted for backward compatibility with Audit 21.
    return (os.getenv("OCR_ENGINE") or os.getenv("OCR_ENGINE_CMD") or "").strip().strip('"')


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

    Audit 22.1 supports Google Vision through either:
    - GOOGLE_APPLICATION_CREDENTIALS JSON when available; or
    - Application Default Credentials from `gcloud auth application-default login`.

    It must not merge OCR with MusicXML or mutate measures, meter, key,
    notes, rests, navigation or review state.
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

    ocr_engine = normalize_engine_name(configured_ocr_engine_cmd())
    if not ocr_engine:
        contract = create_empty_ocr_contract(status="unavailable", engine="")
        contract["warnings"].append("OCR_ENGINE não configurado. OCR real ainda não foi executado.")
        return contract

    if ocr_engine != GOOGLE_VISION_ENGINE:
        contract = create_empty_ocr_contract(status="unavailable", engine=ocr_engine)
        contract["warnings"].append(f"Motor OCR '{ocr_engine}' não suportado nesta auditoria.")
        return contract

    if normalized_type == "pdf":
        contract = create_empty_ocr_contract(status="unavailable", engine=GOOGLE_VISION_ENGINE)
        contract["warnings"].append(
            "Google Vision OCR para PDF local exige conversão página→imagem ou fluxo GCS; ainda não executado nesta auditoria."
        )
        return contract

    if normalized_type in OCR_IMAGE_FILE_TYPES:
        return run_google_vision_image_ocr(Path(source_path) if source_path else None)

    contract = create_empty_ocr_contract(status="unavailable", engine=GOOGLE_VISION_ENGINE)
    contract["warnings"].append(f"Tipo de arquivo não suportado pelo Google Vision nesta auditoria: {normalized_type}.")
    return contract


def run_google_vision_image_ocr(source_path: Path | None) -> dict[str, Any]:
    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip().strip('"')

    if credentials_path and not Path(credentials_path).exists():
        contract = create_empty_ocr_contract(status="unavailable", engine=GOOGLE_VISION_ENGINE)
        contract["warnings"].append(f"Arquivo de credenciais Google não encontrado: {credentials_path}")
        return contract

    if source_path is None or not source_path.exists():
        contract = create_empty_ocr_contract(status="failed", engine=GOOGLE_VISION_ENGINE)
        contract["warnings"].append("Arquivo de entrada OCR não encontrado.")
        return contract

    try:
        text_blocks = _run_google_vision_image(source_path, configured_ocr_feature())
    except ImportError:
        contract = create_empty_ocr_contract(status="unavailable", engine=GOOGLE_VISION_ENGINE)
        contract["warnings"].append("Dependência google-cloud-vision não instalada no ambiente.")
        return contract
    except Exception as exc:  # pragma: no cover - external API/runtime path
        contract = create_empty_ocr_contract(status="failed", engine=GOOGLE_VISION_ENGINE)
        contract["warnings"].append(
            "Falha ao executar Google Vision OCR. Verifique GOOGLE_APPLICATION_CREDENTIALS ou rode "
            "`gcloud auth application-default login` para usar ADC local. Detalhe: "
            f"{exc}"
        )
        return contract

    contract = create_empty_ocr_contract(status="success", engine=GOOGLE_VISION_ENGINE)
    contract["text_blocks"] = text_blocks
    if not text_blocks:
        contract["warnings"].append("Google Vision executou, mas não retornou blocos de texto.")
    if not credentials_path:
        contract["warnings"].append("Google Vision executado via Application Default Credentials local.")
    return contract


def _run_google_vision_image(source_path: Path, feature: str) -> list[dict[str, Any]]:
    from google.cloud import vision

    client = vision.ImageAnnotatorClient()
    image = vision.Image(content=source_path.read_bytes())

    if feature == "TEXT_DETECTION":
        response = client.text_detection(image=image)
    else:
        response = client.document_text_detection(image=image)

    if response.error.message:
        raise RuntimeError(response.error.message)

    annotations = getattr(response, "text_annotations", None) or []
    text_blocks: list[dict[str, Any]] = []

    for idx, annotation in enumerate(annotations):
        if idx == 0:
            continue
        text = getattr(annotation, "description", "") or ""
        if not text.strip():
            continue

        vertices = []
        for vertex in getattr(annotation.bounding_poly, "vertices", []) or []:
            vertices.append({"x": int(getattr(vertex, "x", 0) or 0), "y": int(getattr(vertex, "y", 0) or 0)})

        text_blocks.append(
            {
                "text": text,
                "confidence": 0.0,
                "bbox": {"vertices": vertices},
                "page": 1,
                "source": "ocr",
            }
        )

    return text_blocks


def configured_ocr_feature() -> str:
    feature = os.getenv("OCR_FEATURE", "DOCUMENT_TEXT_DETECTION").strip().upper()
    return "TEXT_DETECTION" if feature == "TEXT_DETECTION" else "DOCUMENT_TEXT_DETECTION"


def normalize_engine_name(value: str) -> str:
    return value.strip().strip('"').lower().replace("-", "_")


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


def suffix_to_file_type(source_name: str = "") -> str:
    suffix = Path(source_name).suffix.lower().replace(".", "")
    return normalize_file_type(suffix)


def normalize_file_type(file_type: str = "") -> str:
    cleaned = (file_type or "").lower().replace(".", "").strip()
    if cleaned == "xml":
        return "musicxml"
    return cleaned
