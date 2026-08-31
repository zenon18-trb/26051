# Physics reference — SIH26051 shelter thermal model

This document is the **locked physics contract**. Implementation must
match it. If code and this file disagree, stop and fix one of them
explicitly; do not leave two truths.

The model is a **first-order estimation tool**, not CFD, EnergyPlus, or
ANSYS. It is for early design comparison only.

### Phase 3 Steady-State Balance Scope

* **ACTIVE IN PHASE 3**:
  - **Wall Conduction ($Q_{\text{cond,walls}}$)**: Series resistance computation using material conductivity ($k$) from database and wall surface resistances ($R_{si} = 0.13, R_{so} = 0.04$).
  - **Roof Conduction ($Q_{\text{cond,roof}}$)**: Series resistance computation using material conductivity ($k$) and roof surface resistances ($R_{si} = 0.10, R_{so} = 0.04$).
  - **Window Conduction ($Q_{\text{cond,windows}}$)**: Resolved using `glass` material conductivity and $6\,\text{mm}$ thickness with wall surface resistances.
  - **Occupant Heat Gain ($Q_{\text{occ}}$)**: Computed using the default $70\,\text{W/person}$.
  - **HVAC Load ($Q_{\text{hvac}}$)**: Calculated in setpoint mode as $Q_{\text{hvac}} = -Q_{\text{other}}$.

* **INACTIVE IN PHASE 3 (FUTURE PHASES / PHASE 4 ONLY)**:
  - **Solar Heat Gain ($Q_{\text{solar}} = 0.0\,\text{W}$)**: Ignored in the steady-state balance; climate horizontal solar radiation is carried as a placeholder for transient Phase 4 only.
  - **Ventilation/Infiltration Heat Flow ($Q_{\text{vent}} = 0.0\,\text{W}$)**: Ignored in the steady-state balance.
  - **Transient lumped-capacitance RC updating**: Frozen. Steady-state uses the peak hourly temperature snapshot.

---


## 1. Variables and SI units

All engine internals and API numeric fields use SI as below.
The UI may collect thickness in millimetres; convert to metres before
the API / engine.

| Symbol | Meaning | Unit |
|--------|---------|------|
| \(L\), \(W\), \(H\) | Shelter length, width, height | m |
| \(A\) | Area (wall, roof, window, floor) | m² |
| \(d\) | Layer thickness | m |
| \(k\) | Thermal conductivity | W/(m·K) |
| \(R\) | Thermal resistance of an assembly or layer | m²·K/W |
| \(U\) | Thermal transmittance \(= 1/R\) | W/(m²·K) |
| \(T\) | Temperature | °C |
| \(\Delta T\) | Temperature difference | K (same magnitude as °C difference) |
| \(Q\) | Heat flow **into indoor air** | W |
| \(C\) | Thermal capacitance of the indoor node | J/K |
| \(\rho_{\mathrm{air}}\) | Density of air | kg/m³ |
| \(c_{p,\mathrm{air}}\) | Specific heat of air | J/(kg·K) |
| \(N\) | Air changes per hour (ACH) | 1/h |
| \(I\) | Global horizontal shortwave irradiance (Open-Meteo) | W/m² |
| \(\tau\) | Simple window solar transmittance (SHGC-like) | — |
| \(n_{\mathrm{occ}}\) | Occupant count | — |
| \(q_{\mathrm{occ}}\) | Sensible heat per occupant | W/person |

**Locked heat-flow sign**

> **Positive \(Q\) = heat entering the indoor air node.**

Therefore:

\[
Q_{\mathrm{cond}} = U \cdot A \cdot (T_{\mathrm{out}} - T_{\mathrm{in}})
\]

- If \(T_{\mathrm{out}} > T_{\mathrm{in}}\), conduction is a **gain** (\(Q>0\)).
- If \(T_{\mathrm{out}} < T_{\mathrm{in}}\), conduction is a **loss** (\(Q<0\)).

