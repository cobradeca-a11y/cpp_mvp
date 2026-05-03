from __future__ import annotations

from typing import Any

LAYOUT_VERSION = "audit-30"
NO_LAYOUT_STATUS = "unavailable_no_reliable_layout_geometry"
NO_LAYOUT_REASON = "MusicXML/OMR protocol does not provide reliable page or system bounding boxes yet."


def sync_layout_geometry(protocol: dict[str, Any]) -> dict[str, Any]:
    """Attach an explicit page/system geometry contract to the CPP protocol.

    Audit 30 records layout evidence without inventing coordinates. When no
    reliable layout geometry is present, the absence is represented explicitly
    so later audits can distinguish "not available" from "not processed".
    """
    pages = protocol.get("pages") if isinstance(protocol.get("pages"), list) else []
    systems = protocol.get("systems") if isinstance(protocol.get("systems"), list) else []
    source = protocol.get("source") if isinstance(protocol.get("source"), dict) else {}

    if not pages and systems:
        pages = [make_page_geometry_shell("p001", 1, source)]
        protocol["pages"] = pages
    else:
        protocol["pages"] = [normalize_page(page, index + 1, source) for index, page in enumerate(pages)]

    protocol["systems"] = [attach_system_geometry(system, index + 1) for index, system in enumerate(systems)]

    layout_pages = [page_geometry_summary(page, index + 1) for index, page in enumerate(protocol.get("pages", []))]
    layout_systems = [system_geometry_summary(system, index + 1) for index, system in enumerate(protocol.get("systems", []))]

    page_status_counts = count_statuses(layout_pages)
    system_status_counts = count_statuses(layout_systems)

    protocol["layout"] = {
        "engine": "cpp_layout_geometry_contract",
        "version": LAYOUT_VERSION,
        "status": layout_status(layout_pages, layout_systems),
        "page_count": len(layout_pages),
        "system_count": len(layout_systems),
        "page_geometry_status_counts": page_status_counts,
        "system_geometry_status_counts": system_status_counts,
        "pages": layout_pages,
        "systems": layout_systems,
        "warnings": layout_warnings(layout_pages, layout_systems),
    }
    return protocol


def make_page_geometry_shell(page_id: str, number: int, source: dict[str, Any]) -> dict[str, Any]:
    return {
        "page_id": page_id,
        "number": number,
        "source_file": source.get("file_name", ""),
        "geometry": unavailable_geometry("page"),
    }


def normalize_page(page: Any, fallback_number: int, source: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(page, dict):
        return make_page_geometry_shell(f"p{fallback_number:03d}", fallback_number, source)

    page_id = page.get("page_id") or f"p{fallback_number:03d}"
    number = page.get("number") or fallback_number
    normalized = {**page, "page_id": page_id, "number": number}
    geometry = normalized.get("geometry") if isinstance(normalized.get("geometry"), dict) else {}
    normalized["geometry"] = normalize_geometry(geometry, "page")
    return normalized


def attach_system_geometry(system: Any, fallback_number: int) -> dict[str, Any]:
    if not isinstance(system, dict):
        system = {}

    system_id = system.get("system_id") or f"s{fallback_number:03d}"
    page_id = system.get("page_id") or "p001"
    normalized = {**system, "system_id": system_id, "page_id": page_id, "number": system.get("number") or fallback_number}
    geometry = normalized.get("geometry") if isinstance(normalized.get("geometry"), dict) else {}
    normalized["geometry"] = normalize_geometry(geometry, "system")
    return normalized


def normalize_geometry(geometry: dict[str, Any], scope: str) -> dict[str, Any]:
    bbox = geometry.get("bbox")
    if has_valid_bbox(bbox):
        return {
            "scope": scope,
            "status": geometry.get("status") or "available",
            "bbox": bbox,
            "source": geometry.get("source") or "layout",
            "confidence": geometry.get("confidence") or "needs_review",
            "notes": geometry.get("notes") or [],
        }
    return unavailable_geometry(scope)


def unavailable_geometry(scope: str) -> dict[str, Any]:
    return {
        "scope": scope,
        "status": NO_LAYOUT_STATUS,
        "bbox": None,
        "source": "musicxml_or_omr_without_layout_bbox",
        "confidence": "none",
        "notes": [NO_LAYOUT_REASON],
    }


def has_valid_bbox(bbox: Any) -> bool:
    if not isinstance(bbox, dict):
        return False
    keys = {"x_min", "y_min", "x_max", "y_max"}
    if not keys.issubset(bbox):
        return False
    try:
        return float(bbox["x_max"]) > float(bbox["x_min"]) and float(bbox["y_max"]) > float(bbox["y_min"])
    except (TypeError, ValueError):
        return False


def page_geometry_summary(page: dict[str, Any], fallback_number: int) -> dict[str, Any]:
    geometry = page.get("geometry", unavailable_geometry("page"))
    return {
        "page_id": page.get("page_id") or f"p{fallback_number:03d}",
        "number": page.get("number") or fallback_number,
        "geometry_status": geometry.get("status", NO_LAYOUT_STATUS),
        "bbox": geometry.get("bbox"),
        "source": geometry.get("source", ""),
        "confidence": geometry.get("confidence", "none"),
    }


def system_geometry_summary(system: dict[str, Any], fallback_number: int) -> dict[str, Any]:
    geometry = system.get("geometry", unavailable_geometry("system"))
    return {
        "system_id": system.get("system_id") or f"s{fallback_number:03d}",
        "page_id": system.get("page_id") or "p001",
        "number": system.get("number") or fallback_number,
        "geometry_status": geometry.get("status", NO_LAYOUT_STATUS),
        "bbox": geometry.get("bbox"),
        "source": geometry.get("source", ""),
        "confidence": geometry.get("confidence", "none"),
    }


def count_statuses(items: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        status = item.get("geometry_status", NO_LAYOUT_STATUS)
        counts[status] = counts.get(status, 0) + 1
    return dict(sorted(counts.items()))


def layout_status(layout_pages: list[dict[str, Any]], layout_systems: list[dict[str, Any]]) -> str:
    if not layout_pages and not layout_systems:
        return "no_layout_subjects"
    statuses = [item.get("geometry_status") for item in [*layout_pages, *layout_systems]]
    if statuses and all(status == NO_LAYOUT_STATUS for status in statuses):
        return "geometry_unavailable"
    if any(status == "available" for status in statuses):
        return "geometry_partially_available"
    return "geometry_needs_review"


def layout_warnings(layout_pages: list[dict[str, Any]], layout_systems: list[dict[str, Any]]) -> list[str]:
    warnings: list[str] = []
    if not layout_pages:
        warnings.append("Nenhuma página com geometria confiável registrada.")
    if not layout_systems:
        warnings.append("Nenhum sistema com geometria confiável registrado.")
    if any(item.get("geometry_status") == NO_LAYOUT_STATUS for item in [*layout_pages, *layout_systems]):
        warnings.append("Geometria de página/sistema ainda indisponível; não mapear OCR para sistema ou compasso nesta etapa.")
    return warnings
