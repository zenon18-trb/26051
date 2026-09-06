import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  generateOptimizationCandidates,
  extractSimulationMetrics,
  calculateOptimizationScore,
  generateCandidateExplanation,
  DEFAULT_OPTIMIZATION_WEIGHTS,
} from "./thermalOptimizer";
import type { ShelterFullConfiguration } from "./thermalFixes";
import type { SimulationResponse, LocationPreset, HourlyResult, SteadyStateResult } from "./api";

const mockPreset: LocationPreset = {
  id: "leh",
  name: "Leh",
  lat: 34.1526,
  lon: 77.5771,
  elevation_m: 3500,
  state: "Ladakh",
  climate_type: "Cold",
  t_out_design_heating_c: -20,
  t_out_design_cooling_c: 25,
  solar_peak_w_m2: 900,
};

function createMockConfig(overrides: Partial<ShelterFullConfiguration> = {}): ShelterFullConfiguration {
  return {
    location: { lat: 34.1526, lon: 77.5771, preset: mockPreset },
    geometry: { length_m: 6.0, width_m: 4.0, height_m: 2.8 },
    wallLayers: [{ material_id: "puf_panel", thickness_m: 0.05 }],
    roofLayers: [{ material_id: "puf_panel", thickness_m: 0.05 }],
    windows: { area_m2: 3.0, kind: "glazed" },
    vents: { open: true },
    occupants: 4,
    hvac: {
      mode: "floating",
      setpoint_c: null,
      t_in_initial_c: 15.0,
      comfort_band: { t_low_c: 18.0, t_high_c: 26.0 },
    },
    ...overrides,
  };
}

const mockSteadyState: SteadyStateResult = {
  u_eff_w_per_k: 100,
  q_conductance_w_per_k: 80,
  q_ventilation_w_per_k: 20,
  q_internal_w: 300,
  q_solar_w: 100,
};

const mockHourly: HourlyResult[] = [
  {
    hour: 12,
    timestamp: "12:00",
    t_out_c: 25,
    t_in_c: 24,
    q_heating_w: 0,
    q_cooling_w: 0,
    q_solar_w: 50,
    q_vent_w: 0,
    q_cond_w: 0,
    q_int_w: 0,
    in_comfort_band: true,
  },
  {
    hour: 4,
    timestamp: "04:00",
    t_out_c: -10,
    t_in_c: 14,
    q_heating_w: 0,
    q_cooling_w: 0,
    q_solar_w: 0,
    q_vent_w: 0,
    q_cond_w: 0,
    q_int_w: 0,
    in_comfort_band: false,
  },
];

function createMockSimulation(
  comfortPct: number,
  peakHeatingW = 0,
  peakCoolingW = 0
): SimulationResponse {
  const hoursInBand = Math.round((comfortPct / 100) * 24);
  return {
    climate_source: "bundled_fixture",
    climate_source_label: "Test Fixture",
    capacitance_j_per_k: 10000000,
    capacitance_clamped: false,
    mode: peakHeatingW > 0 || peakCoolingW > 0 ? "setpoint" : "floating",
    steady_state: mockSteadyState,
    hourly: mockHourly,
    comfort: {
      comfort_pct: comfortPct,
      hours_in_band: hoursInBand,
      total_hours: 24,
      peak_deviation_above_k: comfortPct < 100 ? 4.0 : 0,
      peak_deviation_below_k: comfortPct < 100 ? 4.0 : 0,
      t_low_c: 18.0,
      t_high_c: 26.0,
    },
    hvac_summary: {
      peak_heating_w: peakHeatingW,
      peak_cooling_w: peakCoolingW,
    },
    units: {},
    assumptions: [],
  };
}

