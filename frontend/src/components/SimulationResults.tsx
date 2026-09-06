"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Flame,
  Gauge,
  HelpCircle,
  Info,
  Layers,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Thermometer,
  TrendingDown,
  TrendingUp,
  Trophy,
  Wind,
  Wrench,
  Zap,
} from "lucide-react";
import { useShelterConfiguration } from "@/context/ShelterConfigurationContext";
import {
  diagnoseThermalPerformance,
  HourlyAssessment,
  ThermalContributor,
  ThermalDiagnosis,
  ThermalSeverity,
} from "@/lib/thermalDiagnosis.ts";
import {
  generateFeasibleFixCandidates,
  evaluateThermalFix,
  ThermalFixCandidate,
  ThermalFixEvaluation,
  ShelterFullConfiguration,
} from "@/lib/thermalFixes.ts";
import {
  runThermalOptimization,
  OptimizationRun,
  OptimizationResult,
  DEFAULT_OPTIMIZATION_WEIGHTS,
} from "@/lib/thermalOptimizer.ts";

export function SimulationResults({
  onNavigateToSimulation,
}: {
  onNavigateToSimulation: () => void;
}) {
  const {
    simulationResult,
    location,
    geometry,
    wallLayers,
    setWallLayers,
    roofLayers,
    setRoofLayers,
    windows,
    setWindows,
    vents,
    setVents,
    occupants,
    setOccupants,
    hvac,
    setHvac,
    setSimulationResult,
  } = useShelterConfiguration();

  const [hoveredHourIndex, setHoveredHourIndex] = useState<number | null>(null);
  const [evaluatedFixes, setEvaluatedFixes] = useState<Record<string, ThermalFixEvaluation>>({});
  const [evaluatingFixId, setEvaluatingFixId] = useState<string | null>(null);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [appliedFixMsg, setAppliedFixMsg] = useState<string | null>(null);

  // Stage 10 Optimization State
  const [optimizationRun, setOptimizationRun] = useState<OptimizationRun | null>(null);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [optProgress, setOptProgress] = useState<{
    completed: number;
    total: number;
    currentTitle: string;
  } | null>(null);
  const [optError, setOptError] = useState<string | null>(null);

  const baselineConfig: ShelterFullConfiguration = useMemo(
    () => ({
      location,
      geometry,
      wallLayers,
      roofLayers,
      windows,
      vents,
      occupants,
      hvac,
    }),
    [location, geometry, wallLayers, roofLayers, windows, vents, occupants, hvac]
  );

  const diagnosis: ThermalDiagnosis | null = useMemo(() => {
    return diagnoseThermalPerformance(simulationResult);
  }, [simulationResult]);

  const candidates: ThermalFixCandidate[] = useMemo(() => {
    return generateFeasibleFixCandidates(baselineConfig, diagnosis);
  }, [baselineConfig, diagnosis]);

  // Handle single candidate evaluation (Stage 9)
  const handleEvaluateFix = useCallback(
    async (candidate: ThermalFixCandidate) => {
      if (!simulationResult) return;
      setEvaluatingFixId(candidate.id);
      setEvaluationError(null);
      setAppliedFixMsg(null);

      try {
        const result = await evaluateThermalFix(candidate, baselineConfig, simulationResult);
        setEvaluatedFixes((prev) => ({
          ...prev,
          [candidate.id]: result,
        }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to evaluate candidate fix.";
        setEvaluationError(`Error evaluating "${candidate.title}": ${msg}`);
      } finally {
        setEvaluatingFixId(null);
      }
    },
    [baselineConfig, simulationResult]
  );

  // Handle single fix application (Stage 9)
  const handleApplyFix = useCallback(
    (candidate: ThermalFixCandidate, evaluation: ThermalFixEvaluation) => {
      const modified = candidate.applyModification(baselineConfig);

      if (modified.wallLayers) setWallLayers(modified.wallLayers);
      if (modified.roofLayers) setRoofLayers(modified.roofLayers);
      if (modified.windows) setWindows(modified.windows);
      if (modified.vents) setVents(modified.vents);
      if (modified.occupants !== null && modified.occupants !== undefined) setOccupants(modified.occupants);
      if (modified.hvac) setHvac(modified.hvac);

      setSimulationResult(evaluation.simulationResponse);
      setAppliedFixMsg(`Successfully applied "${candidate.title}" to active shelter configuration.`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [baselineConfig, setWallLayers, setRoofLayers, setWindows, setVents, setOccupants, setHvac, setSimulationResult]
  );

  // Handle full multi-candidate optimization run (Stage 10)
  const handleRunOptimization = useCallback(async () => {
    if (!simulationResult) return;
    setIsOptimizing(true);
    setOptError(null);
    setOptProgress({ completed: 0, total: 0, currentTitle: "Initializing candidate space..." });

    try {
      const run = await runThermalOptimization(
        baselineConfig,
        simulationResult,
        DEFAULT_OPTIMIZATION_WEIGHTS,
        (completed, total, currentTitle) => {
          setOptProgress({ completed, total, currentTitle });
        }
      );
      setOptimizationRun(run);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Optimization process encountered an error.";
      setOptError(`Optimization failed: ${msg}`);
    } finally {
      setIsOptimizing(false);
      setOptProgress(null);
    }
  }, [baselineConfig, simulationResult]);

  // Handle applying recommended candidate to active workspace (Stage 10)
  const handleApplyRecommendation = useCallback(
    (recResult: OptimizationResult) => {
      const modified = recResult.candidate.applyModification(baselineConfig);

      // Update active workspace configuration
      if (modified.wallLayers) setWallLayers(modified.wallLayers);
      if (modified.roofLayers) setRoofLayers(modified.roofLayers);
      if (modified.windows) setWindows(modified.windows);
      if (modified.vents) setVents(modified.vents);
      if (modified.occupants !== null && modified.occupants !== undefined) setOccupants(modified.occupants);
      if (modified.hvac) setHvac(modified.hvac);

      // Invalidate old simulation results and optimization runs to prevent stale state display
      setSimulationResult(null);
      setOptimizationRun(null);

      // Navigate user to simulation tab to run fresh simulation with new design
      onNavigateToSimulation();
    },
    [baselineConfig, setWallLayers, setRoofLayers, setWindows, setVents, setOccupants, setHvac, setSimulationResult, onNavigateToSimulation]
  );

  if (!simulationResult || !diagnosis) {
    return (
      <div className="climate-page">
        <div className="page-heading">
          <div>
            <p className="eyebrow">STAGE 8, 9 &amp; 10 · THERMAL DIAGNOSIS &amp; OPTIMIZATION</p>
            <h1>Thermal Health &amp; Design Optimization</h1>
            <p className="page-description">
              Analysis results generated by the server simulation engine.
            </p>
          </div>
        </div>

        <div className="panel" style={{ padding: "40px 24px", textAlign: "center" }}>
          <div className="empty-icon" style={{ margin: "0 auto 16px" }}>
            <Activity aria-hidden />
          </div>
          <h3>No Simulation Results Available</h3>
          <p style={{ maxWidth: "440px", margin: "0 auto 20px", color: "#68808f", fontSize: "12px" }}>
            Run the 24-hour transient thermal simulation to evaluate shelter thermal health, detect comfort failures, and run explainable design optimization.
          </p>
          <button
            type="button"
            className="primary-button"
            onClick={onNavigateToSimulation}
            style={{ margin: "0 auto" }}
          >
            <ArrowLeft aria-hidden />
            Go to Simulation Setup
          </button>
        </div>
      </div>
    );
  }

  const { comfort, hvac_summary, steady_state, capacitance_j_per_k, mode, climate_source_label } =
    simulationResult;

  const severityTheme = {
    good: {
      cardClass: "diagnosis-card diagnosis-good",
      badgeClass: "diagnosis-badge badge-good",
      icon: <ShieldCheck aria-hidden className="w-5 h-5 text-emerald-600" />,
      color: "#166534",
      bg: "#f0fdf4",
      border: "#bbf7d0",
    },
    warning: {
      cardClass: "diagnosis-card diagnosis-warning",
      badgeClass: "diagnosis-badge badge-warning",
      icon: <AlertTriangle aria-hidden className="w-5 h-5 text-amber-600" />,
      color: "#92400e",
      bg: "#fffbeb",
      border: "#fde68a",
    },
    critical: {
      cardClass: "diagnosis-card diagnosis-critical",
      badgeClass: "diagnosis-badge badge-critical",
      icon: <AlertOctagon aria-hidden className="w-5 h-5 text-rose-600" />,
      color: "#9f1239",
      bg: "#fff1f2",
      border: "#fecdd3",
    },
  }[diagnosis.status];

  return (
    <div className="climate-page">
      {/* Page Heading */}
      <div className="page-heading climate-heading">
        <div>
          <p className="eyebrow">STAGE 8, 9 &amp; 10 · DIAGNOSIS, INTERVENTIONS &amp; OPTIMIZATION</p>
          <h1>Thermal Health &amp; Design Optimization</h1>
          <p className="page-description">
            Deterministic rule-based failure diagnosis, single-fix evaluation, and explainable multi-candidate design optimization.
          </p>
        </div>
        <div className="configured-pill">
          <span className="status-dot status-dot-configured" />
          Simulation &amp; Optimizer Active
        </div>
      </div>

      {/* Applied Fix Toast Banner */}
      {appliedFixMsg && (
        <div className="geometry-success-banner" style={{ marginBottom: "14px" }}>
          <CheckCircle2 aria-hidden />
          <span>{appliedFixMsg}</span>
        </div>
      )}

      {/* 1. Primary Diagnosis Hero Banner (Stage 8) */}
      <div
        className="diagnosis-hero-banner"
        style={{
          backgroundColor: severityTheme.bg,
          borderColor: severityTheme.border,
          color: severityTheme.color,
        }}
      >
        <div className="diagnosis-hero-icon-wrap" style={{ borderColor: severityTheme.border }}>
          {severityTheme.icon}
        </div>
        <div className="diagnosis-hero-content">
          <div className="diagnosis-hero-topline">
            <span className={severityTheme.badgeClass}>{diagnosis.headline}</span>
            <span className="diagnosis-site-pill">
              Location: <strong>{location?.preset?.name ?? "Configured Site"}</strong> ({climate_source_label})
            </span>
          </div>
          <h2 className="diagnosis-hero-title">{diagnosis.summary}</h2>
          <p className="diagnosis-hero-explanation">{diagnosis.explanation}</p>
        </div>
      </div>

      {/* 2. Failure Breakdown KPI Cards (Stage 8) */}
      <div className="results-kpi-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginTop: "16px" }}>
        {/* KPI 1: Comfort Percentage */}
        <div className="results-kpi-card">
          <div
            className="kpi-icon-wrap"
            style={{
              background: diagnosis.status === "good" ? "#edf7f0" : diagnosis.status === "warning" ? "#fff9eb" : "#feebe8",
              color: diagnosis.status === "good" ? "#2e7a50" : diagnosis.status === "warning" ? "#9c7328" : "#c53828",
            }}
          >
            <Thermometer aria-hidden />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Comfort Rating</span>
            <strong
              className="kpi-value"
              style={{
                color: diagnosis.status === "good" ? "#2e7a50" : diagnosis.status === "warning" ? "#9c7328" : "#c53828",
              }}
            >
              {diagnosis.comfortPercent.toFixed(1)}%
            </strong>
            <span className="kpi-sub">
              {diagnosis.hoursInComfort} of {diagnosis.totalHours} hrs inside comfort band
            </span>
          </div>
        </div>

        {/* KPI 2: Overheating Hours */}
        <div className="results-kpi-card">
          <div
            className="kpi-icon-wrap"
            style={{
              background: diagnosis.overheatingHours > 0 ? "#fff5ed" : "#f1f5f7",
              color: diagnosis.overheatingHours > 0 ? "#d96b27" : "#768b97",
            }}
          >
            <TrendingUp aria-hidden />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Overheating Duration</span>
            <strong className="kpi-value" style={{ color: diagnosis.overheatingHours > 0 ? "#d96b27" : "inherit" }}>
              {diagnosis.overheatingHours} hrs
            </strong>
            <span className="kpi-sub">
              {diagnosis.overheatingHours > 0
                ? `Peak: ${diagnosis.peakIndoorTemperature.toFixed(1)}°C (+${diagnosis.peakHotDeviation.toFixed(1)} K)`
                : "No overheating detected"}
            </span>
          </div>
        </div>

        {/* KPI 3: Overcooling Hours */}
        <div className="results-kpi-card">
          <div
            className="kpi-icon-wrap"
            style={{
              background: diagnosis.overcoolingHours > 0 ? "#eef6fc" : "#f1f5f7",
              color: diagnosis.overcoolingHours > 0 ? "#216f9d" : "#768b97",
            }}
          >
            <TrendingDown aria-hidden />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Overcooling Duration</span>
            <strong className="kpi-value" style={{ color: diagnosis.overcoolingHours > 0 ? "#216f9d" : "inherit" }}>
              {diagnosis.overcoolingHours} hrs
            </strong>
            <span className="kpi-sub">
              {diagnosis.overcoolingHours > 0
                ? `Min: ${diagnosis.minimumIndoorTemperature.toFixed(1)}°C (-${diagnosis.peakColdDeviation.toFixed(1)} K)`
                : "No overcooling detected"}
            </span>
          </div>
        </div>

        {/* KPI 4: Peak HVAC or Capacitance */}
        <div className="results-kpi-card">
          <div className="kpi-icon-wrap" style={{ background: "#f5f3ff", color: "#6d28d9" }}>
            <Cpu aria-hidden />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Thermal Inertia (C)</span>
            <strong className="kpi-value" style={{ color: "#6d28d9" }}>
              {(capacitance_j_per_k / 1000).toFixed(0)} kJ/K
            </strong>
            <span className="kpi-sub">
              {mode === "setpoint" ? "Active setpoint mode" : "Passive thermal storage"}
            </span>
          </div>
        </div>
      </div>

      {/* 3. 24-Hour Diurnal Timeline Chart (Stage 8) */}
      <section className="climate-panel" style={{ marginTop: "18px", padding: "20px" }}>
        <div className="panel-heading" style={{ marginBottom: "12px", borderBottom: "none", paddingBottom: 0 }}>
          <div>
            <h2>24-Hour Diurnal Temperature &amp; Comfort Envelope</h2>
            <p>
              Hourly predicted indoor temperature (T_in) compared with outdoor climate (T_out) and target comfort boundaries ({diagnosis.comfortBand.t_low_c}°C — {diagnosis.comfortBand.t_high_c}°C).
            </p>
          </div>
          <div className="chart-legend">
            <div className="legend-item">
              <span className="legend-line line-indoor" />
              <span>Indoor T_in</span>
            </div>
            <div className="legend-item">
              <span className="legend-line line-outdoor" />
              <span>Outdoor T_out</span>
            </div>
            <div className="legend-item">
              <span className="legend-zone" />
              <span>Comfort Band</span>
            </div>
          </div>
        </div>

        {/* SVG Hourly Timeline Chart */}
        <HourlyTimelineChart
          assessments={diagnosis.hourlyAssessments}
          comfortBand={diagnosis.comfortBand}
          hoveredIndex={hoveredHourIndex}
          onHoverIndex={setHoveredHourIndex}
        />

        {/* Diagnostic Thresholds Disclaimer */}
        <div className="thresholds-note" style={{ marginTop: "12px" }}>
          <Info aria-hidden className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span>
            <strong>Product Diagnostic Note:</strong> Severity ratings (Good: 0h failure, Warning: 1–25% hours outside band, Critical: &gt;25% hours outside band) are heuristic user-guidance thresholds, not statutory DRDO standards or physics laws.
          </span>
        </div>
      </section>

      {/* 4. STAGE 10: Explainable Thermal Design Optimization Section */}
      <section className="climate-panel" style={{ marginTop: "18px", padding: "22px" }}>
        <div className="panel-heading" style={{ paddingBottom: "14px", borderBottom: "1px solid #edf2f5" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="eyebrow" style={{ margin: 0 }}>STAGE 10 · EXPLAINABLE DESIGN OPTIMIZATION</span>
            </div>
            <h2 style={{ marginTop: "4px" }}>Explainable Thermal Design Optimizer</h2>
            <p>
              Explores bounded single-parameter design candidates (up to 12) via the real backend physics engine and ranks them under transparent engineering weights (60% comfort, 30% HVAC demand, 10% design disruption).
            </p>
          </div>
          <Trophy aria-hidden className="text-amber-500" />
        </div>

        {/* Optimizer Launcher Card */}
        <div className="optimizer-launcher-bar" style={{ marginTop: "16px" }}>
          <div className="launcher-info">
            <strong>Run Automated Design Optimization</strong>
            <p>
              Simulates candidate envelope thicknesses, glazing ratios, ventilation states, and HVAC setpoint modes sequentially against FastAPI.
            </p>
          </div>
          <button
            type="button"
            className="primary-button launcher-btn"
            onClick={handleRunOptimization}
            disabled={isOptimizing}
          >
            {isOptimizing ? (
              <>
                <RefreshCw aria-hidden className="spin w-4 h-4" />
                <span>Optimizing Designs...</span>
              </>
            ) : optimizationRun ? (
              <>
                <RefreshCw aria-hidden className="w-4 h-4" />
                <span>Re-Run Thermal Optimizer</span>
              </>
            ) : (
              <>
                <Sparkles aria-hidden className="w-4 h-4" />
                <span>Run Thermal Optimization</span>
              </>
            )}
          </button>
        </div>

        {/* Progress Bar when Optimizing */}
        {isOptimizing && optProgress && (
          <div className="opt-progress-box" style={{ marginTop: "14px" }}>
            <div className="opt-progress-header">
              <span>Evaluating Candidate {optProgress.completed + 1} of {optProgress.total || "..."}</span>
              <strong>{optProgress.currentTitle}</strong>
            </div>
            <div className="opt-progress-track">
              <div
                className="opt-progress-fill"
                style={{
                  width: `${optProgress.total > 0 ? (optProgress.completed / optProgress.total) * 100 : 15}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Error Banner */}
        {optError && (
          <div className="preflight-error-banner" style={{ marginTop: "14px" }}>
            <AlertTriangle aria-hidden />
            <div>
              <strong>Optimization Run Failed</strong>
              <p>{optError}</p>
            </div>
          </div>
        )}

        {/* Optimization Run Results View */}
        {optimizationRun && (
          <div className="optimization-results-container" style={{ marginTop: "18px" }}>
            {/* 4A. Prominent Recommended Design Card */}
            {optimizationRun.recommendedResult ? (
              <div className="recommended-hero-card">
                <div className="rec-card-topbar">
                  <div className="rec-badge-wrap">
                    <span className="rec-star-badge">
                      <Award aria-hidden className="w-3.5 h-3.5" />
                      Recommended Design Intervention
                    </span>
                    <span className="rec-score-pill">
                      Composite Score: <strong>{optimizationRun.recommendedResult.score?.totalScore.toFixed(3)}</strong>
                    </span>
                  </div>
                  <span className="rec-rank-pill">Rank #1 of {optimizationRun.results.length} Candidates</span>
                </div>

                <div className="rec-main-info">
                  <h3 className="rec-title">{optimizationRun.recommendedResult.candidate.title}</h3>
                  <div className="rec-param-delta">
                    <span>{optimizationRun.recommendedResult.candidate.parameterName}:</span>
                    <strong>
                      {optimizationRun.recommendedResult.candidate.baselineValueDisplay} →{" "}
                      {optimizationRun.recommendedResult.candidate.proposedValueDisplay}
                    </strong>
                  </div>
                </div>

                {/* 4-Metric Simulated Impact Comparison Grid */}
                <div className="rec-kpi-grid">
                  <div className="rec-kpi-cell">
                    <span className="rec-kpi-lbl">Thermal Comfort</span>
                    <strong className="rec-kpi-val text-emerald-700">
                      {optimizationRun.baselineMetrics.comfortPct.toFixed(1)}% →{" "}
                      {optimizationRun.recommendedResult.metrics?.comfortPct.toFixed(1)}%
                    </strong>
                    <small className="text-emerald-600 font-bold">
                      +{optimizationRun.recommendedResult.metrics?.comfortDeltaPercentagePoints.toFixed(1)} percentage points
                    </small>
                  </div>

                  <div className="rec-kpi-cell">
                    <span className="rec-kpi-lbl">Discomfort Duration</span>
                    <strong className="rec-kpi-val">
                      {optimizationRun.baselineMetrics.hoursOutside} h →{" "}
                      {optimizationRun.recommendedResult.metrics?.hoursOutside} h
                    </strong>
                    <small className="text-emerald-600 font-bold">
                      {optimizationRun.recommendedResult.metrics?.hoursOutsideDelta} hours
                    </small>
                  </div>

                  <div className="rec-kpi-cell">
                    <span className="rec-kpi-lbl">Peak HVAC Demand</span>
                    <strong className="rec-kpi-val">
                      {optimizationRun.recommendedResult.metrics?.peakTotalHvacW.toFixed(0)} W
                    </strong>
                    <small style={{ color: "#68808f" }}>
                      Baseline: {optimizationRun.baselineMetrics.peakTotalHvacW.toFixed(0)} W
                    </small>
                  </div>

                  <div className="rec-kpi-cell">
                    <span className="rec-kpi-lbl">Temperature Extremes</span>
                    <strong className="rec-kpi-val">
                      {optimizationRun.recommendedResult.metrics?.minIndoorTempC.toFixed(1)}°C —{" "}
                      {optimizationRun.recommendedResult.metrics?.maxIndoorTempC.toFixed(1)}°C
                    </strong>
                    <small style={{ color: "#68808f" }}>
                      Baseline: {optimizationRun.baselineMetrics.minIndoorTempC.toFixed(1)}°C —{" "}
                      {optimizationRun.baselineMetrics.maxIndoorTempC.toFixed(1)}°C
                    </small>
                  </div>
                </div>

                {/* Explainability Synthesis Card */}
                <div className="rec-why-box">
                  <div className="rec-why-header">
                    <Info aria-hidden className="w-4 h-4 text-blue-600" />
                    <strong>Why Was This Design Selected?</strong>
                  </div>
                  <p className="rec-why-text">{optimizationRun.recommendedResult.explanation}</p>
                </div>

                {/* Apply Recommended Design Action */}
                <div className="rec-actions-bar">
                  <button
                    type="button"
                    className="primary-button rec-apply-btn"
                    onClick={() => handleApplyRecommendation(optimizationRun.recommendedResult!)}
                  >
                    <Check aria-hidden className="w-4 h-4" />
                    <span>Apply Recommended Design to Workspace</span>
                  </button>
                  <span className="rec-apply-hint">
                    Applying updates your active shelter parameters and requests a fresh validation simulation.
                  </span>
                </div>
              </div>
            ) : (
              <div className="stable-fixes-card" style={{ marginTop: "14px" }}>
                <div className="stable-icon-wrap">
                  <ShieldCheck aria-hidden />
                </div>
                <div className="stable-fixes-content">
                  <strong>No Meaningful Improvement Over Baseline</strong>
                  <p>
                    None of the {optimizationRun.totalCandidateCount} evaluated single-parameter interventions produced a meaningful improvement over the current baseline design.
                  </p>
                </div>
              </div>
            )}

            {/* 4B. Candidate Ranking Table */}
            <div className="candidate-ranking-card" style={{ marginTop: "18px" }}>
              <div className="ranking-table-header">
                <div>
                  <h4>Evaluated Candidate Ranking</h4>
                  <p>Comprehensive comparative ranking across all {optimizationRun.totalCandidateCount} simulated interventions.</p>
                </div>
                <span className="table-count-pill">{optimizationRun.results.length} Candidates</span>
              </div>

              <div className="table-scroll-wrap">
                <table className="ranking-table">
                  <thead>
                    <tr>
                      <th style={{ width: "50px" }}>Rank</th>
                      <th>Design Intervention</th>
                      <th>Category</th>
                      <th>Thermal Comfort</th>
                      <th>Discomfort</th>
                      <th>Peak HVAC</th>
                      <th>Score</th>
                      <th style={{ textAlign: "right" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {optimizationRun.results.map((res) => {
                      const isRec = res.status === "recommended";
                      const isRej = res.status === "rejected" || res.status === "failed";

                      return (
                        <tr key={res.candidate.id} className={isRec ? "row-recommended" : isRej ? "row-infeasible" : ""}>
                          <td>
                            {isRej ? (
                              <span className="rank-muted">—</span>
                            ) : (
                              <span className={`rank-badge ${isRec ? "rank-gold" : ""}`}>#{res.rank}</span>
                            )}
                          </td>
                          <td>
                            <strong className="cand-table-title">{res.candidate.title}</strong>
                            <small className="cand-table-sub">
                              {res.candidate.baselineValueDisplay} → {res.candidate.proposedValueDisplay}
                            </small>
                          </td>
                          <td>
                            <span className="category-tag-table">
                              {res.candidate.category.replace("envelope_", "")}
                            </span>
                          </td>
                          <td>
                            {res.metrics ? (
                              <div className="metric-table-col">
                                <strong>{res.metrics.comfortPct.toFixed(1)}%</strong>
                                <small
                                  style={{
                                    color:
                                      res.metrics.comfortDeltaPercentagePoints > 0
                                        ? "#2e7a50"
                                        : res.metrics.comfortDeltaPercentagePoints < 0
                                        ? "#c53828"
                                        : "#68808f",
                                  }}
                                >
                                  {res.metrics.comfortDeltaPercentagePoints > 0 ? "+" : ""}
                                  {res.metrics.comfortDeltaPercentagePoints.toFixed(1)} pp
                                </small>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td>
                            {res.metrics ? (
                              <div className="metric-table-col">
                                <span>{res.metrics.hoursOutside} hrs</span>
                                <small style={{ color: res.metrics.hoursOutsideDelta < 0 ? "#2e7a50" : "#68808f" }}>
                                  {res.metrics.hoursOutsideDelta > 0 ? "+" : ""}
                                  {res.metrics.hoursOutsideDelta} hrs
                                </small>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td>
                            {res.metrics ? (
                              <div className="metric-table-col">
                                <span>{res.metrics.peakTotalHvacW.toFixed(0)} W</span>
                                <small style={{ color: "#68808f" }}>
                                  {res.metrics.peakTotalHvacDeltaW > 0 ? "+" : ""}
                                  {res.metrics.peakTotalHvacDeltaW.toFixed(0)} W
                                </small>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td>
                            {res.score ? (
                              <strong className="score-table-val">{res.score.totalScore.toFixed(3)}</strong>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {res.status === "recommended" ? (
                              <span className="status-badge-table badge-table-recommended">✓ Recommended</span>
                            ) : res.status === "evaluated" ? (
                              <span className="status-badge-table badge-table-evaluated">Evaluated</span>
                            ) : (
                              <span className="status-badge-table badge-table-rejected">Filtered</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Optimizer Technical Boundaries Disclaimer */}
            <div className="thresholds-note" style={{ marginTop: "14px" }}>
              <Info aria-hidden className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span>
                <strong>Optimization Boundary Note:</strong> The optimizer evaluates a bounded set of deterministic, single-parameter interventions under 60% comfort, 30% HVAC demand, and 10% design disruption weighting. It identifies the best-performing candidate among evaluated designs and does not guarantee an unconstrained global optimum.
              </span>
            </div>
          </div>
        )}
      </section>

      {/* 5. STAGE 9: Potential Single Design Interventions Section */}
      <section className="climate-panel" style={{ marginTop: "18px", padding: "22px" }}>
        <div className="panel-heading" style={{ paddingBottom: "14px", borderBottom: "1px solid #edf2f5" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="eyebrow" style={{ margin: 0 }}>STAGE 9 · POTENTIAL DESIGN INTERVENTIONS</span>
            </div>
            <h2 style={{ marginTop: "4px" }}>Single-Fix Candidate Evaluator</h2>
            <p>
              Targeted single-parameter modifications evaluated against the authoritative backend simulation engine.
            </p>
          </div>
          <Wrench aria-hidden className="text-slate-400" />
        </div>

        {/* Evaluation Error Banner */}
        {evaluationError && (
          <div className="preflight-error-banner" style={{ marginTop: "14px" }}>
            <AlertTriangle aria-hidden />
            <div>
              <strong>Candidate Evaluation Error</strong>
              <p>{evaluationError}</p>
            </div>
          </div>
        )}

        {/* Stable Case: No Fixes Required */}
        {candidates.length === 0 ? (
          <div className="stable-fixes-card" style={{ marginTop: "16px" }}>
            <div className="stable-icon-wrap">
              <ShieldCheck aria-hidden />
            </div>
            <div className="stable-fixes-content">
              <strong>No Thermal Failure Detected</strong>
              <p>
                The baseline shelter configuration satisfies thermal comfort limits for all 24 simulated hours. Design interventions are not required for this baseline scenario.
              </p>
            </div>
          </div>
        ) : (
          <div className="fixes-container" style={{ marginTop: "16px" }}>
            <div className="fixes-intro-note">
              <Sparkles aria-hidden className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <span>
                <strong>Methodology:</strong> Each candidate modifies exactly <em>one</em> design parameter. Click <strong>Evaluate Fix</strong> to execute a real transient backend simulation for that specific candidate.
              </span>
            </div>

            <div className="fixes-grid" style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "14px" }}>
              {candidates.map((candidate) => {
                const evaluation = evaluatedFixes[candidate.id];
                const isEvaluating = evaluatingFixId === candidate.id;

                return (
                  <div key={candidate.id} className={`fix-candidate-card ${evaluation ? "fix-card-evaluated" : ""}`}>
                    {/* Card Header */}
                    <div className="fix-card-header">
                      <div className="fix-title-wrap">
                        <span className="fix-priority-badge">Candidate #{candidate.priority}</span>
                        <h3>{candidate.title}</h3>
                      </div>
                      <div className="fix-status-wrap">
                        {isEvaluating ? (
                          <span className="fix-eval-badge badge-evaluating">
                            <RefreshCw aria-hidden className="spin w-3 h-3" />
                            Simulating Backend...
                          </span>
                        ) : evaluation ? (
                          <span
                            className={`fix-eval-badge ${
                              evaluation.comparison.outcome === "improves"
                                ? "badge-outcome-improves"
                                : evaluation.comparison.outcome === "worsens"
                                ? "badge-outcome-worsens"
                                : "badge-outcome-neutral"
                            }`}
                          >
                            {evaluation.comparison.outcome === "improves"
                              ? "✓ Improves Comfort"
                              : evaluation.comparison.outcome === "worsens"
                              ? "⚠ Degrades Comfort"
                              : "○ Neutral Impact"}
                          </span>
                        ) : (
                          <span className="fix-eval-badge badge-unevaluated">Not Yet Evaluated</span>
                        )}
                      </div>
                    </div>

                    {/* Parameter Change Row */}
                    <div className="fix-params-row">
                      <div className="fix-param-col">
                        <span className="param-label">Target Parameter</span>
                        <strong className="param-val">{candidate.parameterName}</strong>
                      </div>
                      <div className="fix-param-col">
                        <span className="param-label">Baseline Value</span>
                        <strong className="param-val" style={{ color: "#68808f" }}>
                          {candidate.currentValueDisplay}
                        </strong>
                      </div>
                      <div className="fix-arrow-col">
                        <ArrowRight aria-hidden />
                      </div>
                      <div className="fix-param-col">
                        <span className="param-label">Proposed Value</span>
                        <strong className="param-val" style={{ color: "#1b5e85" }}>
                          {candidate.proposedValueDisplay}
                        </strong>
                      </div>
                    </div>

                    {/* Rationale */}
                    <p className="fix-rationale-text">
                      <strong>Engineering Rationale:</strong> {candidate.rationale}
                    </p>

                    {/* Evaluated Comparison Metrics (Appears after simulation) */}
                    {evaluation && (
                      <div className="evaluation-results-box">
                        <div className="eval-results-heading">
                          <strong>Backend Simulation Comparison (Baseline vs Candidate)</strong>
                        </div>

                        <div className="eval-metrics-grid">
                          <div className="eval-metric-cell">
                            <span>Thermal Comfort</span>
                            <strong>
                              {evaluation.comparison.baselineComfortPct.toFixed(1)}% → {evaluation.comparison.candidateComfortPct.toFixed(1)}%
                            </strong>
                            <small
                              style={{
                                color:
                                  evaluation.comparison.comfortDeltaPercentagePoints > 0
                                    ? "#2e7a50"
                                    : evaluation.comparison.comfortDeltaPercentagePoints < 0
                                    ? "#c53828"
                                    : "#68808f",
                                fontWeight: 700,
                              }}
                            >
                              {evaluation.comparison.comfortDeltaPercentagePoints > 0 ? "+" : ""}
                              {evaluation.comparison.comfortDeltaPercentagePoints.toFixed(1)} percentage points
                            </small>
                          </div>

                          <div className="eval-metric-cell">
                            <span>Discomfort Hours</span>
                            <strong>
                              {evaluation.comparison.baselineHoursOutside} h → {evaluation.comparison.candidateHoursOutside} h
                            </strong>
                            <small
                              style={{
                                color:
                                  evaluation.comparison.hoursOutsideDelta < 0
                                    ? "#2e7a50"
                                    : evaluation.comparison.hoursOutsideDelta > 0
                                    ? "#c53828"
                                    : "#68808f",
                                fontWeight: 700,
                              }}
                            >
                              {evaluation.comparison.hoursOutsideDelta > 0 ? "+" : ""}
                              {evaluation.comparison.hoursOutsideDelta} hours
                            </small>
                          </div>

                          <div className="eval-metric-cell">
                            <span>Peak Heating Demand</span>
                            <strong>
                              {evaluation.comparison.baselinePeakHeatingW.toFixed(0)} W → {evaluation.comparison.candidatePeakHeatingW.toFixed(0)} W
                            </strong>
                            <small style={{ color: "#68808f" }}>
                              {evaluation.comparison.peakHeatingDeltaW > 0 ? "+" : ""}
                              {evaluation.comparison.peakHeatingDeltaW.toFixed(0)} W
                            </small>
                          </div>

                          <div className="eval-metric-cell">
                            <span>Indoor Temperature Range</span>
                            <strong>
                              {evaluation.comparison.candidateMinIndoorTemp.toFixed(1)}°C — {evaluation.comparison.candidatePeakIndoorTemp.toFixed(1)}°C
                            </strong>
                            <small style={{ color: "#68808f" }}>
                              Baseline: {evaluation.comparison.baselineMinIndoorTemp.toFixed(1)}°C — {evaluation.comparison.baselinePeakIndoorTemp.toFixed(1)}°C
                            </small>
                          </div>
                        </div>

                        {/* Explainable Impact Statement */}
                        <div className="eval-explanation-banner">
                          <Check aria-hidden className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span>{evaluation.comparison.explanation}</span>
                        </div>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="fix-card-actions">
                      <button
                        type="button"
                        className="primary-button fix-eval-btn"
                        onClick={() => handleEvaluateFix(candidate)}
                        disabled={isEvaluating}
                      >
                        {isEvaluating ? (
                          <>
                            <RefreshCw aria-hidden className="spin w-3.5 h-3.5" />
                            <span>Simulating on Server...</span>
                          </>
                        ) : evaluation ? (
                          <>
                            <RefreshCw aria-hidden className="w-3.5 h-3.5" />
                            <span>Re-Evaluate Fix</span>
                          </>
                        ) : (
                          <>
                            <Sparkles aria-hidden className="w-3.5 h-3.5" />
                            <span>Evaluate Fix (Run POST /api/simulate)</span>
                          </>
                        )}
                      </button>

                      {evaluation && (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => handleApplyFix(candidate, evaluation)}
                        >
                          <Check aria-hidden className="w-3.5 h-3.5" />
                          <span>Apply Fix to Active Design</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* 6. Two-Column Analysis Grid (Stage 8 Breakdown & Assumptions) */}
      <div className="climate-layout" style={{ marginTop: "18px" }}>
        {/* Left Column: Likely Thermal Contributors */}
        <section className="climate-panel selection-panel">
          <div className="panel-heading">
            <div>
              <h2>Likely Thermal Contributors</h2>
              <p>
                Ranked heat-flow components based on server simulation output magnitudes.
              </p>
            </div>
            <Flame aria-hidden className="text-slate-400" />
          </div>

          <div className="contributors-list" style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {diagnosis.contributors.map((contrib, idx) => (
              <div key={contrib.id} className="contributor-item-card">
                <div className="contributor-card-header">
                  <div className="contributor-rank-title">
                    <span className="contributor-rank-badge">#{idx + 1}</span>
                    <strong>{contrib.name}</strong>
                  </div>
                  <div className="contributor-magnitude-wrap">
                    <span
                      className={`contributor-direction-badge ${
                        contrib.direction === "entering"
                          ? "badge-gain"
                          : contrib.direction === "leaving"
                          ? "badge-loss"
                          : "badge-neutral"
                      }`}
                    >
                      {contrib.signed_w > 0 ? `+${contrib.signed_w.toFixed(0)} W` : `${contrib.signed_w.toFixed(0)} W`}
                    </span>
                  </div>
                </div>
                <div className="contributor-card-body">
                  <span className="contributor-meaning">{contrib.meaning}</span>
                  <p className="contributor-evidence">{contrib.evidence}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="orientation-disclaimer" style={{ marginTop: "14px" }}>
            <HelpCircle aria-hidden />
            <span>
              <strong>Interpretation Rule:</strong> The ranking reflects calculated instantaneous heat flows during the diurnal cycle. It identifies dominant contributors to the heat balance without asserting single causality.
            </span>
          </div>
        </section>

        {/* Right Column: Representative Hour Steady-State & Assumptions */}
        <section className="climate-panel summary-panel">
          <div className="panel-heading">
            <div>
              <h2>Representative Hour Heat Breakdown</h2>
              <p>
                Peak outdoor temperature snapshot at {steady_state.representative_hour.slice(11, 16)} (T_out = {steady_state.t_out_c.toFixed(1)} °C, T_in = {steady_state.t_in_c.toFixed(1)} °C)
              </p>
            </div>
            <Activity aria-hidden className="text-slate-400" />
          </div>

          <div className="metrics-grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: "14px" }}>
            <div className="climate-metric">
              <span>Wall Conduction (Q_walls)</span>
              <strong>{steady_state.q_cond_walls_w.toFixed(1)} W</strong>
            </div>
            <div className="climate-metric">
              <span>Roof Conduction (Q_roof)</span>
              <strong>{steady_state.q_cond_roof_w.toFixed(1)} W</strong>
            </div>
            <div className="climate-metric">
              <span>Window Conduction (Q_win)</span>
              <strong>{steady_state.q_cond_windows_w.toFixed(1)} W</strong>
            </div>
            <div className="climate-metric">
              <span>Solar Radiation (Q_solar)</span>
              <strong>{steady_state.q_solar_w.toFixed(1)} W</strong>
            </div>
            <div className="climate-metric">
              <span>Ventilation Load (Q_vent)</span>
              <strong>{steady_state.q_vent_w.toFixed(1)} W</strong>
            </div>
            <div className="climate-metric">
              <span>Occupant Sensible (Q_occ)</span>
              <strong>{steady_state.q_occ_w.toFixed(1)} W</strong>
            </div>
            <div className="climate-metric">
              <span>HVAC Holding Load (Q_hvac)</span>
              <strong style={{ color: steady_state.q_hvac_w !== 0 ? "#1b5e85" : "inherit" }}>
                {steady_state.q_hvac_w.toFixed(1)} W
              </strong>
            </div>
            <div className="climate-metric">
              <span>Net Heat Flow (Q_net)</span>
              <strong>{steady_state.q_net_w.toFixed(1)} W</strong>
            </div>
          </div>

          <div className="source-banner source-live" style={{ marginTop: "14px" }}>
            <Database aria-hidden />
            <div>
              <strong>Governing Model Assumptions</strong>
              <ul style={{ margin: "6px 0 0", paddingLeft: "16px", fontSize: "11px", color: "#577382", lineHeight: "1.5" }}>
                {simulationResult.assumptions.slice(0, 4).map((a, idx) => (
                  <li key={idx}>{a}</li>
                ))}
              </ul>
            </div>
          </div>

          <div style={{ marginTop: "16px" }}>
            <button
              type="button"
              className="secondary-button"
              onClick={onNavigateToSimulation}
            >
              <ArrowLeft aria-hidden />
              <span>Back to Simulation Workspace</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * Clean, lightweight SVG 24-hour temperature chart with comfort boundaries.
 */
function HourlyTimelineChart({
  assessments,
  comfortBand,
  hoveredIndex,
  onHoverIndex,
}: {
  assessments: HourlyAssessment[];
  comfortBand: { t_low_c: number; t_high_c: number };
  hoveredIndex: number | null;
  onHoverIndex: (index: number | null) => void;
}) {
  const chartWidth = 760;
  const chartHeight = 220;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 35;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  // Determine Y-scale range
  const allTemps = assessments.flatMap((a) => [a.t_in_c, a.t_out_c, comfortBand.t_low_c, comfortBand.t_high_c]);
  const minTemp = Math.floor(Math.min(...allTemps) - 2);
  const maxTemp = Math.ceil(Math.max(...allTemps) + 2);
  const tempRange = maxTemp - minTemp || 1;

  const scaleX = (index: number) => {
    return paddingLeft + (index / (assessments.length - 1 || 1)) * innerWidth;
  };

  const scaleY = (temp: number) => {
    return paddingTop + innerHeight - ((temp - minTemp) / tempRange) * innerHeight;
  };

  // Build SVG Path strings
  const indoorPoints = assessments.map((a, idx) => `${scaleX(idx).toFixed(1)},${scaleY(a.t_in_c).toFixed(1)}`).join(" ");
  const outdoorPoints = assessments.map((a, idx) => `${scaleX(idx).toFixed(1)},${scaleY(a.t_out_c).toFixed(1)}`).join(" ");

  const comfortTopY = scaleY(comfortBand.t_high_c);
  const comfortBottomY = scaleY(comfortBand.t_low_c);
  const comfortHeight = Math.max(2, comfortBottomY - comfortTopY);

  // Y-axis ticks
  const yTicks = [minTemp, comfortBand.t_low_c, comfortBand.t_high_c, maxTemp].filter(
    (v, i, a) => a.indexOf(v) === i
  ).sort((a, b) => a - b);

  const activePoint = hoveredIndex !== null ? assessments[hoveredIndex] : null;

  return (
    <div className="chart-container-wrap" style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="hourly-chart-svg"
        style={{ width: "100%", height: "auto", display: "block" }}
        onMouseLeave={() => onHoverIndex(null)}
      >
        {/* Shaded Comfort Zone */}
        <rect
          x={paddingLeft}
          y={comfortTopY}
          width={innerWidth}
          height={comfortHeight}
          fill="#edf7f0"
          opacity="0.75"
        />

        {/* Grid lines */}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={paddingLeft}
              y1={scaleY(tick)}
              x2={paddingLeft + innerWidth}
              y2={scaleY(tick)}
              stroke="#e2ecf2"
              strokeDasharray={tick === comfortBand.t_low_c || tick === comfortBand.t_high_c ? "3,3" : "none"}
            />
            <text
              x={paddingLeft - 8}
              y={scaleY(tick) + 3}
              textAnchor="end"
              fontSize="10"
              fill={
                tick === comfortBand.t_low_c || tick === comfortBand.t_high_c
                  ? "#2e7a50"
                  : "#8aa0ad"
              }
              fontWeight={tick === comfortBand.t_low_c || tick === comfortBand.t_high_c ? "700" : "400"}
            >
              {tick.toFixed(0)}°C
            </text>
          </g>
        ))}

        {/* Comfort Band Boundary Labels */}
        <text
          x={paddingLeft + innerWidth - 5}
          y={comfortTopY - 4}
          textAnchor="end"
          fontSize="9"
          fontWeight="700"
          fill="#2e7a50"
        >
          Upper Comfort ({comfortBand.t_high_c}°C)
        </text>
        <text
          x={paddingLeft + innerWidth - 5}
          y={comfortBottomY + 11}
          textAnchor="end"
          fontSize="9"
          fontWeight="700"
          fill="#2e7a50"
        >
          Lower Comfort ({comfortBand.t_low_c}°C)
        </text>

        {/* Outdoor Temperature Line (Dashed) */}
        <polyline
          points={outdoorPoints}
          fill="none"
          stroke="#94aab7"
          strokeWidth="1.5"
          strokeDasharray="4,4"
        />

        {/* Indoor Temperature Line (Solid) */}
        <polyline
          points={indoorPoints}
          fill="none"
          stroke="#1b5e85"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Hourly Point Markers & Interactive Columns */}
        {assessments.map((a, idx) => {
          const cx = scaleX(idx);
          const cy = scaleY(a.t_in_c);
          const isOutside = a.status !== "comfortable";
          const isHovered = hoveredIndex === idx;

          return (
            <g key={a.timestamp} onMouseEnter={() => onHoverIndex(idx)}>
              {/* Transparent hover column */}
              <rect
                x={cx - innerWidth / (assessments.length * 2)}
                y={paddingTop}
                width={innerWidth / assessments.length}
                height={innerHeight}
                fill={isHovered ? "rgba(27, 94, 133, 0.08)" : "transparent"}
                style={{ cursor: "pointer" }}
              />

              {/* X-axis tick labels every 4 hours */}
              {idx % 4 === 0 && (
                <text
                  x={cx}
                  y={chartHeight - 10}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#78909e"
                  fontWeight={isHovered ? "700" : "400"}
                >
                  {a.hour_label}
                </text>
              )}

              {/* Data point circle */}
              <circle
                cx={cx}
                cy={cy}
                r={isHovered ? 5 : isOutside ? 3.5 : 2.5}
                fill={
                  a.status === "overheating"
                    ? "#d96b27"
                    : a.status === "overcooling"
                    ? "#216f9d"
                    : "#2e7a50"
                }
                stroke="#fff"
                strokeWidth={isHovered ? 2 : 1}
              />
            </g>
          );
        })}
      </svg>

      {/* Interactive Tooltip Card */}
      {activePoint && hoveredIndex !== null && (
        <div
          className="chart-hover-tooltip"
          style={{
            position: "absolute",
            top: "8px",
            left: `${Math.min(Math.max(10, scaleX(hoveredIndex) - 90), chartWidth - 190)}px`,
            background: "rgba(18, 49, 75, 0.94)",
            color: "#fff",
            padding: "8px 12px",
            borderRadius: "6px",
            fontSize: "11px",
            pointerEvents: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 10,
            lineHeight: "1.4",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", fontWeight: "700", borderBottom: "1px solid rgba(255,255,255,0.2)", paddingBottom: "3px", marginBottom: "4px" }}>
            <span>Time: {activePoint.hour_label}</span>
            <span
              style={{
                color:
                  activePoint.status === "overheating"
                    ? "#fca5a5"
                    : activePoint.status === "overcooling"
                    ? "#93c5fd"
                    : "#86efac",
                textTransform: "uppercase",
                fontSize: "9px",
              }}
            >
              {activePoint.status}
            </span>
          </div>
          <div>Indoor (T_in): <strong>{activePoint.t_in_c.toFixed(1)}°C</strong></div>
          <div>Outdoor (T_out): <strong>{activePoint.t_out_c.toFixed(1)}°C</strong></div>
          {activePoint.deviation_k > 0 && (
            <div style={{ color: "#fca5a5", marginTop: "2px" }}>
              Deviation: +{activePoint.deviation_k.toFixed(1)} K outside band
            </div>
          )}
        </div>
      )}
    </div>
  );
}
