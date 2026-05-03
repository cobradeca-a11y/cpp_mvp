from __future__ import annotations

from typing import Any

ALIGNMENT_REPORT_VERSION = "audit-34"


def sync_alignment_report(protocol: dict[str, Any]) -> dict[str, Any]:
    """Attach an audit-only OCR/MusicXML alignment report.

    Audit 34 must not create or change associations. It only summarizes the
    current protocol evidence, blockers, confidence, and review needs.
    """
    source = protocol.get("source") if isinstance(protocol.get("source"), dict) else {}
    ocr = protocol.get("ocr") if isinstance(protocol.get("ocr"), dict) else {}
    fusion = protocol.get("fusion") if isinstance(protocol.get("fusion"), dict) else {}
    layout = protocol.get("layout") if isinstance(protocol.get("layout"), dict) else {}
    system_assoc = protocol.get("ocr_system_associations") if isinstance(protocol.get("ocr_system_associations"), dict) else {}
    measure_assoc = protocol.get("ocr_measure_associations") if isinstance(protocol.get("ocr_measure_associations"), dict) else {}
    measures = protocol.get("measures") if isinstance(protocol.get("measures"), list) else []

    blockers = collect_alignment_blockers(layout, system_assoc, measure_assoc)
    report = {
        "engine": "cpp_ocr_musicxml_alignment_report",
        "version": ALIGNMENT_REPORT_VERSION,
        "status": alignment_report_status(blockers, system_assoc, measure_assoc),
        "source_summary": {
            "file_name": source.get("file_name", ""),
            "file_type": source.get("file_type", ""),
            "omr_status": source.get("omr_status", ""),
            "ocr_status": source.get("ocr_status", ocr.get("status", "")),
        },
        "evidence_summary": {
            "measures_count": len(measures),
            "ocr_text_blocks_count": len(ocr.get("text_blocks", []) if isinstance(ocr.get("text_blocks"), list) else []),
            "fusion_text_blocks_count": len(fusion.get("text_blocks_index", []) if isinstance(fusion.get("text_blocks_index"), list) else []),
            "text_line_groups_count": len(fusion.get("text_line_groups", []) if isinstance(fusion.get("text_line_groups"), list) else []),
            "text_region_groups_count": len(fusion.get("text_region_groups", []) if isinstance(fusion.get("text_region_groups"), list) else []),
            "possible_chords_count": len(fusion.get("possible_chords", []) if isinstance(fusion.get("possible_chords"), list) else []),
            "possible_lyrics_count": len(fusion.get("possible_lyrics", []) if isinstance(fusion.get("possible_lyrics"), list) else []),
        },
        "layout_summary": {
            "layout_status": layout.get("status", "not_available"),
            "page_count": layout.get("page_count", 0),
            "system_count": layout.get("system_count", 0),
            "page_geometry_status_counts": layout.get("page_geometry_status_counts", {}),
            "system_geometry_status_counts": layout.get("system_geometry_status_counts", {}),
        },
        "classification_summary": {
            "classification_counts": fusion.get("classification_counts", {}),
            "region_counts": fusion.get("region_counts", {}),
            "normalization_counts": fusion.get("normalization_counts", {}),
            "chord_candidate_counts": fusion.get("chord_candidate_counts", {}),
        },
        "association_summary": {
            "ocr_system_status": system_assoc.get("status", "not_available"),
            "ocr_system_association_count": system_assoc.get("association_count", 0),
            "ocr_system_assigned_count": system_assoc.get("assigned_count", 0),
            "ocr_system_blocked_count": system_assoc.get("blocked_count", 0),
            "ocr_measure_status": measure_assoc.get("status", "not_available"),
            "ocr_measure_association_count": measure_assoc.get("association_count", 0),
            "ocr_measure_assigned_count": measure_assoc.get("assigned_count", 0),
            "ocr_measure_blocked_count": measure_assoc.get("blocked_count", 0),
            "ocr_measure_confidence_counts": measure_assoc.get("confidence_counts", {}),
            "ocr_measure_average_confidence_score": measure_assoc.get("average_confidence_score", 0.0),
        },
        "blockers": blockers,
        "review_required": bool(blockers),
        "warnings": build_alignment_warnings(blockers),
        "notes": [
            "Relatório auditável apenas: não cria nem altera associação OCR→sistema ou OCR→compasso.",
            "Qualquer evidência bloqueada permanece pendente para revisão humana.",
        ],
    }
    protocol["alignment_report"] = report
    return protocol


def alignment_report_status(blockers: list[dict[str, Any]], system_assoc: dict[str, Any], measure_assoc: dict[str, Any]) -> str:
    if not blockers and measure_assoc.get("assigned_count", 0):
        return "alignment_partially_available"
    if blockers:
        return "alignment_blocked_needs_review"
    if system_assoc.get("status") == "no_ocr_regions" and measure_assoc.get("status") == "no_ocr_regions":
        return "no_ocr_regions"
    return "alignment_not_available"


def collect_alignment_blockers(
    layout: dict[str, Any],
    system_assoc: dict[str, Any],
    measure_assoc: dict[str, Any],
) -> list[dict[str, Any]]:
    blockers: list[dict[str, Any]] = []

    if layout.get("status") in {"geometry_unavailable", "no_layout_subjects"}:
        blockers.append({
            "code": "layout_geometry_unavailable",
            "severity": "blocking",
            "message": "Geometria de página/sistema indisponível para alinhamento OCR/MusicXML.",
        })

    if system_assoc.get("status") == "blocked_no_reliable_layout_geometry":
        blockers.append({
            "code": "ocr_system_association_blocked",
            "severity": "blocking",
            "message": "Associação OCR→sistema bloqueada por ausência de geometria confiável.",
            "blocked_count": system_assoc.get("blocked_count", 0),
        })

    if measure_assoc.get("status") in {"blocked_no_system_association", "blocked_no_reliable_measure_geometry"}:
        blockers.append({
            "code": "ocr_measure_association_blocked",
            "severity": "blocking",
            "message": "Associação OCR→compasso bloqueada; nenhum compasso pode ser inferido.",
            "blocked_count": measure_assoc.get("blocked_count", 0),
            "average_confidence_score": measure_assoc.get("average_confidence_score", 0.0),
        })

    return blockers


def build_alignment_warnings(blockers: list[dict[str, Any]]) -> list[str]:
    if not blockers:
        return []
    return [
        "Relatório indica bloqueios de alinhamento; não usar OCR como associado a sistema/compasso sem revisão.",
        "Não gerar cifra tocável baseada nesses alinhamentos bloqueados.",
    ]
