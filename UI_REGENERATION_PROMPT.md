# UI regeneration prompt — Shelter Thermal Designer

Use the following prompt with a UI-generation model or tool.

```text
Design and implement the complete responsive web UI for **Shelter Thermal
Designer**, an internal DRDO early-stage engineering tool for estimating the
thermal behavior of small field shelters in extreme Indian environments.

This is scientific analysis software, not a marketing site and not a generic
admin dashboard. The user is an engineer who moves through a deliberate
workflow: location and climate → shelter geometry → wall/roof material
assemblies → windows → ventilation and occupants → HVAC and comfort settings
→ simulation → results, recommendations, and report.

Build the UI in React/Next.js with TypeScript, Tailwind CSS or equivalent CSS,
and Lucide icons. Keep it frontend-first: use well-typed mock data and clear
loading, empty, validation, success, and error states where an API is not
available. Do not invent features outside the scope below.

## Visual direction

Create a precise, dark field-operations workspace:

- Canvas: near-black `#000`; cards: `#0A0A0A`; inset surfaces/chips:
  `#1F1F1F`.
- Primary text: off-white `#EDEDED`; secondary: `#999`; hairline borders:
  white at roughly 14% opacity.
- Accent blue `#52A8FF` denotes the active selection, information, focused
  chart series, and progress. Green `#62C073` means configured/pass/live.
  Amber is reserved for fallback or caution. Red is reserved for true errors.
- Use a clean neo-grotesk sans serif (Inter is suitable) for interface and
  headings, paired with a compact monospace face for labels, units, IDs,
  metadata, and numerical readouts.
- Square corners or at most very subtle 4–8px rounding. Thin borders, flat
  surfaces, restrained shadows. Avoid gradients except for a restrained image
  scrim or subtle blue atmospheric glow. No glassmorphism, neon, bubbly cards,
  oversized pill UI, or decorative illustrations.
- Headings are tight, medium weight, slightly negative tracking. Metadata is
  uppercase mono, 10–12px, with tracking. Body copy is compact but readable.
- Use compact line charts, bar charts, engineering diagrams, tables, and
  SVG schematics rather than stock dashboard graphics.

## Application shell and navigation

The desktop shell is full-width and dark. Use a three-part top header:

- Left: a small geometric four-square mark and the lockup “Shelter Thermal”;
  place “Designer” beneath it in small mono text.
- Center: primary navigation.
- Right: a white square-cornered “Begin configuration ↗” button.

On the landing screen, the header overlays the hero and shows: Overview,
Climate, Analysis, Reports. On all workspace screens, make it sticky and show
the workflow destinations with Lucide icons: Location Climate, Shelter
Configuration, Materials Library, Windows & Glazing, Ventilation & Occupants,
HVAC & Thermal Control, Analysis, and Reports. The active item is blue with a
fine underline. On mobile, replace this navigation with a menu icon that opens
a full-screen black navigation panel.

Below the solid workspace header, include a horizontally scrollable stage
strip with compact chips: Overview, Location, Geometry, Materials, Windows,
Ventilation, HVAC, Analysis, Reports. The active chip is white with dark text.
At the bottom of every workspace screen, show a thin mono footer:
“DRDO Thermal Analysis Initiative · Internal prototype” and “Data stays in
your workspace”.

## Landing / Overview

The landing screen is a full-viewport high-altitude mountain photograph with a
dark bottom-up scrim and a very restrained blue glow toward the lower left.
Overlay this copy near the bottom left:

- Eyebrow: “SIH26051 · THERMAL ANALYSIS WORKSPACE” and a small green-dot
  “FIELD READY” status.
- H1: “Design for the conditions beyond the map.” with “beyond” italicized.
- Supporting text: “Configure your shelter design and run area-specific
  thermal analysis for extreme environments.”
- Primary CTA: “Begin configuration ↗”.
- Fine mono metadata along the bottom: “ALTITUDE / VARIABLE”,
  “ORIENTATION / NORTH”, “MODEL / FIRST-ORDER”, plus an unobtrusive
  “01 — START AT THE EDGE”.

After the hero / in the dashboard state, make the product’s limitation
unmissable with a slim bordered notice: “First-order estimation tool”. Explain
that it supports early design decisions and is not a substitute for CFD,
EnergyPlus, physical testing, or certification.

Create a dashboard with:

- Four border-separated KPI cells: workflow completion `0/6`, `6 steps`,
  completion percentage, and `0.1v Prototype v0.1`.
- A “Design workflow” section. One card lists six clickable rows identified
  `01-LOC`, `02-GEOM`, `03-ENV`, `04-GLZ`, `05-OCC`, `06-HVAC`; each has a
  status chip (PASS / FAIL) and configuration detail. A second card visualizes
  stage completion with compact horizontal bars. A third can show an audit-like
  configuration diff or project readiness.
- A “current run / activity” area that handles the empty project elegantly and
  directs the engineer to the first incomplete stage.

## Workflow screens

All stages use the same page heading pattern: uppercase mono “STAGE N · …”, a
large title, a concise explanatory sentence, and a right-aligned configuration
status dot/text. Use two-column desktop layouts that stack cleanly on mobile.
Every editable engineering value must show a unit, validation feedback, and a
clear save/continue action. Preserve user-entered state when navigating.

