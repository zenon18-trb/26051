"""Transient 24-hour RC lumped-capacitance simulation model.

Implements the hour-by-hour Euler temperature updating loop for the indoor node.
"""

from __future__ import annotations

from typing import Any

from app.simulation.steady_state import (
    calculate_conduction_heat_flow,
    calculate_occupant_heat_gain,
    calculate_solar_heat_gain,
    calculate_ventilation_heat_flow,
)


def simulate_transient_24h(
    hourly_climate: list[dict[str, Any]],
    length_m: float,
    width_m: float,
    height_m: float,
    u_wall: float,
    u_roof: float,
    u_window: float,
    A_walls: float,
    A_roof: float,
    A_windows: float,
    occupants: int,
    setpoint_c: float | None,
    t_in_initial_c: float | None,
    vents_open: bool,
    c_total: float,
) -> list[dict[str, Any]]:
    """Run the 24-hour transient simulation with a 3600-second timestep.

    Sign Convention: Positive Q = heat entering the indoor air node.
    """
    results = []
    
    # 1. Determine starting temperature
    if setpoint_c is not None:
        t_in_prev = setpoint_c
    elif t_in_initial_c is not None:
        t_in_prev = t_in_initial_c
    else:
        # Default starting condition is outdoor temperature at t=0
        t_in_prev = hourly_climate[0]["t_out_c"]
        
    volume = length_m * width_m * height_m
    ach = 5.0 if vents_open else 0.5
    
    # 2. Iterate hourly timesteps
    for hour_data in hourly_climate:
        t_out_c = hour_data["t_out_c"]
        irradiance = hour_data["shortwave_wm2"]
        
        # In setpoint mode, indoor temperature is held constant at the target
        t_in_current = setpoint_c if setpoint_c is not None else t_in_prev
        
        # Calculate individual heat flow components
        q_cond_walls = calculate_conduction_heat_flow(u_wall, A_walls, t_out_c, t_in_current)
        q_cond_roof = calculate_conduction_heat_flow(u_roof, A_roof, t_out_c, t_in_current)
        q_cond_windows = calculate_conduction_heat_flow(u_window, A_windows, t_out_c, t_in_current)
        
        # Window solar gain (transmittance tau = 0.5)
        q_solar = calculate_solar_heat_gain(0.5, A_windows, irradiance)
        
        # Ventilation / Infiltration load
        q_vent = calculate_ventilation_heat_flow(ach, volume, t_out_c, t_in_current)
        
        # Occupants sensible gain
        q_occ = calculate_occupant_heat_gain(occupants, q_occ=70.0)
        
        # Sum of non-HVAC loads
        q_other = q_cond_walls + q_cond_roof + q_cond_windows + q_solar + q_vent + q_occ
        
        if setpoint_c is not None:
            # Setpoint mode: Q_hvac cancels Q_other exactly
            q_hvac = -q_other
            q_net = 0.0
            t_in_next = setpoint_c
        else:
            # Floating mode: Q_hvac is zero, indoor temperature drifts
            q_hvac = 0.0
            q_net = q_other
            # Euler update: T_next = T_current + (Q_net / C) * dt
            t_in_next = t_in_current + (q_net / c_total) * 3600.0
            
        results.append({
            "timestamp": hour_data["timestamp"],
            "t_out_c": round(t_out_c, 2),
            "t_in_c": round(t_in_current, 2),
            "q_cond_walls_w": round(q_cond_walls, 2),
            "q_cond_roof_w": round(q_cond_roof, 2),
            "q_cond_windows_w": round(q_cond_windows, 2),
            "q_solar_w": round(q_solar, 2),
            "q_vent_w": round(q_vent, 2),
            "q_occ_w": round(q_occ, 2),
            "q_hvac_w": round(q_hvac, 2),
            "q_other_w": round(q_other, 2),
            "q_net_w": round(q_net, 2),
        })
        
        t_in_prev = t_in_next
        
    return results
