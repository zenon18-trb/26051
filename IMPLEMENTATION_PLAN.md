# IMPLEMENTATION_PLAN.md — 4-Day Phased Build Plan

Locked build order. Do not start a phase until the previous phase's
expected output actually works. Update the **Status** line as you go.

**Do not write application code until Phase 0 is the active phase and
the planning docs are treated as locked** (they are, as of this file).

If time runs short, cut in this order:

1. Leaflet
2. PDF chart images
3. Cost/weight **display**
4. Comparison visual polish

**Never cut:** physics engine, known-answer tests, climate fixtures,
simulation dashboard, assumptions, limitations/disclaimer.

Tests belong in `backend/tests/` (not `backend/app/tests/`).

---

## Locked 4-day schedule

| Day | Phases | Exit criterion |
|-----|--------|----------------|
| **1** | 0, 1 | Health check in the browser; materials + steady-state tests pass; `GET /api/materials` |
| **2** | 2, 3 | Live or fallback climate; `POST /api/simulate` returns steady-state component Q |
| **3** | 4, then **thin UI** | RC + comfort on the API; **browser E2E**: preset → form → dashboard + 24h chart |
| **4** | 5, 7, 8 | Recommend + compare 2–3 configs + PDF; tests; demo rehearsal |

Day 3 **must** include the first thin frontend (previously “Phase 6”).
Do not leave the entire UI for Day 4.

---

## Phase 0 — Project scaffolding & environment

**Status:** COMPLETE

**Objective**
Empty-but-runnable frontend and backend talking to each other. No
thermal logic.

**Files involved**
- `backend/app/main.py`, `backend/app/core/config.py`, `backend/requirements.txt`
- `frontend/` via `create-next-app` (App Router, TypeScript, Tailwind).
  **Do not** initialise shadcn/ui.
- `backend/app/api/health.py`
- `.env.example` for frontend and backend
- `README.md` run instructions

**Implementation tasks**
1. FastAPI app, `GET /api/health` → `{"status": "ok"}`, CORS for the
   local frontend origin.
2. Next.js app: TypeScript, Tailwind, App Router. Lucide React allowed.
3. Minimal page that calls `/api/health` and shows the result.
4. README with pinned Python/Node versions and exact run commands.

**Testing**
- curl `GET /api/health`
- Frontend shows backend health

**Expected output**
- `uvicorn app.main:app --reload` (from `backend/`)
- `npm run dev` shows backend connectivity

**Possible failure points**
- CORS
- Version mismatches — pin in README

**Developer must understand**
- FastAPI router split
- Next.js App Router; server vs client components
- Why CORS exists

---

## Phase 1 — Material catalogue, physics contract, steady-state engine

**Status:** not started

**Objective**
Pure-Python steady-state engine, SI + sign convention locked in code to
match `docs/physics_reference.md`, unit-tested known-answer cases, and
`GET /api/materials`.

**Files involved**
- `backend/app/data/materials.json`
- `backend/app/simulation/materials.py`
- `backend/app/simulation/steady_state.py`
- `backend/app/api/materials.py`
- `backend/tests/test_steady_state.py`

**Implementation tasks**
1. `materials.json`: small real set (e.g. mild steel sheet, plywood,
   brick, concrete, PUF, glass wool, glazing). Each row: `id`, `k`
   (W/(m·K)), `confidence` (`reference` | `approximate`), `source`.
   Do not invent citations. Do **not** add cost/weight for ranking.
2. `materials.py`: load, validate, lookup by id.
3. `steady_state.py` implementing:
   - `r_value(thickness_m, k)`
   - `total_r_value(layers, r_si, r_so)`
   - `u_value(r_total)`
   - `q_cond(u, area, t_out, t_in)` → `U × A × (T_out − T_in)`
   - solar (window), ventilation, occupant helpers with the same sign
     convention
4. `GET /api/materials` returns the catalogue (no physics).
5. Keep `docs/physics_reference.md` consistent if implementation chooses
   specific surface-resistance values (already specified there).

**Testing** (`backend/tests/test_steady_state.py`)
- R-value known-answer
- U-value known-answer
- heat-flow **sign** (T_out > T_in → Q_cond > 0)
- multi-layer
- insulation sanity: doubling insulation thickness lowers U
- numbers match the hand-calculated example in `docs/physics_reference.md`

**Expected output**
- `pytest backend/tests/test_steady_state.py` passes
- `GET /api/materials` returns JSON catalogue

**Possible failure points**
- mm vs m
- forgetting surface resistances
- reversing ΔT

**Developer must understand**
- R, U, Q in plain language
- Series resistances
- Positive Q = heat into indoor air

---

## Phase 2 — Climate service, fixtures, locations

**Status:** COMPLETE

**Objective**
Open-Meteo isolated in the climate service; bundled 24h fixtures;
labelled fallback; `GET /api/locations` and `GET /api/climate`.

