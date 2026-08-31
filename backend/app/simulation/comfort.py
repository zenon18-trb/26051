"""Thermal comfort calculation module.

Assesses temperature deviation outside the comfortable band (default: 18 - 26 °C).
"""

from __future__ import annotations

from typing import Any


def calculate_comfort_metrics(
    hourly_results: list[dict[str, Any]],
    t_low_c: float = 18.0,
    t_high_c: float = 26.0,
) -> dict[str, Any]:
    """Calculate the overall thermal comfort percentage and peak boundary deviations."""
    if not hourly_results:
        return {
            "comfort_pct": 0.0,
            "hours_in_band": 0,
            "total_hours": 0,
            "peak_deviation_above_k": 0.0,
            "peak_deviation_below_k": 0.0,
            "t_low_c": t_low_c,
            "t_high_c": t_high_c,
        }
        
    total_hours = len(hourly_results)
    comfortable_hours = 0
    
    t_in_temps = [hour["t_in_c"] for hour in hourly_results]
    
    for t_in in t_in_temps:
        if t_low_c <= t_in <= t_high_c:
            comfortable_hours += 1
            
    comfort_pct = (comfortable_hours / total_hours) * 100.0
    
    t_max = max(t_in_temps)
    t_min = min(t_in_temps)
    
    peak_deviation_above = max(0.0, t_max - t_high_c)
    peak_deviation_below = max(0.0, t_low_c - t_min)
    
    return {
        "comfort_pct": round(comfort_pct, 1),
        "hours_in_band": comfortable_hours,
        "total_hours": total_hours,
        "peak_deviation_above_k": round(peak_deviation_above, 2),
        "peak_deviation_below_k": round(peak_deviation_below, 2),
        "t_low_c": t_low_c,
        "t_high_c": t_high_c,
    }
