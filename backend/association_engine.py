from __future__ import annotations

from typing import Any

SYSTEM_ASSOCIATION_VERSION = "audit-31"
MEASURE_ASSOCIATION_VERSION = "audit-33"
PAGE_SYSTEM_MEASURE_VERSION = "audit-48"
BLOCKED_NO_GEOMETRY_STATUS = "blocked_no_reliable_layout_geometry"
BLOCKED_NO_SYSTEM_STATUS = "blocked_no_system_association"
BLOCKED_NO_MEASURE_GEOMETRY_STATUS = "blocked_no_reliable_measure_geometry"
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
        "version": SYSTEM_ASSOCIATION_VERSION,
        "status": association_status(associations),
        "association_count": len(associations),
        "assigned_count": sum(1 for item in associations if item.get("association_status") == "assigned_to_system"),
        "blocked_count": sum(1 for item in associations if item.get("association_status") == BLOCKED_NO_GEOMETRY_STATUS),
        "unassigned_count": sum(1 for item in associations if item.get("association_status") == UNASSIGNED_STATUS),
        "associations": associations,
        "warnings": association_warnings(associations, "sistema"),
    }
    return protocol


def sync_ocr_measure_associations(protocol: dict[str, Any]) -> dict[str, Any]:
    """Attach conservative OCR-to-measure association evidence.

    Audit 33 adds explicit confidence scoring to the Audit 32 measure
    association contract. Blocked or unassigned associations receive score 0.0.
    """
    system_contract = protocol.get("ocr_system_associations") if isinstance(protocol.get("ocr_system_associations"), dict) else {}
    system_associations = system_contract.get("associations") if isinstance(system_contract.get("associations"), list) else []
    measures = protocol.get("measures") if isinstance(protocol.get("measures"), list) else []

    associations = [add_measure_confidence(build_region_measure_association(item, measures)) for item in system_associations]

    confidence_counts = count_confidence_levels(associations)
    protocol["ocr_measure_associations"] = {
        "engine": "cpp_ocr_measure_association_contract",
        "version": MEASURE_ASSOCIATION_VERSION,
        "status": measure_association_status(associations),
        "association_count": len(associations),
        "assigned_count": sum(1 for item in associations if item.get("association_status") == "assigned_to_measure"),
        "blocked_count": sum(1 for item in associations if str(item.get("association_status", "")).startswith("blocked_")),
        "unassigned_count": sum(1 for item in associations if item.get("association_status") == UNASSIGNED_STATUS),
        "confidence_counts": confidence_counts,
        "average_confidence_score": average_confidence_score(associations),
        "associations": associations,
        "warnings": measure_association_warnings(associations),
    }
    return protocol


def sync_page_system_measure_associations(protocol: dict[str, Any]) -> dict[str, Any]:
    """Attach conservative page→system→measure association status.

    Audit 48 is an audit/reporting layer only. It summarizes which OCR pages,
    systems and measures exist, and why automatic page→system→measure binding
    is blocked or pending. It does not create musical associations.
    """
    ocr = protocol.get("ocr") if isinstance(protocol.get("ocr"), dict) else {}
    layout = protocol.get("layout") if isinstance(protocol.get("layout"), dict) else {}
    measures = protocol.get("measures") if isinstance(protocol.get("measures"), list) else []
    ocr_pages = ocr.get("pages") if isinstance(ocr.get("pages"), list) else []
    layout_systems = layout.get("systems") if isinstance(layout.get("systems"), list) else []

    page_numbers = sorted({int(item.get("page") or 1) for item in ocr_pages} | {page_from_page_id(system.get("page_id")) or 1 for system in layout_systems})
    associations = [build_page_system_measure_association(page, ocr_pages, layout_systems, measures) for page in page_numbers]

    protocol["page_system_measure_associations"] = {
        "engine": "cpp_page_system_measure_association_contract",
        "version": PAGE_SYSTEM_MEASURE_VERSION,
        "status": page_system_measure_status(associations),
        "page_count": len(associations),
        "assigned_count": sum(1 for item in associations if item.get("association_status") == "assigned_page_system_measure"),
        "blocked_count": sum(1 for item in associations if str(item.get("association_status", "")).startswith("blocked_")),
        "unassigned_count": sum(1 for item in associations if item.get("association_status") == "unassigned_pending_geometry_or_review"),
        "associations": associations,
        "warnings": page_system_measure_warnings(associations),
    }
    return protocol


