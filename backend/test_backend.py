from fastapi.testclient import TestClient

import main
from main import app


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
    assert data["source"]["ocr_status"] == "pending"
    assert data["source"]["validation_status"] == "pending"
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
