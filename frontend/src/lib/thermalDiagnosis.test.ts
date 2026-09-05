import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  diagnoseThermalPerformance,
  type ThermalDiagnosis,
} from "./thermalDiagnosis.ts";
import type { SimulationResponse, HourlySimulationPoint } from "./api.ts";

function createMockSimulation(
  hourlyTemps: number[],
  comfortLow = 18.0,
  comfortHigh = 26.0,
  mode = "floating"
): SimulationResponse {
  const hourly: HourlySimulationPoint[] = hourlyTemps.map((temp, i) => {
    const hourStr = String(i).padStart(2, "0");
    return {
      timestamp: `2026-06-15T${hourStr}:00:00Z`,
      t_out_c: 20.0,
      t_in_c: temp,
      q_cond_walls_w: temp > 20 ? -200 : 200,
      q_cond_roof_w: temp > 20 ? -150 : 150,
      q_cond_windows_w: temp > 20 ? -50 : 50,
      q_solar_w: i >= 10 && i <= 15 ? 600 : 0,
      q_vent_w: temp > 20 ? -80 : 80,
      q_occ_w: 280,
      q_hvac_w: 0,
      q_other_w: 0,
      q_net_w: 0,
    };
  });

  let inBand = 0;
  for (const t of hourlyTemps) {
    if (t >= comfortLow && t <= comfortHigh) inBand++;
  }
  const pct = (inBand / hourlyTemps.length) * 100;

  return {
    climate_source: "bundled_fixture",
    climate_source_label: "Test Fixture",
    capacitance_j_per_k: 10000000,
    capacitance_clamped: false,
    mode,
    steady_state: {
      representative_hour: "2026-06-15T12:00:00Z",
      t_out_c: 25.0,
      t_in_c: 22.0,
      q_cond_walls_w: 100,
      q_cond_roof_w: 80,
      q_cond_windows_w: 20,
      q_solar_w: 500,
      q_vent_w: 50,
      q_occ_w: 280,
      q_hvac_w: 0,
      q_other_w: 1030,
      q_net_w: 1030,
    },
    hourly,
    comfort: {
      comfort_pct: Math.round(pct * 10) / 10,
      hours_in_band: inBand,
      total_hours: hourlyTemps.length,
      peak_deviation_above_k: Math.max(0, ...hourlyTemps.map((t) => t - comfortHigh)),
      peak_deviation_below_k: Math.max(0, ...hourlyTemps.map((t) => comfortLow - t)),
      t_low_c: comfortLow,
      t_high_c: comfortHigh,
    },
    hvac_summary: {
      peak_heating_w: 0,
      peak_cooling_w: 0,
    },
    units: {},
    assumptions: ["Test assumption"],
  };
}