Solar and occupant contributions are **≥ 0**.
Ventilation uses the same \((T_{\mathrm{out}} - T_{\mathrm{in}})\) convention
(can be positive or negative).
HVAC: positive = **heating** (heat added to the node); negative = **cooling**.

Do not report “cooling load” as a positive conduction number without
stating that you have flipped the sign for display. Prefer showing
signed \(Q\) plus separately derived peak heating / peak cooling.

---

## 2. Geometry (derived)

Treat the shelter as a closed rectangular box.

- Floor / roof plan area: \(A_{\mathrm{floor}} = L \cdot W\) (roof area
  taken equal to floor area; no pitch in the MVP).
- Four walls: \(A_{\mathrm{walls,gross}} = 2(L+W)H\)
- Net opaque wall area: \(A_{\mathrm{walls}} = A_{\mathrm{walls,gross}} - A_{\mathrm{windows}}\)
  (clamp at a small positive minimum; reject configs where windows exceed
  gross wall area).

---

## 3. Steady-state fabric

### 3.1 Layer resistance

\[
R_{\mathrm{layer}} = \frac{d}{k}
\]

Layers in a wall or roof are in **series**.

### 3.2 Surface resistances

Include standard still-air surface resistances so U-values are not
unrealistically high:

| Symbol | Value | Notes |
|--------|--------|--------|
| \(R_{\mathrm{si}}\) | 0.13 m²·K/W | Inside, horizontal heat flow (walls). Approximate standard value (ISO 6946 order of magnitude). |
| \(R_{\mathrm{so}}\) | 0.04 m²·K/W | Outside, walls. |
| \(R_{\mathrm{si,roof}}\) | 0.10 m²·K/W | Inside, heat flow up (roof). |
| \(R_{\mathrm{so,roof}}\) | 0.04 m²·K/W | Outside, roof. |

**Confidence:** `approximate` / standard-order values, not a full ISO 6946
implementation (no wind-speed-dependent \(h_o\) in the MVP).

\[
R_{\mathrm{total}} = R_{\mathrm{si}} + \sum_i R_{\mathrm{layer},i} + R_{\mathrm{so}}
\]

\[
U = \frac{1}{R_{\mathrm{total}}}
\]

Windows (glazed): treat as a **single** equivalent U-value from the
glazing material row (plus the same surface resistances unless the
material row is already a whole-window U). Document the choice in code
comments. Default approach: glazing as one layer \(d/k\) plus \(R_{\mathrm{si}}+R_{\mathrm{so}}\).

### 3.3 Conductive heat flow

For each envelope part \(p \in \{\mathrm{walls}, \mathrm{roof}, \mathrm{windows}\}\):

\[
Q_{\mathrm{cond},p} = U_p \cdot A_p \cdot (T_{\mathrm{out}} - T_{\mathrm{in}})
\]

\[
Q_{\mathrm{cond}} = \sum_p Q_{\mathrm{cond},p}
\]

For a **steady-state snapshot**, use a representative hour (MVP: hour of
maximum outdoor temperature in the 24-hour series, and report that hour
explicitly). The 24-hour model recomputes \(Q_{\mathrm{cond}}\) each hour
with that hour’s \(T_{\mathrm{out}}\) and current \(T_{\mathrm{in}}\).

---

## 4. Solar (MVP)

Window solar gain only:

\[
Q_{\mathrm{solar}} = \tau \cdot A_{\mathrm{windows,glazed}} \cdot I
\]

Locked default: \(\tau = 0.5\) (simple transmittance / SHGC-like factor).
**Confidence:** approximate. No angle of incidence, no shading, no
frame correction.

Open vents contribute **no** solar transmittance (they are ventilation
openings, not glazing).

**Out of MVP / optional later:** opaque roof/wall absorbed solar or
sol-air temperature. If omitted, say so in the UI and PDF (already in
limitations).

---

## 5. Ventilation / infiltration

\[
Q_{\mathrm{vent}} = \dot{m} \, c_{p,\mathrm{air}} \, (T_{\mathrm{out}} - T_{\mathrm{in}})
\]

\[
\dot{m} = \rho_{\mathrm{air}} \cdot V \cdot \frac{N}{3600}
\]

