"use client";

import { useId, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Flame,
  Info,
  ShieldCheck,
  Users,
  Wind,
} from "lucide-react";
import {
  calculateOccupantMetrics,
  calculateVentilationMetrics,
  type VentConfig,
} from "@/lib/api";
import { useShelterConfiguration } from "@/context/ShelterConfigurationContext";
import { ThreeVentilationPreview } from "@/components/ThreeVentilationPreview";

type OccupantPreset = {
  id: string;
  name: string;
  count: number;
  description: string;
};

const OCCUPANT_PRESETS: OccupantPreset[] = [
  {
    id: "unoccupied",
    name: "0 (Unoccupied)",
    count: 0,
    description: "Equipment shelter / unmanned depot",
  },
  {
    id: "sentry-duo",
    name: "2 (Sentry Duo)",
    count: 2,
    description: "Perimeter guard / two-person outpost",
  },
  {
    id: "standard-squad",
    name: "4 (Standard Squad)",
    count: 4,
    description: "Standard tactical squad accommodation",
  },
  {
    id: "platoon-bunk",
    name: "8 (Platoon Bunk)",
    count: 8,
    description: "Multi-occupant barracks / emergency shelter",
  },
];

export function VentilationOccupants() {
  const {
    geometry,
    vents,
    occupants,
    setVents,
    setOccupants,
    isVentilationConfigured,
    isOccupantsConfigured,
    isVentilationAndOccupantsConfigured,
  } = useShelterConfiguration();

  // Local state initialized from context or sensible defaults
  const [isOpen, setIsOpen] = useState<boolean>(vents?.open ?? false);
  const [occupantsStr, setOccupantsStr] = useState<string>(
    occupants !== null && occupants !== undefined ? String(occupants) : "4"
  );
  const [savedSuccess, setSavedSuccess] = useState<boolean>(
    Boolean(vents !== null && occupants !== null)
  );

  const occupantsInputId = useId();
  const reduceMotion = useReducedMotion();

  // Geometry volume
  const shelterVolume = useMemo(() => {
    if (!geometry) return null;
    return geometry.length_m * geometry.width_m * geometry.height_m;
  }, [geometry]);

  // Occupant validation
  const parsedOccupants = parseFloat(occupantsStr);
  const occupantsError = useMemo(() => {
    if (!occupantsStr.trim()) return "Occupant count is required (enter 0 for unoccupied).";
    if (isNaN(parsedOccupants) || !isFinite(parsedOccupants)) {
      return "Occupant count must be a valid integer.";
    }
    if (!Number.isInteger(parsedOccupants)) {
      return "Occupant count must be a whole integer (decimal people not allowed).";
    }
    if (parsedOccupants < 0) {
      return "Occupant count cannot be negative.";
    }
    if (parsedOccupants > 100) {
      return "Occupant count cannot exceed 100 persons for a single tactical shelter.";
    }
    return null;
  }, [occupantsStr, parsedOccupants]);

  const isFormValid = !occupantsError;

  // Derived metrics
  const ventMetrics = useMemo(() => {
    return calculateVentilationMetrics(isOpen, shelterVolume);
  }, [isOpen, shelterVolume]);

  const occMetrics = useMemo(() => {
    if (!isFormValid) return null;
    return calculateOccupantMetrics(parsedOccupants);
  }, [isFormValid, parsedOccupants]);

  function handleSave() {
    if (!isFormValid) return;
    const ventConfig: VentConfig = { open: isOpen };
    setVents(ventConfig);
    setOccupants(parsedOccupants);
    setSavedSuccess(true);
  }

  function handleApplyOccupantPreset(preset: OccupantPreset) {
    setOccupantsStr(String(preset.count));
    setSavedSuccess(false);
  }

  return (
    <div className="climate-page">
      {/* Page Heading */}
      <div className="page-heading climate-heading">
        <div>
          <p className="eyebrow">STAGE 5 · VENTILATION &amp; OCCUPANTS</p>
          <h1>Ventilation &amp; Occupants</h1>
          <p className="page-description">
            Define the shelter ventilation state and occupant load used in the thermal analysis.
          </p>
        </div>
        <div className="configured-pill">
          <span
            className={`status-dot ${
              isVentilationAndOccupantsConfigured ? "status-dot-configured" : ""
            }`}
          />
          {isVentilationAndOccupantsConfigured
            ? "Configured"
            : isVentilationConfigured || isOccupantsConfigured
            ? "Partially configured"
            : "Not configured"}
        </div>
      </div>

      <div className="climate-layout">
        {/* Left Column: Input Panels */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Panel 1: Ventilation State */}
          <section className="climate-panel selection-panel">
            <div className="panel-heading">
              <div>
                <h2>Ventilation State</h2>
                <p>Configure natural airflow vents state (open or closed).</p>
              </div>
              <Wind aria-hidden className="text-slate-400" />
            </div>

            <div className="orientation-section" style={{ marginTop: 0 }}>
              <label className="orientation-label">Airflow &amp; Vent Opening</label>
              <p className="orientation-subnote">
                Controls air change rate in the 24-hour transient simulation loop.
              </p>

              <div className="glazing-kind-list" role="radiogroup" aria-label="Ventilation State">
                {/* Closed Option */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={!isOpen}
                  className={`glazing-kind-card ${!isOpen ? "glazing-kind-card-active" : ""}`}
                  onClick={() => {
                    setIsOpen(false);
                    setSavedSuccess(false);
                  }}
                >
                  <div className="glazing-kind-header">
                    <strong>Closed (Infiltration Only)</strong>
                    <span className="glazing-badge">ACH = 0.5 h⁻¹</span>
                  </div>
                  <p>
                    Vents sealed. Air exchange limited to envelope background infiltration (lower air exchange).
                  </p>
                </button>

                {/* Open Option */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={isOpen}
                  className={`glazing-kind-card ${isOpen ? "glazing-kind-card-active" : ""}`}
                  onClick={() => {
                    setIsOpen(true);
                    setSavedSuccess(false);
                  }}
                >
                  <div className="glazing-kind-header">
                    <strong>Open (Natural Cross Ventilation)</strong>
                    <span className="glazing-badge">ACH = 5.0 h⁻¹</span>
                  </div>
                  <p>
                    Natural ventilation openings active. Promotes unhindered airflow and heat expulsion (higher air exchange).
                  </p>
                </button>
              </div>

              <div className="orientation-disclaimer">
                <Info aria-hidden />
                <span>
                  <strong>Model assumption:</strong> ACH = 0.5 h⁻¹ when closed, 5.0 h⁻¹ when open. Wind speed is not modulated in the first-order MVP.
                </span>
              </div>
            </div>
          </section>

          {/* Panel 2: Occupants */}
          <section className="climate-panel selection-panel">
            <div className="panel-heading">
              <div>
                <h2>Occupants &amp; Internal Load</h2>
                <p>Specify number of active personnel inside the shelter.</p>
              </div>
              <Users aria-hidden className="text-slate-400" />
            </div>

            {/* Quick Presets */}
            <div className="geometry-presets-block">
              <span className="geometry-presets-title">Occupancy Quick Presets</span>
              <div className="geometry-presets-grid">
                {OCCUPANT_PRESETS.map((preset) => {
                  const isActive =
                    Number.isInteger(parsedOccupants) &&
                    parsedOccupants === preset.count &&
                    !occupantsError;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={`geometry-preset-btn ${
                        isActive ? "geometry-preset-btn-active" : ""
                      }`}
                      onClick={() => handleApplyOccupantPreset(preset)}
                    >
                      <strong>{preset.name}</strong>
                      <span>{preset.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Occupants Count Field */}
            <div className="geometry-inputs-grid" style={{ gridTemplateColumns: "1fr" }}>
              <div className="geometry-field">
                <label htmlFor={occupantsInputId}>
                  Number of Occupants (Persons)
                  <input
                    id={occupantsInputId}
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    inputMode="numeric"
                    value={occupantsStr}
                    onChange={(e) => {
                      setOccupantsStr(e.target.value);
                      setSavedSuccess(false);
                    }}
                    className={occupantsError ? "input-error" : ""}
                    aria-invalid={Boolean(occupantsError)}
                    aria-describedby={occupantsError ? `${occupantsInputId}-error` : undefined}
                  />
                </label>
                {occupantsError ? (
                  <span id={`${occupantsInputId}-error`} className="field-error-msg" role="alert">
                    {occupantsError}
                  </span>
                ) : (
                  <small className="field-hint">
                    Integer value (≥ 0). Enter 0 for unmanned equipment shelter.
                  </small>
                )}
              </div>
            </div>

            <div className="orientation-disclaimer">
              <Info aria-hidden />
              <span>
                <strong>Sensible heat model:</strong> 70 W/person (seated/light activity baseline). Final thermal loads are calculated by the server simulation engine.
              </span>
            </div>

            {/* Save Button */}
            <button
              type="button"
              className="primary-button climate-submit"
              onClick={handleSave}
              disabled={!isFormValid}
            >
              <ShieldCheck aria-hidden />
              Save Ventilation &amp; Occupancy
            </button>

            {savedSuccess && isFormValid && (
              <div className="geometry-success-banner" role="status">
                <CheckCircle2 aria-hidden />
                <span>Ventilation state and occupant count saved to active workspace.</span>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Engineering Breakdown & Summary */}
        <section className="climate-panel summary-panel">
          <div className="panel-heading">
            <div>
              <h2>Engineering Thermal Preview</h2>
              <p>
                {isOpen ? "Open Vents (5.0 ACH)" : "Closed Vents (0.5 ACH)"} ·{" "}
                {isFormValid ? `${parsedOccupants} Occupants` : "Invalid Occupants"}
              </p>
            </div>
            <Flame aria-hidden className="text-slate-400" />
          </div>

          {isFormValid && occMetrics ? (
            <div className="geometry-preview-container">
              {/* Airflow & Occupant Schematic SVG */}
              <div className="isometric-viewport">
                <ThreeVentilationPreview
                  isOpen={isOpen}
                  occupantsCount={parsedOccupants}
                  length={geometry?.length_m ?? 6.0}
                  width={geometry?.width_m ?? 4.0}
                  height={geometry?.height_m ?? 2.8}
                  reduceMotion={Boolean(reduceMotion)}
                />
                <span className="preview-caption">
                  WebGL engineering preview · Airflow circulation and occupant sensible load
                </span>
              </div>

              {/* Source Banner */}
              <div className="source-banner source-live">
                <Database aria-hidden />
                <div>
                  <strong>Simulation Engine Load Models</strong>
                  <p>
                    Ventilation mass flow \(\dot&#123;m&#125; = \rho \cdot V \cdot \text&#123;ACH&#125; / 3600\) · Internal sensible gain \(Q_\text&#123;occ&#125; = N \times 70\,\text&#123;W&#125;\).
                  </p>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="metrics-grid">
                <div className="climate-metric">
                  <span>Ventilation State</span>
                  <strong style={{ color: isOpen ? "#2e7a50" : "#216f9d" }}>
                    {isOpen ? "OPEN" : "CLOSED"}
                  </strong>
                </div>
                <div className="climate-metric">
                  <span>Air Exchange Rate (ACH)</span>
                  <strong>{ventMetrics.ach.toFixed(1)} h⁻¹</strong>
                </div>
                <div className="climate-metric">
                  <span>Shelter Air Volume</span>
                  <strong>
                    {ventMetrics.volume_m3 !== null
                      ? `${ventMetrics.volume_m3.toFixed(1)} m³`
                      : "Configure geometry"}
                  </strong>
                </div>
                <div className="climate-metric">
                  <span>Derived Volumetric Airflow</span>
                  <strong>
                    {ventMetrics.airflow_m3_h !== null
                      ? `${ventMetrics.airflow_m3_h.toFixed(1)} m³/h`
                      : "Configure geometry"}
                  </strong>
                </div>
                <div className="climate-metric">
                  <span>Derived Mass Airflow Rate</span>
                  <strong>
                    {ventMetrics.mass_flow_kg_s !== null
                      ? `${(ventMetrics.mass_flow_kg_s * 1000).toFixed(1)} g/s`
                      : "Configure geometry"}
                  </strong>
                </div>
                <div className="climate-metric">
                  <span>Occupant Count</span>
                  <strong>{parsedOccupants} persons</strong>
                </div>
                <div className="climate-metric">
                  <span>Occupant Sensible Heat</span>
                  <strong>{occMetrics.sensible_heat_w.toFixed(0)} W</strong>
                </div>
                <div className="climate-metric">
                  <span>Per-Person Sensible Load</span>
                  <strong>70 W / person</strong>
                </div>
              </div>

              <div className="result-footer">
                <CheckCircle2 aria-hidden />
                Stage 5 configuration complete. Ready for HVAC and simulation execution.
              </div>
            </div>
          ) : (
            <div className="summary-empty">
              <div className="summary-empty-icon">
                <AlertTriangle aria-hidden />
              </div>
              <h3>Invalid Input</h3>
              <p>Please enter a non-negative integer for the occupant count.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Schematic illustration of shelter ventilation airflow and internal occupant sensible heat.
 */
export function VentilationSchematicSvg({
  isOpen,
  occupantsCount,
  volumeM3,
}: {
  isOpen: boolean;
  occupantsCount: number;
  volumeM3: number | null;
}) {
  void volumeM3;
  return (
    <svg
      viewBox="0 0 400 210"
      className="isometric-svg"
      role="img"
      aria-label={`Ventilation schematic: vents ${isOpen ? "open" : "closed"}, ${occupantsCount} occupants`}
    >
      <defs>
        <pattern id="vent-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="0.75" fill="#c3d5e0" opacity="0.6" />
        </pattern>
        <linearGradient id="shelter-box-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f8fbfd" />
          <stop offset="100%" stopColor="#e5eff5" />
        </linearGradient>
        <linearGradient id="airflow-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#438cb2" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#68b2dc" stopOpacity="0.8" />
        </linearGradient>
        <linearGradient id="heat-grad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#d96b27" />
          <stop offset="100%" stopColor="#f3a469" />
        </linearGradient>
      </defs>

      {/* Grid background */}
      <rect width="400" height="210" fill="url(#vent-grid)" rx="6" />

      {/* Shelter Cutaway Outline */}
      <rect
        x="60"
        y="45"
        width="280"
        height="125"
        rx="4"
        fill="url(#shelter-box-grad)"
        stroke="#4a7c98"
        strokeWidth="2"
      />

      {/* Roof cap */}
      <path
        d="M 50 45 L 200 20 L 350 45 Z"
        fill="#dae8f0"
        stroke="#4a7c98"
        strokeWidth="2"
      />

      {/* Left Vent Opening */}
      <rect
        x="56"
        y="75"
        width="8"
        height="35"
        rx="2"
        fill={isOpen ? "#2e7a50" : "#a2b5c0"}
      />
      <text
        x="45"
        y="96"
        textAnchor="end"
        fontSize="8"
        fontWeight="bold"
        fill={isOpen ? "#2e7a50" : "#627b8a"}
      >
        {isOpen ? "INLET (OPEN)" : "CLOSED"}
      </text>

      {/* Right Vent Opening */}
      <rect
        x="336"
        y="75"
        width="8"
        height="35"
        rx="2"
        fill={isOpen ? "#2e7a50" : "#a2b5c0"}
      />
      <text
        x="355"
        y="96"
        textAnchor="start"
        fontSize="8"
        fontWeight="bold"
        fill={isOpen ? "#2e7a50" : "#627b8a"}
      >
        {isOpen ? "OUTLET (OPEN)" : "CLOSED"}
      </text>

      {/* Airflow Streamlines */}
      {isOpen ? (
        <g stroke="#3288b8" strokeWidth="2" strokeDasharray="6 4" fill="none">
          <path d="M 40 92 Q 130 92 200 90 T 360 92" />
          <path d="M 40 85 Q 140 70 200 80 T 360 85" />
          <path d="M 40 100 Q 140 115 200 105 T 360 100" />
          {/* Arrowheads */}
          <polygon points="362,92 354,88 354,96" fill="#3288b8" />
          <polygon points="362,85 354,81 354,89" fill="#3288b8" />
          <polygon points="362,100 354,96 354,104" fill="#3288b8" />
        </g>
      ) : (
        <g stroke="#9ab4c2" strokeWidth="1.5" strokeDasharray="3 3" fill="none" opacity="0.6">
          <path d="M 50 92 Q 100 92 120 100" />
          <path d="M 350 92 Q 300 92 280 100" />
        </g>
      )}

      {/* Occupant Silhouettes and Sensible Heat Plumes */}
      {occupantsCount > 0 ? (
        <g transform="translate(140, 105)">
          {Array.from({ length: Math.min(6, occupantsCount) }).map((_, i) => {
            const spacing = Math.min(24, 120 / Math.max(1, Math.min(6, occupantsCount)));
            const ox = i * spacing;
            return (
              <g key={i} transform={`translate(${ox}, 0)`}>
                {/* Person Head & Body */}
                <circle cx="10" cy="18" r="5" fill="#1b5e85" />
                <path d="M 4 38 C 4 28 16 28 16 38 Z" fill="#1b5e85" />
                {/* Rising Heat Plume */}
                <path
                  d="M 10 10 Q 7 3 10 -4 T 10 -12"
                  stroke="#d96b27"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                />
              </g>
            );
          })}
          {occupantsCount > 6 && (
            <text x="145" y="32" fontSize="9" fontWeight="bold" fill="#1b5e85">
              +{occupantsCount - 6} more
            </text>
          )}
        </g>
      ) : (
        <g transform="translate(200, 125)">
          <text x="0" y="0" textAnchor="middle" fontSize="10" fill="#718896" fontStyle="italic">
            No occupants inside shelter (0 W sensible load)
          </text>
        </g>
      )}

      {/* Status Tags Inside Schematic */}
      <g transform="translate(200, 58)">
        <rect x="-80" y="-10" width="160" height="18" rx="3" fill="#ffffff" stroke="#d0dfe8" />
        <text x="0" y="2" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#12314b">
          {isOpen ? "5.0 ACH Natural Flow" : "0.5 ACH Infiltration"} · {occupantsCount * 70} W Sensible
        </text>
      </g>

      {/* Ground Line */}
      <line x1="30" y1="170" x2="370" y2="170" stroke="#b2c8d5" strokeWidth="2" />
    </svg>
  );
}
