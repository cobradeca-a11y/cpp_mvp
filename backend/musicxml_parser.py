from __future__ import annotations

from pathlib import Path
from typing import Any
from lxml import etree

NS = {"m": "http://www.musicxml.org/ns/musicxml"}


def _xp(node: etree._Element, expr: str):
    return node.xpath(expr, namespaces=NS)


def _txt(node: etree._Element, expr: str, default: str = "") -> str:
    result = _xp(node, expr)
    if not result:
        return default
    value = result[0]
    if isinstance(value, etree._Element):
        return (value.text or "").strip()
    return str(value).strip()


def create_empty_professional_protocol(source_name: str = "") -> dict[str, Any]:
    return {
        "cpp_version": "professional-omr-1.0",
        "source": {
            "file_name": source_name,
            "file_type": "musicxml",
            "pages": 0,
            "omr_status": "musicxml_parsed",
            "omr_engine": "Audiveris/MusicXML",
            "ocr_status": "pending",
            "ocr_engine": "",
            "validation_status": "pending",
            "message": "",
        },
        "music": {
            "title": Path(source_name).stem if source_name else "",
            "key": "",
            "meter_default": "",
            "tempo": "",
            "composer": "",
            "arranger": "",
        },
        "pages": [],
        "systems": [],
        "measures": [],
        "navigation": {
            "visual_markers": [],
            "execution_order": [],
            "status": "visual_only",
        },
        "validation": {
            "validation_status": "pending",
            "overall_confidence": 0,
            "issues": [],
        },
        "review": [],
        "outputs": {
            "technical_chord_sheet": "",
            "playable_chord_sheet": "",
            "uncertainty_report": "",
            "detection_report": "",
        },
    }


