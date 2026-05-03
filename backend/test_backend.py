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
    assert data["source"]["ocr_status"] == "unavailable"
    assert "ocr" in data
    assert data["ocr"]["status"] == "unavailable"
    assert data["source"]["validation_status"] == "pending"
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
    assert data["ocr"]["status"] == "not_applicable"
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
    assert data["ocr"]["status"] == "not_applicable"
    assert len(data["measures"]) == 1
    assert data["systems"][0]["detected_summary"]["measure_count"] == 1


def test_image_returns_unavailable_when_google_vision_not_configured(monkeypatch):
    monkeypatch.setattr(main, "audiveris_available", lambda: False)
    monkeypatch.setattr(main, "OCR_ENGINE", "google_vision")

    client = TestClient(app)
    response = client.post(
        "/api/omr/analyze",
        files={"file": ("sample.png", b"\x89PNG\r\n\x1a\nfake", "image/png")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["source"]["file_type"] == "png"
    assert data["ocr"]["status"] == "unavailable"
    assert "GOOGLE_APPLICATION_CREDENTIALS" in data["ocr"]["warnings"][0]
    assert data["measures"] == []


def test_image_google_vision_success_with_mock(monkeypatch, tmp_path):
    monkeypatch.setattr(main, "OCR_ENGINE", "google_vision")
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", str(tmp_path / "gcp.json"))
    (tmp_path / "gcp.json").write_text("{}", encoding="utf-8")
    monkeypatch.setattr(
        "ocr_engine._run_google_vision_image",
        lambda *_args, **_kwargs: [
            {
                "text": "Am",
                "confidence": 0.0,
                "bbox": {"vertices": [{"x": 1, "y": 2}, {"x": 3, "y": 2}, {"x": 3, "y": 4}, {"x": 1, "y": 4}]},
                "page": 1,
                "source": "ocr",
            }
        ],
    )

    client = TestClient(app)
    response = client.post(
        "/api/omr/analyze",
        files={"file": ("sample.png", b"\x89PNG\r\n\x1a\nfake", "image/png")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["ocr"]["status"] == "success"
    assert data["ocr"]["engine"] == "google_vision"
    assert data["ocr"]["text_blocks"][0]["text"] == "Am"
    assert data["source"]["ocr_status"] == "success"
    assert data["measures"] == []
