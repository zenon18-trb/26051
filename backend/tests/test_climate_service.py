"""Unit and integration tests for the Phase 2 climate data service and locations.

Validates locations presets, coordinate-to-preset mapping, input bounds checking,
and mock HTTP scenarios for Open-Meteo and local JSON fixture fallbacks.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch
import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.climate_service import (
    clear_climate_cache,
    get_hourly_climate,
    load_preset_locations,
    resolve_preset_id,
)
from app.simulation.exceptions import PhysicsValidationError

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_teardown() -> None:
    """Clear cache before and after every test for clean isolation."""
    clear_climate_cache()
    yield
    clear_climate_cache()


# 1. Test GET /api/locations
def test_get_locations_returns_presets() -> None:
    """Verify that GET /api/locations returns all 5 presets with correct schemas."""
    response = client.get("/api/locations")
    assert response.status_code == 200
    body = response.json()
    assert "locations" in body
    
    locations = body["locations"]
    assert len(locations) == 5
    
    # Check Jaisalmer properties
    jaisalmer = next((loc for loc in locations if loc["id"] == "jaisalmer"), None)
    assert jaisalmer is not None
    assert jaisalmer["name"] == "Jaisalmer"
    assert jaisalmer["region"] == "Rajasthan"
    assert jaisalmer["latitude"] == pytest.approx(26.91)
    assert jaisalmer["longitude"] == pytest.approx(70.91)
    assert jaisalmer["lat"] == pytest.approx(26.91)
    assert jaisalmer["lon"] == pytest.approx(70.91)
    assert jaisalmer["environment_type"] == "hot-arid"
    assert jaisalmer["climate_type"] == "hot-arid"
    assert "description" in jaisalmer
    assert jaisalmer["fixture_id"] == "jaisalmer"


# 2. Test valid preset lookup
def test_preset_lookup_resolution() -> None:
    """Verify mapping of coordinates and preset_ids to correct location IDs."""
    # Test resolution by exact ID
    assert resolve_preset_id(0.0, 0.0, preset_id="leh") == "leh"
    
    # Test resolution by coordinate proximity (Delhi coordinates: 28.61, 77.21)
    assert resolve_preset_id(28.62, 77.20) == "delhi"
    
    # Test coordinates that do not map to any preset
    assert resolve_preset_id(10.0, 20.0) is None


# 3. Test invalid location handling (bounds checking)
def test_invalid_location_bounds() -> None:
    """Verify that out-of-bounds coordinates raise PhysicsValidationError or return 400."""
    # Latitude out of bounds (> 90)
    response = client.get("/api/climate?lat=91.0&lon=45.0")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert "Latitude must be between -90 and 90" in response.json()["error"]["message"]

    # Longitude out of bounds (< -180)
    response = client.get("/api/climate?lat=20.0&lon=-181.0")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert "Longitude must be between -180 and 180" in response.json()["error"]["message"]

    # Missing parameters
    response = client.get("/api/climate?lat=20.0")
    assert response.status_code == 400
    assert "Request validation failed" in response.json()["error"]["message"]


# 4. Test Open-Meteo successful response (mocked)
@patch("httpx.get")
def test_open_meteo_success_mocked(mock_get: MagicMock) -> None:
    """Verify successful Open-Meteo fetch is parsed correctly and source set to live."""
    # Build fake Open-Meteo JSON payload
    fake_time = [f"2026-08-31T{h:02d}:00" for h in range(24)]
    fake_temp = [20.0 + h * 0.5 for h in range(24)]
    fake_solar = [0.0 if h < 6 or h > 18 else 500.0 for h in range(24)]
    fake_wind = [3.0] * 24
    fake_rh = [50] * 24
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "latitude": 28.6,
        "longitude": 77.2,
        "hourly": {
            "time": fake_time,
            "temperature_2m": fake_temp,
            "shortwave_radiation": fake_solar,
            "wind_speed_10m": fake_wind,
            "relative_humidity_2m": fake_rh
        }
    }
    mock_get.return_value = mock_response
    
    response = client.get("/api/climate?lat=28.61&lon=77.21")
    assert response.status_code == 200
    
    body = response.json()
    assert body["climate_source"] == "open_meteo"
    assert body["climate_source_label"] == "Climate source: Open-Meteo (live)"
    assert body["fallback_used"] is False
    assert len(body["hours"]) == 24
    assert body["hours"][0]["t_out_c"] == 20.0
    assert body["hours"][12]["shortwave_wm2"] == 500.0


# 5. Test Open-Meteo timeout behavior (mocked)
@patch("httpx.get")
def test_open_meteo_timeout_fallback(mock_get: MagicMock) -> None:
    """Verify that an API timeout triggers fallback to the correct preset fixture."""
    # Simulate a timeout exception
    mock_get.side_effect = httpx.TimeoutException("Connection timed out")
    
    # Query with Mumbai coordinates (19.07, 72.87) to map it to mumbai fixture
    response = client.get("/api/climate?lat=19.07&lon=72.87")
    assert response.status_code == 200
    
    body = response.json()
    assert body["climate_source"] == "fallback"
    assert body["climate_source_label"] == "Climate source: Bundled fallback — Open-Meteo unavailable"
    assert body["fallback_used"] is True
    assert body["preset_id"] == "mumbai"
    assert len(body["hours"]) == 24
    # Mumbai average humidity is high
    assert body["hours"][0]["rh_pct"] >= 70


# 6. Test Open-Meteo HTTP 500 error (mocked)
@patch("httpx.get")
def test_open_meteo_http_error_fallback(mock_get: MagicMock) -> None:
    """Verify that an API HTTP 500 status code triggers fallback."""
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
        message="Internal Server Error",
        request=MagicMock(),
        response=mock_response
    )
    mock_get.return_value = mock_response
    
    response = client.get("/api/climate?lat=34.15&lon=77.57")  # Leh coordinates
    assert response.status_code == 200
    body = response.json()
    assert body["climate_source"] == "fallback"
    assert body["fallback_used"] is True
    assert body["preset_id"] == "leh"


# 7. Test malformed Open-Meteo response structure (mocked)
@patch("httpx.get")
def test_open_meteo_malformed_response_fallback(mock_get: MagicMock) -> None:
    """Verify that a malformed JSON payload from Open-Meteo triggers fallback."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    # Missing 'hourly' list
    mock_response.json.return_value = {
        "latitude": 28.6,
        "longitude": 77.2
    }
    mock_get.return_value = mock_response
    
    response = client.get("/api/climate?lat=28.61&lon=77.21")
    assert response.status_code == 200
    body = response.json()
    assert body["climate_source"] == "fallback"
    assert body["fallback_used"] is True
    assert body["preset_id"] == "delhi"


