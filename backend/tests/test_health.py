from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok_payload() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body == {"status": "ok", "service": "shelter-thermal-api"}
