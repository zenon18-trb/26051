"use client";

import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  FileDown,
  Info,
  Loader2,
  Play,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  serializeSimulationRequest,
  simulateShelter,
} from "@/lib/api";
import { openPrintableSimulationReport } from "@/lib/printSimulationReport";
import { useShelterConfiguration } from "@/context/ShelterConfigurationContext";
import { ThreeAnalysisHouse } from "@/components/ThreeAnalysisHouse";

export function ThermalSimulation({
  onNavigateToResults,
}: {
  onNavigateToResults: () => void;
}) {
  const {
    location,
    climate,
    geometry,
    wallLayers,
    roofLayers,
    windows,
    vents,
    occupants,
    hvac,
    simulationResult,
    setSimulationResult,
    isMaterialsConfigured,
    isWindowsConfigured,
    isVentilationAndOccupantsConfigured,
    isHvacConfigured,
    isReadyForSimulation,
  } = useShelterConfiguration();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  // Pre-flight check item list
  const preFlightChecks = [
    {
      id: "location",
      label: "Geographical Location & Coordinates",
      ready: Boolean(location),
      detail: location
        ? `${location.preset?.name ?? "Custom"} (${location.lat.toFixed(2)}°, ${location.lon.toFixed(2)}°)`
        : "Missing location selection",
    },
    {
      id: "climate",
      label: "Climate Hourly Time-Series",
      ready: Boolean(climate),
      detail: climate
        ? `${climate.hours.length} hours (${climate.climate_source_label})`
        : "Missing climate data",
    },
    {
      id: "geometry",
      label: "Shelter Physical Dimensions & Orientation",
      ready: Boolean(geometry),
      detail: geometry
        ? `${geometry.length_m}m × ${geometry.width_m}m × ${geometry.height_m}m (${geometry.orientation ?? "North"})`
        : "Missing shelter geometry",
    },
    {
      id: "materials",
      label: "Wall & Roof Envelope Assemblies",
      ready: isMaterialsConfigured,
      detail: isMaterialsConfigured
        ? `Wall: ${wallLayers.length} layers · Roof: ${roofLayers.length} layers`
        : "Assemblies incomplete or missing layers",
    },
    {
      id: "windows",
      label: "Windows & Glazing Aperture",
      ready: isWindowsConfigured,
      detail: isWindowsConfigured
        ? `${windows?.area_m2.toFixed(1)} m² (${windows?.kind})`
        : "Missing window configuration",
    },
    {
      id: "ventilation",
      label: "Ventilation & Occupant Load",
      ready: isVentilationAndOccupantsConfigured,
      detail: isVentilationAndOccupantsConfigured
        ? `${vents?.open ? "Open Vents (5.0 ACH)" : "Closed Vents (0.5 ACH)"} · ${occupants} occupants`
        : "Ventilation or occupants not configured",
    },
    {
      id: "hvac",
      label: "HVAC Operational Mode & Comfort Band",
      ready: isHvacConfigured,
      detail: isHvacConfigured
        ? hvac?.mode === "setpoint"
          ? `Setpoint: ${hvac.setpoint_c?.toFixed(1)} °C (${hvac.comfort_band.t_low_c}–${hvac.comfort_band.t_high_c} °C)`
          : `Floating Mode (${hvac?.comfort_band.t_low_c}–${hvac?.comfort_band.t_high_c} °C)`
        : "HVAC mode not configured",
    },
  ];

  const readyCount = preFlightChecks.filter((c) => c.ready).length;

  async function handleRunSimulation() {
    if (!isReadyForSimulation) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const requestPayload = serializeSimulationRequest({
        location,
        geometry,
        wallLayers,
        roofLayers,
        windows,
        vents,
        occupants,
        hvac,
      });

      const response = await simulateShelter(requestPayload);
      setSimulationResult(response);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while communicating with the simulation backend.";
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  }

  function handleDownloadReport() {
    if (!simulationResult) return;
    openPrintableSimulationReport({
      result: simulationResult,
      locationName: location?.preset?.name ?? "Custom location",
      locationCoordinates: location ? `${location.lat.toFixed(4)}°, ${location.lon.toFixed(4)}°` : undefined,
      geometry,
      wallLayers,
      roofLayers,
      windows,
      vents,
      occupants,
      hvac,
    });
  }

  return (
    <div className="climate-page">
      {/* Page Heading */}
      <div className="page-heading climate-heading">
        <div>
          <p className="eyebrow">STAGE 7 · THERMAL SIMULATION</p>
          <h1>Thermal Simulation</h1>
          <p className="page-description">
            Run a 24-hour transient thermal analysis of the configured shelter.
          </p>
        </div>
        <div className="configured-pill">
          <span
            className={`status-dot ${
              simulationResult
                ? "status-dot-configured"
                : isReadyForSimulation
                ? ""
                : ""
            }`}
          />
          {simulationResult
            ? "Simulation Complete"
            : isReadyForSimulation
            ? "Ready to Simulate"
            : `${readyCount} of 7 Prerequisites Ready`}
        </div>
      </div>

      <div className="climate-layout">
        {/* Left Column: Pre-Flight Checklist & Action Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Pre-Flight Checklist */}
          <section className="climate-panel selection-panel">
            <div className="panel-heading">
              <div>
                <h2>Pre-Flight Readiness Check</h2>
                <p>Verifying prerequisite model parameters before server submission.</p>
              </div>
              <ShieldCheck aria-hidden className="text-slate-400" />
            </div>

            <div className="preflight-list">
              {preFlightChecks.map((item) => (
                <div
                  key={item.id}
                  className={`preflight-item ${
                    item.ready ? "preflight-item-ready" : "preflight-item-pending"
                  }`}
                >
                  <div className="preflight-icon">
                    {item.ready ? (
                      <CheckCircle2 aria-hidden className="text-emerald-600" />
                    ) : (
                      <XCircle aria-hidden className="text-rose-500" />
                    )}
                  </div>
                  <div className="preflight-content">
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </div>
                  <span
                    className={`preflight-badge ${
                      item.ready ? "badge-ready" : "badge-pending"
                    }`}
                  >
                    {item.ready ? "READY" : "MISSING"}
                  </span>
                </div>
              ))}
            </div>

            {/* Error Message Display */}
            {errorMsg && (
              <div className="preflight-error-banner" role="alert">
                <AlertCircle aria-hidden />
                <div>
                  <strong>Simulation Execution Error</strong>
                  <p>{errorMsg}</p>
                </div>
              </div>
            )}

            {/* Launch Action Button */}
            <div style={{ marginTop: "18px" }}>
              <button
                type="button"
                className="primary-button climate-submit"
                onClick={handleRunSimulation}
                disabled={!isReadyForSimulation || isLoading}
                style={{ width: "100%", justifyContent: "center" }}
              >
                {isLoading ? (
                  <>
                    <Loader2 aria-hidden className="animate-spin" />
                    Executing 24-Hour Transient Solver...
                  </>
                ) : simulationResult ? (
                  <>
                    <RotateCcw aria-hidden />
                    Re-Run Thermal Simulation
                  </>
                ) : (
                  <>
                    <Play aria-hidden />
                    Run Thermal Simulation
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Model Assumptions Banner */}
          <section className="climate-panel" style={{ padding: "16px 20px" }}>
            <div className="source-banner source-live" style={{ margin: 0 }}>
              <Database aria-hidden />
              <div>
                <strong>Authoritative Server Physics Engine</strong>
                <p>
                  Calculates 24-hour transient heat flux balance using numerical integration (\(\Delta t = 3600\,\text&#123;s&#125;\)) with honest Open-Meteo or fixture climate series.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Pre-Flight Summary & Simulation Result Overview */}
        <section className="climate-panel summary-panel">
          <div className="panel-heading">
            <div>
              <h2>
                {simulationResult
                  ? "Simulation Run Complete"
                  : "Engine Configuration Summary"}
              </h2>
              <p>
                {simulationResult
                  ? `Server calculations finished for ${location?.preset?.name ?? "Target Site"}`
                  : "Review submitted parameters before execution"}
              </p>
            </div>
            <Activity aria-hidden className="text-slate-400" />
          </div>

          <div className="analysis-house-wrap">
            <ThreeAnalysisHouse
              geometry={geometry}
              wallLayers={wallLayers}
              roofLayers={roofLayers}
              windows={windows}
              vents={vents}
              occupants={occupants}
              hvac={hvac}
              isRunning={isLoading}
              reduceMotion={Boolean(reduceMotion)}
            />
            <p className="preview-caption">Assembled system model · Envelope, glazing, vents, occupants and HVAC shown from active configuration</p>
          </div>

          {simulationResult ? (
            <div className="geometry-preview-container">
              {/* Success Banner */}
              <div className="geometry-success-banner" style={{ margin: 0 }}>
                <CheckCircle2 aria-hidden />
                <span>
                  Simulation successful · 24-hour transient analysis computed by backend.
                </span>
              </div>

              {/* Server Metadata Bar */}
              <div className="simulation-meta-card">
                <div className="meta-item">
                  <span>Weather Data Source</span>
                  <strong>{simulationResult.climate_source_label}</strong>
                </div>
                <div className="meta-item">
                  <span>Thermal Mode</span>
                  <strong style={{ textTransform: "uppercase" }}>
                    {simulationResult.mode}
                  </strong>
                </div>
                <div className="meta-item">
                  <span>Thermal Capacitance (C)</span>
                  <strong>
                    {(simulationResult.capacitance_j_per_k / 1000).toFixed(1)} kJ/K
                    {simulationResult.capacitance_clamped ? " (clamped)" : ""}
                  </strong>
                </div>
                <div className="meta-item">
                  <span>Representative Hour</span>
                  <strong>
                    {simulationResult.steady_state.representative_hour.slice(11, 16)} (T_out: {simulationResult.steady_state.t_out_c.toFixed(1)} °C)
                  </strong>
                </div>
              </div>

              {/* High-Level Key Results Cards */}
              <div className="metrics-grid">
                <div className="climate-metric">
                  <span>Comfort Hours</span>
                  <strong style={{ color: "#2e7a50" }}>
                    {simulationResult.comfort.comfort_pct.toFixed(1)}%
                  </strong>
                </div>
                <div className="climate-metric">
                  <span>Comfort Window</span>
                  <strong>
                    {simulationResult.comfort.hours_in_band} / {simulationResult.comfort.total_hours} hrs
                  </strong>
                </div>
                <div className="climate-metric">
                  <span>Peak Heating Load</span>
                  <strong>
                    {simulationResult.hvac_summary.peak_heating_w > 0
                      ? `${simulationResult.hvac_summary.peak_heating_w.toFixed(0)} W`
                      : "0 W"}
                  </strong>
                </div>
                <div className="climate-metric">
                  <span>Peak Cooling Load</span>
                  <strong>
                    {simulationResult.hvac_summary.peak_cooling_w > 0
                      ? `${simulationResult.hvac_summary.peak_cooling_w.toFixed(0)} W`
                      : "0 W"}
                  </strong>
                </div>
                <div className="climate-metric">
                  <span>Peak Temp Overshoot</span>
                  <strong>
                    +{simulationResult.comfort.peak_deviation_above_k.toFixed(1)} K
                  </strong>
                </div>
                <div className="climate-metric">
                  <span>Peak Temp Undershoot</span>
                  <strong>
                    -{simulationResult.comfort.peak_deviation_below_k.toFixed(1)} K
                  </strong>
                </div>
              </div>

              {/* View Results Call-to-Action */}
              <button
                type="button"
                className="secondary-button analysis-report-button"
                onClick={handleDownloadReport}
              >
                <FileDown aria-hidden />
                Download PDF Report
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={onNavigateToResults}
                style={{
                  width: "100%",
                  justifyContent: "center",
                  padding: "14px",
                  fontSize: "13px",
                  marginTop: "6px",
                }}
              >
                <span>View Full Analysis Results</span>
                <ArrowRight aria-hidden />
              </button>
            </div>
          ) : (
            <div className="geometry-preview-container">
              {/* Summary of what will be submitted */}
              <div className="source-banner source-live" style={{ margin: 0 }}>
                <Cpu aria-hidden />
                <div>
                  <strong>Target Execution Parameters</strong>
                  <p>
                    {location?.preset?.name ?? "Configured Site"} · {geometry ? `${geometry.length_m}×${geometry.width_m}×${geometry.height_m}m` : "Dimensions"} · {vents?.open ? "Open Vents" : "Closed Vents"} · {occupants ?? 0} Occupants
                  </p>
                </div>
              </div>

              <div className="metrics-grid">
                <div className="climate-metric">
                  <span>Target Site</span>
                  <strong>{location?.preset?.name ?? "Not configured"}</strong>
                </div>
                <div className="climate-metric">
                  <span>Dimensions (L×W×H)</span>
                  <strong>
                    {geometry
                      ? `${geometry.length_m} × ${geometry.width_m} × ${geometry.height_m}m`
                      : "Not configured"}
                  </strong>
                </div>
                <div className="climate-metric">
                  <span>Envelope Materials</span>
                  <strong>
                    {isMaterialsConfigured
                      ? `Wall (${wallLayers.length}) · Roof (${roofLayers.length})`
                      : "Incomplete"}
                  </strong>
                </div>
                <div className="climate-metric">
                  <span>Window Aperture</span>
                  <strong>
                    {windows ? `${windows.area_m2.toFixed(1)} m²` : "Not configured"}
                  </strong>
                </div>
                <div className="climate-metric">
                  <span>Air Exchange Mode</span>
                  <strong>
                    {vents
                      ? vents.open
                        ? "5.0 ACH (Open)"
                        : "0.5 ACH (Closed)"
                      : "Not configured"}
                  </strong>
                </div>
                <div className="climate-metric">
                  <span>Occupancy</span>
                  <strong>
                    {occupants !== null && occupants !== undefined
                      ? `${occupants} Persons (${occupants * 70} W)`
                      : "Not configured"}
                  </strong>
                </div>
                <div className="climate-metric">
                  <span>HVAC Mode</span>
                  <strong>
                    {hvac
                      ? hvac.mode === "setpoint"
                        ? `Setpoint ${hvac.setpoint_c?.toFixed(1)} °C`
                        : "Floating (0 W HVAC)"
                      : "Not configured"}
                  </strong>
                </div>
                <div className="climate-metric">
                  <span>Comfort Limits</span>
                  <strong>
                    {hvac
                      ? `${hvac.comfort_band.t_low_c} – ${hvac.comfort_band.t_high_c} °C`
                      : "18.0 – 26.0 °C"}
                  </strong>
                </div>
              </div>

              <div className="orientation-disclaimer">
                <Info aria-hidden />
                <span>
                  Click <strong>Run Thermal Simulation</strong> to send the complete configuration to the server simulation engine.
                </span>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
