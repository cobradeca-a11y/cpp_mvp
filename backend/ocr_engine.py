from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any

from ocr_cache import cache_key_for_image, cached_text_blocks, write_ocr_cache

OCR_SUPPORTED_FILE_TYPES = {"pdf", "png", "jpg", "jpeg", "webp"}
OCR_IMAGE_FILE_TYPES = {"png", "jpg", "jpeg", "webp"}
OCR_NOT_APPLICABLE_FILE_TYPES = {"xml", "musicxml", "mxl"}
GOOGLE_VISION_ENGINE = "google_vision"
PDF_CONVERSION_DPI = 220


def configured_ocr_engine_cmd() -> str:
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

    Audit 46 adds OCR cache by image/page hash. Cached OCR is reused only when
    the exact image/page content and OCR settings match. Cached blocks are not
    modified except for the already explicit page normalization in PDF flow.
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
        return run_google_vision_pdf_ocr(Path(source_path) if source_path else None)

    if normalized_type in OCR_IMAGE_FILE_TYPES:
        return run_google_vision_image_ocr(Path(source_path) if source_path else None)

    contract = create_empty_ocr_contract(status="unavailable", engine=GOOGLE_VISION_ENGINE)
    contract["warnings"].append(f"Tipo de arquivo não suportado pelo Google Vision nesta auditoria: {normalized_type}.")
    return contract


def run_google_vision_image_ocr(source_path: Path | None) -> dict[str, Any]:
    credentials_error = validate_google_credentials()
    if credentials_error:
        return credentials_error

    if source_path is None or not source_path.exists():
        contract = create_empty_ocr_contract(status="failed", engine=GOOGLE_VISION_ENGINE)
        contract["warnings"].append("Arquivo de entrada OCR não encontrado.")
        return contract

    feature = configured_ocr_feature()
    cache_key = cache_key_for_image(source_path, GOOGLE_VISION_ENGINE, feature)
    cached = cached_text_blocks(cache_key)
    if cached is not None:
        contract = create_empty_ocr_contract(status="success", engine=GOOGLE_VISION_ENGINE)
        contract["text_blocks"] = normalize_ocr_pages(cached, default_page=1)
        contract["warnings"].append("OCR carregado do cache audit-46 por hash de imagem.")
        return contract

    try:
        text_blocks = _run_google_vision_image(source_path, feature)
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

    text_blocks = normalize_ocr_pages(text_blocks, default_page=1)
    write_ocr_cache(cache_key, text_blocks, {"engine": GOOGLE_VISION_ENGINE, "feature": feature, "page": 1})

    contract = create_empty_ocr_contract(status="success", engine=GOOGLE_VISION_ENGINE)
    contract["text_blocks"] = text_blocks
    if not text_blocks:
        contract["warnings"].append("Google Vision executou, mas não retornou blocos de texto.")
    if not os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip().strip('"'):
        contract["warnings"].append("Google Vision executado via Application Default Credentials local.")
    return contract


def run_google_vision_pdf_ocr(source_path: Path | None) -> dict[str, Any]:
    credentials_error = validate_google_credentials()
    if credentials_error:
        return credentials_error

    if source_path is None or not source_path.exists():
        contract = create_empty_ocr_contract(status="failed", engine=GOOGLE_VISION_ENGINE)
        contract["warnings"].append("Arquivo PDF de entrada OCR não encontrado.")
        return contract

    feature = configured_ocr_feature()
    cache_hits = 0
    cache_misses = 0

    try:
        with tempfile.TemporaryDirectory(prefix="cpp_pdf_pages_") as tmp:
            page_images = convert_pdf_to_page_images(source_path, Path(tmp))
            if not page_images:
                contract = create_empty_ocr_contract(status="failed", engine=GOOGLE_VISION_ENGINE)
                contract["warnings"].append("Conversão PDF→imagem não retornou páginas para OCR.")
                return contract

            all_blocks: list[dict[str, Any]] = []
            warnings: list[str] = []
            for page_number, image_path in page_images:
                try:
                    cache_key = cache_key_for_image(image_path, GOOGLE_VISION_ENGINE, feature, page=page_number)
                    cached = cached_text_blocks(cache_key)
                    if cached is not None:
                        cache_hits += 1
                        all_blocks.extend(normalize_ocr_pages(cached, default_page=page_number, force_page=True))
                        continue

                    cache_misses += 1
                    page_blocks = _run_google_vision_image(image_path, feature)
                    page_blocks = normalize_ocr_pages(page_blocks, default_page=page_number, force_page=True)
                    write_ocr_cache(cache_key, page_blocks, {"engine": GOOGLE_VISION_ENGINE, "feature": feature, "page": page_number})
                    all_blocks.extend(page_blocks)
                except Exception as exc:  # pragma: no cover - external API/runtime path
                    warnings.append(f"Falha no OCR da página {page_number}: {exc}")
    except ImportError as exc:
        contract = create_empty_ocr_contract(status="unavailable", engine=GOOGLE_VISION_ENGINE)
        contract["warnings"].append(f"Dependência de conversão PDF→imagem indisponível: {exc}")
        return contract
    except Exception as exc:
        contract = create_empty_ocr_contract(status="failed", engine=GOOGLE_VISION_ENGINE)
        contract["warnings"].append(f"Falha ao converter PDF→imagem para OCR: {exc}")
        return contract

    contract = create_empty_ocr_contract(status="success" if all_blocks else "failed", engine=GOOGLE_VISION_ENGINE)
    contract["text_blocks"] = all_blocks
    contract["warnings"].append("PDF convertido página→imagem para OCR local. Origem de página preservada em cada bloco OCR.")
    contract["warnings"].append(f"Cache OCR audit-46: {cache_hits} hit(s), {cache_misses} miss(es).")
    contract["warnings"].extend(warnings)
    if not all_blocks:
        contract["warnings"].append("Google Vision executou nas páginas convertidas, mas não retornou blocos de texto.")
    if not os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip().strip('"'):
        contract["warnings"].append("Google Vision executado via Application Default Credentials local.")
    return contract


def validate_google_credentials() -> dict[str, Any] | None:
    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip().strip('"')
    if credentials_path and not Path(credentials_path).exists():
        contract = create_empty_ocr_contract(status="unavailable", engine=GOOGLE_VISION_ENGINE)
        contract["warnings"].append(f"Arquivo de credenciais Google não encontrado: {credentials_path}")
        return contract
    return None


def convert_pdf_to_page_images(source_path: Path, output_dir: Path) -> list[tuple[int, Path]]:
    try:
        import fitz  # type: ignore
    except ImportError as exc:  # pragma: no cover - dependency availability path
        raise ImportError("PyMuPDF/fitz não instalado. Instale PyMuPDF para OCR local de PDF.") from exc

    output_dir.mkdir(parents=True, exist_ok=True)
    document = fitz.open(str(source_path))
    page_images: list[tuple[int, Path]] = []
    try:
        for page_index in range(len(document)):
            page = document.load_page(page_index)
            pix = page.get_pixmap(dpi=PDF_CONVERSION_DPI, alpha=False)
            image_path = output_dir / f"page-{page_index + 1:04d}.png"
            pix.save(str(image_path))
            page_images.append((page_index + 1, image_path))
    finally:
        document.close()
    return page_images


def normalize_ocr_pages(text_blocks: list[dict[str, Any]], default_page: int, force_page: bool = False) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for block in text_blocks:
        copied = dict(block)
        copied["page"] = int(default_page if force_page else (copied.get("page") or default_page))
        copied.setdefault("source", "ocr")
        out.append(copied)
    return out


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
