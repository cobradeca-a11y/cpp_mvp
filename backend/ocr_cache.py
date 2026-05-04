from __future__ import annotations

import copy
import hashlib
import json
import os
from pathlib import Path
from typing import Any

OCR_CACHE_VERSION = "audit-46"
DEFAULT_CACHE_DIR = Path(".cpp_ocr_cache")


def ocr_cache_enabled() -> bool:
    return os.getenv("CPP_OCR_CACHE", "1").strip().lower() not in {"0", "false", "no", "off"}


def ocr_cache_dir() -> Path:
    configured = os.getenv("CPP_OCR_CACHE_DIR", "").strip().strip('"')
    return Path(configured) if configured else DEFAULT_CACHE_DIR


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def file_sha256(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def cache_key_for_image(path: Path, engine: str, feature: str, page: int | None = None) -> str:
    parts = [OCR_CACHE_VERSION, engine, feature, file_sha256(path)]
    if page is not None:
      parts.append(f"page-{page}")
    return sha256_bytes("|".join(parts).encode("utf-8"))


def cache_path_for_key(cache_key: str) -> Path:
    return ocr_cache_dir() / f"{cache_key}.json"


def read_ocr_cache(cache_key: str) -> dict[str, Any] | None:
    if not ocr_cache_enabled():
        return None
    path = cache_path_for_key(cache_key)
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    if payload.get("cache_version") != OCR_CACHE_VERSION:
        return None
    return payload


def write_ocr_cache(cache_key: str, text_blocks: list[dict[str, Any]], metadata: dict[str, Any] | None = None) -> None:
    if not ocr_cache_enabled():
        return
    path = cache_path_for_key(cache_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "cache_version": OCR_CACHE_VERSION,
        "cache_key": cache_key,
        "metadata": metadata or {},
        "text_blocks": copy.deepcopy(text_blocks),
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def cached_text_blocks(cache_key: str) -> list[dict[str, Any]] | None:
    payload = read_ocr_cache(cache_key)
    if not payload:
        return None
    blocks = payload.get("text_blocks")
    if not isinstance(blocks, list):
        return None
    return copy.deepcopy(blocks)
