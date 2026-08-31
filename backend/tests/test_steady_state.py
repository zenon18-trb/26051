"""Unit tests for the Phase 1 steady-state thermal engine and material database.

This file contains tests in backend/tests/ to verify the correctness of the physics engine,
data schemas, custom exceptions, and the GET /api/materials API endpoint.
"""

from __future__ import annotations

import sys
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.simulation.exceptions import PhysicsValidationError
from app.simulation.steady_state import (
    calculate_conduction_heat_flow,
    calculate_layer_resistance,
    calculate_occupant_heat_gain,
    calculate_solar_heat_gain,
    calculate_total_resistance,
    calculate_u_value,
    calculate_ventilation_heat_flow,
    q_cond,
    q_occ,
    r_value,
    total_r_value,
    u_value,
)

client = TestClient(app)


# Test 1 — layer resistance
def test_layer_resistance() -> None:
    """Verify R_layer = thickness / k.
    
    Given: thickness = 0.05 m, k = 0.025 W/(m·K)
    Expected: R = 2.0 m²K/W
    """
    thickness = 0.05
    k = 0.025
    r = calculate_layer_resistance(thickness, k)
    assert r == pytest.approx(2.0)
    assert r_value(thickness, k) == pytest.approx(2.0)


# Test 2 — U-value
def test_u_value() -> None:
    """Verify U = 1 / R_total.
    
    Given: R_total = 2.0 m²K/W
    Expected: U = 0.5 W/(m²·K)
    """
    r_total = 2.0
    u = calculate_u_value(r_total)
    assert u == pytest.approx(0.5)
    assert u_value(r_total) == pytest.approx(0.5)


# Test 3 — positive heat flow
def test_positive_heat_flow() -> None:
    """Verify positive heat flow direction (heat enters shelter).
    
    Given: U = 0.5 W/(m²K), A = 20 m², Tout = 45 °C, Tin = 24 °C
    Expected: Q_cond = +210 W
    """
    u = 0.5
    area = 20.0
    t_out = 45.0
    t_in = 24.0
    q = calculate_conduction_heat_flow(u, area, t_out, t_in)
    assert q == pytest.approx(210.0)
    assert q_cond(u, area, t_out, t_in) == pytest.approx(210.0)


# Test 4 — negative heat flow
def test_negative_heat_flow() -> None:
    """Verify negative heat flow direction (heat leaves shelter).
    
    Given: U = 0.5 W/(m²K), A = 20 m², Tout = 5 °C, Tin = 24 °C
    Expected: Q_cond = -190 W
    """
    u = 0.5
    area = 20.0
    t_out = 5.0
    t_in = 24.0
    q = calculate_conduction_heat_flow(u, area, t_out, t_in)
    assert q == pytest.approx(-190.0)
    assert q_cond(u, area, t_out, t_in) == pytest.approx(-190.0)


# Test 5 — zero temperature difference
def test_zero_temperature_difference() -> None:
    """Verify zero heat flow when Tout == Tin.
    
    Given: Tout = Tin = 24 °C
    Expected: Q_cond = 0 W
    """
    u = 0.5
    area = 20.0
    t_out = 24.0
    t_in = 24.0
    q = calculate_conduction_heat_flow(u, area, t_out, t_in)
    assert q == pytest.approx(0.0)


# Test 6 — multi-layer resistance
def test_multi_layer_resistance() -> None:
    """Verify series addition of multi-layer resistance.
    
    Expected: R_total = sum of individual layer resistances
    """
    r_layers = [1.2, 0.8, 2.5]
    total_r = calculate_total_resistance(r_layers, r_si=0.0, r_so=0.0)
    assert total_r == pytest.approx(4.5)
    assert total_r_value(r_layers, r_si=0.0, r_so=0.0) == pytest.approx(4.5)
    
    # Test with surface resistances
    r_si = 0.13
    r_so = 0.04
    total_r_surface = calculate_total_resistance(r_layers, r_si=r_si, r_so=r_so)
    assert total_r_surface == pytest.approx(4.5 + 0.13 + 0.04)


# Test 7 — insulation sanity check
def test_insulation_sanity_check() -> None:
    """Verify that increasing insulation thickness:
    
    - Increases resistance
    - Decreases U-value
    - Reduces magnitude of conductive heat flow (under identical conditions)
    """
    k = 0.025
    area = 20.0
    t_out = 45.0
    t_in = 24.0
    
    r_thin = calculate_layer_resistance(0.025, k)  # 25mm
    r_thick = calculate_layer_resistance(0.050, k)  # 50mm
    
    assert r_thick > r_thin
    
    u_thin = calculate_u_value(calculate_total_resistance([r_thin], r_si=0.13, r_so=0.04))
    u_thick = calculate_u_value(calculate_total_resistance([r_thick], r_si=0.13, r_so=0.04))
    
    assert u_thick < u_thin
    
    q_thin = calculate_conduction_heat_flow(u_thin, area, t_out, t_in)
    q_thick = calculate_conduction_heat_flow(u_thick, area, t_out, t_in)
    
    assert abs(q_thick) < abs(q_thin)


