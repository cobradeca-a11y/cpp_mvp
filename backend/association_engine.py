from __future__ import annotations

from typing import Any

ASSOCIATION_VERSION = "audit-31"
BLOCKED_NO_GEOMETRY_STATUS = "blocked_no_reliable_layout_geometry"
UNASSIGNED_STATUS = "unassigned_no_musicxml_layout"


def sync_ocr_system_associations(protocol: dict[str, Any]) -> dict[str, Any]:
    """Attach conservative OCR-to-system association evidence.

    Audit 31 must not invent associations. If layout/system geometry is missing
    or unreliable, every OCR region remains blocked with an explicit reason.
    """
    fusion = protocol.get("fusion") if isinstance(protocol.get("fusion"), dict) else {}
    layout = protocol.get("layout") if isinstance(protocol.get("layout"), dict) else {}
    regions = fusion.get("text_region_groups") if isinstance(fusion.get("text_region_groups"), list) else []
    layout_systems = layout.get("systems") if isinstance(layout.get("systems"), list) else []

    associations = []
    for region in regions:
        associations.append(build_region_system_association(region, layout_systems))

    protocol["ocr_system_associations"] = {
        "engine": "cpp_ocr_system_association_contract",
        "version": ASSOCIATION_VERSION,
        "status": association_status(associations),
        "association_count": len(associations),
        "assigned_count": sum(1 for item in associations if item.get("association_status") == "assigned_to_system"),
        "blocked_count": sum(1 for item in associations if item.get("association_status") == BLOCKED_NO_GEOMETRY_STATUS),
        "unassigned_count": sum(1 for item in associations if item.get("association_status") == UNASSIGNED_STATUS),
        "associations": associations,
        "warnings": association_warnings(associations),
    }
    return protocol


def build_region_system_association(region: dict[str, Any], layout_systems: list[dict[str, Any]]) -> dict[str, Any]:
    base = {
        "region_id": region.get("region_id"),
        "region_type": region.get("region_type"),
        "page": region.get("page", 1),
        "text": region.get("text", ""),
        "normalized_text": region.get("normalized_text", ""),
        "candidate_system_id": None,
        "association_status": UNASSIGNED_STATUS,
        "confidence": "none",
        "reason": "no_association_attempted_without_layout_geometry",
    }

    region_bbox = region.get("bbox") if isinstance(region.get("bbox"), dict) else None
    candidates = reliable_systems_for_page(layout_systems, region.get("page", 1))

    if not region_bbox or not candidates:
        return {
            **base,
            "association_status": BLOCKED_NO_GEOMETRY_STATUS,
            "reason": "OCR→sistema bloqueado: região OCR ou sistema musical sem bbox/layout confiável.",
        }

    # Conservative placeholder for future audits: geometry exists, but Audit 31
    # still does not implement matching heuristics. It only proves the contract.
    return {
        **base,
        "association_status": UNASSIGNED_STATUS,
        "reason": "Geometria disponível, mas associação automática ainda não implementada nesta auditoria.",
    }


def reliable_systems_for_page(layout_systems: list[dict[str, Any]], page: int) -> list[dict[str, Any]]:
    out = []
    for system in layout_systems:
        if system.get("page_id") and page_from_page_id(system.get("page_id")) not in {None, page}:
            continue
        if system.get("geometry_status") == "available" and isinstance(system.get("bbox"), dict):
            out.append(system)
    return out


def page_from_page_id(page_id: Any) -> int | None:
    if not isinstance(page_id, str):
        return None
    digits = "".join(ch for ch in page_id if ch.isdigit())
    if not digits:
        return None
    try:
        return int(digits)
    except ValueError:
        return None


def association_status(associations: list[dict[str, Any]]) -> str:
    if not associations:
        return "no_ocr_regions"
    if all(item.get("association_status") == BLOCKED_NO_GEOMETRY_STATUS for item in associations):
        return "blocked_no_reliable_layout_geometry"
    if any(item.get("association_status") == "assigned_to_system" for item in associations):
        return "partially_assigned"
    return "unassigned_pending_geometry_or_review"


def association_warnings(associations: list[dict[str, Any]]) -> list[str]:
    warnings = []
    if not associations:
        warnings.append("Nenhuma região OCR disponível para associação com sistema musical.")
    if any(item.get("association_status") == BLOCKED_NO_GEOMETRY_STATUS for item in associations):
        warnings.append("Associação OCR→sistema bloqueada enquanto não houver geometria confiável de página/sistema.")
    return warnings
