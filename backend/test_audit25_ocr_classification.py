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

    assert fusion["version"] == "audit-25"
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
