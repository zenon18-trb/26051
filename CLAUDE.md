# CLAUDE.md — AI Development Guide for This Project

This file tells any AI assistant (or future you) how to work on this
codebase. Read this before touching any code.

The locked source of truth for *what* we build is `PROJECT_SPEC.md`.
The locked source of truth for *how pieces fit* is `ARCHITECTURE.md`.
The locked source of truth for *order of work* is `IMPLEMENTATION_PLAN.md`.
The locked physics contract is `docs/physics_reference.md`.
The locked HTTP contract is `docs/api_reference.md`.

Do not silently diverge from those files.

## What this project is

SIH26051 — Area-Specific Shelter Thermal Design Tool for DRDO.

A web tool where an engineer picks a location, describes a shelter, and
gets back:

- steady-state heat-flow breakdown (positive Q = heat into indoor air)
- a 24-hour single-zone RC indoor temperature curve
- a comfort assessment
- a ranked comparison of 2–3 **user-defined** configurations
- a PDF engineering report recomputed on the server

This is a **first-order estimation tool**, not CFD / EnergyPlus / ANSYS.
Every number on screen or in the PDF must be traceable to a formula in
`docs/physics_reference.md` or to a documented assumption. Never claim more
accuracy than the model has.

## Who is building this

One developer, new to this stack, ~4 days. Because of that:

- Favour the simplest architecture that is still real engineering.
- Do not add a technology unless it removes more complexity than it adds.
- Every non-trivial piece of code should be explainable in a few sentences.
- No black-box abstractions.

## Before writing any code, always

1. Read this file (`CLAUDE.md`).
2. Read `PROJECT_SPEC.md`.
3. Read `ARCHITECTURE.md`.
4. Read `IMPLEMENTATION_PLAN.md` — find the current phase.
5. Read `docs/physics_reference.md` before changing any physics.
6. Read `docs/api_reference.md` before changing any endpoint.
7. Check what is already implemented. Do not redo or silently overwrite
   working code.

## Workflow for every feature

1. **Explain** the feature in plain language before coding it.
2. **Identify** exactly which files are affected.
3. **Implement the smallest correct version.** No unused config, no extra
   endpoints "just in case."
4. **Run tests / build / lint** for anything touched.
5. **Fix errors** before moving on.
6. **Update docs** if behaviour, API shape, or assumptions changed.
7. **Explain what changed**, in a short summary a beginner can follow.

Never make a large architectural change silently.

## Non-negotiable engineering rules

- The **thermal simulation engine is pure Python**. It must never import
  FastAPI, httpx, frontend code, or any network-related library. It
  accepts structured Python data and returns structured results. It
  must be callable from pytest with no server running.
- **Climate fetching and physics never mix.** Open-Meteo lives only in
  the climate service. The engine never knows an HTTP request happened.
- **Open-Meteo is primary; bundled fixtures are the demo safety net.**
  If Open-Meteo fails or times out, use the matching bundled 24-hour
  fixture and **label the result as fallback** in the API, UI, and PDF.
  Never present fallback data as live data.
- **SI units and heat-flow sign are locked** in `docs/physics_reference.md`.
  Positive Q = heat entering indoor air.
  `Q_cond = U × A × (T_out − T_in)`.
- **HVAC modes must not be mixed.** No setpoint → indoor T floats,
  `Q_hvac = 0`. With setpoint → indoor T is held at the setpoint,
  `Q_hvac = −Q_other`. Report heating and cooling separately.
- **No invented material data.** Unverified `k` values are
  `"confidence": "approximate"` with a note.
- **No ML.** Recommendations re-run the same deterministic simulation and
  rank on documented thermal scores only. Do **not** rank on cost or
  weight in the MVP.
- **`POST /api/report` recomputes.** Do not accept browser-supplied
  simulation results as authoritative.
- **UI is light-themed.** Bright professional engineering software. No
  dark theme, no dark dashboard, no neon, no glassmorphism, no heavy
  gradients.
- **Do not add:** database, Redis, Celery, Docker as a requirement,
  Kubernetes, GraphQL, authentication, user accounts, persistence,
  CFD, EnergyPlus.

## Locked technology stack

| Layer | Use | Do not require |
|-------|-----|----------------|
| Frontend | Next.js App Router, TypeScript, React, Tailwind CSS, Recharts, React Hook Form, Zod, Lucide React | shadcn/ui, Leaflet (optional only) |
| Backend | FastAPI, Pydantic, Uvicorn, ReportLab | extra services |
| HTTP client | sync `httpx` in climate service only | async unless already trivial |
| Climate | Open-Meteo + bundled JSON fixtures | paid weather APIs |
| Physics | `backend/app/simulation/` pure Python | any framework import there |
| Tests | pytest in `backend/tests/` | frontend test framework |
| Data | `materials.json`, `locations.json`, climate fixtures | database |

## Locked API surface

- `GET /api/health`
- `GET /api/locations`
- `GET /api/materials`
- `GET /api/climate`
- `POST /api/simulate`
- `POST /api/recommend`
- `POST /api/report`

No other endpoints in the 4-day MVP.

## Cut order if time runs short

1. Leaflet
2. PDF chart images (use tables)
3. Cost/weight **display** (never ranking)
4. Comparison visual polish

**Never cut:** physics engine, known-answer tests, climate fixtures,
simulation dashboard, assumptions, limitations/disclaimer.

## Explaining concepts as we go

When code introduces a concept the developer may not know (Pydantic,
React server vs client components, thermal resistance, RC model, etc.),
give a short inline explanation: **what**, **why here**, **where it
lives**, **how data flows**. Keep it specific to this project.

## Definition of done for any phase

- The code runs.
- The relevant tests pass.
- The developer could explain the output to a judge without reading code.
- Documentation reflects reality.

## Things to actively avoid

- Over-engineering (plugin systems, Redis caches, microservices).
- Copying unused boilerplate.
- Silent scope creep beyond the current phase in `IMPLEMENTATION_PLAN.md`.
- Claiming simulation accuracy the model cannot back up.
- Dark or "flashy" UI.
- Ranking on invented cost or weight.
- Accepting client-computed results for the PDF.
