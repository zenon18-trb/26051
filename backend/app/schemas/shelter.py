"""Pydantic schemas for the shelter envelope and configuration.

Governs input validation of dimensions, material layers, windows, vents, and occupancy.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, model_validator
from typing_extensions import Self


class MaterialLayerConfig(BaseModel):
    """Represent a single material layer in the wall or roof assembly."""

    material_id: str = Field(..., description="ID matching the material database")
    thickness_m: float = Field(..., gt=0, description="Thickness in meters")


class WindowConfig(BaseModel):
    """Represent window configuration."""

    area_m2: float = Field(..., ge=0, description="Total window area in m²")
    kind: str = Field("glazed", description="Glazing type (e.g. glazed, open)")


class VentConfig(BaseModel):
    """Represent ventilation openings status."""

    open: bool = Field(False, description="True if natural vents are open, False otherwise")


class ShelterConfig(BaseModel):
    """Represent complete physical configuration of the shelter."""

    length_m: float = Field(..., gt=0, description="Shelter length in meters")
    width_m: float = Field(..., gt=0, description="Shelter width in meters")
    height_m: float = Field(..., gt=0, description="Shelter height in meters")
    wall_layers: list[MaterialLayerConfig] = Field(..., description="Series list of wall material layers")
    roof_layers: list[MaterialLayerConfig] = Field(..., description="Series list of roof material layers")
    windows: WindowConfig = Field(..., description="Window configuration")
    vents: VentConfig = Field(..., description="Ventilation status")
    occupants: int = Field(..., ge=0, description="Number of occupants")
    setpoint_c: float | None = Field(None, description="Optional target indoor setpoint temperature in °C")

    @model_validator(mode="after")
    def validate_geometry(self) -> Self:
        """Enforce physical boundaries and dimensions relations."""
        if not self.wall_layers:
            raise ValueError("wall_layers cannot be empty.")
        if not self.roof_layers:
            raise ValueError("roof_layers cannot be empty.")
            
        gross_wall_area = 2 * (self.length_m + self.width_m) * self.height_m
        if self.windows.area_m2 > gross_wall_area:
            raise ValueError(
                f"Window area ({self.windows.area_m2} m²) cannot exceed "
                f"gross wall area ({gross_wall_area:.2f} m²)."
            )
        return self