def build_page_system_measure_association(page: int, ocr_pages: list[dict[str, Any]], layout_systems: list[dict[str, Any]], measures: list[dict[str, Any]]) -> dict[str, Any]:
    ocr_page = next((item for item in ocr_pages if int(item.get("page") or 1) == page), None)
    page_systems = [system for system in layout_systems if (page_from_page_id(system.get("page_id")) or 1) == page]
    reliable_systems = [system for system in page_systems if system.get("geometry_status") == "available" and isinstance(system.get("bbox"), dict)]
    page_measures = [measure for measure in measures if measure_belongs_to_page(measure, page, reliable_systems)]
    reliable_measures = [measure for measure in page_measures if measure_has_reliable_geometry(measure)]

    base = {
        "page": page,
        "ocr_page_status": ocr_page.get("ocr_status") if ocr_page else "missing_ocr_page",
        "ocr_text_block_count": int(ocr_page.get("text_block_count") or 0) if ocr_page else 0,
        "system_count": len(page_systems),
        "reliable_system_count": len(reliable_systems),
        "measure_count": len(page_measures),
        "reliable_measure_count": len(reliable_measures),
        "candidate_system_ids": [system.get("system_id") for system in reliable_systems if system.get("system_id")],
        "candidate_measure_ids": [measure.get("id") or measure.get("measure_id") for measure in reliable_measures if measure.get("id") or measure.get("measure_id")],
        "association_status": "unassigned_pending_geometry_or_review",
        "confidence_score": 0.0,
        "confidence_level": "none",
        "reason": "Associação página→sistema→compasso não aplicada automaticamente.",
    }

    if not ocr_page:
        return {
            **base,
            "association_status": "blocked_no_ocr_page_evidence",
            "confidence_level": "blocked",
            "reason": "Associação página→sistema→compasso bloqueada: página OCR não existe no contrato.",
        }

    if not reliable_systems:
        return {
            **base,
            "association_status": "blocked_no_reliable_system_geometry",
            "confidence_level": "blocked",
            "reason": "Associação página→sistema→compasso bloqueada: sem geometria confiável de sistema na página.",
        }

    if not reliable_measures:
        return {
            **base,
            "association_status": "blocked_no_reliable_measure_geometry",
            "confidence_level": "blocked",
            "reason": "Associação página→sistema→compasso bloqueada: sem geometria confiável de compasso nos sistemas da página.",
        }

    return {
        **base,
        "association_status": "unassigned_pending_geometry_or_review",
        "confidence_level": "none",
        "reason": "Geometria de página/sistema/compasso existe, mas associação automática permanece pendente de revisão/algoritmo posterior.",
    }


def measure_belongs_to_page(measure: dict[str, Any], page: int, reliable_systems: list[dict[str, Any]]) -> bool:
    measure_page = measure.get("page")
    if isinstance(measure_page, int):
        return measure_page == page
    system_id = measure.get("system_id")
    reliable_system_ids = {system.get("system_id") for system in reliable_systems if system.get("system_id")}
    return bool(system_id and system_id in reliable_system_ids)


def measure_has_reliable_geometry(measure: dict[str, Any]) -> bool:
    geometry = measure.get("geometry") if isinstance(measure.get("geometry"), dict) else {}
    bbox = geometry.get("bbox") if isinstance(geometry, dict) else None
    return geometry.get("status") == "available" and isinstance(bbox, dict)


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

    return {
        **base,
        "association_status": UNASSIGNED_STATUS,
        "reason": "Geometria disponível, mas associação automática ainda não implementada nesta auditoria.",
    }


def build_region_measure_association(system_association: dict[str, Any], measures: list[dict[str, Any]]) -> dict[str, Any]:
    base = {
        "region_id": system_association.get("region_id"),
        "region_type": system_association.get("region_type"),
        "page": system_association.get("page", 1),
        "text": system_association.get("text", ""),
        "normalized_text": system_association.get("normalized_text", ""),
        "candidate_system_id": system_association.get("candidate_system_id"),
        "candidate_measure_id": None,
        "candidate_measure_number": None,
        "association_status": UNASSIGNED_STATUS,
        "confidence": "none",
        "reason": "no_measure_association_attempted_without_system_and_measure_geometry",
    }

    if system_association.get("association_status") != "assigned_to_system":
        return {
            **base,
            "association_status": BLOCKED_NO_SYSTEM_STATUS,
            "reason": "OCR→compasso bloqueado: região OCR ainda não possui associação confiável com sistema musical.",
        }

    system_id = system_association.get("candidate_system_id")
    measure_candidates = reliable_measures_for_system(measures, system_id)
    if not measure_candidates:
        return {
            **base,
            "association_status": BLOCKED_NO_MEASURE_GEOMETRY_STATUS,
            "reason": "OCR→compasso bloqueado: não há bbox/geometria confiável de compasso no sistema candidato.",
        }

    return {
        **base,
        "association_status": UNASSIGNED_STATUS,
        "reason": "Geometria de sistema/compasso disponível, mas associação automática ainda não implementada nesta auditoria.",
    }