describe("Thermal Failure Detection & Diagnosis Engine", () => {
  test("1. All 24 hours comfortable -> good severity, no failure", () => {
    // 24 hours at constant 22°C (inside 18°C - 26°C)
    const temps = Array(24).fill(22.0);
    const mock = createMockSimulation(temps);
    const diagnosis = diagnoseThermalPerformance(mock);

    assert.ok(diagnosis !== null);
    assert.equal(diagnosis.status, "good");
    assert.equal(diagnosis.failureType, "none");
    assert.equal(diagnosis.headline, "THERMALLY STABLE");
    assert.equal(diagnosis.comfortPercent, 100);
    assert.equal(diagnosis.hoursOutsideComfort, 0);
    assert.equal(diagnosis.hoursInComfort, 24);
    assert.equal(diagnosis.overheatingHours, 0);
    assert.equal(diagnosis.overcoolingHours, 0);
    assert.equal(diagnosis.peakHotDeviation, 0);
    assert.equal(diagnosis.peakColdDeviation, 0);
  });

  test("2. Only overheating -> overheating failure type", () => {
    // 20 hours comfortable (22°C), 4 hours overheating (28°C)
    const temps = [...Array(20).fill(22.0), ...Array(4).fill(28.0)];
    const mock = createMockSimulation(temps);
    const diagnosis = diagnoseThermalPerformance(mock);

    assert.ok(diagnosis !== null);
    assert.equal(diagnosis.failureType, "overheating");
    assert.equal(diagnosis.overheatingHours, 4);
    assert.equal(diagnosis.overcoolingHours, 0);
    assert.equal(diagnosis.hoursOutsideComfort, 4);
    assert.equal(diagnosis.peakIndoorTemperature, 28.0);
    assert.equal(diagnosis.peakHotDeviation, 2.0); // 28 - 26 = 2 K
  });

  test("3. Only overcooling -> overcooling failure type", () => {
    // 19 hours comfortable (20°C), 5 hours overcooling (15°C)
    const temps = [...Array(19).fill(20.0), ...Array(5).fill(15.0)];
    const mock = createMockSimulation(temps);
    const diagnosis = diagnoseThermalPerformance(mock);

    assert.ok(diagnosis !== null);
    assert.equal(diagnosis.failureType, "overcooling");
    assert.equal(diagnosis.overcoolingHours, 5);
    assert.equal(diagnosis.overheatingHours, 0);
    assert.equal(diagnosis.hoursOutsideComfort, 5);
    assert.equal(diagnosis.minimumIndoorTemperature, 15.0);
    assert.equal(diagnosis.peakColdDeviation, 3.0); // 18 - 15 = 3 K
  });

  test("4. Both overheating and overcooling -> mixed failure type", () => {
    // 16 hours comfortable (22°C), 4 hours overheating (29°C), 4 hours overcooling (14°C)
    const temps = [
      ...Array(16).fill(22.0),
      ...Array(4).fill(29.0),
      ...Array(4).fill(14.0),
    ];
    const mock = createMockSimulation(temps);
    const diagnosis = diagnoseThermalPerformance(mock);

    assert.ok(diagnosis !== null);
    assert.equal(diagnosis.failureType, "mixed");
    assert.equal(diagnosis.overheatingHours, 4);
    assert.equal(diagnosis.overcoolingHours, 4);
    assert.equal(diagnosis.hoursOutsideComfort, 8);
    assert.equal(diagnosis.peakHotDeviation, 3.0);
    assert.equal(diagnosis.peakColdDeviation, 4.0);
  });

  test("5. Exactly 25% outside comfort -> warning severity", () => {
    // 6 out of 24 hours outside comfort (25%)
    const temps = [...Array(18).fill(22.0), ...Array(6).fill(28.0)];
    const mock = createMockSimulation(temps);
    const diagnosis = diagnoseThermalPerformance(mock);

    assert.ok(diagnosis !== null);
    assert.equal(diagnosis.status, "warning");
    assert.equal(diagnosis.headline, "THERMAL WARNING");
    assert.equal(diagnosis.hoursOutsideComfort, 6);
    assert.equal(diagnosis.comfortPercent, 75.0);
  });

  test("6. More than 25% outside comfort -> critical severity", () => {
    // 7 out of 24 hours outside comfort (29.17%)
    const temps = [...Array(17).fill(22.0), ...Array(7).fill(28.0)];
    const mock = createMockSimulation(temps);
    const diagnosis = diagnoseThermalPerformance(mock);

    assert.ok(diagnosis !== null);
    assert.equal(diagnosis.status, "critical");
    assert.equal(diagnosis.headline, "THERMAL FAILURE DETECTED");
    assert.equal(diagnosis.hoursOutsideComfort, 7);
  });

  test("7. Contributor ranking uses actual response values without fabrication", () => {
    const temps = [...Array(18).fill(22.0), ...Array(6).fill(30.0)];
    const mock = createMockSimulation(temps);
    const diagnosis = diagnoseThermalPerformance(mock);

    assert.ok(diagnosis !== null);
    assert.ok(diagnosis.contributors.length > 0);

    // Solar gain was set to 600 W in mock
    const solarContrib = diagnosis.contributors.find((c) => c.id === "solar");
    assert.ok(solarContrib);
    assert.equal(solarContrib.magnitude_w, 600);
    assert.equal(solarContrib.direction, "entering");
    assert.match(solarContrib.evidence, /600 W/);

    // Occupants was set to 280 W
    const occContrib = diagnosis.contributors.find((c) => c.id === "occupants");
    assert.ok(occContrib);
    assert.equal(occContrib.magnitude_w, 280);
  });

  test("8. No simulation result -> returns null safe empty state", () => {
    const diagnosis = diagnoseThermalPerformance(null);
    assert.equal(diagnosis, null);

    const emptyResult = {
      ...createMockSimulation([]),
      hourly: [],
    };
    const diagnosisEmpty = diagnoseThermalPerformance(emptyResult);
    assert.equal(diagnosisEmpty, null);
  });
});
