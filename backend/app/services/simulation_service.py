"""Simulation orchestration service layer.

Glue code that resolves coordinates via the climate service, resolves material properties
via the material service, calculates geometry areas, and invokes the pure physics engine
to run both the steady-state and the 24-hour transient simulation.
"""

from __future__ import annotations

import logging
from typing import Any

from app.schemas.simulation import SimulationRequest
from app.services.climate_service import get_hourly_climate
from app.simulation import (
    calculate_comfort_metrics,
    calculate_conduction_heat_flow,
    calculate_layer_resistance,
    calculate_occupant_heat_gain,
    calculate_solar_heat_gain,
    calculate_total_resistance,
    calculate_u_value,
    calculate_ventilation_heat_flow,
    get_material_by_id,
    simulate_transient_24h,
)

logger = logging.getLogger(__name__)


def run_simulation(req: SimulationRequest) -> dict[str, Any]:
    """Execute the steady-state snapshot and 24-hour transient RC simulation.
    
    1. Fetch 24h climate series and locate the representative hour (max Tout).
    2. Resolve material IDs to conductivities and calculate wall/roof/window U-values.
    3. Calculate envelope geometry (opaque walls, roof, window areas, volume).
    4. Compute total shelter thermal capacitance.
    5. Compute steady-state snapshot flows (including active solar and ventilation).
    6. Execute the 24-hour transient RC simulation using Euler updates.
    7. Calculate comfort metrics and peak HVAC requirement summaries.
    """
    # 1. Climate retrieval and representative hour lookup
    lat = req.location.lat
    lon = req.location.lon
    preset_id = req.location.preset_id
    
    climate = get_hourly_climate(lat=lat, lon=lon, preset_id=preset_id)
    hours = climate["hours"]
    
    # Locate maximum outdoor temperature hour as the representative design hour
    rep_hour = max(hours, key=lambda h: h["t_out_c"])
    rep_hour_ts = rep_hour["timestamp"]
    t_out_c = rep_hour["t_out_c"]
    
    # Determine indoor dry-bulb temperature target
    if req.shelter.setpoint_c is not None:
        t_in_c = req.shelter.setpoint_c
        mode = "setpoint"
    else:
        # If floating, default to t_in_initial_c or comfortable design baseline (26.0 °C)
        t_in_c = req.t_in_initial_c if req.t_in_initial_c is not None else 26.0
        mode = "floating"
        
    # 2. Geometry calculations
    length = req.shelter.length_m
    width = req.shelter.width_m
    height = req.shelter.height_m
    
    A_roof = length * width
    A_walls_gross = 2 * (length + width) * height
    A_windows = req.shelter.windows.area_m2
    
    # Net wall area is gross walls minus window area
    A_walls = max(0.0, A_walls_gross - A_windows)
    volume = length * width * height
    ach = 5.0 if req.shelter.vents.open else 0.5
    
    # 3. Resolve wall assembly U-value
    wall_r_layers = []
    for layer in req.shelter.wall_layers:
        material = get_material_by_id(layer.material_id)
        r_layer = calculate_layer_resistance(layer.thickness_m, material["k"])
        wall_r_layers.append(r_layer)
        
    r_total_wall = calculate_total_resistance(wall_r_layers, r_si=0.13, r_so=0.04)
    u_wall = calculate_u_value(r_total_wall)
    
    # 4. Resolve roof assembly U-value
    roof_r_layers = []
    for layer in req.shelter.roof_layers:
        material = get_material_by_id(layer.material_id)
        r_layer = calculate_layer_resistance(layer.thickness_m, material["k"])
        roof_r_layers.append(r_layer)
        
    r_total_roof = calculate_total_resistance(roof_r_layers, r_si=0.10, r_so=0.04)
    u_roof = calculate_u_value(r_total_roof)
    
    # 5. Resolve windows U-value (using database glass entry)
    glass_material = get_material_by_id("glass")
    r_glass = calculate_layer_resistance(0.006, glass_material["k"]) # Standard 6mm glazing
    r_total_window = calculate_total_resistance([r_glass], r_si=0.13, r_so=0.04)
    u_window = calculate_u_value(r_total_window)
    
    # 6. Total shelter thermal capacitance calculation (C)
    c_air = 1.2 * 1005.0 * volume  # rho_air * cp_air * V
    
    # Calculate fabric capacitance from active layers
    c_fabric = 0.0
    f_mass = 0.5  # 50% thermally active mass fraction
    has_mass_props = True
    
    for layer in req.shelter.wall_layers:
        material = get_material_by_id(layer.material_id)
        if material.get("density") and material.get("specific_heat"):
            c_fabric += material["density"] * material["specific_heat"] * A_walls * layer.thickness_m * f_mass
        else:
            has_mass_props = False
            
    for layer in req.shelter.roof_layers:
        material = get_material_by_id(layer.material_id)
        if material.get("density") and material.get("specific_heat"):
            c_fabric += material["density"] * material["specific_heat"] * A_roof * layer.thickness_m * f_mass
        else:
            has_mass_props = False
            
    # Fallback to floor area calculation if properties are missing
    if not has_mass_props or c_fabric == 0.0:
        c_fabric = 50000.0 * A_roof  # 50 kJ/(K·m²) of floor area
        
    c_total = c_air + c_fabric
    
    # Clamp capacitance to stable minimum threshold
    c_min = 50000.0
    capacitance_clamped = False
    if c_total < c_min:
        c_total = c_min
        capacitance_clamped = True
        
    # 7. Steady-state heat flows (W) for the representative snapshot hour
    q_cond_walls_w = calculate_conduction_heat_flow(u_wall, A_walls, t_out_c, t_in_c)
    q_cond_roof_w = calculate_conduction_heat_flow(u_roof, A_roof, t_out_c, t_in_c)
    q_cond_windows_w = calculate_conduction_heat_flow(u_window, A_windows, t_out_c, t_in_c)
    
    # Solar heat gain (tau = 0.5)
    q_solar_w = calculate_solar_heat_gain(0.5, A_windows, rep_hour["shortwave_wm2"])
    
    # Ventilation / infiltration
    q_vent_w = calculate_ventilation_heat_flow(ach, volume, t_out_c, t_in_c)
    
    # Occupants sensible load (70 W per person default)
    q_occ_w = calculate_occupant_heat_gain(req.shelter.occupants, q_occ=70.0)
    
    # Total active non-HVAC heat flows
    q_other_w = q_cond_walls_w + q_cond_roof_w + q_cond_windows_w + q_solar_w + q_vent_w + q_occ_w
    
    # HVAC holding calculation
    if mode == "setpoint":
        q_hvac_w = -q_other_w
        q_net_w = 0.0  # Held exactly at setpoint
    else:
        q_hvac_w = 0.0
        q_net_w = q_other_w
        
    # 8. Transient 24-hour loop execution
    hourly_results = simulate_transient_24h(
        hourly_climate=hours,
        length_m=length,
        width_m=width,
        height_m=height,
        u_wall=u_wall,
        u_roof=u_roof,
        u_window=u_window,
        A_walls=A_walls,
        A_roof=A_roof,
        A_windows=A_windows,
        occupants=req.shelter.occupants,
        setpoint_c=req.shelter.setpoint_c,
        t_in_initial_c=req.t_in_initial_c,
        vents_open=req.shelter.vents.open,
        c_total=c_total,
    )
    
    # Calculate comfort statistics
    t_low_c = req.comfort_band.t_low_c if req.comfort_band else 18.0
    t_high_c = req.comfort_band.t_high_c if req.comfort_band else 26.0
    comfort = calculate_comfort_metrics(hourly_results, t_low_c, t_high_c)
    
    # Calculate Peak HVAC summary demands
    peak_heating = 0.0
    peak_cooling = 0.0
    for hour in hourly_results:
        q_hvac = hour["q_hvac_w"]
        if q_hvac > 0:
            if q_hvac > peak_heating:
                peak_heating = q_hvac
        elif q_hvac < 0:
            if -q_hvac > peak_cooling:
                peak_cooling = -q_hvac
                
    hvac_summary = {
        "peak_heating_w": round(peak_heating, 1),
        "peak_cooling_w": round(peak_cooling, 1),
    }
    
    return {
        "climate_source": climate["climate_source"],
        "climate_source_label": climate["climate_source_label"],
        "capacitance_j_per_k": round(c_total, 1),
        "capacitance_clamped": capacitance_clamped,
        "mode": mode,
        "steady_state": {
            "representative_hour": rep_hour_ts,
            "t_out_c": round(t_out_c, 1),
            "t_in_c": round(t_in_c, 1),
            "q_cond_walls_w": round(q_cond_walls_w, 1),
            "q_cond_roof_w": round(q_cond_roof_w, 1),
            "q_cond_windows_w": round(q_cond_windows_w, 1),
            "q_solar_w": round(q_solar_w, 1),
            "q_vent_w": round(q_vent_w, 1),
            "q_occ_w": round(q_occ_w, 1),
            "q_hvac_w": round(q_hvac_w, 1),
            "q_other_w": round(q_other_w, 1),
            "q_net_w": round(q_net_w, 1),
        },
        "hourly": hourly_results,
        "comfort": comfort,
        "hvac_summary": hvac_summary,
    }