\[
V = L \cdot W \cdot H
\]

Locked defaults:

- \(\rho_{\mathrm{air}} = 1.2\,\mathrm{kg/m^3}\)
- \(c_{p,\mathrm{air}} = 1005\,\mathrm{J/(kg·K)}\)
- If vents are **open**: \(N = 5\,\mathrm{h^{-1}}\) (order-of-magnitude natural ventilation).
- If vents are **closed** (infiltration only): \(N = 0.5\,\mathrm{h^{-1}}\).

**Confidence:** approximate. Wind speed is **not** used to modulate \(N\)
in the MVP.

---

## 6. Occupants

\[
Q_{\mathrm{occ}} = n_{\mathrm{occ}} \cdot q_{\mathrm{occ}}
\]

Locked default: \(q_{\mathrm{occ}} = 70\,\mathrm{W}\) sensible (seated/light
activity, order of ISO 7730 / common HVAC rules of thumb).
**Confidence:** approximate. No latent load.

---

## 7. Other heat / net flow

\[
Q_{\mathrm{other}} = Q_{\mathrm{cond}} + Q_{\mathrm{solar}} + Q_{\mathrm{vent}} + Q_{\mathrm{occ}}
\]

(HVAC excluded from \(Q_{\mathrm{other}}\).)

Net flow into the node:

\[
Q_{\mathrm{net}} = Q_{\mathrm{other}} + Q_{\mathrm{hvac}}
\]

---

## 8. HVAC semantics (do not mix modes)

### 8.1 No setpoint (floating indoor temperature)

- \(T_{\mathrm{in}}\) evolves with the RC update.
- \(Q_{\mathrm{hvac}} = 0\) every hour.
- Design metrics: indoor temperature series and comfort %.
- Peak heating/cooling **requirements** are 0 (no plant). You may still
  show peak \(|Q_{\mathrm{other}}|\) as “unmet load if one were to hold
  temperature,” but **do not** label that as \(Q_{\mathrm{hvac}}\).

### 8.2 With setpoint (held indoor temperature)

- \(T_{\mathrm{in}}(t) = T_{\mathrm{set}}\) for all hours.
- \(Q_{\mathrm{hvac}}(t) = -Q_{\mathrm{other}}(t)\).
- Heating requirement at hour \(t\): \(\max(Q_{\mathrm{hvac}}, 0)\).
- Cooling requirement at hour \(t\): \(\max(-Q_{\mathrm{hvac}}, 0)\).
- Peak heating = max over hours of heating requirement.
- Peak cooling = max over hours of cooling requirement.

Do not mix floating \(T_{\mathrm{in}}\) and plant load into one metric.

---

## 9. RC lumped-capacitance model

### 9.1 What it is

One indoor air + contents node with capacitance \(C\). Envelope
resistance is represented by the U-A terms inside \(Q_{\mathrm{cond}}\).
This is the thermal analogue of a single RC circuit.

### 9.2 Time step

- \(\Delta t = 3600\,\mathrm{s}\) (1 hour)
- 24 steps, aligned with climate hourly series
- Deterministic Euler update:

\[
T_{\mathrm{in}}(t+\Delta t) = T_{\mathrm{in}}(t) + \frac{\Delta t}{C}\, Q_{\mathrm{net}}(t)
\]

In **setpoint mode**, skip the update and set \(T_{\mathrm{in}} = T_{\mathrm{set}}\);
still compute \(Q_{\mathrm{hvac}} = -Q_{\mathrm{other}}\).

Initial condition (floating mode): \(T_{\mathrm{in}}(0) = T_{\mathrm{out}}(0)\)
unless the request supplies an initial indoor temperature. Document the
choice in the API response.

#### Known-Answer Hand-Calculated Transient Validation Example

