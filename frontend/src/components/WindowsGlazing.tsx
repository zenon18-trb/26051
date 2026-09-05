"use client";

import { useId, useMemo, useState } from "react";
import {
  AlertTriangle,
  AppWindow,
  CheckCircle2,
  Compass,
  Database,
  Info,
  Layers,
  Ruler,
  ShieldCheck,
  SunMedium,
} from "lucide-react";
import {
  calculateWindowMetrics,
  type CardinalOrientation,
  type WindowConfig,
} from "@/lib/api";
import { useShelterConfiguration } from "@/context/ShelterConfigurationContext";

type WindowPreset = {
  id: string;
  name: string;
  area_m2: number;
  purpose: string;
};

const WINDOW_PRESETS: WindowPreset[] = [
  {
    id: "no-windows",
    name: "No Glazing (Windowless)",
    area_m2: 0.0,
    purpose: "Maximum insulation retention / bunker",
  },
  {
    id: "minimal",
    name: "Minimal Daylight Slot",
    area_m2: 1.5,
    purpose: "High-altitude / extreme cold outpost",
  },
  {
    id: "standard",
    name: "Standard Field Cabin",
    area_m2: 3.0,
    purpose: "Balanced natural light and thermal comfort",
  },
  {
    id: "observation",
    name: "Observation / Daylit Post",
    area_m2: 6.0,
    purpose: "Command / perimeter monitoring shelter",
  },
];

const GLAZING_KINDS: { value: "glazed" | "open"; label: string; description: string }[] = [
  {
    value: "glazed",
    label: "Standard Glazed Window (6mm Glass)",
    description: "Standard float glass with fixed solar transmittance (τ = 0.50).",
  },
  {
    value: "open",
    label: "Open Unglazed Aperture",
    description: "Direct opening without glazing for natural unhindered ventilation.",
  },
];

