"""Unit and integration tests for the Phase 3 shelter simulation API.

Validates the POST /api/simulate endpoint against the physical schema boundaries,
U-value resolutions, HVAC balance equations, input checks, and the hand-calculated oracle.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.simulation.exceptions import PhysicsValidationError

client = TestClient(app)


# Mock climate data return with peak temperature at 45.0 °C
MOCK_CLIMATE_PEAK_45 = {
    "lat": 28.61,
    "lon": 77.21,
    "preset_id": "delhi",
    "climate_source": "open_meteo",
    "climate_source_label": "Climate source: Open-Meteo (live)",
    "hours": [
        {"timestamp": f"2026-08-31T{h:02d}:00:00", "t_out_c": 30.0 + (15.0 if h == 15 else 0.0), "shortwave_wm2": 0.0, "wind_ms": 3.0, "rh_pct": 50}
        for h in range(24)
    ]
}


# Mock climate data with climate source as fallback
MOCK_CLIMATE_FALLBACK = {
    "lat": 28.61,
    "lon": 77.21,
    "preset_id": "delhi",
    "climate_source": "fallback",
    "climate_source_label": "Climate source: Bundled fallback — Open-Meteo unavailable",
    "hours": [
        {"timestamp": f"2026-08-31T{h:02d}:00:00", "t_out_c": 30.0 + (15.0 if h == 15 else 0.0), "shortwave_wm2": 0.0, "wind_ms": 3.0, "rh_pct": 50}
        for h in range(24)
    ]
}


def test_validation_invalid_dimensions() -> None:
    """Verify that non-positive dimensions are rejected with 400 Bad Request."""
    payload = {
        "location": {"lat": 28.61, "lon": 77.21},
        "shelter": {
            "length_m": 0.0,  # Invalid
            "width_m": 4.0,
            "height_m": 2.5,
            "wall_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "roof_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "windows": {"area_m2": 2.0, "kind": "glazed"},
            "vents": {"open": False},
            "occupants": 4
        }
    }
    response = client.post("/api/simulate", json=payload)
    assert response.status_code == 400
    assert "Request validation failed" in response.json()["error"]["message"]


def test_validation_invalid_material() -> None:
    """Verify that invalid material IDs are rejected with 400 Bad Request."""
    payload = {
        "location": {"lat": 28.61, "lon": 77.21},
        "shelter": {
            "length_m": 6.0,
            "width_m": 4.0,
            "height_m": 2.5,
            "wall_layers": [{"material_id": "non_existent_material", "thickness_m": 0.05}],
            "roof_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "windows": {"area_m2": 2.0, "kind": "glazed"},
            "vents": {"open": False},
            "occupants": 4
        }
    }
    response = client.post("/api/simulate", json=payload)
    assert response.status_code == 400
    assert "non_existent_material" in response.json()["error"]["message"]


def test_validation_invalid_thickness() -> None:
    """Verify that zero or negative layer thicknesses are rejected."""
    payload = {
        "location": {"lat": 28.61, "lon": 77.21},
        "shelter": {
            "length_m": 6.0,
            "width_m": 4.0,
            "height_m": 2.5,
            "wall_layers": [{"material_id": "puf", "thickness_m": -0.05}],  # Invalid
            "roof_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "windows": {"area_m2": 2.0, "kind": "glazed"},
            "vents": {"open": False},
            "occupants": 4
        }
    }
    response = client.post("/api/simulate", json=payload)
    assert response.status_code == 400
    assert "Request validation failed" in response.json()["error"]["message"]


def test_validation_window_area_exceeds_walls() -> None:
    """Verify that window area exceeding gross wall area is rejected."""
    # Gross wall area = 2 * (6 + 4) * 2.5 = 50 m². We supply window area = 51 m²
    payload = {
        "location": {"lat": 28.61, "lon": 77.21},
        "shelter": {
            "length_m": 6.0,
            "width_m": 4.0,
            "height_m": 2.5,
            "wall_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "roof_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "windows": {"area_m2": 51.0, "kind": "glazed"},  # Exceeds wall area
            "vents": {"open": False},
            "occupants": 4
        }
    }
    response = client.post("/api/simulate", json=payload)
    assert response.status_code == 400
    assert "Window area" in response.json()["error"]["message"]


@patch("app.services.simulation_service.get_hourly_climate")
def test_simulation_endpoints_flow_and_fallback(mock_climate: MagicMock) -> None:
    """Verify correct API serialization and climate fallback label propagation."""
    mock_climate.return_value = MOCK_CLIMATE_FALLBACK
    
    payload = {
        "location": {"lat": 28.61, "lon": 77.21},
        "shelter": {
            "length_m": 6.0,
            "width_m": 4.0,
            "height_m": 2.5,
            "wall_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "roof_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "windows": {"area_m2": 2.0, "kind": "glazed"},
            "vents": {"open": False},
            "occupants": 4
        }
    }
    response = client.post("/api/simulate", json=payload)
    assert response.status_code == 200
    body = response.json()
    
    # Check climate labels propagation
    assert body["climate_source"] == "fallback"
    assert "Bundled fallback" in body["climate_source_label"]
    assert "steady_state" in body
    assert body["mode"] == "floating"


@patch("app.services.simulation_service.get_hourly_climate")
def test_floating_mode_hvac_is_zero(mock_climate: MagicMock) -> None:
    """Verify that in floating mode, Q_hvac is exactly 0.0."""
    mock_climate.return_value = MOCK_CLIMATE_PEAK_45
    
    payload = {
        "location": {"lat": 28.61, "lon": 77.21},
        "shelter": {
            "length_m": 6.0,
            "width_m": 4.0,
            "height_m": 2.5,
            "wall_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "roof_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "windows": {"area_m2": 2.0, "kind": "glazed"},
            "vents": {"open": False},
            "occupants": 4
        },
        "t_in_initial_c": 24.0
    }
    response = client.post("/api/simulate", json=payload)
    assert response.status_code == 200
    ss = response.json()["steady_state"]
    assert ss["q_hvac_w"] == 0.0
    assert ss["q_net_w"] == ss["q_other_w"]


@patch("app.services.simulation_service.get_hourly_climate")
def test_setpoint_mode_hvac_closes_balance(mock_climate: MagicMock) -> None:
    """Verify that in setpoint mode, Q_net is 0.0 and Q_hvac matches -Q_other."""
    mock_climate.return_value = MOCK_CLIMATE_PEAK_45
    
    payload = {
        "location": {"lat": 28.61, "lon": 77.21},
        "shelter": {
            "length_m": 6.0,
            "width_m": 4.0,
            "height_m": 2.5,
            "wall_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "roof_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "windows": {"area_m2": 2.0, "kind": "glazed"},
            "vents": {"open": False},
            "occupants": 4,
            "setpoint_c": 24.0  # Held setpoint
        }
    }
    response = client.post("/api/simulate", json=payload)
    assert response.status_code == 200
    ss = response.json()["steady_state"]
    assert ss["t_in_c"] == 24.0
    assert ss["q_net_w"] == 0.0
    assert ss["q_hvac_w"] == pytest.approx(-ss["q_other_w"])


@patch("app.services.simulation_service.get_hourly_climate")
def test_direction_of_heat_flow(mock_climate: MagicMock) -> None:
    """Verify that Tout > Tin produces positive Q, and Tout < Tin produces negative Q."""
    # Scenario A: Outside hotter (Tout = 45, Tin = 24) -> Conduction Q > 0
    mock_climate.return_value = MOCK_CLIMATE_PEAK_45
    payload_hot = {
        "location": {"lat": 28.61, "lon": 77.21},
        "shelter": {
            "length_m": 6.0, "width_m": 4.0, "height_m": 2.5,
            "wall_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "roof_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "windows": {"area_m2": 2.0, "kind": "glazed"},
            "vents": {"open": False}, "occupants": 0,
            "setpoint_c": 24.0
        }
    }
    res_hot = client.post("/api/simulate", json=payload_hot)
    ss_hot = res_hot.json()["steady_state"]
    assert ss_hot["q_cond_walls_w"] > 0
    assert ss_hot["q_cond_roof_w"] > 0
    
    # Scenario B: Outside colder (Tout = 15, Tin = 24)
    mock_climate_cold = {
        **MOCK_CLIMATE_PEAK_45,
        "hours": [
            {"timestamp": f"2026-08-31T{h:02d}:00:00", "t_out_c": 10.0 + (5.0 if h == 15 else 0.0), "shortwave_wm2": 0.0, "wind_ms": 3.0, "rh_pct": 50}
            for h in range(24)
        ]
    }
    with patch("app.services.simulation_service.get_hourly_climate", return_value=mock_climate_cold):
        res_cold = client.post("/api/simulate", json=payload_hot)
        ss_cold = res_cold.json()["steady_state"]
        assert ss_cold["q_cond_walls_w"] < 0
        assert ss_cold["q_cond_roof_w"] < 0


@patch("app.services.simulation_service.get_hourly_climate")
def test_known_answer_simulation_validation(mock_climate: MagicMock) -> None:
    """Verify the simulation output against the manual hand-calculated baseline.
    
    Dimensions:
    - Length = 3.0 m, Width = 2.0 m -> Roof Area = 6.0 m²
    - Height = 2.0 m -> Gross Wall Area = 2 * (3.0 + 2.0) * 2.0 = 20.0 m²
    - Windows = 0.0 m² -> Net Wall Area = 20.0 m²
    
    Material: Wall layer is 50 mm PUF panel (k = 0.025)
    - R_layer = 0.05 / 0.025 = 2.0 m²K/W
    - R_total = 0.13 (R_si) + 2.0 + 0.04 (R_so) = 2.17 m²K/W
    - U = 1 / 2.17 = 0.4608295 W/(m²K)
    
    Conditions:
    - Tout = 45 °C, Tin = 24 °C (Delta T = 21 K)
    
    Calculations:
    - Q_wall = U * A * Delta T = (1 / 2.17) * 20.0 * 21.0 = 420.0 / 2.17 = 193.548387 W
    - Output is rounded to 1 decimal place: 193.5 W.
    """
    mock_climate.return_value = MOCK_CLIMATE_PEAK_45
    
    payload = {
        "location": {"lat": 28.61, "lon": 77.21},
        "shelter": {
            "length_m": 3.0,
            "width_m": 2.0,
            "height_m": 2.0,
            "wall_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "roof_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "windows": {"area_m2": 0.0, "kind": "glazed"},
            "vents": {"open": False},
            "occupants": 0,
            "setpoint_c": 24.0
        }
    }
    response = client.post("/api/simulate", json=payload)
    assert response.status_code == 200
    body = response.json()
    
    ss = body["steady_state"]
    assert ss["t_out_c"] == 45.0
    assert ss["t_in_c"] == 24.0
    assert ss["q_cond_walls_w"] == pytest.approx(193.5)