def parse_musicxml_to_cpp(musicxml_path: str | Path, source_name: str = "") -> dict[str, Any]:
    """Convert MusicXML into the CPP professional protocol.

    This parser is intentionally conservative. It extracts only structural data
    present in MusicXML and leaves OCR/fusion/AI validation for later pipeline
    stages. It must not invent missing lyrics, chords, navigation, or alignment.
    """
    path = Path(musicxml_path)
    protocol = create_empty_professional_protocol(source_name)

    try:
        tree = etree.parse(str(path))
    except Exception as exc:
        protocol["source"]["omr_status"] = "failed"
        protocol["source"]["message"] = f"Falha ao ler MusicXML: {exc}"
        protocol["validation"]["validation_status"] = "needs_review"
        protocol["validation"]["issues"].append({
            "measure_number": None,
            "issue_type": "musicxml_parse_error",
            "severity": "high",
            "evidence": str(exc),
            "suggested_action": "Verificar se o arquivo MusicXML/MXL é válido.",
            "needs_human_review": True,
        })
        return protocol

    root = tree.getroot()
    title = _txt(root, "string(//m:work/m:work-title)") or _txt(root, "string(//m:movement-title)") or Path(source_name).stem
    protocol["music"]["title"] = title

    parts = _xp(root, "//m:part")
    if not parts:
        protocol["source"]["omr_status"] = "failed"
        protocol["source"]["message"] = "MusicXML sem partes musicais reconhecíveis."
        protocol["validation"]["validation_status"] = "needs_review"
        protocol["validation"]["issues"].append({
            "measure_number": None,
            "issue_type": "musicxml_no_parts_found",
            "severity": "high",
            "evidence": "Nenhum elemento <part> encontrado no MusicXML.",
            "suggested_action": "Reexportar o MusicXML ou revisar o resultado do OMR.",
            "needs_human_review": True,
        })
        return protocol

    primary_part = parts[0]
    divisions = 1
    current_meter = ""
    measure_number_fallback = 1

    for measure in _xp(primary_part, "./m:measure"):
        m_number_raw = measure.get("number") or str(measure_number_fallback)
        try:
            m_number = int("".join(ch for ch in m_number_raw if ch.isdigit()) or measure_number_fallback)
        except ValueError:
            m_number = measure_number_fallback

        attr = _xp(measure, "./m:attributes")
        if attr:
            attr0 = attr[-1]
            div_txt = _txt(attr0, "string(./m:divisions)")
            if div_txt.isdigit():
                divisions = max(1, int(div_txt))

            beats = _txt(attr0, "string(./m:time/m:beats)")
            beat_type = _txt(attr0, "string(./m:time/m:beat-type)")
            if beats and beat_type:
                current_meter = f"{beats}/{beat_type}"
                if not protocol["music"]["meter_default"]:
                    protocol["music"]["meter_default"] = current_meter

            fifths = _txt(attr0, "string(./m:key/m:fifths)")
            if fifths and not protocol["music"]["key"]:
                protocol["music"]["key"] = fifths_to_key(fifths)

        measure_obj = {
            "measure_id": f"m{m_number:03d}",
            "system_id": "s001",
            "number": m_number,
            "meter": current_meter or protocol["music"].get("meter_default") or "",
            "is_anacrusis": False,
            "time_grid": time_grid(current_meter or protocol["music"].get("meter_default", "")),
            "detected_elements": {
                "chords": [],
                "syllables": [],
                "note_heads": [],
                "rests": [],
                "navigation": [],
                "special_cases": [],
            },
            "markers": [],
            "alignments": [],
            "special_cases": [],
            "alignment_warnings": [],
            "confidence": "provável",
            "review_required": True,
            "review_status": "pending",
            "source": "musicxml",
            "notes": "Importado de MusicXML; OCR/fusão ainda necessários para cifras e alinhamento definitivo.",
        }

        cursor_div = 0
        marker_index = 1
        for child in measure:
            tag = etree.QName(child).localname
            if tag == "note":
                dur_txt = _txt(child, "string(./m:duration)")
                dur = int(dur_txt) if dur_txt.isdigit() else 0
                is_rest = bool(_xp(child, "./m:rest"))
                lyric_texts = ["".join(t.itertext()).strip() for t in _xp(child, "./m:lyric/m:text")]
                beat = beat_from_div(cursor_div, divisions, current_meter)

                if is_rest:
                    rest_marker = make_marker("rest", "pausa", marker_index, beat, "musicxml", {"duration_divisions": dur})
                    measure_obj["markers"].append(rest_marker)
                    measure_obj["detected_elements"]["rests"].append(rest_marker)
                    marker_index += 1
                else:
                    pitch = pitch_name(child)
                    note_marker = make_marker("note_head", pitch or "nota", marker_index, beat, "musicxml", {"duration_divisions": dur})
                    measure_obj["markers"].append(note_marker)
                    measure_obj["detected_elements"]["note_heads"].append(note_marker)
                    marker_index += 1

                    for lyric_text in lyric_texts:
                        if lyric_text:
                            syllable_marker = make_marker("syllable", lyric_text, marker_index, beat, "musicxml", {"duration_divisions": dur})
                            measure_obj["markers"].append(syllable_marker)
                            measure_obj["detected_elements"]["syllables"].append(syllable_marker)
                            marker_index += 1

                if not _xp(child, "./m:chord"):
                    cursor_div += dur

            elif tag in {"barline", "direction"}:
                nav = detect_navigation(child)
                if nav:
                    nav_marker = make_marker("navigation", nav, marker_index, "", "musicxml", {})
                    measure_obj["markers"].append(nav_marker)
                    measure_obj["detected_elements"]["navigation"].append(nav_marker)
                    protocol["navigation"]["visual_markers"].append({
                        "id": f"nav_{m_number}_{marker_index}",
                        "type": nav,
                        "measure_id": measure_obj["measure_id"],
                        "confidence": "musicxml",
                    })
                    marker_index += 1

        if measure_obj["detected_elements"]["note_heads"] or measure_obj["detected_elements"]["syllables"] or measure_obj["detected_elements"]["rests"]:
            measure_obj["confidence"] = "provável"
        else:
            measure_obj["confidence"] = "incerto"
            measure_obj["alignment_warnings"].append({
                "type": "empty_musicxml_measure",
                "severity": "medium",
                "message": "Compasso sem notas, pausas ou letra importadas do MusicXML.",
            })

        protocol["measures"].append(measure_obj)
        protocol["navigation"]["execution_order"].append({"measure_id": measure_obj["measure_id"], "repeat_instance": 1})
        measure_number_fallback += 1

    protocol["systems"].append({
        "system_id": "s001",
        "page_id": "p001",
        "number": 1,
        "status": "musicxml_imported",
        "detected_summary": {
            "meter": protocol["music"].get("meter_default", ""),
            "key_signature": protocol["music"].get("key", ""),
            "tempo": protocol["music"].get("tempo", ""),
            "measure_count": len(protocol["measures"]),
            "chords": [],
            "lyrics": collect_lyrics(protocol),
            "navigation": [x["type"] for x in protocol["navigation"]["visual_markers"]],
            "warnings": ["Leitura estrutural importada via MusicXML. OCR/fusão ainda necessários para cifras e alinhamento definitivo."],
        },
    })

    return protocol