For the simplified test case implemented in `test_transient.py`:
* **Given parameters**:
  - \(T_{\mathrm{out}} = 30.0^\circ\mathrm{C}\) (constant)
  - \(T_{\mathrm{in}} = 20.0^\circ\mathrm{C}\) (initial)
  - \(\Delta t = 3600\,\mathrm{s}\)
  - \(C = 100,000.0\,\mathrm{J/K}\)
  - \(U_{\mathrm{wall}} = 0.5\,\mathrm{W/(m^2K)}\), \(A_{\mathrm{walls}} = 10.0\,\mathrm{m^2}\)
  - \(U_{\mathrm{roof}} = 0.5\,\mathrm{W/(m^2K)}\), \(A_{\mathrm{roof}} = 10.0\,\mathrm{m^2}\)
  - \(A_{\mathrm{windows}} = 0.0\,\mathrm{m^2}\)
  - \(n_{\mathrm{occ}} = 0\)
  - Vents: Closed (\(N = 0.5\), Volume \(V = 8.0\,\mathrm{m^3}\))
* **Heat flow calculation**:
  - \(Q_{\mathrm{cond,wall}} = 0.5 \times 10.0 \times (30.0 - 20.0) = 50.0\,\mathrm{W}\)
  - \(Q_{\mathrm{cond,roof}} = 0.5 \times 10.0 \times (30.0 - 20.0) = 50.0\,\mathrm{W}\)
  - \(Q_{\mathrm{vent}} = 1.2 \times 8.0 \times (0.5 / 3600) \times 1005 \times (30.0 - 20.0) = 13.4\,\mathrm{W}\)
  - \(Q_{\mathrm{other}} = 50.0 + 50.0 + 13.4 = 113.4\,\mathrm{W}\)
* **Euler integration**:
  - \(\Delta T = Q_{\mathrm{other}} \times \Delta t / C = 113.4 \times 3600 / 100,000 = 4.0824\,\mathrm{K}\)
  - \(T_{\mathrm{in,next}} = 20.0 + 4.08 = 24.08^\circ\mathrm{C}\)


### 9.3 Capacitance \(C\) (documented simplification)

MVP formula (transparent, coarse):

\[
C = \rho_{\mathrm{air}} c_{p,\mathrm{air}} V + \sum_{\mathrm{layers}} \rho_i c_{p,i} (A_{\mathrm{part}} d_i) \cdot f_{\mathrm{mass}}
\]

If a material row has no density or \(c_p\), use **air capacitance only**
plus a documented fabric factor:

\[
C = \rho_{\mathrm{air}} c_{p,\mathrm{air}} V + C_{\mathrm{fabric,default}}
\]

Locked fallback if material \(\rho, c_p\) are missing:

\[
C_{\mathrm{fabric,default}} = 50 \times 10^3 \cdot A_{\mathrm{floor}} \quad [\mathrm{J/K}]
\]

(about 50 kJ/(K·m²) of floor area — a light-shelter order of magnitude).
**Confidence:** approximate. Always expose the numeric \(C\) used in the
API/PDF so the assumption is inspectable.

If \(C\) would be so small that \(\Delta t/C\) is unstable, clamp \(C\)
upward to \(C_{\min} = 5\times 10^4\,\mathrm{J/K}\) and flag
`capacitance_clamped: true` in the result.

---

## 10. Comfort

Default band (adjustable in the request):

- \(T_{\mathrm{low}} = 18^\circ\mathrm{C}\)
- \(T_{\mathrm{high}} = 26^\circ\mathrm{C}\)

For each of 24 hours, indoor T is in-band iff
\(T_{\mathrm{low}} \le T_{\mathrm{in}} \le T_{\mathrm{high}}\).

- `hours_in_band` / 24 × 100 = `comfort_pct`
- Peak deviation above: \(\max(0, \max T_{\mathrm{in}} - T_{\mathrm{high}})\)
- Peak deviation below: \(\max(0, T_{\mathrm{low}} - \min T_{\mathrm{in}})\)

Humidity is **not** in the comfort metric in the MVP (no PMV, no latent).

---

## 11. Recommendation score (thermal only)

Do **not** use cost or weight.

Named weights (locked MVP):