1. **Location & Climate**
   - Left panel: toggle between Preset locations and Custom coordinates.
     Presets are stacked selectable cards with name, Indian region, climate
     type, short description, and latitude/longitude. Custom mode provides a
     clickable map, latitude, and longitude fields.
   - “Retrieve climate data” is the action. Show loading while obtaining data.
   - Right panel: 24-hour climate summary. Empty state says no climate profile
     has been loaded. Populated state shows temperature range, data-point
     count, solar irradiance range, and source.
   - Explicitly distinguish a green “Live climate service” from an amber
     “Bundled climate fixture used — Open-Meteo unavailable”. Never imply a
     fallback fixture is live data.

2. **Shelter Configuration**
   - Geometry presets, numeric length/width/height fields in metres, and a
     four-choice cardinal orientation control. Show derived floor, wall, and
     roof areas.
   - Include a large clean isometric SVG shelter preview that responds to
     dimensions/orientation, plus a summary table. Invalid dimensions should
     produce a clear inline state, never a raw error.

3. **Materials & Envelope Assembly**
   - Let the user switch between Wall and Roof assembly. Display layers ordered
     exterior → interior with material, thickness in mm, thermal conductivity,
     resistance/U-value contribution, reorder arrows, and remove controls.
   - Include an add-layer control and a searchable material catalogue with
     category chips, materials cards, characteristic values, and a detail pane.
   - Present an assembly cross-section / thermal preview and derived overall
     U-value. Do not make insulation a magic separate control: it is a layer.

4. **Windows & Glazing**
   - Enter aperture area in m², choose a simple standard glazed window or an
     open unglazed aperture, and display ratios and an architectural preview.

5. **Ventilation & Occupants**
   - Use a clear open/closed ventilation-state selector and show the associated
     ACH value. Add an occupants count field with stepper controls and state
     the resulting sensible internal gain. Include a restrained engineering
     airflow/occupancy schematic.

6. **HVAC & Thermal Control**
   - Offer two explicit modes: Floating temperature (no HVAC) and Setpoint
     control. In setpoint mode expose a temperature setpoint; in either mode
     expose an editable low/high comfort band.
   - Explain the physics directly: floating mode reports indoor drift with
     HVAC at 0 W; setpoint mode holds indoor temperature and reports heating
     and cooling loads. Do not merge these concepts into one ambiguous metric.
   - Add a simple thermal-control diagram and semantic explanation.

7. **Thermal Simulation**
   - Start with a “Pre-Flight Readiness Check” listing all six required inputs,
     their configured state, and a direct edit link for incomplete stages.
   - Disable the run action until the configuration is valid. On run, show a
     compact progress state and then a result-ready state that identifies the
     climate source used. Use deterministic engineering language, not AI
     hype.

8. **Thermal Health & Design Optimization / Reports**
   - If no run exists, show an empty state and a “Run thermal simulation” CTA.
   - Once results exist, lead with an explainable diagnosis, the location and
     climate-source label, then prominent KPI readouts: comfort rating,
     overheating duration, overcooling duration, thermal inertia, peak heating
     and peak cooling where applicable.
   - Plot a 24-hour indoor and outdoor temperature line chart with a shaded
     comfort envelope, a clear legend, precise axes, hover/focus readout, and
     an accessible text/table alternative.
   - Include “Likely Thermal Contributors” and a representative-hour heat-flow
     breakdown for wall conduction, roof conduction, glazing, ventilation,
     solar, occupants, and HVAC. Use sign-aware labels and units.
   - Add an “Explainable Thermal Design Optimizer” that compares 2–3 complete
     user-defined configurations. Show a recommendation only from computed
     thermal metrics (comfort and peak heating/cooling), with actual deltas and
     named weights. Never rank by invented cost or weight.
   - Provide a “Single-Fix Candidate Evaluator” with a baseline/proposed-value
     comparison and apply action. Make it clear whether the proposed change is
     applied.
   - Include a report-download action. The report must carry the same climate
     source, configuration, results, limitations, and disclaimer as the UI.

## Data and behavior rules

- The core result is a first-order, deterministic, single-zone 24-hour thermal
  estimate. Label it as such persistently.
- Results should expose indoor/outdoor hourly temperature, conduction, solar,
  ventilation, occupants, HVAC, net heat flow, comfort percentage, and peak
  heating/cooling values.
- Positive HVAC means heating; negative HVAC means cooling. Without a setpoint,
  HVAC must remain 0 W. With a setpoint, indoor temperature is held at the
  setpoint and plant load is displayed clearly.
- Treat all errors as recoverable UI states with human-readable copy. Use
  skeletons/spinners sparingly; do not use toasts as the sole feedback.
- Maintain keyboard focus states, semantic labels, accessible chart summaries,
  sufficient contrast, and reduced-motion support.

## Responsive and implementation requirements

- Desktop content width: approximately 1200–1280px with 48–56px outer padding.
  Use 2–3 columns for dashboards and forms. Tablet collapses progressively;
  mobile uses one column, a full-screen menu, horizontally scrollable stage
  chips, and no clipped controls or tables.
- Keep interactions fast and modest: short opacity/border transitions only.
- Use real interface copy and plausible engineering values (e.g., Leh,
  Ladakh; 3,524 m; a −3°C to 12°C outdoor range) rather than lorem ipsum.
- Do not use a sidebar, bright white/light theme, SaaS marketing gradients,
  generic rounded dashboard tiles, fake AI chat, or a “modern fintech” style.

Return a complete, cohesive application—not just a hero page—and ensure every
screen shares the same dark technical design language.
```
