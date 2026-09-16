# Three.js Visual Realism Roadmap

## Goal

Improve the Shelter, Glazing, and Ventilation previews so they communicate the configured building and authoritative backend results more credibly. This is visualisation work: it must not create a second physics engine in the browser.

## Guardrails

- FastAPI simulation output remains the source of truth for thermal values, comfort, and hourly data.
- Keep the current `three` dependency; do not add a rendering framework unless imperative scenes become a genuine constraint.
- Respect `reduceMotion`, cap pixel ratio at 2, and pause animation when a canvas is off screen.
- Share renderer, resize, orbit, animation, and disposal utilities rather than copying them between previews.

## Stage 0 — Baseline and visual contract

**Outcome:** reproducible targets before rendering changes.

- Capture desktop/mobile screenshots for default shelter, glazed/open window, and open/closed ventilation states.
- Exercise day/night, orientation, dimensions, window area, occupants, and reduced motion.
- Define common wall, roof, frame, glass, ground, heat, and airflow colours.
- Extract a `ThreeScene` utility for renderer setup, resize, camera input, lifecycle, and cleanup.

**Done when:** previews share resize, input, colour-space, and cleanup behaviour with no console warnings after navigation.

## Stage 1 — Shader foundation (start here)

**Outcome:** reusable visual effects that improve depth without posing as engineering data.

- Create `frontend/src/lib/three/shaders/`.
- Add `createFresnelGlassMaterial()` with view-angle reflection, configurable tint, opacity, roughness/noise, and night emission.
- Add `createFlowMaterial()` with UV/time-based moving noise, alpha fading, and configurable speed, direction, colour, and intensity.
- Add `createThermalSurfaceMaterial()` for a clearly labelled illustrative gradient that takes normalized backend data only.
- Provide static variants when reduced motion is enabled.
- Make a small dev-only material playground to validate parameters in isolation.

**Done when:** glass has view-dependent depth, open-vent flow moves in its configured direction, and all shader animation stops under `reduceMotion`.

## Stage 2 — Lighting and material response

**Outcome:** consistent daylight, night lighting, shadows, and believable surfaces.

- Enable ACES tone mapping and set a shared exposure.
- Establish a common lighting rig: sky, directional sun, soft shadows, and low-intensity night/interior light.
- Use a compact, licensed environment map when available, retaining a procedural fallback.
- Introduce material presets with appropriate roughness, normal detail, and metal response.
- Add contact shadow/AO-style grounding.

**Done when:** previews read correctly day and night, share an apparent sun direction, and remain smooth on a mid-range laptop.

## Stage 3 — Accurate configuration geometry

**Outcome:** the views depict entered configuration rather than a decorated box.

- Build walls, floor, and roof as separate meshes.
- Cut actual wall openings for windows; add reveals, sills, frames, pane thickness, and open-panel geometry.
- Model vents as real openings/louvres on their configured faces.
- Apply orientation consistently to building, windows, vents, and sun reference.
- Add simple interior/scale context while retaining low-poly complexity.

**Done when:** zero-window configurations have no opening; changing window area alters the aperture; open windows and vents visibly connect inside to outside.

## Stage 4 — Simulation-linked visualisation

**Outcome:** visuals communicate authoritative backend response fields.

- Pass persisted `SimulationResponse` to the analysis preview.
- Add hourly scrub/play controls backed by the server’s 24-hour series.
- Drive labelled thermal overlays from returned indoor/outdoor temperature and component loads.
- Map flow intensity only to configured ventilation/backend values; do not imply CFD from geometry.
- Add legends, units, data source, and an “illustrative flow” label where needed.

**Done when:** selecting an hour changes the view and its displayed values match the report/dashboard exactly.

## Stage 5 — Ventilation particles and context

**Outcome:** airflow and scale are intuitive without excessive GPU cost.

- Replace fixed tubes with seeded streamlines or instanced particles travelling inlet-to-outlet.
- Derive direction/speed from configuration and available backend input/results; vary opacity by intensity.
- Add optional wind arrow and solar-path indicator, visibly separate from calculated results.
- Replace the infinite grid default with simple ground, terrain tint, and low-cost scale assets.

**Done when:** open and closed vents have distinct visual states while low-power devices keep an acceptable frame rate.

## Stage 6 — Quality, accessibility, and performance

**Outcome:** rich scenes remain dependable and understandable.

- Render only while visible or interacting; stop loops otherwise.
- Reuse resources, instance people/particles, and provide a constrained-device quality fallback.
- Add keyboard reset-view controls and text alternatives for colour/motion-only data.
- Test WebGL resource cleanup, route changes, and a WebGL-unavailable fallback.
- Establish visual-regression screenshots for Stage 0 states.

**Done when:** repeated navigation causes no resource leaks, reduced-motion modes work, and fallback content retains essential simulation information.

## First pull request

1. Extract shared scene lifecycle utilities from the three existing previews.
2. Add `createFresnelGlassMaterial()` and use it in `ThreeGlazingPreview`.
3. Add `createFlowMaterial()` and use it in `ThreeVentilationPreview`.
4. Preserve current meshes and controls.
5. Verify day/night, reduced motion, resizing, and unmount cleanup.

This first stage is a visible upgrade with a small regression surface and establishes the shader API for geometry and data-linked stages.