| Metric | Weight | Direction |
|--------|--------|-----------|
| `comfort_pct` | \(w_c = 0.50\) | higher is better |
| peak cooling (W) | \(w_{\mathrm{cool}} = 0.25\) | lower is better |
| peak heating (W) | \(w_{\mathrm{heat}} = 0.25\) | lower is better |

Normalisation across the candidate set (min–max). If all candidates
share the same value for a metric, that term contributes 0.5 to everyone
(neutral).

Let \(x' \) be 0…1 normalised “higher is better”:

- comfort: \(x'_c = (c - c_{\min})/(c_{\max}-c_{\min})\)
- peak cooling: \(x'_{\mathrm{cool}} = 1 - (P_c - P_{c,\min})/(P_{c,\max}-P_{c,\min})\)
- peak heating: likewise

\[
S = w_c x'_c + w_{\mathrm{cool}} x'_{\mathrm{cool}} + w_{\mathrm{heat}} x'_{\mathrm{heat}}
\]

In **floating mode** (no setpoint), peak heating/cooling requirements are
0. Then \(S\) reduces to comfort ranking (the load terms are neutral).
That is intended: without HVAC, comfort of the floating temperature is
the design metric.

Justification text **must** quote numbers that appear on the simulation
outputs (e.g. comfort_pct, peak Q, Δ% vs baseline). No invented
percentages.

---

## 12. Climate fields: used vs unused

| Field | Used in MVP physics? | Notes |
|-------|----------------------|--------|
| Hourly outdoor temperature | **Yes** | \(T_{\mathrm{out}}\) |
| Hourly shortwave radiation | **Yes** | \(I\) for window solar |
| Wind speed | **No** | May be stored/displayed; does not change \(R_{\mathrm{so}}\) or ACH |
| Humidity | **No** | Display only; no latent load, not in comfort % |
| Timestamp | **Yes** | Series alignment |

If a future change uses wind or humidity in equations, update this
section first.

---

## 13. Assumptions and limitations

Must appear in the UI and PDF:

1. Single indoor node — no floor-to-ceiling or sun-patch gradients.
2. No thermal bridging, no infiltration detailing beyond ACH.
3. Material \(k\) only as good as `materials.json` (`reference` vs
   `approximate`).
4. Solar: simple \(\tau A I\); no orientation-resolved beam/diffuse.
5. Opaque solar omitted in MVP.
6. Wind unused; humidity unused in physics.
7. \(C\) is a coarse estimate.
8. Surface resistances are standard-order constants.
9. Not for certification or HVAC plant sizing as a final design.

---

## 14. Validation approach

Tests in `backend/tests/` must include:

- R, U known-answer (this section §15)
- Sign of \(Q_{\mathrm{cond}}\)
- Multi-layer series additivity
- Insulation sanity (larger \(d_{\mathrm{ins}}\) → smaller \(U\))
- Hot/cold climate directional sanity (floating mode)
- One Euler step matching §15.2
- Comfort arithmetic
- Ranking: extra insulation improves comfort (floating) or reduces
  peak |HVAC| (setpoint mode)

---

## 15. Hand-calculated examples

Use these as pytest oracles (tolerance ±1e-6 relative or ±0.01 W).

### 15.1 Steady-state wall

**Given**

- One layer: plywood, \(d = 0.018\,\mathrm{m}\), \(k = 0.13\,\mathrm{W/(m·K)}\)
- \(R_{\mathrm{si}} = 0.13\), \(R_{\mathrm{so}} = 0.04\)
- \(A = 10\,\mathrm{m^2}\)
- \(T_{\mathrm{out}} = 40^\circ\mathrm{C}\), \(T_{\mathrm{in}} = 26^\circ\mathrm{C}\)

**Compute**

\[
R_{\mathrm{layer}} = 0.018 / 0.13 = 0.138461538\,\mathrm{m^2·K/W}
\]

\[
R_{\mathrm{total}} = 0.13 + 0.138461538 + 0.04 = 0.308461538\,\mathrm{m^2·K/W}
\]

\[
U = 1 / 0.308461538 = 3.24188\,\mathrm{W/(m^2·K)}
\]

\[
Q_{\mathrm{cond}} = 3.24188 \times 10 \times (40 - 26) = 453.863\,\mathrm{W}
\]

Sign check: \(T_{\mathrm{out}} > T_{\mathrm{in}}\) ⇒ \(Q_{\mathrm{cond}} > 0\).

**Insulation sanity (same wall + 0.05 m PUF, \(k = 0.025\))**

\[
R_{\mathrm{PUF}} = 0.05 / 0.025 = 2.0
\]

\[
R_{\mathrm{total}} = 0.13 + 0.138461538 + 2.0 + 0.04 = 2.308461538
\]

\[
U = 0.43319\,\mathrm{W/(m^2·K)}
\]

\(U\) dropped vs 3.24 — test must assert \(U_{\mathrm{ins}} < U_{\mathrm{bare}}\).

#### 15.1.1 PUF Insulation (Phase 1 Validation Hand-Calculation)

**Given**

- One layer: PUF insulation, \(d = 0.05\,\mathrm{m}\), \(k = 0.025\,\mathrm{W/(m·K)}\)
- Surface resistances: Omitted for this validation case (\(R_{\mathrm{si}} = 0, R_{\mathrm{so}} = 0\))
- Area: \(A = 20\,\mathrm{m^2}\)
- \(T_{\mathrm{out}} = 45^\circ\mathrm{C}\), \(T_{\mathrm{in}} = 24^\circ\mathrm{C}\)

**Compute**

\[
R_{\mathrm{layer}} = \frac{d}{k} = \frac{0.05}{0.025} = 2.0\,\mathrm{m^2·K/W}
\]

Since surface resistances are omitted:

\[
R_{\mathrm{total}} = R_{\mathrm{layer}} = 2.0\,\mathrm{m^2·K/W}
\]

\[
U = \frac{1}{R_{\mathrm{total}}} = \frac{1}{2.0} = 0.5\,\mathrm{W/(m^2·K)}
\]

\[
Q_{\mathrm{cond}} = U \cdot A \cdot (T_{\mathrm{out}} - T_{\mathrm{in}}) = 0.5 \cdot 20 \cdot (45 - 24) = 0.5 \cdot 20 \cdot 21 = +210.0\,\mathrm{W}
\]

**Explanation**
Positive Q value (\(+210\,\mathrm{W}\)) indicates that heat is entering the indoor air, as the outdoor temperature is higher than the indoor temperature (\(45^\circ\mathrm{C} > 24^\circ\mathrm{C}\)).

The automated unit test `test_positive_heat_flow` in `backend/tests/test_steady_state.py` matches this hand calculation exactly.

### 15.2 One RC Euler step (floating, no HVAC)

**Given**

- \(C = 5.0 \times 10^5\,\mathrm{J/K}\)
- \(\Delta t = 3600\,\mathrm{s}\)
- \(T_{\mathrm{in}} = 26^\circ\mathrm{C}\), \(T_{\mathrm{out}} = 40^\circ\mathrm{C}\)
- \(Q_{\mathrm{net}} = Q_{\mathrm{cond}} = 400\,\mathrm{W}\) (illustrative; solar/vent/occ = 0)

\[
T_{\mathrm{in,new}} = 26 + \frac{3600}{5.0\times 10^5} \times 400 = 26 + 2.88 = 28.88^\circ\mathrm{C}
\]

Indoor temperature **rose**, as required for a net gain.

### 15.3 HVAC hold

Same \(Q_{\mathrm{other}} = 400\,\mathrm{W}\), setpoint mode:

\[
Q_{\mathrm{hvac}} = -400\,\mathrm{W}
\]

(cooling 400 W). \(T_{\mathrm{in}}\) stays at \(T_{\mathrm{set}}\).

---

## 16. Material data policy

- Do not invent \(k\) and label it `reference`.
- If a textbook/datasheet value cannot be cited, use `approximate` and
  a short `source` note (e.g. “typical range for PUF boards”).
- Cost and mass are **not** scoring inputs. If later displayed, they
  need their own `confidence` and must not enter \(S\).
