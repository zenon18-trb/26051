"""Pydantic schemas for the simulation requests and responses.

Governs structural validation of climate inputs, location mappings, and the 
steady-state and transient thermal breakdown output structure.
"""

from __future__ import annotations

from pydantic import BaseModel, Field
from app.schemas.shelter import ShelterConfig


class LocationConfig(BaseModel):
    """Coordinates and preset details of the simulation run."""

    lat: float = Field(..., ge=-90.0, le=90.0, description="Latitude coordinate")
    lon: float = Field(..., ge=-180.0, le=180.0, description="Longitude coordinate")
    preset_id: str | None = Field(None, description="Optional preset ID mapping to fallback fixtures")


class ComfortBand(BaseModel):
    """Thermal comfort boundary limits."""

    t_low_c: float = Field(18.0, description="Lower comfort band threshold in °C")
    t_high_c: float = Field(26.0, description="Upper comfort band threshold in °C")


class SimulationRequest(BaseModel):
    """Input payload for POST /api/simulate."""

    location: LocationConfig = Field(..., description="Target geographical location")
    shelter: ShelterConfig = Field(..., description="Shelter envelope physical configuration")
    comfort_band: ComfortBand = Field(default_factory=ComfortBand, description="Desired comfort boundaries")
    t_in_initial_c: float | None = Field(None, description="Optional initial/design indoor dry-bulb temperature in °C")


class SteadyStateBreakdown(BaseModel):
    """Steady-state component heat flow breakdown for the representative hour."""

    representative_hour: str = Field(..., description="Timestamp of the selected design hour")
    t_out_c: float = Field(..., description="Outdoor temperature during representative hour in °C")
    t_in_c: float = Field(..., description="Indoor temperature during representative hour in °C")
    
    # Heat flows (W) - Positive = entering indoor air, Negative = leaving indoor air
    q_cond_walls_w: float = Field(..., description="Conductive heat gain/loss through walls in W")
    q_cond_roof_w: float = Field(..., description="Conductive heat gain/loss through roof in W")
    q_cond_windows_w: float = Field(..., description="Conductive heat gain/loss through windows in W")
    q_solar_w: float = Field(..., description="Solar heat gain through glazing in W")
    q_vent_w: float = Field(..., description="Infiltration/ventilation heat flow in W")
    q_occ_w: float = Field(..., description="Sensible heat gain from occupants in W")
    q_hvac_w: float = Field(..., description="HVAC heating (positive) or cooling (negative) input in W")
    q_other_w: float = Field(..., description="Sum of all non-HVAC heat flows in W")
    q_net_w: float = Field(..., description="Net heat flow into the indoor node in W (0.0 in setpoint mode)")


class HourlySimulationPoint(BaseModel):
    """Lumped-node physics heat flows and indoor temperature for a single hour step."""

    timestamp: str = Field(..., description="ISO timestamp of the climate hour")
    t_out_c: float = Field(..., description="Outdoor dry-bulb temperature in °C")
    t_in_c: float = Field(..., description="Predicted indoor dry-bulb temperature in °C")
    
    # Heat flows (W)
    q_cond_walls_w: float = Field(..., description="Conductive heat gain/loss through walls in W")
    q_cond_roof_w: float = Field(..., description="Conductive heat gain/loss through roof in W")
    q_cond_windows_w: float = Field(..., description="Conductive heat gain/loss through windows in W")
    q_solar_w: float = Field(..., description="Solar heat gain through window glazing in W")
    q_vent_w: float = Field(..., description="Ventilation / Infiltration heat load in W")
    q_occ_w: float = Field(..., description="Sensible heat load from occupants in W")
    q_hvac_w: float = Field(..., description="HVAC load required (positive=heating, negative=cooling) in W")
    q_other_w: float = Field(..., description="Total non-HVAC heat flows entering the air node in W")
    q_net_w: float = Field(..., description="Net heat flow (Q_other + Q_hvac) in W")


class ComfortSummary(BaseModel):
    """Thermal comfort statistics over the 24-hour cycle."""

    comfort_pct: float = Field(..., description="Percentage of hours where indoor temperature is in comfort range")
    hours_in_band: int = Field(..., description="Number of hours within comfort band range")
    total_hours: int = Field(..., description="Total hours simulated (typically 24)")
    peak_deviation_above_k: float = Field(..., description="Maximum indoor temperature overshoot above high threshold in K")
    peak_deviation_below_k: float = Field(..., description="Maximum indoor temperature undershoot below low threshold in K")
    t_low_c: float = Field(..., description="Comfort band lower limit in °C")
    t_high_c: float = Field(..., description="Comfort band upper limit in °C")


class HVACSummary(BaseModel):
    """Peak loads summary of the plant sizing demand."""

    peak_heating_w: float = Field(..., description="Peak heating system power demand in W")
    peak_cooling_w: float = Field(..., description="Peak cooling system power demand in W")


class SimulationResponse(BaseModel):
    """Complete output payload returned by POST /api/simulate."""

    climate_source: str = Field(..., description="Retrieved data source ('open_meteo' or 'fallback')")
    climate_source_label: str = Field(..., description="Honest human-readable label of the weather data source")
    capacitance_j_per_k: float = Field(..., description="Calculated total thermal capacitance of the shelter in J/K")
    capacitance_clamped: bool = Field(..., description="True if capacitance was clamped upward to stable minimum")
    mode: str = Field(..., description="Simulation HVAC mode ('floating' or 'setpoint')")
    steady_state: SteadyStateBreakdown = Field(..., description="Steady-state representative hour thermal snapshot")
    hourly: list[HourlySimulationPoint] = Field(..., description="24-hour transient simulation time-series")
    comfort: ComfortSummary = Field(..., description="Transient comfort assessment summary")
    hvac_summary: HVACSummary = Field(..., description="Peak HVAC loads summary")
    
    # Metadata
    units: dict[str, str] = Field(
        default={
            "dimensions": "meters (m)",
            "areas": "square meters (m²)",
            "temperatures": "degrees Celsius (°C)",
            "heat_flows": "Watts (W)",
            "conductivities": "W/(m·K)",
            "resistances": "m²·K/W",
            "capacitance": "Joules per Kelvin (J/K)"
        },
        description="Units definition for physical quantities returned"
    )
    assumptions: list[str] = Field(
        default=[
            "Single-zone lumped node representation (no spatial gradients)",
            "Conduction heat transfer calculated using steady-state U-values with standard surface resistances",
            "Solar radiation is active in the 24-hour transient loop using standard window solar transmittance (tau = 0.5)",
            "Ventilation/infiltration is active in the 24-hour transient loop (ACH = 0.5 if closed, 5.0 if open)",
            "Occupant sensible heat output is taken as 70.0 W per person",
            "Conduction heat flow sign convention: Positive = heat entering shelter air node",
            "Timestep delta_t = 3600 seconds (1 hour) using Euler numerical integration"
        ],
        description="Explicit physical modeling boundaries and assumptions"
    )
