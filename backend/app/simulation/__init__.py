"""Shelter Thermal Design Tool Simulation Engine.

This package contains the pure-Python simulation modules with zero external network
or framework dependencies.
"""

from __future__ import annotations

from app.simulation.comfort import calculate_comfort_metrics
from app.simulation.exceptions import PhysicsValidationError
from app.simulation.materials import (
    get_material_by_id,
    load_materials,
)
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
    q_solar,
    q_vent,
    r_value,
    total_r_value,
    u_value,
)
from app.simulation.transient import simulate_transient_24h

__all__ = [
    "PhysicsValidationError",
    "load_materials",
    "get_material_by_id",
    "calculate_layer_resistance",
    "calculate_total_resistance",
    "calculate_u_value",
    "calculate_conduction_heat_flow",
    "calculate_occupant_heat_gain",
    "calculate_solar_heat_gain",
    "calculate_ventilation_heat_flow",
    "r_value",
    "total_r_value",
    "u_value",
    "q_cond",
    "q_occ",
    "q_solar",
    "q_vent",
    "simulate_transient_24h",
    "calculate_comfort_metrics",
]