**Files involved**
- `backend/app/services/climate_service.py`  (sync httpx **only here**)
- `backend/app/schemas/climate.py`
- `backend/app/data/locations.json`
- `backend/app/data/climate_fixtures/*.json`
- `backend/app/api/climate.py`, `backend/app/api/locations.py`
- `backend/tests/test_climate_service.py`

**Implementation tasks**
1. 4–6 preset Indian locations (hot-arid, humid-coastal, cold
   high-altitude, temperate) in `locations.json`.
2. One 24-hour fixture JSON per preset (and a generic fallback fixture).
3. Pydantic climate schema: hourly T, solar; optional wind/humidity for
   display; `climate_source` and `climate_source_label`.
4. `climate_service.py`: sync httpx to Open-Meteo; timeout; on failure
   load fixture; **never** raise past the service without a labelled
   fallback for preset ids. For unknown lat/lon with failed live fetch,
   use generic fixture + fallback label.
5. Optional in-memory cache `(lat, lon, date)`.
6. `GET /api/locations`, `GET /api/climate?lat=&lon=` (and optional
   `preset_id`).

**Testing**
- Fixture file parses and has 24 hours
- Mocked Open-Meteo success
- Mocked timeout/failure → fallback + `climate_source == "fallback"`
- Label string is present and not equal to a live-data claim

**Expected output**
- `GET /api/climate?lat=28.6&lon=77.2` returns hourly data and a source
  field
- `GET /api/locations` returns presets

**Possible failure points**
- Open-Meteo field names — verify against current docs before parsing
- Silent fallback (forbidden)

**Developer must understand**
- Why climate is outside `simulation/`
- Why fallback must be labelled
- Sync httpx is enough for one outbound call

---

## Phase 3 — ShelterConfig + `POST /api/simulate` (steady-state)

**Status:** not started

**Objective**
Client submits shelter + location; server returns **steady-state**
component breakdown. Transient is Phase 4; this phase still wires
climate → engine for Q components.

**Files involved**
- `backend/app/schemas/shelter.py`, `simulation.py`
- `backend/app/api/simulate.py`
- `backend/app/services/simulation_service.py`
- `backend/tests/test_api_validation.py`

**Implementation tasks**
1. `ShelterConfig`: dimensions (m), wall/roof layers, windows/vents,
   occupancy, optional setpoint. Reject negative thickness, empty layer
   lists, unknown material ids, non-positive dimensions.
2. Response (steady-state subset): per-component Q (cond walls/roof/
   windows, solar, ventilation, occupant, hvac), totals, climate_source.
   HVAC: if no setpoint, `Q_hvac = 0`; if setpoint, apply locked
   semantics (see physics reference) even in this simplified snapshot.
3. Orchestration only in `simulation_service.py`.
4. Errors: 4xx validation, climate issues still return data if fallback
   applied (not a 503 if fixture saved the demo). If even fallback
   fails, 503 with a clean body.

**Testing**
- Valid request → component breakdown
- Invalid input → 4xx, not 500
- Sign of Q_cond consistent with T_out vs T_in

**Expected output**
- curl/Postman `POST /api/simulate` returns real numbers and source label

**Developer must understand**
- Pydantic as the input gate
- Request → validate → service → engine → response

---

## Phase 4 — RC 24-hour model + comfort (still API-first)

**Status:** COMPLETE

**Objective**
Hourly lumped-capacitance simulation and comfort; extend
`POST /api/simulate` to the full contract in `docs/api_reference.md`.

**Files involved**
- `backend/app/simulation/transient.py`
- `backend/app/simulation/comfort.py`
- schemas + `simulate.py` (extend)
- `backend/tests/test_transient.py`
- `backend/tests/test_comfort.py`

**Implementation tasks**
1. `transient.py`: one indoor node, `dt = 3600 s`, documented `C`,
   Euler (or equivalent documented) update. Per-hour fields listed in
   the spec. HVAC: float vs hold-at-setpoint as locked.
2. Guard against nonsense `C` (document minimum); keep prototype stable
   at 1 h steps.
3. `comfort.py`: % in-band, peak deviation.
4. Expand simulate response: `hourly[]` + `comfort`.

**Testing**
- Hand-calc single-step RC (physics_reference example)
- Hot climate → indoor T rises (floating mode)
- Cold climate → indoor T falls (floating mode)
- Comfort % in [0, 100]
- Setpoint mode: indoor T equals setpoint; Q_hvac = −Q_other

**Expected output**
- `/api/simulate` returns 24 hourly rows + comfort summary

**Possible failure points**
- Unstable C/dt
- Mixing float and HVAC metrics

**Developer must understand**
- RC analogy
- What a single node cannot capture

---

## Phase 6 thin UI — Day 3 (do this immediately after Phase 4)

**Status:** not started

**Note:** Numbering kept as “Phase 6” to match earlier docs; it is
**scheduled on Day 3**, not Day 4.

**Objective**
Browser demonstrates the complete single-shelter path:

preset → climate → form → simulate → 24h indoor/outdoor graph →
comfort % → component breakdown.

Leaflet is **not** in this phase.

