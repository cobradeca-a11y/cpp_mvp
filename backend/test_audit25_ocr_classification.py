from fusion_engine import build_initial_fusion, classify_ocr_text


def test_audit25_classifies_observed_telemann_noise_and_labels():
    cases = {
        ".": "punctuation",
        "!": "punctuation",
        "(": "punctuation",
        ")": "punctuation",
        "-": "lyric_hyphen_or_continuation",
        "_": "lyric_hyphen_or_continuation",
        "។": "music_symbol_noise",
        "tr": "editorial_text",
        "( a 2 )": "editorial_text",
        "u.Ob.": "instrument_label",
        "u.Cemb.": "instrument_label",
        "Ob": "instrument_label",
        "Viol": "instrument_label",
        "Viola": "instrument_label",
        "Bc": "instrument_label",
    }

    for text, expected in cases.items():
        assert classify_ocr_text(text) == expected


def test_audit25_classifies_lyrics_fragments_and_chords_conservatively():
    cases = {
        "Was": "possible_lyric",
        "ist": "possible_lyric",
        "schöner": "possible_lyric",
        "Liebe": "possible_lyric",
        "süßer": "possible_lyric",
        "Kuẞ": "lyric_syllable_fragment",
        "Lie": "lyric_syllable_fragment",
        "be": "lyric_syllable_fragment",
        "D": "possible_chord",
        "A7/G": "possible_chord",
        "Em7(add11)": "possible_chord",
    }

    for text, expected in cases.items():
        assert classify_ocr_text(text) == expected


def test_audit25_preserves_unassigned_layout_and_counts_classifications():
    protocol = {
        "source": {"omr_status": "success"},
        "ocr": {
            "status": "success",
            "text_blocks": [
                {"text": "Was", "bbox": {"x": 1}, "page": 1},
                {"text": "Lie", "bbox": {"x": 2}, "page": 1},
                {"text": ".", "bbox": {"x": 3}, "page": 1},
                {"text": "u.Ob.", "bbox": {"x": 4}, "page": 1},
            ],
        },
        "systems": [],
        "measures": [{"id": "m1"}],
    }

    fusion = build_initial_fusion(protocol)

    assert fusion["version"] == "audit-28"
    assert fusion["status"] == "evidence_indexed_needs_layout_mapping"
    assert fusion["classification_counts"] == {
        "instrument_label": 1,
        "lyric_syllable_fragment": 1,
        "possible_lyric": 1,
        "punctuation": 1,
    }
    assert [candidate["text"] for candidate in fusion["possible_lyrics"]] == ["Was", "Lie"]
    assert fusion["possible_chords"] == []
    assert all(
        indexed["assignment"] == {
            "system_id": None,
            "measure_id": None,
            "status": "unassigned_no_musicxml_layout",
        }
        for indexed in fusion["text_blocks_index"]
    )


def test_audit26_1_groups_ocr_blocks_by_visual_line_without_measure_assignment():
    protocol = {
        "source": {"omr_status": "success"},
        "ocr": {
            "status": "success",
            "text_blocks": [
                {"text": "Was", "bbox": {"vertices": [{"x": 10, "y": 100}, {"x": 40, "y": 100}, {"x": 40, "y": 112}, {"x": 10, "y": 112}]}, "page": 1},
                {"text": "ist", "bbox": {"vertices": [{"x": 48, "y": 101}, {"x": 70, "y": 101}, {"x": 70, "y": 113}, {"x": 48, "y": 113}]}, "page": 1},
                {"text": "Liebe", "bbox": {"vertices": [{"x": 12, "y": 150}, {"x": 52, "y": 150}, {"x": 52, "y": 162}, {"x": 12, "y": 162}]}, "page": 1},
            ],
        },
        "systems": [],
        "measures": [{"id": "m1"}],
    }

    fusion = build_initial_fusion(protocol)

    assert len(fusion["text_line_groups"]) == 2
    assert fusion["text_line_groups"][0]["text"] == "Was ist"
    assert fusion["text_line_groups"][0]["normalized_text"] == "Was ist"
    assert fusion["text_line_groups"][0]["text_block_ids"] == ["fx0001", "fx0002"]
    assert fusion["text_line_groups"][0]["bbox"] == {
        "x_min": 10.0,
        "y_min": 100.0,
        "x_max": 70.0,
        "y_max": 113.0,
        "width": 60.0,
        "height": 13.0,
    }
    assert fusion["text_line_groups"][0]["assignment"] == {
        "system_id": None,
        "measure_id": None,
        "status": "unassigned_no_musicxml_layout",
    }
    assert fusion["text_line_groups"][1]["text"] == "Liebe"


