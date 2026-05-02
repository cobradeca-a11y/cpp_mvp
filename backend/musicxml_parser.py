from __future__ import annotations

import zipfile
from pathlib import Path
from typing import Any
from lxml import etree


def local_name(node: etree._Element) -> str:
    return etree.QName(node).localname


def children(node: etree._Element, name: str) -> list[etree._Element]:
    return [child for child in node if local_name(child) == name]


def first_child(node: etree._Element, name: str) -> etree._Element | None:
    found = children(node, name)
    return found[0] if found else None


def descendants(node: etree._Element, name: str) -> list[etree._Element]:
    return node.xpath(f".//*[local-name()='{name}']")


def first_descendant_text(node: etree._Element, name: str, default: str = "") -> str:
    found = descendants(node, name)
    if not found:
        return default
    return "".join(found[0].itertext()).strip() or default


def direct_child_text(node: etree._Element, name: str, default: str = "") -> str:
    found = first_child(node, name)
    if found is None:
        return default
    return "".join(found.itertext()).strip() or default


def nested_text(node: etree._Element, path: list[str], default: str = "") -> str:
    current = node
    for name in path:
        next_node = first_child(current, name)
        if next_node is None:
            return default
        current = next_node
    return "".join(current.itertext()).strip() or default


def create_empty_professional_protocol(source_name: str = "") -> dict[str, Any]:
    suffix = Path(source_name).suffix.lower().replace(".", "") if source_name else "musicxml"
    if suffix == "xml":
        suffix = "musicxml"

    return {
        "cpp_version": "professional-omr-1.0",
        "source": {
            "file_name": source_name,
            "file_type": suffix or "musicxml",
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
    """Convert MusicXML/MXL into the CPP professional protocol.

    This parser is intentionally conservative. It extracts only structural data
    present in MusicXML and leaves OCR/fusion/AI validation for later pipeline
    stages. It must not invent missing lyrics, chords, navigation, or alignment.

    Supported inputs:
    - .musicxml / .xml with namespace;
    - .musicxml / .xml without namespace;
    - .mxl compressed MusicXML packages.
    """
    path = Path(musicxml_path)
    protocol = create_empty_professional_protocol(source_name or path.name)

    try:
        root = load_musicxml_root(path)
    except Exception as exc:
        protocol["source"]["omr_status"] = "failed"
        protocol["source"]["message"] = f"Falha ao ler MusicXML/MXL: {exc}"
        add_validation_issue(
            protocol,
            issue_type="musicxml_parse_error",
            severity="high",
            evidence=str(exc),
            suggested_action="Verificar se o arquivo MusicXML/MXL é válido.",
        )
        return protocol

    title = first_descendant_text(root, "work-title") or first_descendant_text(root, "movement-title") or Path(source_name).stem
    protocol["music"]["title"] = title
    fill_creators(root, protocol)

    parts = direct_parts(root)
    if not parts:
        protocol["source"]["omr_status"] = "failed"
        protocol["source"]["message"] = "MusicXML sem partes musicais reconhecíveis."
        add_validation_issue(
            protocol,
            issue_type="musicxml_no_parts_found",
            severity="high",
            evidence="Nenhum elemento <part> encontrado no MusicXML.",
            suggested_action="Reexportar o MusicXML ou revisar o resultado do OMR.",
        )
        return protocol

    primary_part = parts[0]
    divisions = 1
    current_meter = ""
    measure_number_fallback = 1

    for measure in children(primary_part, "measure"):
        m_number_raw = measure.get("number") or str(measure_number_fallback)
        m_number = safe_measure_number(m_number_raw, measure_number_fallback)

        attr = children(measure, "attributes")
        if attr:
            attr0 = attr[-1]
            div_txt = direct_child_text(attr0, "divisions")
            if div_txt.isdigit():
                divisions = max(1, int(div_txt))

            time_node = first_child(attr0, "time")
            if time_node is not None:
                beats = direct_child_text(time_node, "beats")
                beat_type = direct_child_text(time_node, "beat-type")
                if beats and beat_type:
                    current_meter = f"{beats}/{beat_type}"
                    if not protocol["music"]["meter_default"]:
                        protocol["music"]["meter_default"] = current_meter

            key_node = first_child(attr0, "key")
            if key_node is not None and not protocol["music"]["key"]:
                fifths = direct_child_text(key_node, "fifths")
                if fifths:
                    protocol["music"]["key"] = fifths_to_key(fifths)

        measure_obj = create_measure(m_number, current_meter or protocol["music"].get("meter_default", ""))

        cursor_div = 0
        marker_index = 1
        for child in measure:
            tag = local_name(child)
            if tag == "harmony":
                chord_value = harmony_to_chord(child)
                if chord_value:
                    chord_marker = make_marker("chord", chord_value, marker_index, beat_from_div(cursor_div, divisions, current_meter), "musicxml", {})
                    measure_obj["markers"].append(chord_marker)
                    measure_obj["detected_elements"]["chords"].append(chord_marker)
                    marker_index += 1

            elif tag == "note":
                dur_txt = direct_child_text(child, "duration")
                dur = int(dur_txt) if dur_txt.isdigit() else 0
                is_rest = first_child(child, "rest") is not None
                lyric_texts = ["".join(t.itertext()).strip() for t in descendants(child, "text")]
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

                if first_child(child, "chord") is None:
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

        if any(measure_obj["detected_elements"][key] for key in ["note_heads", "syllables", "rests", "chords", "navigation"]):
            measure_obj["confidence"] = "provável"
        else:
            measure_obj["confidence"] = "incerto"
            measure_obj["alignment_warnings"].append({
                "type": "empty_musicxml_measure",
                "severity": "medium",
                "message": "Compasso sem notas, pausas, cifras, navegação ou letra importadas do MusicXML.",
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
            "chords": collect_chords(protocol),
            "lyrics": collect_lyrics(protocol),
            "navigation": [x["type"] for x in protocol["navigation"]["visual_markers"]],
            "warnings": ["Leitura estrutural importada via MusicXML/MXL. OCR/fusão ainda necessários para cifras e alinhamento definitivo."],
        },
    })

    if not protocol["measures"]:
        protocol["source"]["omr_status"] = "failed"
        protocol["source"]["message"] = "MusicXML lido, mas nenhum compasso foi importado."
        add_validation_issue(
            protocol,
            issue_type="musicxml_no_measures_imported",
            severity="high",
            evidence="Partes encontradas, mas nenhuma medida direta foi localizada no MusicXML.",
            suggested_action="Verificar estrutura do arquivo e compatibilidade do parser.",
        )

    return protocol


def load_musicxml_root(path: Path) -> etree._Element:
    if path.suffix.lower() == ".mxl":
        with zipfile.ZipFile(path) as zf:
            xml_name = rootfile_from_container(zf) or first_musicxml_in_zip(zf)
            if not xml_name:
                raise ValueError("Pacote MXL sem MusicXML interno.")
            return etree.fromstring(zf.read(xml_name))
    return etree.parse(str(path)).getroot()


def rootfile_from_container(zf: zipfile.ZipFile) -> str | None:
    try:
        data = zf.read("META-INF/container.xml")
    except KeyError:
        return None
    root = etree.fromstring(data)
    rootfiles = root.xpath(".//*[local-name()='rootfile']")
    for item in rootfiles:
        full_path = item.get("full-path")
        if full_path:
            return full_path
    return None


def first_musicxml_in_zip(zf: zipfile.ZipFile) -> str | None:
    candidates = [name for name in zf.namelist() if name.lower().endswith((".xml", ".musicxml")) and not name.startswith("META-INF/")]
    return candidates[0] if candidates else None


def direct_parts(root: etree._Element) -> list[etree._Element]:
    return children(root, "part")


def fill_creators(root: etree._Element, protocol: dict[str, Any]) -> None:
    for creator in descendants(root, "creator"):
        role = (creator.get("type") or "").lower()
        value = "".join(creator.itertext()).strip()
        if not value:
            continue
        if role == "composer" and not protocol["music"]["composer"]:
            protocol["music"]["composer"] = value
        elif role in {"arranger", "editor"} and not protocol["music"]["arranger"]:
            protocol["music"]["arranger"] = value


def create_measure(number: int, meter: str) -> dict[str, Any]:
    return {
        "measure_id": f"m{number:03d}",
        "system_id": "s001",
        "number": number,
        "meter": meter,
        "is_anacrusis": False,
        "time_grid": time_grid(meter),
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
        "notes": "Importado de MusicXML/MXL; OCR/fusão ainda necessários para cifras e alinhamento definitivo.",
    }


def add_validation_issue(protocol: dict[str, Any], issue_type: str, severity: str, evidence: str, suggested_action: str) -> None:
    protocol["validation"]["validation_status"] = "needs_review"
    protocol["source"]["validation_status"] = "needs_review"
    protocol["validation"]["issues"].append({
        "measure_number": None,
        "issue_type": issue_type,
        "severity": severity,
        "evidence": evidence,
        "suggested_action": suggested_action,
        "needs_human_review": True,
    })


def safe_measure_number(raw: str, fallback: int) -> int:
    try:
        return int("".join(ch for ch in raw if ch.isdigit()) or fallback)
    except ValueError:
        return fallback


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
    pitch = first_child(note, "pitch")
    if pitch is None:
        return ""
    step = direct_child_text(pitch, "step")
    alter = direct_child_text(pitch, "alter")
    octave = direct_child_text(pitch, "octave")
    if not step:
        return ""
    accidental = "#" if alter == "1" else ("b" if alter == "-1" else "")
    return f"{step}{accidental}{octave}"


def harmony_to_chord(harmony: etree._Element) -> str:
    root = first_child(harmony, "root")
    if root is None:
        return ""
    step = direct_child_text(root, "root-step")
    alter = direct_child_text(root, "root-alter")
    kind = direct_child_text(harmony, "kind")
    accidental = "#" if alter == "1" else ("b" if alter == "-1" else "")
    suffix = harmony_kind_suffix(kind)
    return f"{step}{accidental}{suffix}" if step else ""


def harmony_kind_suffix(kind: str) -> str:
    normalized = (kind or "").lower().strip()
    mapping = {
        "major": "",
        "minor": "m",
        "dominant": "7",
        "major-seventh": "maj7",
        "minor-seventh": "m7",
        "diminished": "dim",
        "augmented": "aug",
    }
    return mapping.get(normalized, "" if normalized in {"", "none"} else f"({kind})")


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
    repeat = descendants(node, "repeat")
    if repeat:
        direction = repeat[0].get("direction", "")
        return f"repeat_{direction}" if direction else "repeat"
    bar_styles = descendants(node, "bar-style")
    if bar_styles:
        return "".join(bar_styles[0].itertext()).strip()
    return ""


def collect_lyrics(protocol: dict[str, Any]) -> list[str]:
    out: list[str] = []
    for m in protocol.get("measures", []):
        for s in m.get("detected_elements", {}).get("syllables", []):
            value = s.get("value")
            if value:
                out.append(value)
    return out[:100]


def collect_chords(protocol: dict[str, Any]) -> list[str]:
    out: list[str] = []
    for m in protocol.get("measures", []):
        for s in m.get("detected_elements", {}).get("chords", []):
            value = s.get("value")
            if value:
                out.append(value)
    return out[:100]
