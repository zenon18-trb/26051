"""FastAPI router for simulation endpoint.

Exposes shelter simulation request processing and validation.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.simulation import SimulationRequest, SimulationResponse
from app.services.simulation_service import run_simulation

router = APIRouter()


@router.post("/api/simulate", response_model=SimulationResponse)
def simulate_shelter(request: SimulationRequest) -> SimulationResponse:
    """Run a steady-state thermal simulation for a configured shelter.
    
    Processes dimensions, layer properties, windows, and occupancy to calculate
    conductive heat loads and required HVAC system inputs at peak design hours.
    """
    result = run_simulation(request)
    return SimulationResponse(**result)