# 8. Test fallback fixture selection by preset_id
def test_fallback_fixture_selection_preset() -> None:
    """Verify that get_hourly_climate uses the specified preset_id fixture on fallback."""
    # We pass coordinates that don't match, but force preset_id="leh"
    # To trigger fallback directly, we'll patch httpx.get to fail
    with patch("httpx.get", side_effect=Exception("API offline")):
        res = get_hourly_climate(lat=10.0, lon=20.0, preset_id="leh")
        assert res["climate_source"] == "fallback"
        assert res["preset_id"] == "leh"
        assert res["fallback_used"] is True
        # Check Leh freezing temp in winter mornings
        assert any(h["t_out_c"] < 0 for h in res["hours"])


# 9. Test cache behavior
@patch("httpx.get")
def test_climate_cache_hits(mock_get: MagicMock) -> None:
    """Verify that subsequent queries for the same coordinates do not trigger API requests."""
    fake_time = [f"2026-08-31T{h:02d}:00" for h in range(24)]
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "latitude": 28.6, "longitude": 77.2,
        "hourly": {
            "time": fake_time,
            "temperature_2m": [25.0] * 24,
            "shortwave_radiation": [0.0] * 24,
            "wind_speed_10m": [3.0] * 24,
            "relative_humidity_2m": [50] * 24
        }
    }
    mock_get.return_value = mock_response
    
    # Query 1: Triggers httpx.get
    res1 = client.get("/api/climate?lat=28.61&lon=77.21")
    assert res1.status_code == 200
    assert mock_get.call_count == 1
    
    # Query 2: Resolves from cache
    res2 = client.get("/api/climate?lat=28.61&lon=77.21")
    assert res2.status_code == 200
    assert mock_get.call_count == 1  # Still 1 call!
    
    # Query 3: Different coordinates triggers httpx.get again
    res3 = client.get("/api/climate?lat=26.91&lon=70.91")
    assert res3.status_code == 200
    assert mock_get.call_count == 2
