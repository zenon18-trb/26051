from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.climate import router as climate_router
from app.api.health import router as health_router
from app.api.locations import router as locations_router
from app.api.materials import router as materials_router
from app.api.simulate import router as simulate_router
from app.core.config import cors_origins
from app.simulation.exceptions import PhysicsValidationError

app = FastAPI(
    title="Shelter Thermal API",
    description="Area-specific shelter thermal design (SIH26051). Phase 3: Shelter Config + Simulation API.",
    version="0.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(PhysicsValidationError)
def physics_validation_error_handler(request: Request, exc: PhysicsValidationError) -> JSONResponse:
    """Handle custom physics validation errors and format them as standard API errors."""
    return JSONResponse(
        status_code=400,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": str(exc),
            }
        },
    )


@app.exception_handler(RequestValidationError)
def request_validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle FastAPI validation errors and format them as standard API errors."""
    errors = exc.errors()
    msg = "; ".join([f"{'.'.join(str(loc) for loc in err['loc'])}: {err['msg']}" for err in errors])
    return JSONResponse(
        status_code=400,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": f"Request validation failed: {msg}",
            }
        },
    )


app.include_router(health_router)
app.include_router(materials_router)
app.include_router(locations_router)
app.include_router(climate_router)
app.include_router(simulate_router)