def add_measure_confidence(association: dict[str, Any]) -> dict[str, Any]:
    status = association.get("association_status")
    if status == "assigned_to_measure":
        confidence_score = 1.0
        confidence_level = "high"
        factors = ["assigned_to_measure_with_reliable_geometry"]
    elif str(status or "").startswith("blocked_"):
        confidence_score = 0.0
        confidence_level = "blocked"
        factors = [status]
    else:
        confidence_score = 0.0
        confidence_level = "none"
        factors = ["not_assigned_no_confidence"]

    return {
        **association,
        "confidence_score": confidence_score,
        "confidence_level": confidence_level,
        "confidence_factors": factors,
    }


def reliable_systems_for_page(layout_systems: list[dict[str, Any]], page: int) -> list[dict[str, Any]]:
    out = []
    for system in layout_systems:
        if system.get("page_id") and page_from_page_id(system.get("page_id")) not in {None, page}:
            continue
        if system.get("geometry_status") == "available" and isinstance(system.get("bbox"), dict):
            out.append(system)
    return out


def reliable_measures_for_system(measures: list[dict[str, Any]], system_id: Any) -> list[dict[str, Any]]:
    out = []
    for measure in measures:
        if system_id and measure.get("system_id") not in {None, system_id}:
            continue
        if measure_has_reliable_geometry(measure):
            out.append(measure)
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


def measure_association_status(associations: list[dict[str, Any]]) -> str:
    if not associations:
        return "no_ocr_regions"
    if all(item.get("association_status") == BLOCKED_NO_SYSTEM_STATUS for item in associations):
        return "blocked_no_system_association"
    if all(str(item.get("association_status", "")).startswith("blocked_") for item in associations):
        return "blocked_no_reliable_measure_geometry"
    if any(item.get("association_status") == "assigned_to_measure" for item in associations):
        return "partially_assigned"
    return "unassigned_pending_geometry_or_review"


def page_system_measure_status(associations: list[dict[str, Any]]) -> str:
    if not associations:
        return "no_pages_available"
    if all(str(item.get("association_status", "")).startswith("blocked_") for item in associations):
        return "blocked_no_reliable_page_system_measure_geometry"
    if any(item.get("association_status") == "assigned_page_system_measure" for item in associations):
        return "partially_assigned"
    return "unassigned_pending_geometry_or_review"


def association_warnings(associations: list[dict[str, Any]], target: str) -> list[str]:
    warnings = []
    if not associations:
        warnings.append(f"Nenhuma região OCR disponível para associação com {target} musical.")
    if any(item.get("association_status") == BLOCKED_NO_GEOMETRY_STATUS for item in associations):
        warnings.append("Associação OCR→sistema bloqueada enquanto não houver geometria confiável de página/sistema.")
    return warnings


def measure_association_warnings(associations: list[dict[str, Any]]) -> list[str]:
    warnings = []
    if not associations:
        warnings.append("Nenhuma região OCR disponível para associação com compasso.")
    if any(item.get("association_status") == BLOCKED_NO_SYSTEM_STATUS for item in associations):
        warnings.append("Associação OCR→compasso bloqueada enquanto OCR→sistema não estiver confiável.")
    if any(item.get("association_status") == BLOCKED_NO_MEASURE_GEOMETRY_STATUS for item in associations):
        warnings.append("Associação OCR→compasso bloqueada enquanto não houver geometria confiável de compasso.")
    return warnings


def page_system_measure_warnings(associations: list[dict[str, Any]]) -> list[str]:
    warnings = []
    if not associations:
        warnings.append("Nenhuma página OCR/layout disponível para associação página→sistema→compasso.")
    if any(str(item.get("association_status", "")).startswith("blocked_") for item in associations):
        warnings.append("Associação página→sistema→compasso bloqueada enquanto não houver geometria confiável suficiente.")
    if any(item.get("association_status") == "unassigned_pending_geometry_or_review" for item in associations):
        warnings.append("Associação página→sistema→compasso permanece pendente de revisão/algoritmo posterior.")
    return warnings


def count_confidence_levels(associations: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for association in associations:
        level = association.get("confidence_level", "none")
        counts[level] = counts.get(level, 0) + 1
    return dict(sorted(counts.items()))


def average_confidence_score(associations: list[dict[str, Any]]) -> float:
    if not associations:
        return 0.0
    total = sum(float(item.get("confidence_score", 0.0)) for item in associations)
    return round(total / len(associations), 4)
