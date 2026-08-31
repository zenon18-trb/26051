# ARCHITECTURE.md — System Architecture

Locked architecture for the 4-day prototype. Do not add layers, a
database, or extra services unless a genuine blocking technical problem
appears (none is known).

## 1. High-level layering

```
┌─────────────────────────────────────────────┐
│  UI (Next.js App Router / React)              │
│  presets, form, dashboard, compare, PDF btn │
└───────────────────────┬───────────────────────┘
                         │ HTTP REST / JSON
┌───────────────────────▼───────────────────────┐
│  API layer (FastAPI routers)                │
│  - Pydantic validation                      │
│  - HTTP ↔ service calls only               │
└───────────────────────┬───────────────────────┘
                         │ plain Python calls
┌───────────────────────▼───────────────────────┐
│  Application / service layer                    │
│  - climate fetch or fixture fallback            │
│  - orchestrate simulation                      │
│  - rank candidates (thermal scores)            │
│  - recompute + render PDF                      │
└──────────┬────────────────────────┬────────────┘
           │                        │
┌──────────▼──────────┐   ┌─────────▼────────────┐
│  Climate service      │   │  Thermal simulation │
│  - Open-Meteo (httpx) │   │  engine (pure Python)│
│  - bundled fixtures    │   │  - steady-state      │
│  - source label        │   │  - RC 24h + comfort  │
└─────────────────────────┘   └──────────────────────┘
```

**Key rule:** the simulation engine never imports FastAPI, httpx,
frontend code, or any network library. It takes structured Python data
in and returns structured results. It is unit-tested with hand-computed
numbers and cannot be broken by a weather-API change.

## 2. Backend structure

```
backend/
  app/
    main.py                 # FastAPI app, routers, CORS
    api/                   # thin HTTP routers — no physics
      health.py
      materials.py
      locations.py
      climate.py
      simulate.py
      recommend.py
      report.py
    core/
      config.py            # env vars (Open-Meteo URL, CORS, timeout)
      errors.py            # typed errors → HTTP mapping
    schemas/               # Pydantic API contract
      shelter.py
      climate.py
      simulation.py
      recommendation.py
      report.py
    services/
      climate_service.py   # ONLY place that talks to Open-Meteo
      simulation_service.py # glue: climate + engine (no physics math)
      recommendation_service.py
      report_service.py    # ReportLab; recomputes via simulation_service
    simulation/             # pure physics — no framework deps
      materials.py
      steady_state.py
      transient.py
      comfort.py
      scoring.py           # thermal score formula (pure, documented)
    data/
      materials.json
      locations.json
      climate_fixtures/    # 24h JSON per preset id
  tests/                    # pytest lives HERE, not under app/
    test_steady_state.py
    test_transient.py
    test_comfort.py
    test_recommendation.py
    test_climate_service.py
    test_api_validation.py
```

### Why this split

- `api/` only validates HTTP and calls services.
- `simulation/` is the trusted physics core.
- `services/` is glue: it knows climate **and** simulation, but does
  not implement R/U/Q/RC math.
- Tests sit in `backend/tests/` so they are not treated as package code.

## 3. Frontend structure

```
frontend/
  src/
    app/
      page.tsx              # flow entry (location → configure)
      configure/
      results/              # Day 3 dashboard (MUST)
      compare/              # Day 4
      layout.tsx            # light theme shell + disclaimer
    components/
      charts/               # Recharts (indoor vs outdoor)
      status/               # info / good / warn / critical
    features/
      location/             # presets + lat/lon; Leaflet OPTIONAL
      shelter-config/
      simulation-results/
      comparison/
      report/
    lib/
      api-client.ts
      constants.ts
    hooks/
      use-simulation.ts
      use-climate.ts
    state/
      app-state.tsx         # React context: location, shelter, results
    types/
      shelter.ts
      simulation.ts
```

No shadcn/ui. Tailwind + simple cards/tables/buttons + Lucide icons.

### Server vs client components

- Layout, headers, static chrome → server components by default.
- Forms, charts, location picker, comparison → `"use client"`.
- Shared simulation state lives in React context so compare/report
  pages do not lose the Day-3 results on navigation.