def make_marker(kind: str, value: str, idx: int, beat: str, source: str, extra: dict[str, Any]) -> dict[str, Any]:
    return {
        "marker_id": f"mk{idx:03d}",
        "type": kind,
        "value": value,
        "beat": beat,
        "confidence": "provável" if source == "musicxml" else source,
        "source": source,
        "duration": "",
        "extra": extra,
    }


def pitch_name(note: etree._Element) -> str:
    step = _txt(note, "string(./m:pitch/m:step)")
    alter = _txt(note, "string(./m:pitch/m:alter)")
    octave = _txt(note, "string(./m:pitch/m:octave)")
    if not step:
        return ""
    accidental = "#" if alter == "1" else ("b" if alter == "-1" else "")
    return f"{step}{accidental}{octave}"


def beat_from_div(cursor_div: int, divisions: int, meter: str) -> str:
    if not meter or "/" not in meter:
        return ""
    beat_pos = cursor_div / max(1, divisions)
    beat_number = int(beat_pos) + 1
    fractional = beat_pos - int(beat_pos)
    if fractional >= 0.45:
        return "e"
    return str(beat_number)


def time_grid(meter: str) -> list[str]:
    if meter == "2/4":
        return ["1", "e", "2", "e"]
    if meter == "4/4":
        return ["1", "e", "2", "e", "3", "e", "4", "e"]
    if meter == "6/8":
        return ["1", "la", "li", "2", "la", "li"]
    return ["1", "e", "2", "e", "3", "e"]


def fifths_to_key(fifths: str) -> str:
    major = {
        -7: "Cb", -6: "Gb", -5: "Db", -4: "Ab", -3: "Eb", -2: "Bb", -1: "F",
        0: "C", 1: "G", 2: "D", 3: "A", 4: "E", 5: "B", 6: "F#", 7: "C#",
    }
    try:
        return major.get(int(fifths), fifths)
    except ValueError:
        return fifths


def detect_navigation(node: etree._Element) -> str:
    text = " ".join("".join(x.itertext()).strip() for x in node.iter() if x.text).strip()
    lower = text.lower()
    if "fine" in lower:
        return "Fine"
    if "coda" in lower:
        return "Coda"
    if "segno" in lower:
        return "Segno"
    repeat = _xp(node, ".//m:repeat")
    if repeat:
        direction = repeat[0].get("direction", "")
        return f"repeat_{direction}" if direction else "repeat"
    bar_style = _txt(node, "string(.//m:bar-style)")
    if bar_style:
        return bar_style
    return ""


def collect_lyrics(protocol: dict[str, Any]) -> list[str]:
    out: list[str] = []
    for m in protocol.get("measures", []):
        for s in m.get("detected_elements", {}).get("syllables", []):
            value = s.get("value")
            if value:
                out.append(value)
    return out[:100]
