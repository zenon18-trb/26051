"""FastAPI router for climate endpoint.

Exposes hourly climate retrieval by coordinates and preset mapping.
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.schemas.climate import ClimateResponse
from app.services.climate_service import get_hourly_climate

router = APIRouter()


@router.get("/api/climate", response_model=ClimateResponse)
def get_climate(
    lat: float = Query(..., description="Latitude of the target coordinates"),
    lon: float = Query(..., description="Longitude of the target coordinates"),
    preset_id: str | None = Query(None, description="Optional preset identifier mapping to local fallback")
) -> ClimateResponse:
    """Retrieve 24-hour hourly climate variables (temperature, radiation, wind, humidity).
    
    Attempts to fetch live data from the Open-Meteo API. If offline, timed out, or failing,
    falls back to the corresponding preset JSON fixture.
    """
    climate = get_hourly_climate(lat=lat, lon=lon, preset_id=preset_id)
    return ClimateResponse(**climate)
