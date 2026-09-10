"use client";

import { useId, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Compass,
  Info,
  Layers,
  Ruler,
  ShieldCheck,
} from "lucide-react";
import type { CardinalOrientation, ShelterGeometry } from "@/lib/api";
import { useShelterConfiguration } from "@/context/ShelterConfigurationContext";
import { ThreeShelterPreview } from "@/components/ThreeShelterPreview";

type StandardPreset = {
  id: string;
  name: string;
  purpose: string;
  length_m: number;
  width_m: number;
  height_m: number;
};

const STANDARD_PRESETS: StandardPreset[] = [
  {
    id: "standard-cabin",
    name: "Standard Field Cabin",
    purpose: "General accommodation / base camp",
    length_m: 6.0,
    width_m: 4.0,
    height_m: 2.8,
  },
  {
    id: "high-altitude",
    name: "Compact High-Altitude Unit",
    purpose: "Leh / Siachen extreme cold post",
    length_m: 4.0,
    width_m: 3.0,
    height_m: 2.4,
  },
  {
    id: "command-post",
    name: "Command / Medical Post",
    purpose: "Operational headquarters / field hospital",
    length_m: 8.0,
    width_m: 5.0,
    height_m: 3.0,
  },
  {
    id: "expedition-pod",
    name: "Expedition Tactical Pod",
    purpose: "Rapid-deployment 2-person shelter",
    length_m: 3.0,
    width_m: 2.5,
    height_m: 2.2,
  },
];

const ORIENTATIONS: { value: CardinalOrientation; label: string }[] = [
  { value: "North", label: "North (0°)" },
  { value: "East", label: "East (90°)" },
  { value: "South", label: "South (180°)" },
  { value: "West", label: "West (270°)" },
];

