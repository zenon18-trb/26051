"use client";

import { useId, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  Gauge,
  Info,
  ShieldCheck,
  Sliders,
  SunSnow,
  Thermometer,
  Waves,
  Zap,
} from "lucide-react";
import {
  DEFAULT_COMFORT_BAND,
  type ComfortBand,
  type HvacConfig,
  type HvacMode,
} from "@/lib/api";
import { useShelterConfiguration } from "@/context/ShelterConfigurationContext";

type SetpointPreset = {
  id: string;
  name: string;
  temp_c: number;
  description: string;
};

const SETPOINT_PRESETS: SetpointPreset[] = [
  {
    id: "economy-cool",
    name: "20.0 °C (Standard Cool)",
    temp_c: 20.0,
    description: "Low-energy cooling baseline for high-activity personnel",
  },
  {
    id: "standard-baseline",
    name: "22.0 °C (Tactical Baseline)",
    temp_c: 22.0,
    description: "Standard DRDO military outpost indoor thermal comfort",
  },
  {
    id: "moderate-comfort",
    name: "24.0 °C (Moderate Comfort)",
    temp_c: 24.0,
    description: "Moderate warm-climate target setpoint",
  },
  {
    id: "upper-band",
    name: "26.0 °C (Upper Comfort)",
    temp_c: 26.0,
    description: "Upper comfort boundary / emergency cooling mode",
  },
];

type ComfortBandPreset = {
  id: string;
  name: string;
  low: number;
  high: number;
  description: string;
};

const COMFORT_BAND_PRESETS: ComfortBandPreset[] = [
  {
    id: "military-standard",
    name: "Standard Military (18 – 26 °C)",
    low: 18.0,
    high: 26.0,
    description: "Standard defense tactical shelter comfort range",
  },
  {
    id: "strict-comfort",
    name: "Strict Comfort (20 – 24 °C)",
    low: 20.0,
    high: 24.0,
    description: "Command centre and communication post strict band",
  },
  {
    id: "extended-operational",
    name: "Extended Operational (15 – 28 °C)",
    low: 15.0,
    high: 28.0,
    description: "Extreme environment survival / depot operational limits",
  },
];

