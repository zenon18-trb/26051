"""FastAPI router for locations endpoint.

Exposes preset geographic and climate profile locations.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.climate import LocationListResponse
from app.services.climate_service import load_preset_locations

router = APIRouter()


@router.get("/api/locations", response_model=LocationListResponse)
def get_locations() -> LocationListResponse:
    """Retrieve the curated list of preset locations for the demo.
    
    Returns geographical coordinates, climate environment types, and descriptions
    for each of the 5 reference Indian regions.
    """
    locations = load_preset_locations()
    return LocationListResponse(locations=locations)
