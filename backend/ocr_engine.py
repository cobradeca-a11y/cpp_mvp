from __future__ import annotations

import os
from pathlib import Path
from typing import Any

OCR_STATUSES = {"pending", "unavailable", "success", "failed", "not_applicable"}
IMAGE_TYPES = {"png", "jpg", "jpeg", "webp"}


def build_ocr_block(status: str, engine: str = "", warnings: list[str] | None = None) -> dict[str, Any]:
    normalized_status = status if status in OCR_STATUSES else "failed"
    return {
        "status": normalized_status,
        "engine": engine,
        "text_blocks": [],
        "possible_chords": [],
        "possible_lyrics": [],
        "warnings": warnings or [],
    }


def get_ocr_contract_for_input(source: Path, file_type: str, configured_engine: str = "") -> dict[str, Any]:
    normalized_type = file_type.lower()
    normalized_engine = configured_engine.strip().lower()

    if normalized_type in {"musicxml", "xml", "mxl"}:
        return build_ocr_block(
            status="not_applicable",
            engine="",
            warnings=["OCR não aplicável para entrada MusicXML/MXL nesta auditoria."],
        )

    if normalized_type not in {"pdf", *IMAGE_TYPES}:
        return build_ocr_block(
            status="pending",
            engine=normalized_engine,
            warnings=[f"Tipo de entrada não mapeado para OCR: {source.suffix or normalized_type}."],
        )

    if not normalized_engine:
        return build_ocr_block(
            status="unavailable",
            engine="",
            warnings=["OCR não configurado neste ambiente; execução pendente."],
        )

    if normalized_engine != "google_vision":
        return build_ocr_block(
            status="unavailable",
            engine=normalized_engine,
            warnings=[f"Engine OCR '{normalized_engine}' não suportada nesta auditoria."],
        )

    return run_google_vision_ocr(source, normalized_type)


def run_google_vision_ocr(source: Path, normalized_type: str) -> dict[str, Any]:
    if normalized_type == "pdf":
        return build_ocr_block(
            status="unavailable",
            engine="google_vision",
            warnings=[
                "Google Vision OCR para PDF local exige conversão página→imagem ou fluxo GCS; ainda não executado nesta auditoria."
            ],
        )

    feature = os.getenv("OCR_FEATURE", "DOCUMENT_TEXT_DETECTION").strip().upper() or "DOCUMENT_TEXT_DETECTION"
    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()

    if not credentials_path:
        return build_ocr_block(
            status="unavailable",
            engine="google_vision",
            warnings=["GOOGLE_APPLICATION_CREDENTIALS não definido para Google Vision OCR."],
        )

    if not Path(credentials_path).exists():
        return build_ocr_block(
            status="unavailable",
            engine="google_vision",
            warnings=[f"Arquivo de credenciais Google não encontrado: {credentials_path}"],
        )

    try:
        text_blocks = _run_google_vision_image(source, feature)
    except ImportError:
        return build_ocr_block(
            status="unavailable",
            engine="google_vision",
            warnings=["Dependência google-cloud-vision não instalada no ambiente."],
        )
    except Exception as exc:  # pragma: no cover - erro externo da API
        return build_ocr_block(
            status="failed",
            engine="google_vision",
            warnings=[f"Falha ao executar Google Vision OCR: {exc}"],
        )

    block = build_ocr_block(status="success", engine="google_vision")
    block["text_blocks"] = text_blocks
    return block


def _run_google_vision_image(source: Path, feature: str) -> list[dict[str, Any]]:
    from google.cloud import vision

    client = vision.ImageAnnotatorClient()
    image = vision.Image(content=source.read_bytes())

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
        vertices = []
        for vertex in getattr(annotation.bounding_poly, "vertices", []) or []:
            vertices.append({"x": int(getattr(vertex, "x", 0) or 0), "y": int(getattr(vertex, "y", 0) or 0)})

        text_blocks.append(
            {
                "text": annotation.description,
                "confidence": 0.0,
                "bbox": {"vertices": vertices},
                "page": 1,
                "source": "ocr",
            }
        )

    return text_blocks
