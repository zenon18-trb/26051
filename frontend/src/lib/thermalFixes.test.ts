import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  generateFeasibleFixCandidates,
  compareSimulationResults,
  type ShelterFullConfiguration,
  INSULATION_INCREMENT_M,
} from "./thermalFixes";
import type { ThermalDiagnosis } from "./thermalDiagnosis";
import type { SimulationResponse } from "./api";

function createMockDiagnosis(
  status: "good" | "warning" | "critical",
  failureType: "none" | "overheating" | "overcooling" | "mixed",
  hoursOutside = 0
): ThermalDiagnosis {
  return {
    status,
    failureType,
    headline: status === "good" ? "THERMALLY STABLE" : "THERMAL FAILURE DETECTED",
    summary: `${hoursOutside} hours outside comfort`,
    comfortPercent: hoursOutside === 0 ? 100 : Math.round(((24 - hoursOutside) / 24) * 100),
    hoursInComfort: 24 - hoursOutside,
    totalHours: 24,
    hoursOutsideComfort: hoursOutside,
    overheatingHours: failureType === "overheating" || failureType === "mixed" ? hoursOutside : 0,
    overcoolingHours: failureType === "overcooling" ? hoursOutside : 0,
    peakIndoorTemperature: failureType === "overheating" ? 32.0 : 22.0,
    peakIndoorTemperatureHour: "13:00",
    minimumIndoorTemperature: failureType === "overcooling" ? 12.0 : 18.0,
    minimumIndoorTemperatureHour: "05:00",
    peakHotDeviation: failureType === "overheating" ? 6.0 : 0,
    peakColdDeviation: failureType === "overcooling" ? 6.0 : 0,
    comfortBand: { t_low_c: 18.0, t_high_c: 26.0 },
    hourlyAssessments: [],
    contributors: [],
    explanation: "Mock test explanation",
    evidence: [],
  };
}

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
    vents: { open: false },
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
    t_out_c: 20,
    t_in_c: 32,
    q_heating_w: 0,
    q_cooling_w: 0,
    q_solar_w: 50,
    q_vent_w: 0,
    q_cond_w: 0,
    q_int_w: 0,
    in_comfort_band: false,
  },
  {
    hour: 4,
    timestamp: "04:00",
    t_out_c: -5,
    t_in_c: 12,
    q_heating_w: 0,
    q_cooling_w: 0,
    q_solar_w: 0,
    q_vent_w: 0,
    q_cond_w: 0,
    q_int_w: 0,
    in_comfort_band: false,
  },
];

