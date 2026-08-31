"""Material loading and lookup utilities.

This module loads material definitions from the static materials database
and provides lookup utilities. It remains independent of any FastAPI/network code.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.simulation.exceptions import PhysicsValidationError


_MATERIALS_CACHE: list[dict[str, Any]] | None = None


def get_materials_file_path() -> Path:
    """Resolve the absolute path to materials.json database file."""
    return Path(__file__).parent.parent / "data" / "materials.json"


def load_materials() -> list[dict[str, Any]]:
    """Load and return the list of materials from the JSON database.
    
    Caches the loaded materials in memory.
    """
    global _MATERIALS_CACHE
    if _MATERIALS_CACHE is not None:
        return _MATERIALS_CACHE
        
    path = get_materials_file_path()
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        if not isinstance(data, list):
            raise PhysicsValidationError("Material database must be a list of materials.")
            
        _MATERIALS_CACHE = data
        return _MATERIALS_CACHE
    except FileNotFoundError:
        raise PhysicsValidationError(f"Material database file not found at: {path}")
    except json.JSONDecodeError as e:
        raise PhysicsValidationError(f"Invalid JSON format in material database: {str(e)}")


def get_material_by_id(material_id: str) -> dict[str, Any]:
    """Retrieve a single material's properties by its unique ID.
    
    Raises PhysicsValidationError if the material is not found.
    """
    materials = load_materials()
    for material in materials:
        if material.get("id") == material_id:
            return material
            
    raise PhysicsValidationError(f"Material ID '{material_id}' not found in the database.")
