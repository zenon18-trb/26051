"""FastAPI router for materials endpoint.

Exposes the materials database catalog as structured Pydantic payloads.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.materials import MaterialListResponse
from app.simulation import load_materials

router = APIRouter()


@router.get("/api/materials", response_model=MaterialListResponse)
def get_materials() -> MaterialListResponse:
    """Retrieve the material database catalogue.
    
    Returns a list of all materials with their thermal and physical properties
    to support shelter envelope layer design and configuration.
    """
    materials = load_materials()
    return MaterialListResponse(materials=materials)