export function HvacThermalControl() {
  const { hvac, setHvac, isHvacConfigured } = useShelterConfiguration();

  // Local state initialized from context or defaults
  const [mode, setMode] = useState<HvacMode>(hvac?.mode ?? "floating");
  const [setpointStr, setSetpointStr] = useState<string>(
    hvac?.setpoint_c !== null && hvac?.setpoint_c !== undefined
      ? String(hvac.setpoint_c)
      : "22.0"
  );
  const [initialTempStr, setInitialTempStr] = useState<string>(
    hvac?.t_in_initial_c !== null && hvac?.t_in_initial_c !== undefined
      ? String(hvac.t_in_initial_c)
      : ""
  );
  const [comfortLowStr, setComfortLowStr] = useState<string>(
    String(hvac?.comfort_band?.t_low_c ?? DEFAULT_COMFORT_BAND.t_low_c)
  );
  const [comfortHighStr, setComfortHighStr] = useState<string>(
    String(hvac?.comfort_band?.t_high_c ?? DEFAULT_COMFORT_BAND.t_high_c)
  );
  const [savedSuccess, setSavedSuccess] = useState<boolean>(Boolean(hvac));

  const setpointInputId = useId();
  const initialTempInputId = useId();
  const comfortLowInputId = useId();
  const comfortHighInputId = useId();

  // Validation
  const parsedSetpoint = parseFloat(setpointStr);
  const parsedInitialTemp = initialTempStr.trim() ? parseFloat(initialTempStr) : null;
  const parsedComfortLow = parseFloat(comfortLowStr);
  const parsedComfortHigh = parseFloat(comfortHighStr);

  const setpointError = useMemo(() => {
    if (mode === "floating") return null;
    if (!setpointStr.trim()) return "Setpoint temperature is required in controlled mode.";
    if (isNaN(parsedSetpoint) || !isFinite(parsedSetpoint)) {
      return "Setpoint temperature must be a valid number.";
    }
    if (parsedSetpoint < -20 || parsedSetpoint > 60) {
      return "Setpoint must be within realistic operational range (-20 °C to 60 °C).";
    }
    return null;
  }, [mode, setpointStr, parsedSetpoint]);

  const initialTempError = useMemo(() => {
    if (parsedInitialTemp === null) return null;
    if (isNaN(parsedInitialTemp) || !isFinite(parsedInitialTemp)) {
      return "Initial temperature must be a valid number.";
    }
    if (parsedInitialTemp < -50 || parsedInitialTemp > 70) {
      return "Initial temperature must be within (-50 °C to 70 °C).";
    }
    return null;
  }, [parsedInitialTemp]);

  const comfortBandError = useMemo(() => {
    if (isNaN(parsedComfortLow) || isNaN(parsedComfortHigh)) {
      return "Comfort band thresholds must be valid numbers.";
    }
    if (parsedComfortLow >= parsedComfortHigh) {
      return "Lower comfort boundary (T_low) must be strictly less than upper boundary (T_high).";
    }
    return null;
  }, [parsedComfortLow, parsedComfortHigh]);

  const isFormValid = !setpointError && !initialTempError && !comfortBandError;

  function handleSave() {
    if (!isFormValid) return;

    const comfort_band: ComfortBand = {
      t_low_c: parsedComfortLow,
      t_high_c: parsedComfortHigh,
    };

    const config: HvacConfig = {
      mode,
      setpoint_c: mode === "setpoint" ? parsedSetpoint : null,
      t_in_initial_c: parsedInitialTemp,
      comfort_band,
    };

    setHvac(config);
    setSavedSuccess(true);
  }

  function handleApplySetpointPreset(preset: SetpointPreset) {
    setSetpointStr(String(preset.temp_c));
    setSavedSuccess(false);
  }

  function handleApplyComfortPreset(preset: ComfortBandPreset) {
    setComfortLowStr(String(preset.low));
    setComfortHighStr(String(preset.high));
    setSavedSuccess(false);
  }

  return (
    <div className="climate-page">
      {/* Page Heading */}
      <div className="page-heading climate-heading">
        <div>
          <p className="eyebrow">STAGE 6 · HVAC &amp; THERMAL CONTROL</p>
          <h1>HVAC &amp; Thermal Control</h1>
          <p className="page-description">
            Define whether indoor temperature is allowed to float naturally or maintained at a target setpoint.
          </p>
        </div>
        <div className="configured-pill">
          <span className={`status-dot ${isHvacConfigured ? "status-dot-configured" : ""}`} />
          {isHvacConfigured ? "Configured" : "Not configured"}
        </div>
      </div>

      <div className="climate-layout">
        {/* Left Column: Configuration Controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Panel 1: Operational Mode Selection */}
          <section className="climate-panel selection-panel">
            <div className="panel-heading">
              <div>
                <h2>Thermal Operation Mode</h2>
                <p>Choose between natural free-floating thermal drift or controlled setpoint.</p>
              </div>
              <Gauge aria-hidden className="text-slate-400" />
            </div>

            <div className="orientation-section" style={{ marginTop: 0 }}>
              <label className="orientation-label">HVAC Mode</label>
              <p className="orientation-subnote">
                Controls the active thermal equation in the simulation engine.
              </p>

              <div className="glazing-kind-list" role="radiogroup" aria-label="HVAC Operational Mode">
                {/* Floating Mode Option */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === "floating"}
                  className={`glazing-kind-card ${mode === "floating" ? "glazing-kind-card-active" : ""}`}
                  onClick={() => {
                    setMode("floating");
                    setSavedSuccess(false);
                  }}
                >
                  <div className="glazing-kind-header">
                    <strong>Floating Indoor Temperature</strong>
                    <span className="glazing-badge">Q_HVAC = 0 W · PASSIVE DRIFT</span>
                  </div>
                  <p>
                    Indoor temperature is allowed to evolve according to the calculated thermal loads. HVAC contribution is zero.
                  </p>
                </button>

                {/* Setpoint Mode Option */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === "setpoint"}
                  className={`glazing-kind-card ${mode === "setpoint" ? "glazing-kind-card-active" : ""}`}
                  onClick={() => {
                    setMode("setpoint");
                    setSavedSuccess(false);
                  }}
                >
                  <div className="glazing-kind-header">
                    <strong>Maintain Indoor Setpoint</strong>
                    <span className="glazing-badge">CONTROLLED SETPOINT MODE</span>
                  </div>
                  <p>
                    Indoor temperature is maintained at a target temperature. The server calculates the required heating/cooling loads.
                  </p>
                </button>
              </div>
            </div>

            {/* Setpoint Input (Shown only when Setpoint mode selected) */}
            {mode === "setpoint" && (
              <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* Setpoint Presets */}
                <div className="geometry-presets-block">
                  <span className="geometry-presets-title">Standard Setpoint Presets</span>
                  <div className="geometry-presets-grid">
                    {SETPOINT_PRESETS.map((preset) => {
                      const isActive =
                        !setpointError &&
                        Math.abs(parsedSetpoint - preset.temp_c) < 0.01;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          className={`geometry-preset-btn ${
                            isActive ? "geometry-preset-btn-active" : ""
                          }`}
                          onClick={() => handleApplySetpointPreset(preset)}
                        >
                          <strong>{preset.name}</strong>
                          <span>{preset.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Setpoint Numeric Field */}
                <div className="geometry-inputs-grid" style={{ gridTemplateColumns: "1fr" }}>
                  <div className="geometry-field">
                    <label htmlFor={setpointInputId}>
                      Target Indoor Temperature Setpoint (°C)
                      <input
                        id={setpointInputId}
                        type="number"
                        step="0.5"
                        min="-20"
                        max="60"
                        inputMode="decimal"
                        value={setpointStr}
                        onChange={(e) => {
                          setSetpointStr(e.target.value);
                          setSavedSuccess(false);
                        }}
                        className={setpointError ? "input-error" : ""}
                        aria-invalid={Boolean(setpointError)}
                        aria-describedby={setpointError ? `${setpointInputId}-error` : undefined}
                      />
                    </label>
                    {setpointError ? (
                      <span id={`${setpointInputId}-error`} className="field-error-msg" role="alert">
                        {setpointError}
                      </span>
                    ) : (
                      <small className="field-hint">
                        Target dry-bulb temperature held inside the shelter during transient simulation.
                      </small>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Initial Temperature (Floating mode option) */}
            {mode === "floating" && (
              <div style={{ marginTop: "14px" }}>
                <div className="geometry-inputs-grid" style={{ gridTemplateColumns: "1fr" }}>
                  <div className="geometry-field">
                    <label htmlFor={initialTempInputId}>
                      Initial Indoor Temperature at t = 0 (°C) · <em>Optional</em>
                      <input
                        id={initialTempInputId}
                        type="number"
                        step="0.5"
                        min="-50"
                        max="70"
                        placeholder="Leave blank to use outdoor ambient at t=0"
                        inputMode="decimal"
                        value={initialTempStr}
                        onChange={(e) => {
                          setInitialTempStr(e.target.value);
                          setSavedSuccess(false);
                        }}
                        className={initialTempError ? "input-error" : ""}
                        aria-invalid={Boolean(initialTempError)}
                        aria-describedby={initialTempError ? `${initialTempInputId}-error` : undefined}
                      />
                    </label>
                    {initialTempError ? (
                      <span id={`${initialTempInputId}-error`} className="field-error-msg" role="alert">
                        {initialTempError}
                      </span>
                    ) : (
                      <small className="field-hint">
                        Starting temperature condition for the 24-hour floating Euler simulation. If empty, ambient temperature is used.
                      </small>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Panel 2: Comfort Band Settings */}
          <section className="climate-panel selection-panel">
            <div className="panel-heading">
              <div>
                <h2>Thermal Comfort Band</h2>
                <p>Define acceptable indoor dry-bulb temperature thresholds.</p>
              </div>
              <SunSnow aria-hidden className="text-slate-400" />
            </div>

            {/* Comfort Presets */}
            <div className="geometry-presets-block">
              <span className="geometry-presets-title">Comfort Band Standards</span>
              <div className="geometry-presets-grid">
                {COMFORT_BAND_PRESETS.map((preset) => {
                  const isActive =
                    !comfortBandError &&
                    Math.abs(parsedComfortLow - preset.low) < 0.01 &&
                    Math.abs(parsedComfortHigh - preset.high) < 0.01;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={`geometry-preset-btn ${
                        isActive ? "geometry-preset-btn-active" : ""
                      }`}
                      onClick={() => handleApplyComfortPreset(preset)}
                    >
                      <strong>{preset.name}</strong>
                      <span>{preset.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comfort Bounds Fields */}
            <div className="geometry-inputs-grid">
              <div className="geometry-field">
                <label htmlFor={comfortLowInputId}>
                  Lower Comfort Limit (T_low °C)
                  <input
                    id={comfortLowInputId}
                    type="number"
                    step="0.5"
                    value={comfortLowStr}
                    onChange={(e) => {
                      setComfortLowStr(e.target.value);
                      setSavedSuccess(false);
                    }}
                    className={comfortBandError ? "input-error" : ""}
                  />
                </label>
                <small className="field-hint">Minimum comfortable temperature.</small>
              </div>

              <div className="geometry-field">
                <label htmlFor={comfortHighInputId}>
                  Upper Comfort Limit (T_high °C)
                  <input
                    id={comfortHighInputId}
                    type="number"
                    step="0.5"
                    value={comfortHighStr}
                    onChange={(e) => {
                      setComfortHighStr(e.target.value);
                      setSavedSuccess(false);
                    }}
                    className={comfortBandError ? "input-error" : ""}
                  />
                </label>
                <small className="field-hint">Maximum comfortable temperature.</small>
              </div>
            </div>

            {comfortBandError && (
              <span className="field-error-msg" role="alert" style={{ marginTop: "4px" }}>
                {comfortBandError}
              </span>
            )}

            {/* Save Button */}
            <button
              type="button"
              className="primary-button climate-submit"
              onClick={handleSave}
              disabled={!isFormValid}
            >
              <ShieldCheck aria-hidden />
              Save HVAC &amp; Control Configuration
            </button>

            {savedSuccess && isFormValid && (
              <div className="geometry-success-banner" role="status">
                <CheckCircle2 aria-hidden />
                <span>HVAC thermal control parameters saved to active workspace.</span>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Model Semantics & Preview */}
        <section className="climate-panel summary-panel">
          <div className="panel-heading">
            <div>
              <h2>Thermal Control Semantics</h2>
              <p>
                {mode === "floating"
                  ? "Free-Floating Passive Temperature Drift"
                  : `Controlled Setpoint at ${isFormValid ? parsedSetpoint.toFixed(1) : "--"} °C`}
              </p>
            </div>
            <Cpu aria-hidden className="text-slate-400" />
          </div>

          <div className="geometry-preview-container">
            {/* SVG Illustration of Mode */}
            <div className="isometric-viewport">
              <HvacSemanticsSvg
                mode={mode}
                setpointC={isFormValid && mode === "setpoint" ? parsedSetpoint : 22.0}
                tLowC={parsedComfortLow}
                tHighC={parsedComfortHigh}
              />
              <span className="preview-caption">
                Simulation physics breakdown · {mode === "floating" ? "Diurnal temperature drift" : "Thermostat clamped indoor state"}
              </span>
            </div>

            {/* Source / Model Banner */}
            <div className="source-banner source-live">
              <Database aria-hidden />
              <div>
                <strong>Simulation Governing Equations</strong>
                <p>
                  {mode === "floating"
                    ? "Floating Mode: Q_hvac = 0 W · T_next = T_curr + (Q_other / C_total) · dt"
                    : "Setpoint Mode: T_in = T_setpoint · Q_hvac = -Q_other (Q_net = 0 W)"}
                </p>
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="metrics-grid">
              <div className="climate-metric">
                <span>Operation Mode</span>
                <strong style={{ color: mode === "floating" ? "#216f9d" : "#2e7a50" }}>
                  {mode === "floating" ? "FREE FLOATING" : "CONTROLLED SETPOINT"}
                </strong>
              </div>
              <div className="climate-metric">
                <span>HVAC Contribution</span>
                <strong>{mode === "floating" ? "0 W (Passive)" : "Calculated by Server"}</strong>
              </div>
              <div className="climate-metric">
                <span>Target Setpoint</span>
                <strong>
                  {mode === "setpoint"
                    ? `${parsedSetpoint.toFixed(1)} °C`
                    : "None (Floating)"}
                </strong>
              </div>
              <div className="climate-metric">
                <span>Comfort Band</span>
                <strong>
                  {parsedComfortLow.toFixed(1)} °C – {parsedComfortHigh.toFixed(1)} °C
                </strong>
              </div>
              <div className="climate-metric">
                <span>Initial Temp (t=0)</span>
                <strong>
                  {parsedInitialTemp !== null
                    ? `${parsedInitialTemp.toFixed(1)} °C`
                    : "Ambient (Outdoor at t=0)"}
                </strong>
              </div>
              <div className="climate-metric">
                <span>Load Estimation Status</span>
                <strong>Ready for Server Simulation</strong>
              </div>
            </div>

            <div className="orientation-disclaimer">
              <Info aria-hidden />
              <span>
                <strong>Engineering note:</strong> Final heating/cooling loads and temperature series are calculated by the server simulation engine during the 24-hour transient run.
              </span>
            </div>

            <div className="result-footer">
              <CheckCircle2 aria-hidden />
              Stage 6 configuration complete. All 6 design workflow stages are configured.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * Diagram showing diurnal temperature curve vs controlled setpoint horizontal line.
 */
function HvacSemanticsSvg({
  mode,
  setpointC,
  tLowC,
  tHighC,
}: {
  mode: HvacMode;
  setpointC: number;
  tLowC: number;
  tHighC: number;
}) {
  return (
    <svg
      viewBox="0 0 400 210"
      className="isometric-svg"
      role="img"
      aria-label={`Thermal control diagram: ${mode} mode`}
    >
      <defs>
        <pattern id="hvac-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="0.75" fill="#c3d5e0" opacity="0.6" />
        </pattern>
        <linearGradient id="comfort-band-fill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2e7a50" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#2e7a50" stopOpacity="0.06" />
        </linearGradient>
      </defs>

      {/* Grid background */}
      <rect width="400" height="210" fill="url(#hvac-grid)" rx="6" />

      {/* Axis Lines */}
      <line x1="45" y1="170" x2="370" y2="170" stroke="#a2b9c7" strokeWidth="1.5" />
      <line x1="45" y1="25" x2="45" y2="170" stroke="#a2b9c7" strokeWidth="1.5" />

      {/* Time axis labels */}
      <text x="50" y="185" fontSize="8" fill="#6d8391">00:00</text>
      <text x="125" y="185" fontSize="8" fill="#6d8391">06:00</text>
      <text x="200" y="185" fontSize="8" fill="#6d8391">12:00 (Peak)</text>
      <text x="285" y="185" fontSize="8" fill="#6d8391">18:00</text>
      <text x="355" y="185" fontSize="8" fill="#6d8391">24:00</text>

      {/* Comfort Band Region (between Y=65 and Y=130) */}
      <rect x="45" y="65" width="325" height="65" fill="url(#comfort-band-fill)" />
      <line x1="45" y1="65" x2="370" y2="65" stroke="#2e7a50" strokeWidth="1" strokeDasharray="4 3" />
      <line x1="45" y1="130" x2="370" y2="130" stroke="#2e7a50" strokeWidth="1" strokeDasharray="4 3" />
      
      <text x="375" y="69" fontSize="8" fill="#2e7a50" fontWeight="bold">{tHighC}°C (T_high)</text>
      <text x="375" y="134" fontSize="8" fill="#2e7a50" fontWeight="bold">{tLowC}°C (T_low)</text>

      {/* Outdoor Ambient Temperature Curve (Diurnal sine wave) */}
      <path
        d="M 45 145 C 110 160 150 50 205 45 C 265 40 310 135 370 145"
        fill="none"
        stroke="#8ca8b8"
        strokeWidth="1.75"
        strokeDasharray="4 4"
      />
      <text x="210" y="38" fontSize="8" fill="#6a8798" textAnchor="middle">
        Outdoor Ambient T_out
      </text>

      {/* Indoor Temperature Behavior */}
      {mode === "floating" ? (
        <>
          {/* Floating Drift Curve */}
          <path
            d="M 45 130 C 115 140 160 70 205 68 C 260 65 315 120 370 130"
            fill="none"
            stroke="#1b5e85"
            strokeWidth="2.5"
          />
          <g transform="translate(205, 68)">
            <circle r="4" fill="#1b5e85" />
            <text x="10" y="-8" fontSize="9" fontWeight="bold" fill="#1b5e85">
              Floating T_in (Passive Drift)
            </text>
          </g>
          {/* Legend Banner */}
          <g transform="translate(60, 42)">
            <rect x="0" y="0" width="130" height="18" rx="3" fill="#ffffff" stroke="#cddde6" />
            <text x="8" y="12" fontSize="8" fontWeight="bold" fill="#1b5e85">
              Q_HVAC = 0 W (No active load)
            </text>
          </g>
        </>
      ) : (
        <>
          {/* Setpoint Clamped Horizontal Line at Y=98 */}
          <line x1="45" y1="98" x2="370" y2="98" stroke="#d96b27" strokeWidth="2.5" />
          <g transform="translate(200, 98)">
            <circle r="4" fill="#d96b27" />
            <text x="0" y="-8" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#d96b27">
              Target Setpoint T_set = {setpointC.toFixed(1)} °C
            </text>
          </g>
          {/* Heat flux indicator arrows indicating cooling/heating load */}
          <g stroke="#d96b27" strokeWidth="1.5" fill="none">
            {/* Cooling arrows when T_out > T_set */}
            <path d="M 205 55 L 205 85" markerEnd="url(#arrow)" />
            <polygon points="205,88 202,80 208,80" fill="#d96b27" />
          </g>
          <text x="212" y="75" fontSize="8" fill="#d96b27" fontWeight="bold">
            Q_hvac = -Q_other
          </text>
        </>
      )}

      {/* Title inside schematic */}
      <text x="50" y="18" fontSize="9" fontWeight="bold" fill="#12314b">
        {mode === "floating"
          ? "Floating Mode · T_in evolves with net thermal inertia (C_total)"
          : `Setpoint Mode · Constant T_in = ${setpointC.toFixed(1)} °C`}
      </text>
    </svg>
  );
}