def test_audit27_groups_visual_lines_into_functional_regions_without_assignment():
    protocol = {
        "source": {"omr_status": "success"},
        "ocr": {
            "status": "success",
            "text_blocks": [
                {"text": "Ob", "bbox": {"vertices": [{"x": 5, "y": 20}, {"x": 22, "y": 20}, {"x": 22, "y": 32}, {"x": 5, "y": 32}]}, "page": 1},
                {"text": "Viol", "bbox": {"vertices": [{"x": 5, "y": 45}, {"x": 30, "y": 45}, {"x": 30, "y": 57}, {"x": 5, "y": 57}]}, "page": 1},
                {"text": "D", "bbox": {"vertices": [{"x": 50, "y": 90}, {"x": 60, "y": 90}, {"x": 60, "y": 102}, {"x": 50, "y": 102}]}, "page": 1},
                {"text": "Was", "bbox": {"vertices": [{"x": 50, "y": 130}, {"x": 82, "y": 130}, {"x": 82, "y": 142}, {"x": 50, "y": 142}]}, "page": 1},
                {"text": "ist", "bbox": {"vertices": [{"x": 88, "y": 131}, {"x": 108, "y": 131}, {"x": 108, "y": 143}, {"x": 88, "y": 143}]}, "page": 1},
                {"text": "tr", "bbox": {"vertices": [{"x": 140, "y": 170}, {"x": 154, "y": 170}, {"x": 154, "y": 182}, {"x": 140, "y": 182}]}, "page": 1},
                {"text": ".", "bbox": {"vertices": [{"x": 170, "y": 210}, {"x": 172, "y": 210}, {"x": 172, "y": 212}, {"x": 170, "y": 212}]}, "page": 1},
            ],
        },
        "systems": [],
        "measures": [{"id": "m1"}],
    }

    fusion = build_initial_fusion(protocol)

    assert fusion["region_counts"] == {
        "chord_region": 1,
        "editorial_region": 1,
        "instrument_region": 2,
        "lyric_region": 1,
        "noise_region": 1,
    }
    assert [region["region_type"] for region in fusion["text_region_groups"]] == [
        "instrument_region",
        "instrument_region",
        "chord_region",
        "lyric_region",
        "editorial_region",
        "noise_region",
    ]
    assert all(
        region["assignment"] == {
            "system_id": None,
            "measure_id": None,
            "status": "unassigned_no_musicxml_layout",
        }
        for region in fusion["text_region_groups"]
    )


def test_audit28_normalizes_ocr_text_without_replacing_raw_evidence():
    protocol = {
        "source": {"omr_status": "success"},
        "ocr": {
            "status": "success",
            "text_blocks": [
                {"text": " Kuẞ, ", "bbox": {"vertices": [{"x": 10, "y": 10}, {"x": 30, "y": 10}, {"x": 30, "y": 22}, {"x": 10, "y": 22}]}, "page": 1},
                {"text": "—", "bbox": {"vertices": [{"x": 36, "y": 10}, {"x": 40, "y": 10}, {"x": 40, "y": 22}, {"x": 36, "y": 22}]}, "page": 1},
                {"text": "A7 / G", "bbox": {"vertices": [{"x": 50, "y": 50}, {"x": 90, "y": 50}, {"x": 90, "y": 62}, {"x": 50, "y": 62}]}, "page": 1},
            ],
        },
        "systems": [],
        "measures": [{"id": "m1"}],
    }

    fusion = build_initial_fusion(protocol)

    assert fusion["normalization_counts"] == {
        "continuation_token": 1,
        "normalized_chord_candidate": 1,
        "normalized_text_candidate": 1,
    }
    assert fusion["text_blocks_index"][0]["text"] == "Kuẞ,"
    assert fusion["text_blocks_index"][0]["normalized_text"] == "Kuß"
    assert fusion["text_blocks_index"][1]["text"] == "—"
    assert fusion["text_blocks_index"][1]["normalized_text"] == "-"
    assert fusion["text_blocks_index"][2]["text"] == "A7 / G"
    assert fusion["text_blocks_index"][2]["normalized_text"] == "A7/G"
    assert fusion["possible_chords"][0]["normalized_text"] == "A7/G"
    assert fusion["text_line_groups"][0]["normalized_text"] == "Kuß -"
    assert fusion["text_region_groups"][0]["normalized_text"] == "Kuß -"
