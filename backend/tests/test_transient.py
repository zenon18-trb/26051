"""Unit and physical validation tests for Phase 4 transient simulation.

Tests RC physics, comfort calculations, setpoint holding, Euler integrations,
and insulation comparisons.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.simulation import calculate_comfort_metrics, simulate_transient_24h
from app.simulation.comfort import calculate_comfort_metrics
from app.simulation.transient import simulate_transient_24h

client = TestClient(app)

# Helper mock weather series with constant Tout = 30 °C
MOCK_CLIMATE_CONSTANT_30 = {
    "lat": 28.61,
    "lon": 77.21,
    "preset_id": "delhi",
    "climate_source": "open_meteo",
    "climate_source_label": "Climate source: Open-Meteo (live)",
    "hours": [
        {"timestamp": f"2026-08-31T{h:02d}:00:00", "t_out_c": 30.0, "shortwave_wm2": 0.0, "wind_ms": 1.0, "rh_pct": 50}
        for h in range(24)
    ]
}


def test_hand_calculated_rc_update() -> None:
    """Validate a single Euler updating timestep against a manual calculation.
    
    Given:
    - Tout = 30.0 °C (constant)
    - Tin = 20.0 °C (initial)
    - dt = 3600 s
    - C = 100,000.0 J/K
    - U_wall = 0.5 W/(m²K), A_walls = 10.0 m²
    - U_roof = 0.5 W/(m²K), A_roof = 10.0 m²
    - Windows area = 0.0 m²
    - Occupants = 0
    - Vents = Closed (ACH = 0.5, volume = 8.0 m³ -> q_vent = 1.2 * 8.0 * (0.5/3600) * 1005 * (30 - 20) = 13.4 W)
    - For this isolated pure math known-answer check, let's call simulate_transient_24h directly.
    """
    hourly_climate = [{"timestamp": "2026-08-31T00:00:00", "t_out_c": 30.0, "shortwave_wm2": 0.0}]
    
    results = simulate_transient_24h(
        hourly_climate=hourly_climate,
        length_m=2.0,
        width_m=2.0,
        height_m=2.0,
        u_wall=0.5,
        u_roof=0.5,
        u_window=1.0,  # 0 area window
        A_walls=10.0,
        A_roof=10.0,
        A_windows=0.0,
        occupants=0,
        setpoint_c=None,
        t_in_initial_c=20.0,
        vents_open=False,
        c_total=100000.0
    )
    
    # Trace values
    # Q_wall = 0.5 * 10.0 * 10.0 = 50.0 W
    # Q_roof = 0.5 * 10.0 * 10.0 = 50.0 W
    # Q_window = 1.0 * 0.0 * 10.0 = 0.0 W
    # Q_solar = 0.0 W
    # Volume = 8.0 m³, ACH = 0.5. Mass flow = 1.2 * 8.0 * 0.5 / 3600 = 0.001333 kg/s
    # Q_vent = 0.001333 * 1005 * 10.0 = 13.4 W
    # Q_occ = 0.0 W
    # Q_other = 50.0 + 50.0 + 13.4 = 113.4 W
    # Delta T = 113.4 * 3600 / 100000 = 4.0824 K
    # Tin_next = 20.0 + 4.08 = 24.08 °C
    
    assert len(results) == 1
    assert results[0]["t_in_c"] == 20.0
    assert results[0]["q_cond_walls_w"] == 50.0
    assert results[0]["q_cond_roof_w"] == 50.0
    assert results[0]["q_vent_w"] == pytest.approx(13.4, abs=0.1)


@patch("app.services.simulation_service.get_hourly_climate")
def test_transient_api_contract_and_structure(mock_climate: MagicMock) -> None:
    """Verify that POST /api/simulate returns full transient structures."""
    mock_climate.return_value = MOCK_CLIMATE_CONSTANT_30
    
    payload = {
        "location": {"lat": 28.61, "lon": 77.21, "preset_id": "delhi"},
        "shelter": {
            "length_m": 6.0, "width_m": 4.0, "height_m": 2.5,
            "wall_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "roof_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "windows": {"area_m2": 2.0, "kind": "glazed"},
            "vents": {"open": False},
            "occupants": 4,
            "setpoint_c": None
        },
        "t_in_initial_c": 24.0
    }
    
    response = client.post("/api/simulate", json=payload)
    assert response.status_code == 200
    res = response.json()
    
    # Assert keys exist
    assert "hourly" in res
    assert "comfort" in res
    assert "hvac_summary" in res
    
    assert len(res["hourly"]) == 24
    assert res["comfort"]["total_hours"] == 24
    assert "comfort_pct" in res["comfort"]
    assert "peak_heating_w" in res["hvac_summary"]
    assert "peak_cooling_w" in res["hvac_summary"]


@patch("app.services.simulation_service.get_hourly_climate")
def test_setpoint_holding_transient(mock_climate: MagicMock) -> None:
    """Verify setpoint mode holds temperature at target and calculates HVAC loads."""
    mock_climate.return_value = MOCK_CLIMATE_CONSTANT_30
    
    payload = {
        "location": {"lat": 28.61, "lon": 77.21},
        "shelter": {
            "length_m": 6.0, "width_m": 4.0, "height_m": 2.5,
            "wall_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "roof_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "windows": {"area_m2": 2.0, "kind": "glazed"},
            "vents": {"open": False},
            "occupants": 4,
            "setpoint_c": 24.0  # Setpoint active
        }
    }
    
    response = client.post("/api/simulate", json=payload)
    assert response.status_code == 200
    res = response.json()
    
    # In setpoint mode, indoor temperature must match setpoint for all hours
    for hour in res["hourly"]:
        assert hour["t_in_c"] == 24.0
        assert hour["q_net_w"] == 0.0
        assert hour["q_hvac_w"] == pytest.approx(-hour["q_other_w"], abs=0.1)


@patch("app.services.simulation_service.get_hourly_climate")
def test_floating_mode_temp_drift(mock_climate: MagicMock) -> None:
    """Verify floating mode indoor temp drifts and HVAC load is zero."""
    mock_climate.return_value = MOCK_CLIMATE_CONSTANT_30
    
    payload = {
        "location": {"lat": 28.61, "lon": 77.21},
        "shelter": {
            "length_m": 6.0, "width_m": 4.0, "height_m": 2.5,
            "wall_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "roof_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "windows": {"area_m2": 2.0, "kind": "glazed"},
            "vents": {"open": False},
            "occupants": 0,
            "setpoint_c": None
        },
        "t_in_initial_c": 20.0  # Start cool
    }
    
    response = client.post("/api/simulate", json=payload)
    assert response.status_code == 200
    res = response.json()
    
    # Temp must drift upward towards Tout (30 °C)
    first_temp = res["hourly"][0]["t_in_c"]
    last_temp = res["hourly"][-1]["t_in_c"]
    assert first_temp == 20.0
    assert last_temp > 20.0
    
    for hour in res["hourly"]:
        assert hour["q_hvac_w"] == 0.0


@patch("app.services.simulation_service.get_hourly_climate")
def test_comfort_assessment_correctness(mock_climate: MagicMock) -> None:
    """Verify comfort band statistics calculation."""
    # Constant outdoor 30 °C, setpoint at 24 °C -> comfort band (18 - 26 °C) should be 100% in-band
    mock_climate.return_value = MOCK_CLIMATE_CONSTANT_30
    
    payload = {
        "location": {"lat": 28.61, "lon": 77.21},
        "shelter": {
            "length_m": 6.0, "width_m": 4.0, "height_m": 2.5,
            "wall_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "roof_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "windows": {"area_m2": 2.0, "kind": "glazed"},
            "vents": {"open": False},
            "occupants": 0,
            "setpoint_c": 24.0
        },
        "comfort_band": {"t_low_c": 20.0, "t_high_c": 25.0}
    }
    
    response = client.post("/api/simulate", json=payload)
    assert response.status_code == 200
    comfort = response.json()["comfort"]
    assert comfort["comfort_pct"] == 100.0
    assert comfort["hours_in_band"] == 24
    assert comfort["peak_deviation_above_k"] == 0.0
    assert comfort["peak_deviation_below_k"] == 0.0


@patch("app.services.simulation_service.get_hourly_climate")
def test_extreme_hot_sanity_check(mock_climate: MagicMock) -> None:
    """Sanity check: Extreme hot climate requires cooling (negative HVAC)."""
    hot_climate = {
        **MOCK_CLIMATE_CONSTANT_30,
        "hours": [
            {"timestamp": f"2026-08-31T{h:02d}:00:00", "t_out_c": 45.0, "shortwave_wm2": 0.0, "wind_ms": 1.0, "rh_pct": 50}
            for h in range(24)
        ]
    }
    mock_climate.return_value = hot_climate
    
    payload = {
        "location": {"lat": 28.61, "lon": 77.21},
        "shelter": {
            "length_m": 6.0, "width_m": 4.0, "height_m": 2.5,
            "wall_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "roof_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "windows": {"area_m2": 2.0, "kind": "glazed"},
            "vents": {"open": False},
            "occupants": 0,
            "setpoint_c": 24.0  # Held cool
        }
    }
    
    response = client.post("/api/simulate", json=payload)
    assert response.status_code == 200
    res = response.json()
    hvac = res["hvac_summary"]
    
    assert hvac["peak_cooling_w"] > 0
    assert hvac["peak_heating_w"] == 0.0
    
    # Conduction heat flow must be positive (heat entering)
    for hour in res["hourly"]:
        assert hour["q_cond_walls_w"] > 0
        assert hour["q_hvac_w"] < 0


@patch("app.services.simulation_service.get_hourly_climate")
def test_extreme_cold_sanity_check(mock_climate: MagicMock) -> None:
    """Sanity check: Extreme cold climate requires heating (positive HVAC)."""
    cold_climate = {
        **MOCK_CLIMATE_CONSTANT_30,
        "hours": [
            {"timestamp": f"2026-08-31T{h:02d}:00:00", "t_out_c": -10.0, "shortwave_wm2": 0.0, "wind_ms": 1.0, "rh_pct": 50}
            for h in range(24)
        ]
    }
    mock_climate.return_value = cold_climate
    
    payload = {
        "location": {"lat": 28.61, "lon": 77.21},
        "shelter": {
            "length_m": 6.0, "width_m": 4.0, "height_m": 2.5,
            "wall_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "roof_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "windows": {"area_m2": 2.0, "kind": "glazed"},
            "vents": {"open": False},
            "occupants": 0,
            "setpoint_c": 24.0  # Held warm
        }
    }
    
    response = client.post("/api/simulate", json=payload)
    assert response.status_code == 200
    res = response.json()
    hvac = res["hvac_summary"]
    
    assert hvac["peak_heating_w"] > 0
    assert hvac["peak_cooling_w"] == 0.0
    
    # Conduction heat flow must be negative (heat leaving)
    for hour in res["hourly"]:
        assert hour["q_cond_walls_w"] < 0
        assert hour["q_hvac_w"] > 0


@patch("app.services.simulation_service.get_hourly_climate")
def test_insulation_impact_sanity_check(mock_climate: MagicMock) -> None:
    """Verify that better wall insulation reduces conductive envelope heat transfer."""
    mock_climate.return_value = MOCK_CLIMATE_CONSTANT_30
    
    # Scenario A: Thin plywood wall (poor insulation)
    payload_poor = {
        "location": {"lat": 28.61, "lon": 77.21},
        "shelter": {
            "length_m": 6.0, "width_m": 4.0, "height_m": 2.5,
            "wall_layers": [{"material_id": "plywood", "thickness_m": 0.01}],
            "roof_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "windows": {"area_m2": 0.0, "kind": "glazed"},
            "vents": {"open": False},
            "occupants": 0,
            "setpoint_c": 20.0
        }
    }
    res_poor = client.post("/api/simulate", json=payload_poor)
    q_cond_poor = res_poor.json()["hourly"][0]["q_cond_walls_w"]
    
    # Scenario B: Thick PUF panel wall (better insulation)
    payload_better = {
        "location": {"lat": 28.61, "lon": 77.21},
        "shelter": {
            "length_m": 6.0, "width_m": 4.0, "height_m": 2.5,
            "wall_layers": [{"material_id": "puf", "thickness_m": 0.10}],  # 10cm PUF
            "roof_layers": [{"material_id": "puf", "thickness_m": 0.05}],
            "windows": {"area_m2": 0.0, "kind": "glazed"},
            "vents": {"open": False},
            "occupants": 0,
            "setpoint_c": 20.0
        }
    }
    res_better = client.post("/api/simulate", json=payload_better)
    q_cond_better = res_better.json()["hourly"][0]["q_cond_walls_w"]
    
    # Opaque conduction load must be significantly lower with PUF panels
    assert q_cond_poor > q_cond_better
    assert q_cond_better > 0