describe("Explainable Thermal Optimizer (Stage 10)", () => {
  test("1. Candidate generation is deterministic", () => {
    const config = createMockConfig();
    const run1 = generateOptimizationCandidates(config);
    const run2 = generateOptimizationCandidates(config);

    assert.equal(run1.length, run2.length);
    for (let i = 0; i < run1.length; i++) {
      assert.equal(run1[i].id, run2[i].id);
      assert.equal(run1[i].proposedValueDisplay, run2[i].proposedValueDisplay);
    }
  });

  test("2. Maximum candidate count is bounded (<= 12 candidates)", () => {
    const config = createMockConfig();
    const candidates = generateOptimizationCandidates(config);
    assert.ok(candidates.length > 0);
    assert.ok(candidates.length <= 12, `Candidate count ${candidates.length} exceeds max limit 12`);
  });

  test("3. Duplicate or invalid baseline candidate is rejected", () => {
    // If vents are already closed in baseline, ventilation_close candidate is rejected as infeasible
    const closedConfig = createMockConfig({ vents: { open: false } });
    const candidates = generateOptimizationCandidates(closedConfig);
    const ventCandidate = candidates.find((c) => c.id === "ventilation_close");
    assert.equal(ventCandidate, undefined); // not generated if already closed

    // If setpoint is already active, hvac_setpoint_22c candidate is not generated
    const setpointConfig = createMockConfig({
      hvac: {
        mode: "setpoint",
        setpoint_c: 22.0,
        t_in_initial_c: null,
        comfort_band: { t_low_c: 18.0, t_high_c: 26.0 },
      },
    });
    const setpointCandidates = generateOptimizationCandidates(setpointConfig);
    const hvacCandidate = setpointCandidates.find((c) => c.id === "hvac_setpoint_22c");
    assert.equal(hvacCandidate, undefined);
  });

  test("4. Feasibility check rejects invalid configurations", () => {
    const emptyConfig = createMockConfig({ wallLayers: [] });
    const candidates = generateOptimizationCandidates(emptyConfig);
    const wallCandidates = candidates.filter((c) => c.category === "envelope_wall");
    assert.equal(wallCandidates.length, 0);
  });

  test("5. Score calculation adheres to 60/30/10 weighting without NaN or Infinity", () => {
    const baselineRes = createMockSimulation(50.0, 1000, 500); // 1500 W HVAC
    const candidateRes = createMockSimulation(80.0, 600, 300); // 900 W HVAC

    const baselineMetrics = extractSimulationMetrics(baselineRes);
    const candidateMetrics = extractSimulationMetrics(candidateRes, baselineMetrics);

    const score = calculateOptimizationScore(
      candidateMetrics,
      baselineMetrics,
      0.20, // normalized change
      DEFAULT_OPTIMIZATION_WEIGHTS
    );

    // Comfort: 80% -> comfortScore = 0.80
    // HVAC: 900 / 1500 = 0.6 -> hvacScore = 1 - 0.6 = 0.40
    // Change: 1 - 0.20 = 0.80
    // Total = 0.60 * 0.80 + 0.30 * 0.40 + 0.10 * 0.80 = 0.48 + 0.12 + 0.08 = 0.68
    assert.equal(score.comfortScore, 0.80);
    assert.equal(score.hvacScore, 0.40);
    assert.equal(score.changeScore, 0.80);
    assert.equal(score.totalScore, 0.68);
    assert.equal(Number.isNaN(score.totalScore), false);
    assert.equal(Number.isFinite(score.totalScore), true);
  });

  test("6. Zero-baseline-HVAC is handled safely (no division by zero)", () => {
    const baselineRes = createMockSimulation(50.0, 0, 0); // 0 W HVAC (passive mode)
    const candidateRes = createMockSimulation(100.0, 1500, 0); // 1500 W HVAC

    const baselineMetrics = extractSimulationMetrics(baselineRes);
    const candidateMetrics = extractSimulationMetrics(candidateRes, baselineMetrics);

    const score = calculateOptimizationScore(
      candidateMetrics,
      baselineMetrics,
      0.45,
      DEFAULT_OPTIMIZATION_WEIGHTS
    );

    assert.equal(Number.isNaN(score.hvacScore), false);
    assert.equal(Number.isFinite(score.hvacScore), true);
    assert.equal(Number.isNaN(score.totalScore), false);
    assert.ok(score.totalScore > 0 && score.totalScore <= 1.0);
  });

  test("7. Meaningful improvement detection accurately flags improvements", () => {
    const baselineRes = createMockSimulation(60.0);
    const baselineMetrics = extractSimulationMetrics(baselineRes);

    // Candidate 1: +20% comfort -> meaningful improvement
    const cand1Metrics = extractSimulationMetrics(createMockSimulation(80.0), baselineMetrics);
    const score1 = calculateOptimizationScore(cand1Metrics, baselineMetrics, 0.15);
    assert.equal(score1.isMeaningfulImprovement, true);

    // Candidate 2: Exactly identical comfort and HVAC -> no improvement
    const cand2Metrics = extractSimulationMetrics(createMockSimulation(60.0), baselineMetrics);
    const score2 = calculateOptimizationScore(cand2Metrics, baselineMetrics, 0.15);
    assert.equal(score2.isMeaningfulImprovement, false);

    // Candidate 3: -10% comfort -> degraded, not an improvement
    const cand3Metrics = extractSimulationMetrics(createMockSimulation(50.0), baselineMetrics);
    const score3 = calculateOptimizationScore(cand3Metrics, baselineMetrics, 0.15);
    assert.equal(score3.isMeaningfulImprovement, false);
  });

  test("8. No forced recommendation if all candidates fail meaningful improvement threshold", () => {
    const baselineRes = createMockSimulation(100.0, 0, 0); // Already 100% stable
    const baselineMetrics = extractSimulationMetrics(baselineRes);

    const candMetrics = extractSimulationMetrics(createMockSimulation(100.0, 0, 0), baselineMetrics);
    const score = calculateOptimizationScore(candMetrics, baselineMetrics, 0.15);

    assert.equal(score.isMeaningfulImprovement, false);
  });

  test("9. Baseline configuration remains completely immutable during candidate execution", () => {
    const config = createMockConfig({
      wallLayers: [{ material_id: "puf_panel", thickness_m: 0.05 }],
      roofLayers: [{ material_id: "puf_panel", thickness_m: 0.075 }],
      windows: { area_m2: 3.0, kind: "glazed" },
    });

    const candidates = generateOptimizationCandidates(config);
    for (const candidate of candidates) {
      candidate.applyModification(config);
    }

    // Baseline values must remain strictly unchanged
    assert.equal(config.wallLayers[0].thickness_m, 0.05);
    assert.equal(config.roofLayers[0].thickness_m, 0.075);
    assert.equal(config.windows?.area_m2, 3.0);
    assert.equal(config.vents?.open, true);
  });

  test("10. generateCandidateExplanation produces structured transparent rationale", () => {
    const candidate = generateOptimizationCandidates(createMockConfig())[0];
    const baselineRes = createMockSimulation(50.0);
    const candidateRes = createMockSimulation(80.0);
    const baselineMetrics = extractSimulationMetrics(baselineRes);
    const candidateMetrics = extractSimulationMetrics(candidateRes, baselineMetrics);
    const score = calculateOptimizationScore(candidateMetrics, baselineMetrics, 0.15);

    const explanation = generateCandidateExplanation(
      candidate,
      candidateMetrics,
      baselineMetrics,
      score,
      true // isRecommended
    );

    assert.ok(explanation.includes("ranked first"));
    assert.ok(explanation.includes("+30.0 percentage points"));
    assert.ok(explanation.includes("50.0% → 80.0%"));
    assert.ok(explanation.includes("60/30/10 objective weighting"));
  });
});
