"""Pure Python steady-state thermal simulation engine.

This module implements the fundamental physics equations for first-order shelter
thermal simulation in SI units. It has zero framework or network dependencies.

Positive Q represents heat flow entering the indoor air node.
"""

from __future__ import annotations

from app.simulation.exceptions import PhysicsValidationError


def calculate_layer_resistance(thickness_m: float, k: float) -> float:
    """Calculate the thermal resistance of a single material layer.

    Formula: R = thickness / thermal_conductivity (m²·K/W)
    """
    if thickness_m <= 0:
        raise PhysicsValidationError(
            f"Thickness must be greater than zero. Got: {thickness_m}"
        )
    if k <= 0:
        raise PhysicsValidationError(
            f"Thermal conductivity (k) must be greater than zero. Got: {k}"
        )
    return thickness_m / k


def calculate_total_resistance(
    layer_resistances: list[float], r_si: float = 0.0, r_so: float = 0.0
) -> float:
    """Calculate the total thermal resistance of a series of layers.

    Formula: R_total = R_si + sum(R_layer_i) + R_so (m²·K/W)
    """
    if not layer_resistances:
        raise PhysicsValidationError("Layer resistances list cannot be empty.")
    
    for idx, r in enumerate(layer_resistances):
        if r <= 0:
            raise PhysicsValidationError(
                f"Layer resistance at index {idx} must be greater than zero. Got: {r}"
            )
            
    if r_si < 0:
        raise PhysicsValidationError(
            f"Inside surface resistance (r_si) cannot be negative. Got: {r_si}"
        )
    if r_so < 0:
        raise PhysicsValidationError(
            f"Outside surface resistance (r_so) cannot be negative. Got: {r_so}"
        )
        
    return r_si + sum(layer_resistances) + r_so


def calculate_u_value(r_total: float) -> float:
    """Calculate the thermal transmittance (U-value).

    Formula: U = 1 / R_total (W/(m²·K))
    """
    if r_total <= 0:
        raise PhysicsValidationError(
            f"Total resistance (R_total) must be greater than zero to calculate U-value. Got: {r_total}"
        )
    return 1.0 / r_total


def calculate_conduction_heat_flow(
    u_value: float, area_m2: float, t_out_c: float, t_in_c: float
) -> float:
    """Calculate the conductive heat flow through an element.

    Formula: Q_cond = U * A * (T_out - T_in) (W)
    
    Sign Convention:
    - Positive Q = heat entering the indoor air (T_out > T_in)
    - Negative Q = heat leaving the indoor air (T_out < T_in)
    """
    if u_value <= 0:
        raise PhysicsValidationError(
            f"U-value must be greater than zero. Got: {u_value}"
        )
    if area_m2 < 0:
        raise PhysicsValidationError(
            f"Area cannot be negative. Got: {area_m2}"
        )
    if t_out_c < -273.15:
        raise PhysicsValidationError(
            f"Outdoor temperature cannot be below absolute zero. Got: {t_out_c}"
        )
    if t_in_c < -273.15:
        raise PhysicsValidationError(
            f"Indoor temperature cannot be below absolute zero. Got: {t_in_c}"
        )
        
    return u_value * area_m2 * (t_out_c - t_in_c)


def calculate_occupant_heat_gain(occupants: int, q_occ: float = 70.0) -> float:
    """Calculate the sensible heat gain from occupants.

    Formula: Q_occ = occupants * q_occ (W)
    Must always be non-negative.
    """
    if occupants < 0:
        raise PhysicsValidationError(
            f"Occupant count cannot be negative. Got: {occupants}"
        )
    if q_occ < 0:
        raise PhysicsValidationError(
            f"Heat gain per occupant (q_occ) cannot be negative. Got: {q_occ}"
        )
    return float(occupants * q_occ)


def calculate_solar_heat_gain(
    transmittance: float, window_area_m2: float, irradiance_wm2: float
) -> float:
    """Calculate solar heat gain through glazed windows.

    Formula: Q_solar = transmittance * A_windows * Irradiance (W)
    Must always be non-negative.
    """
    if transmittance < 0 or transmittance > 1:
        raise PhysicsValidationError(
            f"Transmittance must be between 0 and 1. Got: {transmittance}"
        )
    if window_area_m2 < 0:
        raise PhysicsValidationError(
            f"Window area cannot be negative. Got: {window_area_m2}"
        )
    if irradiance_wm2 < 0:
        raise PhysicsValidationError(
            f"Irradiance cannot be negative. Got: {irradiance_wm2}"
        )
    return transmittance * window_area_m2 * irradiance_wm2


def calculate_ventilation_heat_flow(
    ach: float,
    volume_m3: float,
    t_out_c: float,
    t_in_c: float,
    density_air: float = 1.2,
    cp_air: float = 1005.0,
) -> float:
    """Calculate the heat flow due to ventilation/infiltration.

    Formula:
      mass_flow = density_air * volume * (ACH / 3600)
      Q_vent = mass_flow * cp_air * (T_out - T_in) (W)
    """
    if ach < 0:
        raise PhysicsValidationError(f"ACH cannot be negative. Got: {ach}")
    if volume_m3 < 0:
        raise PhysicsValidationError(f"Volume cannot be negative. Got: {volume_m3}")
    if density_air < 0:
        raise PhysicsValidationError(f"Air density cannot be negative. Got: {density_air}")
    if cp_air < 0:
        raise PhysicsValidationError(f"Air specific heat cannot be negative. Got: {cp_air}")
    if t_out_c < -273.15:
        raise PhysicsValidationError(f"Outdoor temperature below absolute zero. Got: {t_out_c}")
    if t_in_c < -273.15:
        raise PhysicsValidationError(f"Indoor temperature below absolute zero. Got: {t_in_c}")

    mass_flow = density_air * volume_m3 * (ach / 3600.0)
    return mass_flow * cp_air * (t_out_c - t_in_c)


# Aliases to match varying specifications in PROJECT_SPEC and ARCHITECTURE
r_value = calculate_layer_resistance
total_r_value = calculate_total_resistance
u_value = calculate_u_value
q_cond = calculate_conduction_heat_flow
q_occ = calculate_occupant_heat_gain
q_solar = calculate_solar_heat_gain
q_vent = calculate_ventilation_heat_flow
