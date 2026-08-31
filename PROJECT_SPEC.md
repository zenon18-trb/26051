# PROJECT_SPEC.md — Shelter Thermal Design Tool

Locked product specification for the 4-day SIH prototype.
Physics details: `docs/physics_reference.md`.
HTTP contract: `docs/api_reference.md`.
Structure: `ARCHITECTURE.md`.
Build order: `IMPLEMENTATION_PLAN.md`.

## 1. Problem statement (SIH26051)

DRDO needs a tool that helps an engineer quickly estimate how a shelter
(field structure, outpost, or temporary building) will behave thermally in
a specific geographic location, and compare a few design choices (wall
material, insulation thickness, window area, ventilation) before a
physical build.

## 2. What we are building

A web application with two parts:

- **Frontend** (Next.js App Router, TypeScript, React, Tailwind CSS):
  preset location selection (lat/lon allowed), shelter form, results
  dashboard, comparison of 2–3 user-defined configs, report download.
- **Backend** (FastAPI): climate retrieval, pure-Python thermal engine,
  rule-based recommendation, PDF generation (ReportLab).

Leaflet is **optional** and must not block the MVP. shadcn/ui is **not**
required.

## 3. What this tool is NOT

- Not CFD, EnergyPlus, or ANSYS.
- Not a replacement for physical testing or certification.
- Not a machine-learning recommender. Rankings come from re-running the
  same transparent physics model on user-supplied candidates.
- Not a persistence platform: no database, accounts, or saved runs.

This distinction must be visible in the UI (persistent disclaimer) and in
the PDF.

## 4. Primary user flow (MUST-HAVE demo path)

```
Preset location
  → climate data (live Open-Meteo or labelled bundled fallback)
    → shelter configuration
      → simulation (steady-state + 24h RC)
        → 24-hour indoor/outdoor graph
        → comfort percentage
        → component heat-flow breakdown
          → compare 2–3 user-defined configurations
            → recommendation (thermal scores only)
              → PDF report (server recomputes)
```

The UI should show which stage of this pipeline the user is in.

## 5. Functional requirements

### 5.1 Location input

- **MVP:** preset Indian locations spanning climate types (hot-arid,
  humid-coastal, cold high-altitude, temperate), plus optional lat/lon.
- **Optional, not blocking:** Leaflet map picker.
- Presets are the demo path.

### 5.2 Climate data

- **Primary source:** Open-Meteo, by latitude/longitude.
- **Fields fetched:** hourly outdoor temperature, shortwave solar
  radiation. Wind speed and humidity may be fetched for display / future
  use; see `docs/physics_reference.md` for which fields **drive** the
  model vs which are unused in the MVP physics.
- **Fixtures:** bundled 24-hour JSON files for each preset.
- **Failure behaviour:** if Open-Meteo fails or times out, use the
  matching bundled fixture (or a generic fixture for arbitrary lat/lon)
  and set `climate_source` to fallback. Example label, required in API,
  UI, and PDF:

  `Climate source: Bundled fallback — Open-Meteo unavailable`

- Never silently present fallback as live data.
- Optional in-memory cache keyed by `(lat, lon, date)` is allowed.
  No Redis.

### 5.3 Shelter definition

User provides:

- Dimensions (length, width, height) → floor, wall, roof areas derived.
- Wall construction: one or more layers (material id + thickness in
  metres at the API boundary; the form may collect millimetres and
  convert).
- Roof construction: same.
- Insulation: additional layer(s) if the user adds them (not a separate
  magic field — it is just another layer).
- Windows/vents: area; glazed vs open (ventilation).
- Occupancy: occupant count (sensible heat gain).
- Optional HVAC setpoint (°C). See HVAC semantics below.

### 5.4 Steady-state calculation

Locked formulas (see `docs/physics_reference.md`):

- `R_layer = thickness / conductivity`
- `R_total` = sum of layer resistances plus documented surface resistances
  if used
- `U = 1 / R_total`
- `Q_cond = U × A × (T_out − T_in)`  (positive = heat into indoor air)

Components, each with the same sign convention:

- Conduction (walls, roof, windows)
- Solar (simple window transmittance; opaque-surface solar is
  **optional**, not MVP)
- Ventilation / infiltration (air-change based)
- Occupant gain
- HVAC (`Q_hvac = 0` if no setpoint)

### 5.5 Transient (24-hour) RC simulation

Single-zone lumped-capacitance model:

- one indoor thermal node
- hourly time step, 24 hours
- documented thermal capacitance `C`
- deterministic; no ML

