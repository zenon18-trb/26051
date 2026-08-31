"""Climate service layer.

Handles retrieval of hourly climate data from the Open-Meteo API or loads
local JSON fallback fixtures in case of offline runs or API failures.
"""

from __future__ import annotations

import datetime
import json
import logging
from pathlib import Path
from typing import Any

import httpx

from app.simulation.exceptions import PhysicsValidationError

logger = logging.getLogger(__name__)

# In-memory cache for live Open-Meteo results
# Key: (rounded_lat, rounded_lon, date_str) -> ClimateResponse dict
_CLIMATE_CACHE: dict[tuple[float, float, str], dict[str, Any]] = {}


def clear_climate_cache() -> None:
    """Clear the in-memory climate cache. Useful for test isolation."""
    global _CLIMATE_CACHE
    _CLIMATE_CACHE.clear()


def get_locations_file_path() -> Path:
    """Resolve absolute path to locations.json."""
    return Path(__file__).parent.parent / "data" / "locations.json"


def get_fixtures_dir_path() -> Path:
    """Resolve absolute path to climate_fixtures/ directory."""
    return Path(__file__).parent.parent / "data" / "climate_fixtures"


def load_preset_locations() -> list[dict[str, Any]]:
    """Load the preset locations list from the database."""
    path = get_locations_file_path()
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load locations from {path}: {str(e)}")
        return []


def resolve_preset_id(lat: float, lon: float, preset_id: str | None = None) -> str | None:
    """Determine if coordinates or preset_id map to a known preset location.
    
    Checks by ID first, then by coordinate proximity (within 0.05 degrees).
    """
    presets = load_preset_locations()
    
    if preset_id:
        for p in presets:
            if p.get("id") == preset_id:
                return p["id"]
                
    # Proximity check (approx 5 km matching)
    for p in presets:
        p_lat = p.get("latitude", p.get("lat"))
        p_lon = p.get("longitude", p.get("lon"))
        if p_lat is not None and p_lon is not None:
            if abs(p_lat - lat) < 0.05 and abs(p_lon - lon) < 0.05:
                return p["id"]
                
    return None


def load_fixture_data(preset_id: str | None) -> list[dict[str, Any]]:
    """Load a local climate fixture JSON.
    
    If preset_id is invalid or missing, falls back to the generic 'fallback.json' fixture.
    """
    fixtures_dir = get_fixtures_dir_path()
    filename = f"{preset_id}.json" if preset_id else "fallback.json"
    fixture_path = fixtures_dir / filename
    
    if not fixture_path.exists():
        fixture_path = fixtures_dir / "fallback.json"
        
    try:
        with open(fixture_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            if not isinstance(data, list) or len(data) != 24:
                raise PhysicsValidationError(f"Fixture {fixture_path.name} must be a list of 24 hours.")
            return data
    except Exception as e:
        # If even the fallback fixture fails to load, raise a system error
        raise RuntimeError(f"Critical error loading fallback climate fixture: {str(e)}") from e


def get_hourly_climate(
    lat: float, lon: float, preset_id: str | None = None
) -> dict[str, Any]:
    """Retrieve 24-hour climate data.
    
    Attempts to fetch from Open-Meteo API. If successful, stores in cache.
    On timeout, connection error, or invalid response, falls back to the matching
    local JSON fixture.
    
    Validation:
    - Latitude must be between -90 and 90.
    - Longitude must be between -180 and 180.
    """
    if not (-90.0 <= lat <= 90.0):
        raise PhysicsValidationError(f"Latitude must be between -90 and 90. Got: {lat}")
    if not (-180.0 <= lon <= 180.0):
        raise PhysicsValidationError(f"Longitude must be between -180 and 180. Got: {lon}")
        
    resolved_id = resolve_preset_id(lat, lon, preset_id)
    
    # 1. Check cache (only cache successful Open-Meteo runs)
    today_str = datetime.date.today().isoformat()
    cache_key = (round(lat, 2), round(lon, 2), today_str)
    
    if cache_key in _CLIMATE_CACHE:
        logger.info(f"Returning cached climate for lat={lat}, lon={lon}")
        return _CLIMATE_CACHE[cache_key]
        
    # 2. Try Open-Meteo API
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation",
        "wind_speed_unit": "ms",
        "timezone": "auto",
        "forecast_days": 1
    }
    
    try:
        logger.info(f"Requesting Open-Meteo climate for lat={lat}, lon={lon}")
        # Sync httpx request with 5.0 second timeout
        response = httpx.get(url, params=params, timeout=5.0)
        response.raise_for_status()
        
        payload = response.json()
        
        # Verify schema
        if "hourly" not in payload or "time" not in payload["hourly"]:
            raise ValueError("Malformed Open-Meteo response: missing hourly.time")
            
        hourly = payload["hourly"]
        times = hourly.get("time", [])
        temps = hourly.get("temperature_2m", [])
        solars = hourly.get("shortwave_radiation", [])
        winds = hourly.get("wind_speed_10m", [])
        hums = hourly.get("relative_humidity_2m", [])
        
        if len(times) < 24:
            raise ValueError(f"Open-Meteo response has less than 24 hours of data. Got: {len(times)}")
            
        hours = []
        for i in range(24):
            # Align timestamp format: ensure ISO format (replace space or local zone if returned)
            t_str = times[i]
            if len(t_str) == 16:  # yyyy-mm-ddThh:mm
                t_str += ":00"
                
            hours.append({
                "timestamp": t_str,
                "t_out_c": float(temps[i]),
                "shortwave_wm2": float(solars[i]),
                "wind_ms": float(winds[i]) if winds[i] is not None else 0.0,
                "rh_pct": float(hums[i]) if hums[i] is not None else 0.0
            })
            
        result = {
            "lat": lat,
            "lon": lon,
            "preset_id": resolved_id,
            "climate_source": "open_meteo",
            "climate_source_label": "Climate source: Open-Meteo (live)",
            "fallback_used": False,
            "hours": hours
        }
        
        # Store in cache
        _CLIMATE_CACHE[cache_key] = result
        return result
        
    except Exception as e:
        # Catch connection error, timeout, HTTP error, or Value/Schema errors
        logger.warning(
            f"Open-Meteo API query failed for lat={lat}, lon={lon}. "
            f"Error: {str(e)}. Falling back to local fixture."
        )
        
        # 3. Fallback to Local Fixture
        hours_fixture = load_fixture_data(resolved_id)
        
        # Update timestamps to align with current query date if needed, but for simplicity
        # and predictability, we keep the fixture dates. The task.md expects deterministic profiles.
        return {
            "lat": lat,
            "lon": lon,
            "preset_id": resolved_id,
            "climate_source": "fallback",
            "climate_source_label": "Climate source: Bundled fallback — Open-Meteo unavailable",
            "fallback_used": True,
            "hours": hours_fixture
        }
