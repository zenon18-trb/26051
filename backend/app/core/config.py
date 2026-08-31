"""Application settings from environment variables.

Phase 0 only needs which browser origins may call this API (CORS).
Defaults match local Next.js (`npm run dev` on port 3000).
"""

from __future__ import annotations

import os


def cors_origins() -> list[str]:
    raw = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    )
    return [origin.strip() for origin in raw.split(",") if origin.strip()]
