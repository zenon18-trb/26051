"""Pydantic schemas for the climate and locations API.

These schemas govern the validation and serialization of locations presets
and hourly climate data structures.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ClimateHourSchema(BaseModel):
    """Represent climate variables for a single hour."""

    timestamp: str = Field(..., description="ISO-8601 format timestamp (e.g. 2026-08-31T00:00:00)")
    t_out_c: float = Field(..., description="Outdoor dry-bulb temperature in °C")
    shortwave_wm2: float = Field(..., description="Global horizontal shortwave solar irradiance in W/m²")
    wind_ms: float | None = Field(None, description="Wind speed in m/s (optional, display only)")
    rh_pct: float | None = Field(None, description="Relative humidity in % (optional, display only)")


class ClimateResponse(BaseModel):
    """Represent the hourly climate data payload for GET /api/climate."""

    lat: float = Field(..., description="Latitude of the query location")
    lon: float = Field(..., description="Longitude of the query location")
    preset_id: str | None = Field(None, description="Preset ID if resolved, otherwise null")
    climate_source: str = Field(..., description="Source of the data ('open_meteo' or 'fallback')")
    climate_source_label: str = Field(
        ..., 
        description="User-facing descriptive sentence indicating the data source honestly"
    )
    fallback_used: bool = Field(
        ...,
        description="True if the API fell back to a local fixture, False if it retrieved live data"
    )
    hours: list[ClimateHourSchema] = Field(..., description="List of exactly 24 hourly climate data points")


class LocationSchema(BaseModel):
    """Represent a single preset location's properties."""

    id: str = Field(..., description="Unique preset location identifier")
    name: str = Field(..., description="Human-readable city/outpost name")
    region: str = Field(..., description="State or territory region")
    latitude: float = Field(..., description="Full latitude coordinate")
    longitude: float = Field(..., description="Full longitude coordinate")
    lat: float = Field(..., description="Short latitude alias")
    lon: float = Field(..., description="Short longitude alias")
    environment_type: str = Field(..., description="Environment classification (e.g. hot-arid, cold-arid)")
    climate_type: str = Field(..., description="Climate type classification (alias of environment_type)")
    description: str = Field(..., description="Human-readable description of the environment")
    fixture_id: str = Field(..., description="Target JSON fixture filename (sans extension)")


class LocationListResponse(BaseModel):
    """API response shape for GET /api/locations."""

    locations: list[LocationSchema]