## 4. Locked API surface

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Liveness |
| GET | `/api/locations` | Preset locations |
| GET | `/api/materials` | Material catalogue for the form |
| GET | `/api/climate` | Hourly climate + `climate_source` |
| POST | `/api/simulate` | Steady-state + 24h + comfort |
| POST | `/api/recommend` | Simulate each candidate, rank, justify |
| POST | `/api/report` | Recompute, return PDF |

Details: `docs/api_reference.md`.

`POST /api/report` accepts the same **configuration** as simulate
(single) or recommend (candidates). The server **recomputes**. Do not
accept already-computed result payloads from the browser as truth.

## 5. Data flow: simulation

1. User selects a preset (or lat/lon) and fills `ShelterConfig`
   (React Hook Form + Zod). Thickness in the form may be mm; convert to
   metres before calling the API (or send metres; either way, the API
   contract is metres).
2. Frontend `POST /api/simulate` with `{ location, shelter, comfort_band? }`.
3. Router validates, then `simulation_service`:
   a. `climate_service.get_hourly(lat, lon)` — Open-Meteo via **sync
      httpx**; on timeout/failure, load fixture and set
      `climate_source = "fallback"`.
   b. Pass structured climate + shelter into `simulation/steady_state.py`
      and `simulation/transient.py`. Engine never sees HTTP.
   c. `simulation/comfort.py` on the indoor temperature series.
4. Response includes component Q breakdown, 24-hour series, comfort,
   and `climate_source` (`open_meteo` | `fallback`) plus a human label.
5. Frontend stores the **request + response** in context and renders
   the dashboard. Fallback label is visible, not buried.

No physics in the router. No HTTP in the engine.

## 6. Data flow: recommendation

1. User supplies 2–3 `ShelterConfig` objects (not auto-generated).
2. `POST /api/recommend` with location + candidates.
3. For each candidate, the same pipeline as `/api/simulate`.
4. `simulation/scoring.py` computes a documented thermal score
   (comfort %, peak cooling, peak heating). **No cost, no weight.**
5. Rank descending by score. Justification strings are formatted from
   computed deltas vs the baseline (first candidate or explicit baseline
   id).

## 7. Climate isolation and fallback

- `climate_service.py` is the **only** Open-Meteo client.
- Bundled fixtures live in `backend/app/data/climate_fixtures/`.
- Return shape always includes:
  - `climate_source`: `"open_meteo"` or `"fallback"`
  - `climate_source_label`: exact user-facing sentence
- Fallback must never be labelled as live.
- Optional in-process dict cache: `(rounded_lat, rounded_lon, date)`.
  Not Redis.

Wind and humidity may be present on the climate object for display; the
engine ignores them in the MVP unless `docs/physics_reference.md` is
updated first.

## 8. Report generation

- `report_service.py` calls `simulation_service` / recommendation
  pipeline with the request body, then lays out the **recomputed**
  structures with ReportLab.
- MVP PDF uses tables for the 24-hour series, not chart raster images
  (images are optional polish).
- Climate source label and the first-order-tool disclaimer are mandatory.

## 9. Testing strategy

Location: `backend/tests/`.

Required categories:

- R-value known-answer
- U-value known-answer
- heat-flow **sign** tests
- multi-layer assembly
- insulation sanity (thicker insulation → lower U)
- hot-climate sanity
- cold-climate sanity
- RC model (including a hand-calc step)
- comfort calculation
- recommendation ranking (better insulation ranks higher)
- climate fixture load
- mocked Open-Meteo failure → fallback + labelled source
- API validation (bad input → 4xx, not 500)

Frontend: TypeScript + Zod + manual QA. No frontend test framework in
the 4-day plan.

## 10. Configuration

- `backend/.env` (not committed): Open-Meteo base URL, timeout,
  CORS origins.
- `core/config.py` loads env with defaults. Open-Meteo needs no API key.
- Frontend: `NEXT_PUBLIC_API_BASE_URL`.

## 11. Deployment shape (prototype)

- Backend: one Uvicorn process, local.
- Frontend: `npm run dev` / `next build` + `next start`.
- **No** database, Redis, Celery, Docker requirement, Kubernetes,
  GraphQL, auth, or persistence.

Post-hackathon persistence is out of scope for this prototype.

## 12. Explicitly forbidden in this architecture

- Engine importing FastAPI / httpx / requests / frontend
- Ranking on cost or weight
- Accepting client-computed results for PDF
- Dark theme
- shadcn as a required dependency
- Leaflet as a required dependency