**Files involved**
- `frontend/src/app/page.tsx`, `configure/`, `results/`, `layout.tsx`
- `frontend/src/features/location/` (presets + lat/lon)
- `frontend/src/features/shelter-config/`
- `frontend/src/features/simulation-results/`
- `frontend/src/lib/api-client.ts`, `types/`
- `frontend/src/state/app-state.tsx`
- `frontend/src/hooks/use-simulation.ts`, `use-climate.ts`

**Implementation tasks**
1. Light theme layout + persistent first-order-tool disclaimer.
2. Location: preset list from `GET /api/locations`; optional lat/lon.
   Show climate source label from `GET /api/climate` (or from simulate).
3. Form: React Hook Form + Zod mirroring `ShelterConfig`. Thickness UI
   may use mm; convert to metres for the API.
4. Results: Q component cards, Recharts indoor vs outdoor, comfort badge
   (blue/green/amber/red). Loading and error states.
5. React context holds location, shelter, last simulate request/response
   so Day 4 pages can reuse them.

**Testing**
- Manual: two presets, poor vs insulated shelter, results differ
- Fallback banner visible if Open-Meteo is blocked in a test run

**Expected output**
- **Judges could watch this path in a browser.** This is the Day 3 gate.

**Possible failure points**
- Hydration: mark interactive trees `"use client"`
- Losing units in the form

**Developer must understand**
- Context vs server components
- Zod + Pydantic as two gates, not duplication of physics

---

## Phase 5 — Recommendation engine (Day 4 morning)

**Status:** not started

**Objective**
`POST /api/recommend`: run each user candidate through the same pipeline;
rank on documented thermal weights only; justification from numbers.

**Files involved**
- `backend/app/simulation/scoring.py`
- `backend/app/services/recommendation_service.py`
- `backend/app/schemas/recommendation.py`
- `backend/app/api/recommend.py`
- `backend/tests/test_recommendation.py`

**Implementation tasks**
1. Request: location + 2–3 `ShelterConfig` (reject 0–1 or >3 if you
   want a hard cap; minimum is 2).
2. Score per `docs/physics_reference.md` (comfort, peak cooling, peak
   heating). Named weights, no magic numbers, **no cost/weight**.
3. Justification: template filled with computed deltas vs baseline.
4. `POST /api/recommend`.

**Testing**
- More insulation, floating or HVAC as specified, ranks above baseline
- Justification numbers exist on the candidate result objects

**Expected output**
- Ranked JSON + justification string

**Developer must understand**
- Why this is not ML
- One-sentence score formula for judges

---

## Phase 7 — Comparison UI + PDF (Day 4 midday)

**Status:** not started

**Objective**
Compare 2–3 configs, show recommendation, download PDF from server
recompute.

**Files involved**
- `frontend/src/app/compare/`
- `frontend/src/features/comparison/`, `report/`
- `backend/app/services/report_service.py`
- `backend/app/api/report.py`
- `backend/tests/test_report.py` (smoke: PDF bytes, disclaimer present)

**Implementation tasks**
1. Comparison UI reusing the config form; `POST /api/recommend`; table of
   thermal metrics + justification. No cost/weight columns.
2. `report_service.py`: call simulate or recommend pipeline from the
   **request body**, then ReportLab. 24h as a **table**. Chart images
   optional.
3. `POST /api/report` — same config as simulate **or** recommend
   (discriminated by presence of `candidates`). Returns `application/pdf`.
4. Download button. Climate source label + disclaimer mandatory in PDF.

**Testing**
- Manual: PDF matches on-screen thermal numbers for the same inputs
- Disclaimer and fallback label (when applicable) present

**Expected output**
- Downloadable PDF consistent with the engine

**Possible failure points**
- Layout time sink — keep tables simple
- Accidentally trusting client results (forbidden)

---

## Phase 8 — Polish, tests, demo (Day 4 afternoon)

**Status:** not started

**Objective**
Demo reliability.

**Files involved**
- All of `backend/tests/`
- `docs/demo_script.md` (create in this phase)
- `README.md` final pass
- Physics/API docs only if implementation drifted (prefer not to drift)

**Implementation tasks**
1. Full pytest: all categories listed in Architecture §9.
2. UI consistency: light theme, spacing, source label, disclaimer.
3. `docs/demo_script.md`: which preset, which two configs, what to say,
   how to answer “this isn’t CFD”, what to do if Open-Meteo is down
   (show the labelled fallback on purpose if needed).
4. One timed dry-run.

**Expected output**
- Demo-ready prototype

**If this phase is at risk**
- Prioritise correctness and the demo script over visual polish.

**Developer must understand**
- The whole flow well enough for unscripted Q&A

---

## Day-by-day grouping (locked)

- **Day 1:** Phase 0, Phase 1
- **Day 2:** Phase 2, Phase 3
- **Day 3:** Phase 4, then Phase 6 thin UI  ← E2E in the browser
- **Day 4:** Phase 5, Phase 7, Phase 8

Protect Day 3 dashboard above Day 4 comparison polish.
