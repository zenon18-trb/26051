"""Custom exceptions for the pure Python simulation engine.

This module contains only pure Python code with no FastAPI or framework dependencies.
"""

from __future__ import annotations


class PhysicsValidationError(ValueError):
    """Exception raised when a thermal model input violates physics laws or limits.
    
    Inherits from ValueError for compatibility with standard Python exception handling.
    """
    pass