export function WindowsGlazing() {
  const { geometry, windows, setWindows, isWindowsConfigured } =
    useShelterConfiguration();

  const [areaStr, setAreaStr] = useState<string>(
    windows !== null ? String(windows.area_m2) : "3.0"
  );
  const [kind, setKind] = useState<"glazed" | "open">(
    windows?.kind === "open" ? "open" : "glazed"
  );
  const [savedSuccess, setSavedSuccess] = useState<boolean>(Boolean(windows));

  const areaId = useId();

  // Parse and calculate geometry references
  const parsedArea = parseFloat(areaStr);
  const grossWallArea = geometry
    ? 2 * (geometry.length_m + geometry.width_m) * geometry.height_m
    : null;
  const floorArea = geometry
    ? geometry.length_m * geometry.width_m
    : null;

  // Validation
  const areaError = useMemo(() => {
    if (!areaStr.trim()) return "Window area is required (enter 0 for windowless).";
    if (isNaN(parsedArea) || !isFinite(parsedArea)) return "Window area must be a valid number.";
    if (parsedArea < 0) return "Window area cannot be negative.";
    if (grossWallArea !== null && parsedArea > grossWallArea) {
      return `Window area (${parsedArea.toFixed(1)} m²) cannot exceed gross wall area (${grossWallArea.toFixed(1)} m²).`;
    }
    return null;
  }, [areaStr, parsedArea, grossWallArea]);

  const isFormValid = !areaError;

  // Window metrics
  const metrics = useMemo(() => {
    if (!isFormValid) return null;
    return calculateWindowMetrics(parsedArea, grossWallArea, floorArea, kind);
  }, [isFormValid, parsedArea, grossWallArea, floorArea, kind]);

  function handleApplyPreset(preset: WindowPreset) {
    setAreaStr(String(preset.area_m2));
    setSavedSuccess(false);
  }

  function handleSaveWindows() {
    if (!isFormValid) return;
    const config: WindowConfig = {
      area_m2: parsedArea,
      kind,
    };
    setWindows(config);
    setSavedSuccess(true);
  }

  return (
    <div className="climate-page">
      {/* Page Heading */}
      <div className="page-heading climate-heading">
        <div>
          <p className="eyebrow">STAGE 4 · WINDOWS &amp; GLAZING</p>
          <h1>Windows &amp; Glazing</h1>
          <p className="page-description">
            Define the glazed area and glazing type used in the thermal analysis.
          </p>
        </div>
        <div className="configured-pill">
          <span className={`status-dot ${isWindowsConfigured ? "status-dot-configured" : ""}`} />
          {isWindowsConfigured ? "Configured" : "Not configured"}
        </div>
      </div>

      <div className="climate-layout">
        {/* Left Column: Window Configuration Inputs */}
        <section className="climate-panel selection-panel">
          <div className="panel-heading">
            <div>
              <h2>Window Dimensions &amp; Glazing</h2>
              <p>Configure aggregate glazed aperture area in square metres (m²).</p>
            </div>
            <AppWindow aria-hidden className="text-slate-400" />
          </div>

          {/* Standard Presets */}
          <div className="geometry-presets-block">
            <span className="geometry-presets-title">Standard Window Area Presets</span>
            <div className="geometry-presets-grid">
              {WINDOW_PRESETS.map((preset) => {
                const isActive = Math.abs(parsedArea - preset.area_m2) < 0.001;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`geometry-preset-btn ${isActive ? "geometry-preset-btn-active" : ""}`}
                    onClick={() => handleApplyPreset(preset)}
                  >
                    <strong>{preset.name}</strong>
                    <span>{preset.area_m2 === 0 ? "0.0 m² (Solid)" : `${preset.area_m2} m²`} · {preset.purpose}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Area Input Field */}
          <div className="geometry-inputs-grid" style={{ gridTemplateColumns: "1fr" }}>
            <div className="geometry-field">
              <label htmlFor={areaId}>
                Total Window Area (m²)
                <input
                  id={areaId}
                  type="number"
                  step="0.1"
                  min="0"
                  inputMode="decimal"
                  value={areaStr}
                  onChange={(e) => {
                    setAreaStr(e.target.value);
                    setSavedSuccess(false);
                  }}
                  className={areaError ? "input-error" : ""}
                  aria-invalid={Boolean(areaError)}
                  aria-describedby={areaError ? `${areaId}-error` : undefined}
                />
              </label>
              {areaError ? (
                <span id={`${areaId}-error`} className="field-error-msg" role="alert">
                  {areaError}
                </span>
              ) : (
                <small className="field-hint">
                  Aggregate transparent aperture across all shelter walls. Enter 0 for windowless.
                </small>
              )}
            </div>
          </div>

          {/* Glazing Kind Selection */}
          <div className="orientation-section">
            <div className="orientation-header">
              <div>
                <label className="orientation-label">Glazing Type / Aperture Kind</label>
                <p className="orientation-subnote">
                  Backend physics glazing representation.
                </p>
              </div>
              <SunMedium aria-hidden />
            </div>

            <div className="glazing-kind-list" role="radiogroup" aria-label="Glazing Type">
              {GLAZING_KINDS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  role="radio"
                  aria-checked={kind === g.value}
                  className={`glazing-kind-card ${kind === g.value ? "glazing-kind-card-active" : ""}`}
                  onClick={() => {
                    setKind(g.value);
                    setSavedSuccess(false);
                  }}
                >
                  <div className="glazing-kind-header">
                    <strong>{g.label}</strong>
                    <span className="glazing-badge">{g.value.toUpperCase()}</span>
                  </div>
                  <p>{g.description}</p>
                </button>
              ))}
            </div>

            <div className="orientation-disclaimer">
              <Info aria-hidden />
              <span>
                The thermal simulation engine uses fixed 6mm float glass properties (k = 0.96 W/m·K, U ≈ 5.67 W/m²K, τ = 0.50).
              </span>
            </div>
          </div>

          {/* Save Action */}
          <button
            type="button"
            className="primary-button climate-submit"
            onClick={handleSaveWindows}
            disabled={!isFormValid}
          >
            <ShieldCheck aria-hidden />
            Save Window Configuration
          </button>

          {savedSuccess && isFormValid && (
            <div className="geometry-success-banner" role="status">
              <CheckCircle2 aria-hidden />
              <span>Window parameters saved successfully to active workspace.</span>
            </div>
          )}
        </section>

        {/* Right Column: Visualization & Design Ratios */}
        <section className="climate-panel summary-panel">
          <div className="panel-heading">
            <div>
              <h2>Architectural Glazing Preview &amp; Ratios</h2>
              <p>
                {isFormValid
                  ? `${parsedArea.toFixed(1)} m² ${kind === "glazed" ? "Glazed" : "Open"} Aperture`
                  : "Enter a valid window area to view design ratios."}
              </p>
            </div>
            <AppWindow aria-hidden className="text-slate-400" />
          </div>

          {isFormValid && metrics ? (
            <div className="geometry-preview-container">
              {/* Isometric Architectural Preview with Window Glazing */}
              <div className="isometric-viewport">
                <IsometricWindowShelterSvg
                  length={geometry?.length_m ?? 6.0}
                  width={geometry?.width_m ?? 4.0}
                  height={geometry?.height_m ?? 2.8}
                  orientation={geometry?.orientation ?? "North"}
                  windowArea={parsedArea}
                  kind={kind}
                />
                <span className="preview-caption">
                  Design visualization only · Aggregate window area represented on primary façade
                </span>
              </div>

              {/* Notice */}
              <div className="source-banner source-live">
                <Database aria-hidden />
                <div>
                  <strong>Window Thermal Properties</strong>
                  <p>
                    {kind === "glazed"
                      ? "Conduction transmittance U ≈ 5.67 W/(m²·K) · Solar transmittance τ = 0.50. Active in transient simulation."
                      : "Open aperture allows direct airflow and solar transmission."}
                  </p>
                </div>
              </div>

              {/* Derived Design Metrics Grid */}
              <div className="metrics-grid">
                <div className="climate-metric">
                  <span>Window Area</span>
                  <strong>{parsedArea.toFixed(2)} m²</strong>
                </div>
                <div className="climate-metric">
                  <span>Glazing Transmittance (U)</span>
                  <strong>{kind === "glazed" ? `${metrics.u_window.toFixed(3)} W/m²K` : "Open (Air)"}</strong>
                </div>
                <div className="climate-metric">
                  <span>Solar Transmittance (τ)</span>
                  <strong>{metrics.tau.toFixed(2)} (50% direct)</strong>
                </div>
                <div className="climate-metric">
                  <span>Window-to-Wall Ratio (WWR)</span>
                  <strong>{metrics.wwr_pct !== null ? `${metrics.wwr_pct.toFixed(1)}%` : "Configure geometry"}</strong>
                </div>
                <div className="climate-metric">
                  <span>Window-to-Floor Ratio</span>
                  <strong>{metrics.wfr_pct !== null ? `${metrics.wfr_pct.toFixed(1)}%` : "Configure geometry"}</strong>
                </div>
                <div className="climate-metric">
                  <span>Net Opaque Wall Area</span>
                  <strong>{metrics.netWallArea !== null ? `${metrics.netWallArea.toFixed(1)} m²` : "Configure geometry"}</strong>
                </div>
              </div>

              <div className="result-footer">
                <CheckCircle2 aria-hidden />
                Window parameters configured and ready for ventilation and occupancy setup.
              </div>
            </div>
          ) : (
            <div className="summary-empty">
              <div className="summary-empty-icon">
                <AlertTriangle aria-hidden />
              </div>
              <h3>Invalid Window Area</h3>
              <p>Enter a non-negative window area to calculate design ratios.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Lightweight SVG rendering an isometric rectangular shelter model with window glazing aperture.
 */
function IsometricWindowShelterSvg({
  length,
  width,
  height,
  orientation,
  windowArea,
  kind,
}: {
  length: number;
  width: number;
  height: number;
  orientation: CardinalOrientation;
  windowArea: number;
  kind: "glazed" | "open";
}) {
  const maxDim = Math.max(length, width, height, 1.0);
  const scale = 110 / maxDim;

  const L = Math.max(25, Math.min(135, length * scale));
  const W = Math.max(25, Math.min(105, width * scale));
  const H = Math.max(20, Math.min(80, height * scale));

  const cos30 = Math.cos(Math.PI / 6);
  const sin30 = Math.sin(Math.PI / 6);

  const originX = 195;
  const originY = 170;

  const p0 = { x: originX, y: originY };
  const p1 = { x: originX + L * cos30, y: originY - L * sin30 };
  const p2 = { x: originX + (L - W) * cos30, y: originY - (L + W) * sin30 };
  const p3 = { x: originX - W * cos30, y: originY - W * sin30 };

  const t0 = { x: p0.x, y: p0.y - H };
  const t1 = { x: p1.x, y: p1.y - H };
  const t2 = { x: p2.x, y: p2.y - H };
  const t3 = { x: p3.x, y: p3.y - H };

  const frontWallPath = `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} L ${t1.x} ${t1.y} L ${t0.x} ${t0.y} Z`;
  const sideWallPath = `M ${p0.x} ${p0.y} L ${p3.x} ${p3.y} L ${t3.x} ${t3.y} L ${t0.x} ${t0.y} Z`;
  const roofPath = `M ${t0.x} ${t0.y} L ${t1.x} ${t1.y} L ${t2.x} ${t2.y} L ${t3.x} ${t3.y} Z`;

  // Window aperture on front wall face (scaled according to window area)
  const frontWallArea = length * height;
  const windowRatio = Math.min(0.7, Math.max(0.0, windowArea / (frontWallArea || 1.0)));
  const hasWindow = windowArea > 0.01;

  // Window width and height fractions
  const wFrac = Math.min(0.7, Math.max(0.2, Math.sqrt(windowRatio) * 0.9));
  const hFrac = Math.min(0.65, Math.max(0.2, Math.sqrt(windowRatio) * 0.8));

  // Window position on front wall (centered)
  const wStart = 0.5 - wFrac / 2;
  const wEnd = 0.5 + wFrac / 2;
  const hStart = 0.45 - hFrac / 2;
  const hEnd = 0.45 + hFrac / 2;

  // Coordinates of window corners on front wall
  const wp0 = {
    x: p0.x + L * wStart * cos30,
    y: p0.y - L * wStart * sin30 - H * hStart,
  };
  const wp1 = {
    x: p0.x + L * wEnd * cos30,
    y: p0.y - L * wEnd * sin30 - H * hStart,
  };
  const wt1 = {
    x: p0.x + L * wEnd * cos30,
    y: p0.y - L * wEnd * sin30 - H * hEnd,
  };
  const wt0 = {
    x: p0.x + L * wStart * cos30,
    y: p0.y - L * wStart * sin30 - H * hEnd,
  };

  const windowPath = `M ${wp0.x} ${wp0.y} L ${wp1.x} ${wp1.y} L ${wt1.x} ${wt1.y} L ${wt0.x} ${wt0.y} Z`;

  return (
    <svg
      viewBox="0 0 400 240"
      className="isometric-svg"
      role="img"
      aria-label={`Isometric view of shelter with ${windowArea}m² windows`}
    >
      <defs>
        <pattern id="iso-grid-win" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="0.75" fill="#c3d5e0" opacity="0.6" />
        </pattern>
        <linearGradient id="roof-grad-win" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e8f3f9" />
          <stop offset="100%" stopColor="#d4e8f3" />
        </linearGradient>
        <linearGradient id="front-grad-win" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f5fafd" />
          <stop offset="100%" stopColor="#e2edf4" />
        </linearGradient>
        <linearGradient id="side-grad-win" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#dbe8f0" />
          <stop offset="100%" stopColor="#c7dbe6" />
        </linearGradient>
        {/* Glass Glazing Gradient */}
        <linearGradient id="glass-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7ec4e8" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#aee0f8" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#5eaad4" stopOpacity="0.85" />
        </linearGradient>
      </defs>

      {/* Grid background */}
      <rect width="400" height="240" fill="url(#iso-grid-win)" rx="6" />

      {/* Compass indicator */}
      <g transform="translate(355, 35)">
        <circle r="18" fill="#ffffff" stroke="#cfe1eb" strokeWidth="1" />
        <path d="M 0 -13 L 4 -2 L -4 -2 Z" fill="#1b5e85" />
        <path d="M 0 13 L 4 2 L -4 2 Z" fill="#9bb3c1" />
        <text x="0" y="-15" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#1b5e85">N</text>
        <text x="0" y="22" textAnchor="middle" fontSize="7" fill="#718896">S</text>
        <text x="21" y="3" textAnchor="middle" fontSize="7" fill="#718896">E</text>
        <text x="-21" y="3" textAnchor="middle" fontSize="7" fill="#718896">W</text>
        <circle r="2" fill="#1b5e85" />
      </g>

      {/* Ground Shadow */}
      <polygon
        points={`${p0.x},${p0.y + 4} ${p1.x + 8},${p1.y + 2} ${p2.x + 8},${p2.y - 2} ${p3.x - 8},${p3.y + 2}`}
        fill="#12314b"
        opacity="0.05"
      />

      {/* Side Wall */}
      <path d={sideWallPath} fill="url(#side-grad-win)" stroke="#6893ab" strokeWidth="1.5" strokeLinejoin="round" />

      {/* Front Wall */}
      <path d={frontWallPath} fill="url(#front-grad-win)" stroke="#6893ab" strokeWidth="1.5" strokeLinejoin="round" />

      {/* Roof */}
      <path d={roofPath} fill="url(#roof-grad-win)" stroke="#3f7c9e" strokeWidth="1.75" strokeLinejoin="round" />

      {/* Glazed Window Aperture on Front Wall */}
      {hasWindow && (
        <g>
          {/* Window Glass Pane */}
          <path
            d={windowPath}
            fill={kind === "glazed" ? "url(#glass-grad)" : "#2a4253"}
            stroke="#1b5e85"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          {/* Glass reflection highlight line */}
          {kind === "glazed" && (
            <line
              x1={wp0.x + (wp1.x - wp0.x) * 0.2}
              y1={wp0.y + (wt0.y - wp0.y) * 0.3}
              x2={wp0.x + (wp1.x - wp0.x) * 0.6}
              y2={wp0.y + (wt0.y - wp0.y) * 0.8}
              stroke="#ffffff"
              strokeWidth="1.5"
              strokeOpacity="0.8"
            />
          )}
          {/* Window Area Label */}
          <text
            x={(wp0.x + wp1.x) / 2}
            y={(wt0.y + wp0.y) / 2 + 3}
            textAnchor="middle"
            fontSize="8"
            fontWeight="bold"
            fill={kind === "glazed" ? "#0f3a53" : "#ffffff"}
          >
            {windowArea.toFixed(1)} m²
          </text>
        </g>
      )}

      {/* Dimension Callouts */}
      <text
        x={(p0.x + p1.x) / 2 + 16 * cos30}
        y={(p0.y + p1.y) / 2 + 16 * sin30}
        textAnchor="middle"
        fontSize="10"
        fontWeight="bold"
        fill="#12314b"
      >
        L = {length.toFixed(1)}m
      </text>

      <text
        x={p3.x - 24}
        y={(p3.y + t3.y) / 2 + 3}
        textAnchor="middle"
        fontSize="10"
        fontWeight="bold"
        fill="#12314b"
      >
        H = {height.toFixed(1)}m
      </text>
    </svg>
  );
}