export function ShelterConfiguration() {
  const { geometry, setGeometry } = useShelterConfiguration();

  const [lengthStr, setLengthStr] = useState<string>(
    geometry ? String(geometry.length_m) : "6.0"
  );
  const [widthStr, setWidthStr] = useState<string>(
    geometry ? String(geometry.width_m) : "4.0"
  );
  const [heightStr, setHeightStr] = useState<string>(
    geometry ? String(geometry.height_m) : "2.8"
  );
  const [orientation, setOrientation] = useState<CardinalOrientation>(
    geometry?.orientation ?? "North"
  );
  const [savedSuccess, setSavedSuccess] = useState<boolean>(Boolean(geometry));

  const lengthId = useId();
  const widthId = useId();
  const heightId = useId();

  // Validate parsed values
  const parsedLength = parseFloat(lengthStr);
  const parsedWidth = parseFloat(widthStr);
  const parsedHeight = parseFloat(heightStr);

  const lengthError = useMemo(() => {
    if (!lengthStr.trim()) return "Length is required.";
    if (isNaN(parsedLength) || !isFinite(parsedLength)) return "Length must be a valid number.";
    if (parsedLength <= 0) return "Length must be greater than 0 metres.";
    return null;
  }, [lengthStr, parsedLength]);

  const widthError = useMemo(() => {
    if (!widthStr.trim()) return "Width is required.";
    if (isNaN(parsedWidth) || !isFinite(parsedWidth)) return "Width must be a valid number.";
    if (parsedWidth <= 0) return "Width must be greater than 0 metres.";
    return null;
  }, [widthStr, parsedWidth]);

  const heightError = useMemo(() => {
    if (!heightStr.trim()) return "Height is required.";
    if (isNaN(parsedHeight) || !isFinite(parsedHeight)) return "Height must be a valid number.";
    if (parsedHeight <= 0) return "Height must be greater than 0 metres.";
    return null;
  }, [heightStr, parsedHeight]);

  const isFormValid = !lengthError && !widthError && !heightError;

  // Derived geometry quantities (mathematically derived from SI dimensions)
  const floorArea = isFormValid ? parsedLength * parsedWidth : null;
  const roofArea = floorArea;
  const volume = isFormValid ? parsedLength * parsedWidth * parsedHeight : null;
  const grossWallArea = isFormValid ? 2 * (parsedLength + parsedWidth) * parsedHeight : null;
  const grossEnvelopeArea =
    isFormValid && grossWallArea !== null && roofArea !== null
      ? grossWallArea + roofArea
      : null;

  const reduceMotion = useReducedMotion();


  function handleApplyPreset(preset: StandardPreset) {
    setLengthStr(String(preset.length_m));
    setWidthStr(String(preset.width_m));
    setHeightStr(String(preset.height_m));
    setSavedSuccess(false);
  }

  function handleSaveGeometry() {
    if (!isFormValid) return;

    const newGeometry: ShelterGeometry = {
      length_m: parsedLength,
      width_m: parsedWidth,
      height_m: parsedHeight,
      orientation,
    };
    setGeometry(newGeometry);
    setSavedSuccess(true);
  }

  return (
    <div className="climate-page">
      <div className="page-heading climate-heading">
        <div>
          <p className="eyebrow">STAGE 2 · SHELTER GEOMETRY</p>
          <h1>Shelter Configuration</h1>
          <p className="page-description">
            Define the shelter envelope dimensions and orientation used for thermal analysis.
          </p>
        </div>
        <div className="configured-pill">
          <span className={`status-dot ${geometry ? "status-dot-configured" : ""}`} />
          {geometry ? "Configured" : "Not configured"}
        </div>
      </div>

      <div className="climate-layout">
        {/* Left Column: Dimensions & Orientation */}
        <section className="climate-panel selection-panel">
          <div className="panel-heading">
            <div>
              <h2>Geometry &amp; Orientation</h2>
              <p>Enter physical envelope dimensions in SI units (metres).</p>
            </div>
            <Ruler aria-hidden />
          </div>

          {/* Engineering Presets Selector */}
          <div className="geometry-presets-block">
            <span className="geometry-presets-title">Standard Engineering Presets</span>
            <div className="geometry-presets-grid">
              {STANDARD_PRESETS.map((preset) => {
                const isActive =
                  Math.abs(parsedLength - preset.length_m) < 0.001 &&
                  Math.abs(parsedWidth - preset.width_m) < 0.001 &&
                  Math.abs(parsedHeight - preset.height_m) < 0.001;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`geometry-preset-btn ${isActive ? "geometry-preset-btn-active" : ""}`}
                    onClick={() => handleApplyPreset(preset)}
                  >
                    <strong>{preset.name}</strong>
                    <span>{preset.length_m}m × {preset.width_m}m × {preset.height_m}m</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dimension Form Inputs */}
          <div className="geometry-inputs-grid">
            <div className="geometry-field">
              <label htmlFor={lengthId}>
                Length (m)
                <input
                  id={lengthId}
                  type="number"
                  step="0.1"
                  min="0.1"
                  inputMode="decimal"
                  value={lengthStr}
                  onChange={(e) => {
                    setLengthStr(e.target.value);
                    setSavedSuccess(false);
                  }}
                  className={lengthError ? "input-error" : ""}
                  aria-invalid={Boolean(lengthError)}
                  aria-describedby={lengthError ? `${lengthId}-error` : undefined}
                />
              </label>
              {lengthError ? (
                <span id={`${lengthId}-error`} className="field-error-msg" role="alert">
                  {lengthError}
                </span>
              ) : (
                <small className="field-hint">Internal dimension (x-axis)</small>
              )}
            </div>

            <div className="geometry-field">
              <label htmlFor={widthId}>
                Width (m)
                <input
                  id={widthId}
                  type="number"
                  step="0.1"
                  min="0.1"
                  inputMode="decimal"
                  value={widthStr}
                  onChange={(e) => {
                    setWidthStr(e.target.value);
                    setSavedSuccess(false);
                  }}
                  className={widthError ? "input-error" : ""}
                  aria-invalid={Boolean(widthError)}
                  aria-describedby={widthError ? `${widthId}-error` : undefined}
                />
              </label>
              {widthError ? (
                <span id={`${widthId}-error`} className="field-error-msg" role="alert">
                  {widthError}
                </span>
              ) : (
                <small className="field-hint">Internal dimension (y-axis)</small>
              )}
            </div>

            <div className="geometry-field">
              <label htmlFor={heightId}>
                Height (m)
                <input
                  id={heightId}
                  type="number"
                  step="0.1"
                  min="0.1"
                  inputMode="decimal"
                  value={heightStr}
                  onChange={(e) => {
                    setHeightStr(e.target.value);
                    setSavedSuccess(false);
                  }}
                  className={heightError ? "input-error" : ""}
                  aria-invalid={Boolean(heightError)}
                  aria-describedby={heightError ? `${heightId}-error` : undefined}
                />
              </label>
              {heightError ? (
                <span id={`${heightId}-error`} className="field-error-msg" role="alert">
                  {heightError}
                </span>
              ) : (
                <small className="field-hint">Internal floor-to-ceiling (z-axis)</small>
              )}
            </div>
          </div>

          {/* Orientation Control */}
          <div className="orientation-section">
            <div className="orientation-header">
              <div>
                <label className="orientation-label">Orientation — visual/design parameter</label>
                <p className="orientation-subnote">
                  Primary façade orientation relative to True North.
                </p>
              </div>
              <Compass aria-hidden />
            </div>

            <div className="orientation-toggle" role="radiogroup" aria-label="Shelter orientation">
              {ORIENTATIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={orientation === opt.value}
                  className={`orientation-btn ${orientation === opt.value ? "orientation-btn-active" : ""}`}
                  onClick={() => {
                    setOrientation(opt.value);
                    setSavedSuccess(false);
                  }}
                >
                  <span className="orientation-btn-val">{opt.value[0]}</span>
                  <span className="orientation-btn-label">{opt.label}</span>
                </button>
              ))}
            </div>

            <div className="orientation-disclaimer">
              <Info aria-hidden />
              <span>
                Orientation is recorded for design context but does not currently alter the thermal calculation.
              </span>
            </div>
          </div>

          {/* Save Action */}
          <button
            type="button"
            className="primary-button climate-submit"
            onClick={handleSaveGeometry}
            disabled={!isFormValid}
          >
            <ShieldCheck aria-hidden />
            Save Geometry Configuration
          </button>

          {savedSuccess && isFormValid && (
            <div className="geometry-success-banner" role="status">
              <CheckCircle2 aria-hidden />
              <span>Geometry parameters saved successfully to active workspace.</span>
            </div>
          )}
        </section>

        {/* Right Column: Visualization & Summary */}
        <section className="climate-panel summary-panel">
          <div className="panel-heading">
            <div>
              <h2>Architectural Preview &amp; Summary</h2>
              <p>
                {isFormValid
                  ? `${parsedLength.toFixed(1)}m × ${parsedWidth.toFixed(1)}m × ${parsedHeight.toFixed(1)}m · ${orientation}`
                  : "Enter valid dimensions to generate geometric metrics."}
              </p>
            </div>
            <Box aria-hidden />
          </div>

          {isFormValid ? (
            <div className="geometry-preview-container">
              {/* Isometric Architectural Illustration */}
              <div className="isometric-viewport">
                <div className="shelter-model-stage">
                  <motion.div
                    key={`${parsedLength}-${parsedWidth}-${parsedHeight}`}
                    className="shelter-model"
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.9, y: 18 }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      y: 0,
                      rotateX: 0,
                      rotateY: 0,
                    }}
                    transition={{ type: "spring", stiffness: 95, damping: 14, mass: 0.9 }}
                  >
                    <ThreeShelterPreview
                      length={parsedLength}
                      width={parsedWidth}
                      height={parsedHeight}
                      orientation={orientation}
                      reduceMotion={Boolean(reduceMotion)}
                    />
                  </motion.div>
                </div>
                <span className="preview-caption">
                  WebGL architectural preview · Rectangular single-zone envelope
                </span>
              </div>

              {/* Preview Notice */}
              <div className="source-banner source-live">
                <Layers aria-hidden />
                <div>
                  <strong>Preview calculation</strong>
                  <p>
                    Derived mathematically from entered SI dimensions. Conduction and transient heat flows will be simulated in subsequent stages.
                  </p>
                </div>
              </div>

              {/* Derived Metrics Grid */}
              <div className="metrics-grid">
                <div className="climate-metric">
                  <span>Floor Area</span>
                  <strong>{floorArea?.toFixed(2)} m²</strong>
                </div>
                <div className="climate-metric">
                  <span>Internal Volume</span>
                  <strong>{volume?.toFixed(2)} m³</strong>
                </div>
                <div className="climate-metric">
                  <span>Gross Wall Area</span>
                  <strong>{grossWallArea?.toFixed(2)} m²</strong>
                </div>
                <div className="climate-metric">
                  <span>Gross Roof Area</span>
                  <strong>{roofArea?.toFixed(2)} m²</strong>
                </div>
                <div className="climate-metric">
                  <span>Gross Envelope Area</span>
                  <strong>{grossEnvelopeArea?.toFixed(2)} m²</strong>
                </div>
                <div className="climate-metric">
                  <span>Façade Orientation</span>
                  <strong>{orientation}</strong>
                </div>
              </div>

              <div className="result-footer">
                <CheckCircle2 aria-hidden />
                Geometry parameters ready for materials and envelope configuration.
              </div>
            </div>
          ) : (
            <div className="summary-empty">
              <div className="summary-empty-icon">
                <AlertTriangle aria-hidden />
              </div>
              <h3>Invalid or Incomplete Dimensions</h3>
              <p>Enter positive, non-zero values for Length, Width, and Height to view geometric quantities.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Lightweight SVG rendering an isometric rectangular shelter model with dimension annotations.
 */
export function IsometricShelterSvg({
  length,
  width,
  height,
  orientation,
}: {
  length: number;
  width: number;
  height: number;
  orientation: CardinalOrientation;
}) {
  const reduceMotion = useReducedMotion();
  // Normalize aspect ratio for isometric rendering box (SVG viewBox: 0 0 400 240)
  const maxDim = Math.max(length, width, height, 1.0);
  const scale = 110 / maxDim;

  const L = Math.max(25, Math.min(135, length * scale));
  const W = Math.max(25, Math.min(105, width * scale));
  const H = Math.max(20, Math.min(80, height * scale));

  // Isometric projection angles (30 degrees)
  const cos30 = Math.cos(Math.PI / 6);
  const sin30 = Math.sin(Math.PI / 6);

  // Center base coordinate
  const originX = 195;
  const originY = 170;

  // 3D box vertex projections
  const p0 = { x: originX, y: originY };
  const p1 = { x: originX + L * cos30, y: originY - L * sin30 };
  const p2 = { x: originX + (L - W) * cos30, y: originY - (L + W) * sin30 };
  const p3 = { x: originX - W * cos30, y: originY - W * sin30 };

  // Top corners (+height):
  const t0 = { x: p0.x, y: p0.y - H };
  const t1 = { x: p1.x, y: p1.y - H };
  const t2 = { x: p2.x, y: p2.y - H };
  const t3 = { x: p3.x, y: p3.y - H };

  const frontWallPath = `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} L ${t1.x} ${t1.y} L ${t0.x} ${t0.y} Z`;
  const sideWallPath = `M ${p0.x} ${p0.y} L ${p3.x} ${p3.y} L ${t3.x} ${t3.y} L ${t0.x} ${t0.y} Z`;
  const roofPath = `M ${t0.x} ${t0.y} L ${t1.x} ${t1.y} L ${t2.x} ${t2.y} L ${t3.x} ${t3.y} Z`;

  return (
    <svg
      viewBox="0 0 400 240"
      className="isometric-svg"
      role="img"
      aria-label={`Isometric view of shelter (${length}m x ${width}m x ${height}m, facing ${orientation})`}
    >
      <defs>
        {/* Engineering grid */}
        <pattern id="iso-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="0.75" fill="#c3d5e0" opacity="0.6" />
        </pattern>
        {/* Linear Gradients for faces */}
        <linearGradient id="roof-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e8f3f9" />
          <stop offset="100%" stopColor="#d4e8f3" />
        </linearGradient>
        <linearGradient id="front-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f5fafd" />
          <stop offset="100%" stopColor="#e2edf4" />
        </linearGradient>
        <linearGradient id="side-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#dbe8f0" />
          <stop offset="100%" stopColor="#c7dbe6" />
        </linearGradient>
      </defs>

      {/* Grid background */}
      <rect width="400" height="240" fill="url(#iso-grid)" rx="6" />

      {/* Compass indicator in top right */}
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
      <motion.polygon
        points={`${p0.x},${p0.y + 4} ${p1.x + 8},${p1.y + 2} ${p2.x + 8},${p2.y - 2} ${p3.x - 8},${p3.y + 2}`}
        fill="#12314b"
        animate={reduceMotion ? undefined : { opacity: [0.05, 0.12, 0.05], scale: [1, 1.045, 1] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Side Wall (Left face) */}
      <motion.path
        d={sideWallPath}
        fill="url(#side-grad)"
        stroke="#6893ab"
        strokeWidth="1.5"
        strokeLinejoin="round"
        initial={reduceMotion ? false : { opacity: 0.2, pathLength: 0 }}
        animate={{ opacity: 1, pathLength: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.6, ease: "easeOut" }}
      />

      {/* Front Wall (Right face) */}
      <motion.path
        d={frontWallPath}
        fill="url(#front-grad)"
        stroke="#6893ab"
        strokeWidth="1.5"
        strokeLinejoin="round"
        initial={reduceMotion ? false : { opacity: 0.2, pathLength: 0 }}
        animate={{ opacity: 1, pathLength: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.65, delay: reduceMotion ? 0 : 0.08, ease: "easeOut" }}
      />

      {/* Roof (Top face) */}
      <motion.path
        d={roofPath}
        fill="url(#roof-grad)"
        stroke="#3f7c9e"
        strokeWidth="1.75"
        strokeLinejoin="round"
        initial={reduceMotion ? false : { opacity: 0.2, pathLength: 0 }}
        animate={{ opacity: 1, pathLength: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.7, delay: reduceMotion ? 0 : 0.16, ease: "easeOut" }}
      />

      {/* A quiet scanning plane gives the model an inspectable, live-system quality. */}
      <motion.path
        d={roofPath}
        className="shelter-roof-scan"
        initial={{ opacity: 0 }}
        animate={reduceMotion ? { opacity: 0.12 } : { opacity: [0.05, 0.28, 0.05] }}
        transition={{ duration: 3.4, repeat: reduceMotion ? 0 : Infinity, ease: "easeInOut" }}
      />
      <motion.line
        className="shelter-scan-line"
        x1={t3.x}
        y1={t3.y}
        x2={t1.x}
        y2={t1.y}
        initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
        animate={reduceMotion ? { pathLength: 1, opacity: 0.3 } : { pathLength: [0, 1, 1, 0], opacity: [0, 0.8, 0.8, 0] }}
        transition={{ duration: 3.4, repeat: reduceMotion ? 0 : Infinity, ease: "easeInOut" }}
      />

      {/* Engineering wireframe inner dashed guideline */}
      <line x1={p0.x} y1={p0.y} x2={p2.x} y2={p2.y} stroke="#85a8bc" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.6" />
      <motion.circle
        className="shelter-vector-node"
        cx={t2.x}
        cy={t2.y}
        r="3"
        animate={reduceMotion ? undefined : { scale: [1, 1.75, 1], opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Dimension Labels and Ticks */}
      {/* Length Annotation along Front Wall */}
      <g>
        <line
          x1={p0.x + 8 * cos30}
          y1={p0.y + 8 * sin30}
          x2={p1.x + 8 * cos30}
          y2={p1.y + 8 * sin30}
          stroke="#1b5e85"
          strokeWidth="1"
        />
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
      </g>

      {/* Width Annotation along Side Wall */}
      <g>
        <line
          x1={p0.x - 8 * cos30}
          y1={p0.y + 8 * sin30}
          x2={p3.x - 8 * cos30}
          y2={p3.y + 8 * sin30}
          stroke="#1b5e85"
          strokeWidth="1"
        />
        <text
          x={(p0.x + p3.x) / 2 - 16 * cos30}
          y={(p0.y + p3.y) / 2 + 16 * sin30}
          textAnchor="middle"
          fontSize="10"
          fontWeight="bold"
          fill="#12314b"
        >
          W = {width.toFixed(1)}m
        </text>
      </g>

      {/* Height Annotation vertical at left corner */}
      <g>
        <line
          x1={p3.x - 12}
          y1={p3.y}
          x2={t3.x - 12}
          y2={t3.y}
          stroke="#1b5e85"
          strokeWidth="1"
        />
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
      </g>

      {/* Roof tag */}
      <text
        x={(t0.x + t2.x) / 2}
        y={(t0.y + t2.y) / 2 + 3}
        textAnchor="middle"
        fontSize="9"
        fill="#396c88"
        fontWeight="600"
      >
        Roof ({ (length * width).toFixed(1) } m²)
      </text>
    </svg>
  );
}
