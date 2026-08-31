"""Pydantic schemas for the materials API.

These schemas govern the serialization and validation of the materials database
for the FastAPI routers and API contract.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class MaterialSchema(BaseModel):
    """Represent a single material's properties in the catalog."""

    id: str = Field(..., description="Unique material identifier")
    name: str = Field(..., description="Human-readable name")
    category: str = Field(..., description="Material category (e.g. insulation, metal, masonry)")
    k: float = Field(..., description="Thermal conductivity in W/(m·K)")
    thermal_conductivity: float = Field(..., description="Thermal conductivity in W/(m·K), alias of k")
    density: float = Field(..., description="Density in kg/m³")
    specific_heat: float = Field(..., description="Specific heat in J/(kg·K)")
    typical_thickness: float = Field(..., description="Typical application thickness in m")
    relative_cost: str = Field(..., description="Approximate relative cost descriptor")
    relative_weight: str = Field(..., description="Approximate relative weight descriptor")
    confidence: str = Field(..., description="Data confidence score ('reference' or 'approximate')")
    source: str = Field(..., description="Reference source of engineering data")
    notes: str = Field(..., description="Practical notes or application advice")


class MaterialListResponse(BaseModel):
    """API response shape for GET /api/materials."""

    materials: list[MaterialSchema]
