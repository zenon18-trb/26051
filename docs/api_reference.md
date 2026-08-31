# API reference — SIH26051

Locked HTTP contract for the 4-day MVP. Base URL is the FastAPI origin
(e.g. `http://127.0.0.1:8000`). Frontend uses `NEXT_PUBLIC_API_BASE_URL`.

All request/response bodies are JSON except `POST /api/report`
(response is `application/pdf`).

**SI:** thicknesses, lengths, and areas in the API are metres and m².
Temperatures in °C. Heat flows in W. See `docs/physics_reference.md`.

**Climate honesty:** every climate-bearing response includes
`climate_source` (`open_meteo` | `fallback`) and
`climate_source_label`. Fallback must never claim to be live.

**PDF:** the server **recomputes**. Do not send engine results from the
browser as authoritative input.

Error body (all JSON endpoints):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable explanation."
  }
}
```

Never return a raw traceback to the client.

---

## GET /api/health

**Purpose:** Liveness check for CORS and demo wiring.

**Request:** none.

**Response `200`:**

```json
{
  "status": "ok",
  "service": "shelter-thermal-api"
}
```

**Errors:** none expected if the process is up.

**Example:**

```http
GET /api/health
```

---

## GET /api/locations

**Purpose:** Curated preset Indian locations database for the demo.

**Request:** none.

**Response `200`:**

```json
{
  "locations": [
    {
      "id": "jaisalmer",
      "name": "Jaisalmer",
      "region": "Rajasthan",
      "latitude": 26.91,
      "longitude": 70.91,
      "lat": 26.91,
      "lon": 70.91,
      "environment_type": "hot-arid",
      "climate_type": "hot-arid",
      "description": "Extreme hot desert environment with high summer temperatures and low relative humidity.",
      "fixture_id": "jaisalmer"
    }
  ]
}
```

**Errors:** `500` if `locations.json` cannot be loaded.

**Example:**

```http
GET /api/locations
```

---

## GET /api/materials

**Purpose:** Material catalogue for the shelter form (ids, k, physical properties, confidence).

**Request:** none.

**Response `200`:**

```json
{
  "materials": [
    {
      "id": "puf",
      "name": "PUF Insulation",
      "category": "insulation",
      "k": 0.025,
      "thermal_conductivity": 0.025,
      "density": 32.0,
      "specific_heat": 1400.0,
      "typical_thickness": 0.05,
      "relative_cost": "moderate-high (approximate)",
      "relative_weight": "low (approximate)",
      "confidence": "approximate",
      "source": "Typical closed-cell polyurethane board range.",
      "notes": "Polyurethane foam, high-performance insulation."
    }
  ]
}
```

Thickness is **not** forced in the catalogue; the user supplies \(d\) during simulation. However, a `typical_thickness` is provided for user guidance.

**Errors:** `500` if `materials.json` cannot be loaded.

---

## GET /api/climate

**Purpose:** Hourly climate for a point, with source labelling and validation checks.

**Query:**

| Param | Required | Meaning |
|-------|----------|---------|
| `lat` | yes | Latitude (must be between -90 and 90) |
| `lon` | yes | Longitude (must be between -180 and 180) |
| `preset_id` | no | Optional preset ID to select matching local fixture on fallback |

**Response `200` (Success via live Open-Meteo):**

```json
{
  "lat": 28.61,
  "lon": 77.21,
  "preset_id": "delhi",
  "climate_source": "open_meteo",
  "climate_source_label": "Climate source: Open-Meteo (live)",
  "fallback_used": false,
  "hours": [
    {
      "timestamp": "2026-08-31T00:00:00",
      "t_out_c": 31.2,
      "shortwave_wm2": 0.0,
      "wind_ms": 2.1,
      "rh_pct": 55.0
    }
  ]
}
```

**Response `200` (Fallback via local fixture in case of timeout/offline):**

```json
{
  "lat": 28.61,
  "lon": 77.21,
  "preset_id": "delhi",
  "climate_source": "fallback",
  "climate_source_label": "Climate source: Bundled fallback — Open-Meteo unavailable",
  "fallback_used": true,
  "hours": [
    {
      "timestamp": "2026-08-31T00:00:00",
      "t_out_c": 26.0,
      "shortwave_wm2": 0.0,
      "wind_ms": 2.8,
      "rh_pct": 66.0
    }
  ]
}
```

`hours` always contains exactly 24 entries when successful.

**Errors:**

| Status | When |
|--------|------|
| `400` | Missing parameters, or out-of-bounds latitude/longitude |
| `503` | Fixture directory missing or critical JSON reading error |

**Example:**

```http
GET /api/climate?lat=28.61&lon=77.21&preset_id=delhi
```

---

## POST /api/simulate

**Purpose:** Steady-state snapshot + 24-hour RC series + comfort for
**one** shelter.

**Request:**

```json
{
  "location": {
    "lat": 28.61,
    "lon": 77.21,
    "preset_id": "delhi"
  },
  "shelter": {
    "length_m": 6,
    "width_m": 4,
    "height_m": 2.5,
    "wall_layers": [
      { "material_id": "plywood", "thickness_m": 0.018 }
    ],
    "roof_layers": [
      { "material_id": "steel_sheet", "thickness_m": 0.0008 },
      { "material_id": "puf", "thickness_m": 0.05 }
    ],
    "windows": {
      "area_m2": 2.0,
      "kind": "glazed"
    },
    "vents": {
      "open": false
    },
    "occupants": 4,
    "setpoint_c": null
  },
  "comfort_band": {
    "t_low_c": 18,
    "t_high_c": 26
  },
  "t_in_initial_c": null
}
```

`setpoint_c`: omit or `null` ⇒ floating mode, `Q_hvac = 0`.
A number ⇒ hold indoor T at setpoint, `Q_hvac = -Q_other`.

`windows.kind`: `"glazed"` | `"open"` (open ⇒ ventilation opening, no
solar τ on that area; prefer using `vents` for ACH and keep windows as
glazing in the MVP if possible).

**Response `200` (shape):**

```json
{
  "climate_source": "open_meteo",
  "climate_source_label": "Climate source: Open-Meteo (live)",
  "capacitance_j_per_k": 500000,
  "capacitance_clamped": false,
  "mode": "floating",
  "steady_state": {
    "representative_hour": "2026-08-31T15:00:00",
    "t_out_c": 42.0,
    "t_in_c": 26.0,
    "q_cond_walls_w": 120.0,
    "q_cond_roof_w": 80.0,
    "q_cond_windows_w": 40.0,
    "q_solar_w": 200.0,
    "q_vent_w": 30.0,
    "q_occ_w": 280.0,
    "q_hvac_w": 0.0,
    "q_other_w": 450.0,
    "q_net_w": 450.0
  },
  "hourly": [
    {
      "timestamp": "2026-08-31T00:00:00",
      "t_out_c": 31.2,
      "t_in_c": 31.2,
      "q_cond_walls_w": 0.0,
      "q_cond_roof_w": 0.0,
      "q_cond_windows_w": 0.0,
      "q_solar_w": 0.0,
      "q_occ_w": 280.0,
      "q_vent_w": 0.0,
      "q_hvac_w": 0.0,
      "q_net_w": 280.0
    }
  ],
  "comfort": {
    "t_low_c": 18,
    "t_high_c": 26,
    "comfort_pct": 41.7,
    "hours_in_band": 10,
    "peak_deviation_above_k": 8.2,
    "peak_deviation_below_k": 0.0
  },
  "hvac_summary": {
    "peak_heating_w": 0.0,
    "peak_cooling_w": 0.0
  }
}
```

`mode` is `"floating"` or `"setpoint"`.
`hourly` length is 24.
In setpoint mode, each `t_in_c` equals `setpoint_c` and
`q_hvac_w = - (q_cond_walls_w + q_cond_roof_w + q_cond_windows_w + q_solar_w + q_occ_w + q_vent_w)`.

**Errors:**

| Status | When |
|--------|------|
| `400` | Validation (negative thickness, unknown material, window area > walls, etc.) |
| `503` | Climate unavailable and fixture load failed |

**Example:**

```http
POST /api/simulate
Content-Type: application/json
```

---

## POST /api/recommend

**Purpose:** Simulate 2–3 **user-defined** candidates; rank with the
locked thermal score; return a justification built from computed deltas.

**Request:**

```json
{
  "location": {
    "lat": 28.61,
    "lon": 77.21,
    "preset_id": "delhi"
  },
  "baseline_index": 0,
  "candidates": [
    { "id": "baseline", "label": "Plywood walls, no extra insulation", "shelter": {} },
    { "id": "puf50", "label": "Plywood + 50 mm PUF roof/walls", "shelter": {} }
  ],
  "comfort_band": { "t_low_c": 18, "t_high_c": 26 }
}
```

Each `shelter` is the same object as in `/api/simulate`.
`candidates` length must be 2 or 3.
Weights are **server-side** (physics reference); not client-supplied in
the MVP (avoids silent score shopping).

**Response `200`:**

```json
{
  "climate_source": "fallback",
  "climate_source_label": "Climate source: Bundled fallback — Open-Meteo unavailable",
  "weights": {
    "comfort_pct": 0.5,
    "peak_cooling_w": 0.25,
    "peak_heating_w": 0.25
  },
  "ranked": [
    {
      "id": "puf50",
      "label": "Plywood + 50 mm PUF roof/walls",
      "score": 0.82,
      "comfort_pct": 70.8,
      "peak_heating_w": 0,
      "peak_cooling_w": 1200,
      "simulation": {}
    }
  ],
  "recommended_id": "puf50",
  "justification": "Adding 50 mm PUF increased time in the 18–26 °C band from 41.7% to 70.8% under the selected climate."
}
```

`simulation` on each candidate is the same object as a `/api/simulate`
response (or a subset containing `comfort`, `hvac_summary`, `steady_state`).
Every number in `justification` must appear in those objects.

**Errors:**

| Status | When |
|--------|------|
| `400` | Fewer than 2 or more than 3 candidates; invalid shelter |
| `503` | Climate + fixture failure |

---

## POST /api/report

**Purpose:** Recompute the pipeline from **configuration**, then return a
PDF. Not a printer for client-side numbers.

**Content-Type:** `application/json`

**Request — single shelter** (same as simulate, plus optional title):

```json
{
  "kind": "simulate",
  "title": "Shelter thermal estimate",
  "location": { "lat": 28.61, "lon": 77.21, "preset_id": "delhi" },
  "shelter": {},
  "comfort_band": { "t_low_c": 18, "t_high_c": 26 }
}
```

**Request — comparison** (same as recommend):

```json
{
  "kind": "recommend",
  "title": "Configuration comparison",
  "location": { "lat": 28.61, "lon": 77.21, "preset_id": "delhi" },
  "baseline_index": 0,
  "candidates": [],
  "comfort_band": { "t_low_c": 18, "t_high_c": 26 }
}
```

**Do not accept** a `results` / `hourly` / `score` payload as input
that skips the engine.

**Response `200`:**

- Headers: `Content-Type: application/pdf`
- Body: PDF bytes
- Suggested: `Content-Disposition: attachment; filename="shelter-thermal-report.pdf"`

PDF **must** include:

- climate source label (live or fallback sentence)
- configuration summary
- steady-state component table
- 24-hour table (chart image optional)
- comfort
- if `kind=recommend`: comparison + recommendation + justification
- assumptions / limitations
- disclaimer: first-order tool, not CFD/EnergyPlus

**Errors:**

| Status | When |
|--------|------|
| `400` | Invalid `kind` or shelter |
| `503` | Climate + fixture failure |
| `500` | PDF renderer failure (logged server-side; client gets generic message) |

**Example:**

```http
POST /api/report
Content-Type: application/json
```

---

## CORS

Allow the frontend origin (local Next.js). Configured in FastAPI, not
in the engine.

## Versioning

No `/v1` prefix in the MVP. Changing a field is a doc + schema change
in the same phase; do not add parallel endpoints.