describe("Thermal Fix Engine (Stage 9)", () => {
  test("1. Overheating generates appropriate candidates (wall/roof insulation, reduce glazing)", () => {
    const config = createMockConfig({ vents: { open: true } });
    const diagnosis = createMockDiagnosis("critical", "overheating", 8);

    const candidates = generateFeasibleFixCandidates(config, diagnosis);

    assert.ok(candidates.length >= 3);
    const types = candidates.map((c) => c.type);
    assert.ok(types.includes("increase_wall_insulation"));
    assert.ok(types.includes("increase_roof_insulation"));
    assert.ok(types.includes("reduce_glazing"));
    assert.ok(types.includes("reduce_ventilation")); // since vents are open
  });

  test("2. Overcooling generates appropriate candidates (insulation, glazing, adjust setpoint)", () => {
    const config = createMockConfig({
      vents: { open: false },
      hvac: {
        mode: "floating",
        setpoint_c: null,
        t_in_initial_c: 15.0,
        comfort_band: { t_low_c: 18.0, t_high_c: 26.0 },
      },
    });
    const diagnosis = createMockDiagnosis("critical", "overcooling", 12);

    const candidates = generateFeasibleFixCandidates(config, diagnosis);

    assert.ok(candidates.length >= 3);
    const types = candidates.map((c) => c.type);
    assert.ok(types.includes("increase_wall_insulation"));
    assert.ok(types.includes("increase_roof_insulation"));
    assert.ok(types.includes("reduce_glazing"));
    assert.ok(types.includes("adjust_setpoint")); // in floating mode
  });

  test("3. Stable design generates no required fixes (returns empty list)", () => {
    const config = createMockConfig();
    const diagnosis = createMockDiagnosis("good", "none", 0);

    const candidates = generateFeasibleFixCandidates(config, diagnosis);
    assert.equal(candidates.length, 0);
  });

  test("4. Insulation candidate changes exactly ONE parameter", () => {
    const config = createMockConfig();
    const diagnosis = createMockDiagnosis("warning", "overcooling", 4);

    const candidates = generateFeasibleFixCandidates(config, diagnosis);
    const wallCandidate = candidates.find((c) => c.type === "increase_wall_insulation");

    assert.ok(wallCandidate);
    const modified = wallCandidate.applyModification(config);

    // Wall thickness increased by exact increment
    assert.equal(modified.wallLayers[0].thickness_m, 0.05 + INSULATION_INCREMENT_M);

    // ALL other parameters remain identical
    assert.equal(modified.roofLayers[0].thickness_m, config.roofLayers[0].thickness_m);
    assert.equal(modified.windows?.area_m2, config.windows?.area_m2);
    assert.equal(modified.vents?.open, config.vents?.open);
    assert.equal(modified.occupants, config.occupants);
    assert.equal(modified.hvac?.mode, config.hvac?.mode);
  });

  test("5. Glazing candidate never becomes negative or invalid", () => {
    // Test with small initial glazing (0.6 m²)
    const config = createMockConfig({ windows: { area_m2: 0.6, kind: "glazed" } });
    const diagnosis = createMockDiagnosis("critical", "overheating", 6);

    const candidates = generateFeasibleFixCandidates(config, diagnosis);
    const windowCandidate = candidates.find((c) => c.type === "reduce_glazing");

    assert.ok(windowCandidate);
    const modified = windowCandidate.applyModification(config);
    assert.ok(modified.windows!.area_m2 > 0);
    assert.ok(modified.windows!.area_m2 < config.windows!.area_m2);

    // Test with zero window area -> candidate should not be generated
    const zeroWindowConfig = createMockConfig({ windows: { area_m2: 0.0, kind: "glazed" } });
    const zeroCandidates = generateFeasibleFixCandidates(zeroWindowConfig, diagnosis);
    assert.equal(
      zeroCandidates.some((c) => c.type === "reduce_glazing"),
      false
    );
  });

  test("6. Ventilation candidate only appears when vents are currently open", () => {
    const diagnosis = createMockDiagnosis("warning", "overcooling", 4);

    // Vents closed -> no reduce_ventilation candidate
    const closedConfig = createMockConfig({ vents: { open: false } });
    const closedCandidates = generateFeasibleFixCandidates(closedConfig, diagnosis);
    assert.equal(
      closedCandidates.some((c) => c.type === "reduce_ventilation"),
      false
    );

    // Vents open -> reduce_ventilation candidate MUST appear
    const openConfig = createMockConfig({ vents: { open: true } });
    const openCandidates = generateFeasibleFixCandidates(openConfig, diagnosis);
    const ventCandidate = openCandidates.find((c) => c.type === "reduce_ventilation");
    assert.ok(ventCandidate);
    const modified = ventCandidate.applyModification(openConfig);
    assert.equal(modified.vents?.open, false);
  });

  test("7. Baseline configuration remains completely unmutated when generating and applying candidates", () => {
    const config = createMockConfig({
      wallLayers: [{ material_id: "puf_panel", thickness_m: 0.05 }],
      roofLayers: [{ material_id: "puf_panel", thickness_m: 0.05 }],
      windows: { area_m2: 3.0, kind: "glazed" },
    });
    const diagnosis = createMockDiagnosis("critical", "overcooling", 10);

    const candidates = generateFeasibleFixCandidates(config, diagnosis);
    for (const candidate of candidates) {
      candidate.applyModification(config);
    }

    // Check baseline is 100% pristine
    assert.equal(config.wallLayers[0].thickness_m, 0.05);
    assert.equal(config.roofLayers[0].thickness_m, 0.05);
    assert.equal(config.windows?.area_m2, 3.0);
    assert.equal(config.vents?.open, false);
  });

  test("8. compareSimulationResults computes correct deltas and outcome", () => {
    const baseline: SimulationResponse = {
      climate_source: "bundled_fixture",
      climate_source_label: "Test",
      capacitance_j_per_k: 10000000,
      capacitance_clamped: false,
      mode: "floating",
      steady_state: mockSteadyState,
      hourly: mockHourly,
      comfort: {
        comfort_pct: 50.0,
        hours_in_band: 12,
        total_hours: 24,
        peak_deviation_above_k: 6.0,
        peak_deviation_below_k: 6.0,
        t_low_c: 18.0,
        t_high_c: 26.0,
      },
      hvac_summary: {
        peak_heating_w: 0,
        peak_cooling_w: 0,
      },
      units: {},
      assumptions: [],
    };

    const candidate: SimulationResponse = {
      ...baseline,
      comfort: {
        ...baseline.comfort,
        comfort_pct: 75.0,
        hours_in_band: 18,
      },
    };

    const comparison = compareSimulationResults(baseline, candidate, {
      title: "Increase Roof Insulation",
    });

    assert.equal(comparison.baselineComfortPct, 50.0);
    assert.equal(comparison.candidateComfortPct, 75.0);
    assert.equal(comparison.comfortDeltaPercentagePoints, 25.0);
    assert.equal(comparison.baselineHoursOutside, 12);
    assert.equal(comparison.candidateHoursOutside, 6);
    assert.equal(comparison.hoursOutsideDelta, -6);
    assert.equal(comparison.outcome, "improves");
    assert.match(comparison.explanation, /improved simulated thermal comfort/);
  });
});
