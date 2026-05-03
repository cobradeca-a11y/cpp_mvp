import io
import zipfile

from fastapi.testclient import TestClient

import main
from main import app

MINIMAL_MUSICXML_NO_NAMESPACE = b'''<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <!-- regression: parser must ignore XML comments and non-element nodes -->
  <work><work-title>Teste sem namespace</work-title></work>
  <part-list><score-part id="P1"><part-name>Voice</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <!-- regression: comments inside measures must not break element scanning -->
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>3</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
        <lyric><syllabic>single</syllabic><text>La</text></lyric>
      </note>
      <note><rest/><duration>1</duration><type>quarter</type></note>
      <note>
        <pitch><step>D</step><octave>4</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
    </measure>
  </part>
</score-partwise>
'''


def make_minimal_mxl() -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "META-INF/container.xml",
            '''<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="score.musicxml" media-type="application/vnd.recordare.musicxml+xml"/>
  </rootfiles>
</container>
''',
        )
        zf.writestr("score.musicxml", MINIMAL_MUSICXML_NO_NAMESPACE)
    return buffer.getvalue()


def assert_ocr_contract(data, expected_status):
    assert "ocr" in data
    assert data["ocr"]["status"] == expected_status
    assert data["source"]["ocr_status"] == expected_status
    assert data["source"]["ocr_engine"] == data["ocr"]["engine"]
    assert isinstance(data["ocr"]["text_blocks"], list)
    assert isinstance(data["ocr"]["possible_chords"], list)
    assert isinstance(data["ocr"]["possible_lyrics"], list)
    assert isinstance(data["ocr"]["warnings"], list)


def assert_fusion_contract(data):
    assert "fusion" in data
    assert data["fusion"]["engine"] == "initial_musicxml_ocr_fusion"
    assert data["fusion"]["version"] == "audit-29"
    assert isinstance(data["fusion"]["text_blocks_index"], list)
    assert isinstance(data["fusion"]["text_line_groups"], list)
    assert isinstance(data["fusion"]["text_region_groups"], list)
    assert isinstance(data["fusion"]["classification_counts"], dict)
    assert isinstance(data["fusion"]["region_counts"], dict)
    assert isinstance(data["fusion"]["normalization_counts"], dict)
    assert isinstance(data["fusion"]["chord_candidate_counts"], dict)
    assert isinstance(data["fusion"]["possible_chords"], list)
    assert isinstance(data["fusion"]["possible_lyrics"], list)
    assert isinstance(data["fusion"]["possible_navigation"], list)
    assert isinstance(data["fusion"]["warnings"], list)


def assert_layout_contract(data):
    assert "layout" in data
    assert data["layout"]["engine"] == "cpp_layout_geometry_contract"
    assert data["layout"]["version"] == "audit-30"
    assert isinstance(data["layout"]["pages"], list)
    assert isinstance(data["layout"]["systems"], list)
    assert isinstance(data["layout"]["page_geometry_status_counts"], dict)
    assert isinstance(data["layout"]["system_geometry_status_counts"], dict)
    assert isinstance(data["layout"]["warnings"], list)


def assert_ocr_system_association_contract(data):
    assert "ocr_system_associations" in data
    contract = data["ocr_system_associations"]
    assert contract["engine"] == "cpp_ocr_system_association_contract"
    assert contract["version"] == "audit-31"
    assert isinstance(contract["associations"], list)
    assert isinstance(contract["warnings"], list)
    assert isinstance(contract["association_count"], int)
    assert isinstance(contract["assigned_count"], int)
    assert isinstance(contract["blocked_count"], int)
    assert isinstance(contract["unassigned_count"], int)


def assert_professional_contracts(data, expected_ocr_status):
    assert_ocr_contract(data, expected_ocr_status)
    assert_fusion_contract(data)
    assert_layout_contract(data)
    assert_ocr_system_association_contract(data)


def test_health_endpoint():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert data["app"] == "CPP Professional OMR Backend"
    assert "audiveris_available" in data