# Test 8 — occupant heat
def test_occupant_heat() -> None:
    """Verify occupant heat gain is calculated correctly and is positive.
    
    Given: occupants = 4, heat_per_person = 100 W
    Expected: Q_occ = +400 W
    """
    occupants = 4
    q_occ_val = 100.0
    q_total = calculate_occupant_heat_gain(occupants, q_occ_val)
    assert q_total == pytest.approx(400.0)
    assert q_occ(occupants, q_occ_val) == pytest.approx(400.0)
    
    # Test with default value (70W)
    assert calculate_occupant_heat_gain(occupants) == pytest.approx(280.0)


# Test 9 — invalid thickness
def test_invalid_thickness() -> None:
    """Verify that validation fails (raises PhysicsValidationError) for invalid thickness."""
    with pytest.raises(PhysicsValidationError):
        calculate_layer_resistance(thickness_m=0.0, k=0.025)
        
    with pytest.raises(PhysicsValidationError):
        calculate_layer_resistance(thickness_m=-0.01, k=0.025)


# Test 10 — invalid conductivity
def test_invalid_conductivity() -> None:
    """Verify that validation fails (raises PhysicsValidationError) for invalid conductivity."""
    with pytest.raises(PhysicsValidationError):
        calculate_layer_resistance(thickness_m=0.05, k=0.0)
        
    with pytest.raises(PhysicsValidationError):
        calculate_layer_resistance(thickness_m=0.05, k=-0.025)


# Test 11 — materials endpoint
def test_materials_endpoint() -> None:
    """Verify GET /api/materials endpoint returns valid structured data."""
    response = client.get("/api/materials")
    assert response.status_code == 200
    
    body = response.json()
    assert "materials" in body
    materials_list = body["materials"]
    assert len(materials_list) >= 10  # Expect at least 10-15 materials
    
    # Verify properties of PUF insulation
    puf_mat = next((m for m in materials_list if m["id"] == "puf"), None)
    assert puf_mat is not None
    assert puf_mat["name"] == "PUF Insulation"
    assert puf_mat["k"] == pytest.approx(0.025)
    assert puf_mat["thermal_conductivity"] == pytest.approx(0.025)
    assert puf_mat["confidence"] == "approximate"
    assert "density" in puf_mat
    assert "specific_heat" in puf_mat
    assert "typical_thickness" in puf_mat
    assert "category" in puf_mat
    assert "relative_cost" in puf_mat
    assert "relative_weight" in puf_mat
    assert "source" in puf_mat
    assert "notes" in puf_mat


# Test 12 — dependencies purity isolation check
def test_simulation_engine_imports_purity() -> None:
    """Ensure the simulation engine has NO imports of FastAPI, network libs, or clients."""
    # Check already loaded modules for simulation files
    simulation_modules = [m for m in sys.modules if m.startswith("app.simulation.")]
    
    forbidden = ["fastapi", "httpx", "requests", "urllib", "frontend"]
    
    for mod_name in simulation_modules:
        mod = sys.modules[mod_name]
        mod_file = getattr(mod, "__file__", "")
        # Inspect lines of code in file for forbidden imports
        if mod_file and mod_file.endswith(".py"):
            with open(mod_file, "r", encoding="utf-8") as f:
                content = f.read()
                for f_import in forbidden:
                    # Look for things like 'import fastapi' or 'from fastapi' or 'import httpx'
                    # avoiding false positives on variable names
                    assert f"import {f_import}" not in content, f"Forbidden import '{f_import}' found in {mod_file}"
                    assert f"from {f_import}" not in content, f"Forbidden import '{f_import}' found in {mod_file}"


# Test 13 — known-answer manual calculation verification
def test_known_answer_hand_calculation() -> None:
    """Verify that calculations exactly match the hand calculation in docs/physics_reference.md.
    
    Given: Plywood sheet (d = 0.018 m, k = 0.13 W/(m·K))
    Surface resistances: r_si = 0.13, r_so = 0.04 m²K/W
    Area: 10 m²
    Tout = 40 °C, Tin = 26 °C
    
    R_layer = 0.018 / 0.13 = 0.138461538 m²K/W
    R_total = 0.13 + 0.138461538 + 0.04 = 0.308461538 m²K/W
    U = 1 / R_total = 3.24188034 W/(m²K)
    Q = U * A * (Tout - Tin) = 3.24188034 * 10 * 14 = 453.863248 W
    """
    # Step 1: Layer resistance
    r_layer = calculate_layer_resistance(0.018, 0.13)
    assert r_layer == pytest.approx(0.018 / 0.13)
    
    # Step 2: Total resistance
    r_total = calculate_total_resistance([r_layer], r_si=0.13, r_so=0.04)
    assert r_total == pytest.approx(0.13 + (0.018 / 0.13) + 0.04)
    
    # Step 3: U-value
    u = calculate_u_value(r_total)
    assert u == pytest.approx(1.0 / (0.13 + (0.018 / 0.13) + 0.04))
    
    # Step 4: Conductive Heat Flow
    q = calculate_conduction_heat_flow(u, area_m2=10.0, t_out_c=40.0, t_in_c=26.0)
    assert q == pytest.approx(453.863248, abs=0.01)
