from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter()


class HealthResponse(BaseModel):
    """Liveness payload. The frontend treats this shape as 'backend connected'."""

    status: str = Field(examples=["ok"])
    service: str = Field(examples=["shelter-thermal-api"])


@router.get("/api/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    return HealthResponse(status="ok", service="shelter-thermal-api")