def test_pdf_returns_professional_protocol_when_audiveris_unavailable(monkeypatch):
    monkeypatch.setattr(main, "audiveris_available", lambda: False)

    client = TestClient(app)
    response = client.post(
        "/api/omr/analyze",
        files={"file": ("teste.pdf", b"%PDF-1.4\n%fake\n", "application/pdf")},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["cpp_version"] == "professional-omr-1.0"
    assert data["source"]["file_name"] == "teste.pdf"
    assert data["source"]["file_type"] == "pdf"
    assert data["source"]["omr_status"] == "unavailable"
    assert data["source"]["omr_engine"] == "Audiveris"
    assert data["source"]["validation_status"] == "pending"
    assert_professional_contracts(data, "unavailable")
    assert data["ocr"]["text_blocks"] == []
    assert data["ocr"]["possible_chords"] == []
    assert data["ocr"]["possible_lyrics"] == []
    assert data["fusion"]["status"] == "no_ocr_text"
    assert data["layout"]["status"] == "no_layout_subjects"
    assert data["ocr_system_associations"]["status"] == "no_ocr_regions"
    assert data["measures"] == []
    assert "validation" in data
    assert data["validation"]["validation_status"] == "pending"
    assert "outputs" in data
    assert set(data["outputs"].keys()) == {
        "technical_chord_sheet",
        "playable_chord_sheet",
        "uncertainty_report",
        "detection_report",
    }
    assert data["navigation"]["status"] == "needs_review"


def test_musicxml_without_namespace_imports_measures():
    client = TestClient(app)
    response = client.post(
        "/api/omr/analyze",
        files={"file": ("sample.musicxml", MINIMAL_MUSICXML_NO_NAMESPACE, "application/vnd.recordare.musicxml+xml")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["source"]["file_type"] == "musicxml"
    assert data["source"]["omr_status"] == "musicxml_parsed"
    assert_professional_contracts(data, "not_applicable")
    assert data["fusion"]["status"] == "no_ocr_text"
    assert data["layout"]["status"] == "geometry_unavailable"
    assert data["layout"]["page_count"] == 1
    assert data["layout"]["system_count"] == 1
    assert data["layout"]["pages"][0]["geometry_status"] == "unavailable_no_reliable_layout_geometry"
    assert data["layout"]["systems"][0]["geometry_status"] == "unavailable_no_reliable_layout_geometry"
    assert data["ocr_system_associations"]["status"] == "no_ocr_regions"
    assert data["systems"][0]["geometry"]["bbox"] is None
    assert data["music"]["title"] == "Teste sem namespace"
    assert data["music"]["meter_default"] == "3/4"
    assert len(data["measures"]) == 1
    assert data["measures"][0]["number"] == 1
    assert data["measures"][0]["detected_elements"]["syllables"][0]["value"] == "La"


def test_mxl_package_imports_measures():
    client = TestClient(app)
    response = client.post(
        "/api/omr/analyze",
        files={"file": ("sample.mxl", make_minimal_mxl(), "application/vnd.recordare.musicxml")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["source"]["file_type"] == "mxl"
    assert data["source"]["omr_status"] == "musicxml_parsed"
    assert_professional_contracts(data, "not_applicable")
    assert len(data["measures"]) == 1
    assert data["systems"][0]["detected_summary"]["measure_count"] == 1


def test_image_google_vision_adc_failure_is_reported(monkeypatch):
    monkeypatch.setattr(main, "audiveris_available", lambda: False)
    monkeypatch.setenv("OCR_ENGINE", "google_vision")
    monkeypatch.delenv("GOOGLE_APPLICATION_CREDENTIALS", raising=False)

    def fail_adc(*_args, **_kwargs):
        raise RuntimeError("Application Default Credentials not found")

    monkeypatch.setattr("ocr_engine._run_google_vision_image", fail_adc)

    client = TestClient(app)
    response = client.post(
        "/api/omr/analyze",
        files={"file": ("sample.png", b"\x89PNG\r\n\x1a\nfake", "image/png")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["source"]["file_type"] == "png"
    assert_professional_contracts(data, "failed")
    assert data["ocr"]["engine"] == "google_vision"
    assert "gcloud auth application-default login" in data["ocr"]["warnings"][0]
    assert data["measures"] == []


def test_pdf_google_vision_without_page_conversion_remains_unavailable(monkeypatch, tmp_path):
    monkeypatch.setattr(main, "audiveris_available", lambda: False)
    monkeypatch.setenv("OCR_ENGINE", "google_vision")
    credentials = tmp_path / "gcp.json"
    credentials.write_text("{}", encoding="utf-8")
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", str(credentials))

    client = TestClient(app)
    response = client.post(
        "/api/omr/analyze",
        files={"file": ("sample.pdf", b"%PDF-1.4\n%fake\n", "application/pdf")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["source"]["file_type"] == "pdf"
    assert_professional_contracts(data, "unavailable")
    assert data["ocr"]["engine"] == "google_vision"
    assert "PDF local exige conversão" in data["ocr"]["warnings"][0]
    assert data["measures"] == []


def test_image_google_vision_success_with_mocked_json_credentials(monkeypatch, tmp_path):
    monkeypatch.setattr(main, "audiveris_available", lambda: False)
    monkeypatch.setenv("OCR_ENGINE", "google_vision")
    monkeypatch.setenv("OCR_FEATURE", "DOCUMENT_TEXT_DETECTION")
    credentials = tmp_path / "gcp.json"
    credentials.write_text("{}", encoding="utf-8")
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", str(credentials))
    monkeypatch.setattr(
        "ocr_engine._run_google_vision_image",
        lambda *_args, **_kwargs: [
            {
                "text": "Am",
                "confidence": 0.0,
                "bbox": {"vertices": [{"x": 1, "y": 2}, {"x": 3, "y": 2}, {"x": 3, "y": 4}, {"x": 1, "y": 4}]},
                "page": 1,
                "source": "ocr",
            },
            {
                "text": "Glória",
                "confidence": 0.0,
                "bbox": {"vertices": [{"x": 10, "y": 20}, {"x": 30, "y": 20}, {"x": 30, "y": 40}, {"x": 10, "y": 40}]},
                "page": 1,
                "source": "ocr",
            },
        ],
    )

    client = TestClient(app)
    response = client.post(
        "/api/omr/analyze",
        files={"file": ("sample.png", b"\x89PNG\r\n\x1a\nfake", "image/png")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["source"]["file_type"] == "png"
    assert_professional_contracts(data, "success")
    assert data["ocr"]["engine"] == "google_vision"
    assert data["ocr"]["text_blocks"][0]["text"] == "Am"
    assert data["source"]["ocr_status"] == "success"
    assert data["measures"] == []
    assert data["fusion"]["status"] == "ocr_only_no_measures"
    assert data["fusion"]["possible_chords"][0]["text"] == "Am"
    assert data["fusion"]["possible_lyrics"][0]["text"] == "Glória"
    assert data["fusion"]["text_blocks_index"][0]["assignment"]["measure_id"] is None
    assert data["ocr_system_associations"]["status"] == "blocked_no_reliable_layout_geometry"
    assert data["ocr_system_associations"]["blocked_count"] == 2
    assert all(
        association["association_status"] == "blocked_no_reliable_layout_geometry"
        for association in data["ocr_system_associations"]["associations"]
    )
    assert all(
        association["candidate_system_id"] is None
        for association in data["ocr_system_associations"]["associations"]
    )


def test_image_google_vision_success_with_mocked_adc(monkeypatch):
    monkeypatch.setattr(main, "audiveris_available", lambda: False)
    monkeypatch.setenv("OCR_ENGINE", "google_vision")
    monkeypatch.delenv("GOOGLE_APPLICATION_CREDENTIALS", raising=False)
    monkeypatch.setattr(
        "ocr_engine._run_google_vision_image",
        lambda *_args, **_kwargs: [
            {
                "text": "Glória",
                "confidence": 0.0,
                "bbox": {"vertices": [{"x": 5, "y": 6}, {"x": 7, "y": 6}, {"x": 7, "y": 8}, {"x": 5, "y": 8}]},
                "page": 1,
                "source": "ocr",
            }
        ],
    )

    client = TestClient(app)
    response = client.post(
        "/api/omr/analyze",
        files={"file": ("sample.jpg", b"fake-jpg", "image/jpeg")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["source"]["file_type"] == "jpg"
    assert_professional_contracts(data, "success")
    assert data["ocr"]["engine"] == "google_vision"
    assert data["ocr"]["text_blocks"][0]["text"] == "Glória"
    assert "Application Default Credentials" in data["ocr"]["warnings"][0]
    assert data["measures"] == []
