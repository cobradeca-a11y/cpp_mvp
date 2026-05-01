from fastapi.testclient import TestClient

from main import app


def test_health_endpoint():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert data["app"] == "CPP Professional OMR Backend"
    assert "audiveris_available" in data
