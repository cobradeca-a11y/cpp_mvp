from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from musicxml_parser import parse_musicxml_to_cpp

APP_NAME = "CPP Professional OMR Backend"
AUDIVERIS_CMD = os.getenv("AUDIVERIS_CMD", "audiveris")

app = FastAPI(title=APP_NAME, version="professional-omr-1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "app": APP_NAME,
        "audiveris_cmd": AUDIVERIS_CMD,
        "audiveris_available": audiveris_available(),
    }


@app.post("/api/omr/analyze")
async def analyze_omr(file: UploadFile = File(...)) -> JSONResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Arquivo sem nome.")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".xml", ".musicxml", ".mxl"}:
        raise HTTPException(status_code=400, detail="Formato não aceito. Use PDF, imagem ou MusicXML/MXL.")

    with tempfile.TemporaryDirectory(prefix="cpp_omr_") as tmp:
        tmpdir = Path(tmp)
        source = tmpdir / sanitize_filename(file.filename)
        source.write_bytes(await file.read())

        if suffix in {".xml", ".musicxml", ".mxl"}:
            protocol = parse_musicxml_to_cpp(source, source_name=file.filename)
            return JSONResponse(normalize_professional_protocol(protocol, file.filename, file_type="musicxml", omr_status="musicxml_parsed"))

        if not audiveris_available():
            return JSONResponse(make_base_protocol(
                filename=file.filename,
                file_type=suffix.replace(".", ""),
                omr_status="unavailable",
                message="Audiveris não está disponível neste ambiente. Instale/configure AUDIVERIS_CMD para executar OMR profissional."
            ))

        musicxml = run_audiveris(source, tmpdir)
        if not musicxml or not musicxml.exists():
            return JSONResponse(make_base_protocol(
                filename=file.filename,
                file_type=suffix.replace(".", ""),
                omr_status="failed",
                message="Audiveris executou, mas não gerou MusicXML/MXL identificável."
            ))

        protocol = parse_musicxml_to_cpp(musicxml, source_name=file.filename)
        return JSONResponse(normalize_professional_protocol(
            protocol,
            file.filename,
            file_type=suffix.replace(".", ""),
            omr_status="success"
        ))


def audiveris_available() -> bool:
    return shutil.which(AUDIVERIS_CMD) is not None or Path(AUDIVERIS_CMD).exists()


def run_audiveris(source: Path, workdir: Path) -> Path | None:
    output_dir = workdir / "out"
    output_dir.mkdir(parents=True, exist_ok=True)

    commands = [
        [AUDIVERIS_CMD, "-batch", "-export", "-output", str(output_dir), str(source)],
        [AUDIVERIS_CMD, "-batch", "-export", str(source)],
    ]

    last_error = ""
    for cmd in commands:
        try:
            subprocess.run(cmd, cwd=str(workdir), check=True, capture_output=True, text=True, timeout=180)
            found = find_musicxml(workdir)
            if found:
                return found
        except subprocess.CalledProcessError as exc:
            last_error = (exc.stderr or exc.stdout or str(exc))[-4000:]
        except subprocess.TimeoutExpired as exc:
            last_error = f"Audiveris timeout: {exc}"

    (workdir / "audiveris_error.txt").write_text(last_error, encoding="utf-8")
    return None


def find_musicxml(root: Path) -> Path | None:
    candidates: list[Path] = []
    for pattern in ("*.musicxml", "*.xml", "*.mxl"):
        candidates.extend(root.rglob(pattern))
    if not candidates:
        return None
    candidates.sort(key=lambda p: p.stat().st_size if p.exists() else 0, reverse=True)
    return candidates[0]


def sanitize_filename(name: str) -> str:
    safe = "".join(ch for ch in name if ch.isalnum() or ch in ".-_ ").strip()
    return safe or "upload.pdf"


def make_base_protocol(filename: str, file_type: str = "", omr_status: str = "pending", message: str = "") -> dict[str, Any]:
    return {
        "cpp_version": "professional-omr-1.0",
        "source": {
            "file_name": filename,
            "file_type": file_type or Path(filename).suffix.replace(".", ""),
            "pages": 0,
            "omr_status": omr_status,
            "omr_engine": "Audiveris",
            "ocr_status": "pending",
            "ocr_engine": "",
            "validation_status": "pending",
            "message": message,
        },
        "music": {
            "title": Path(filename).stem,
            "key": "",
            "meter_default": "",
            "tempo": "",
            "composer": "",
            "arranger": "",
        },
        "pages": [],
        "systems": [],
        "measures": [],
        "navigation": {"visual_markers": [], "execution_order": [], "status": "needs_review"},
        "validation": {"validation_status": "pending", "overall_confidence": 0, "issues": []},
        "review": [],
        "outputs": {
            "technical_chord_sheet": "",
            "playable_chord_sheet": "",
            "uncertainty_report": "",
            "detection_report": "",
        },
    }


def normalize_professional_protocol(protocol: dict[str, Any], filename: str, file_type: str, omr_status: str) -> dict[str, Any]:
    base = make_base_protocol(filename=filename, file_type=file_type, omr_status=omr_status)
    merged = {**base, **(protocol or {})}
    merged["cpp_version"] = "professional-omr-1.0"
    merged["source"] = {**base["source"], **(protocol.get("source", {}) if protocol else {})}
    merged["source"]["file_name"] = filename
    merged["source"]["file_type"] = file_type
    merged["source"]["omr_status"] = omr_status
    merged["source"].setdefault("ocr_status", "pending")
    merged["source"].setdefault("ocr_engine", "")
    merged["source"].setdefault("validation_status", "pending")
    merged["music"] = {**base["music"], **(protocol.get("music", {}) if protocol else {})}
    merged["navigation"] = {**base["navigation"], **(protocol.get("navigation", {}) if protocol else {})}
    merged["validation"] = {**base["validation"], **(protocol.get("validation", {}) if protocol else {})}
    merged["outputs"] = {**base["outputs"], **(protocol.get("outputs", {}) if protocol else {})}
    merged.setdefault("pages", [])
    merged.setdefault("systems", [])
    merged.setdefault("measures", [])
    merged.setdefault("review", [])
    return merged