Per-hour outputs (minimum):

- timestamp
- outdoor temperature
- indoor temperature
- conductive heat flow
- solar contribution
- occupant contribution
- ventilation contribution
- HVAC contribution
- net heat flow where applicable

### 5.6 HVAC semantics (do not mix)

**Without setpoint**

- Indoor temperature floats according to the RC update.
- `Q_hvac = 0` every hour.
- Comfort is assessed on the floating indoor temperature.

**With setpoint**

- Indoor temperature is held at the setpoint.
- `Q_hvac = −Q_other` so the node energy balance closes.
- Positive `Q_hvac` = heating; negative `Q_hvac` = cooling.
- Report peak heating requirement and peak cooling requirement separately.
- Do not present floating-temperature drift and plant load as one
  ambiguous metric.

### 5.7 Comfort assessment

- Compare predicted indoor temperature to a documented, adjustable comfort
  band (default in `docs/physics_reference.md`).
- Report % of the 24 hours in-band, and peak deviation above/below.
- When a setpoint is used, comfort of the *held* indoor temperature is
  nearly tautological; still report it, and emphasise HVAC loads as the
  design metric.

### 5.8 Comparison

- User defines 2–3 full shelter configurations (baseline + variants).
- Each is run through the same simulation pipeline.
- Side-by-side: comfort %, peak heating load, peak cooling load, and
  other thermal metrics from the engine.
- Cost and weight are **not** comparison ranking columns in the MVP.
  They may appear later only if sourced and labelled approximate.

### 5.9 Recommendation engine

- Re-run the deterministic simulation on each candidate.
- Score using **documented named weights** on thermal metrics only, e.g.
  comfort percentage, peak cooling requirement, peak heating
  requirement. Exact weights: `docs/physics_reference.md`.
- **Do not rank on cost or weight.**
- Every recommendation includes a human-readable justification built from
  actual computed deltas (no invented numbers).

### 5.10 Engineering report (PDF)

- ReportLab.
- `POST /api/report` accepts the **same configuration payload** as
  simulate or recommend. The **server recomputes**. Browser-supplied
  result objects are not authoritative.
- Contents: location, climate source label (live vs fallback), climate
  summary, shelter config, steady-state breakdown, 24-hour table (chart
  images optional — tables are the MVP), comfort, comparison,
  recommendation + justification, assumptions/limitations, disclaimer.
- PDF numbers must match the dashboard because both come from the same
  engine.

## 6. Non-functional requirements

- UI: bright, light-neutral engineering look. No dark mode.
- Simulation core: deterministic, testable, independent of FastAPI.
- A single run returns in well under a few seconds.
- Invalid input → clear JSON errors, never raw stack traces to the user.
- Config via environment variables (`backend/.env`,
  `NEXT_PUBLIC_API_BASE_URL`). No hardcoded secrets.
- Tests live in `backend/tests/`.

## 7. Design direction (UI)

- Bright white / light-neutral background.
- Accents only for meaning: blue = info, green = good, amber = warning,
  red = critical.
- Clean typography, generous spacing, cards, tables, charts.
- Subtle borders/shadows. No heavy gradients, glassmorphism, neon, or
  cyberpunk styling. Minimal animation.
- Icons: Lucide React. No shadcn/ui requirement.
- Feels like scientific analysis software, not a marketing site.

## 8. Explicit assumptions & limitations (UI + PDF)

Must appear in the UI and the PDF:

- Single-node lumped model — no indoor spatial temperature gradient.
- No thermal bridging at joints/frames.
- Material properties not independently verified are marked approximate.
- Solar model is simplified (window transmittance; no detailed incidence
  or shading). Opaque solar is optional / out of MVP unless time remains.
- Wind and humidity are not used in the MVP heat-flow equations (see
  physics reference). Humidity is not a latent-load model.
- First-order early-stage comparison, not certification.

## 9. Out of scope (4-day)

- Database, Redis, Celery, Docker requirement, Kubernetes
- GraphQL, ML, CFD, EnergyPlus
- Authentication, user accounts, persistence
- Cost/weight optimisation or ranking
- Leaflet as a must-have
- Pixel-perfect PDF charts

## 10. Success criteria for the SIH prototype

- End-to-end: preset location → climate → configure → 24h simulation
  dashboard (by end of Day 3) → compare 2–3 configs → recommendation → PDF.
- All physics traceable to `docs/physics_reference.md`.
- Fallback climate is labelled when used.
- UI presentable to judges: bright, uncluttered, no unexplained numbers.
- Developer can explain any part live in Q&A.
