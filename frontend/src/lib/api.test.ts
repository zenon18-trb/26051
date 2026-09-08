import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  ApiConfigError,
  calculateAssemblyMetrics,
  calculateOccupantMetrics,
  calculateVentilationMetrics,
  calculateWindowMetrics,
  fetchClimate,
  getApiBaseUrl,
  serializeSimulationRequest,
  simulateShelter,
  type LocationPreset,
  type MaterialItem,
} from "./api";

const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const originalFetch = globalThis.fetch;

afterEach(() => {
  if (originalApiBaseUrl === undefined) {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
  } else {
    process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
  }
  globalThis.fetch = originalFetch;
});

const delhi: LocationPreset = {
  id: "delhi",
  name: "Delhi",
  region: "Delhi",
  latitude: 28.61,
  longitude: 77.21,
  lat: 28.61,
  lon: 77.21,
  environment_type: "composite",
  climate_type: "composite",
  description: "Test preset",
  fixture_id: "delhi",
};

const puf: MaterialItem = {
  id: "puf",
  name: "PUF panel",
  category: "insulation",
  k: 0.025,
  thermal_conductivity: 0.025,
  density: 40,
  specific_heat: 1400,
  typical_thickness: 0.05,
  relative_cost: "medium",
  relative_weight: "low",
  confidence: "high",
  source: "test",
  notes: "test",
};

describe("frontend API contract and configuration helpers", () => {
  test("requires an API base URL and removes a trailing slash", () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    assert.throws(() => getApiBaseUrl(), ApiConfigError);

    process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:8000/";
    assert.equal(getApiBaseUrl(), "http://localhost:8000");
  });

  test("serializes a floating shelter configuration without an HVAC setpoint", () => {
    const request = serializeSimulationRequest({
      location: { lat: delhi.lat, lon: delhi.lon, preset: delhi },
      geometry: { length_m: 6, width_m: 4, height_m: 2.5 },
      wallLayers: [{ material_id: "puf", thickness_m: 0.05 }],
      roofLayers: [{ material_id: "puf", thickness_m: 0.08 }],
      windows: { area_m2: 2, kind: "glazed" },
      vents: { open: false },
      occupants: 3.6,
      hvac: {
        mode: "floating",
        setpoint_c: 22,
        t_in_initial_c: 24,
        comfort_band: { t_low_c: 19, t_high_c: 27 },
      },
    });

    assert.deepEqual(request, {
      location: { lat: 28.61, lon: 77.21, preset_id: "delhi" },
      shelter: {
        length_m: 6,
        width_m: 4,
        height_m: 2.5,
        wall_layers: [{ material_id: "puf", thickness_m: 0.05 }],
        roof_layers: [{ material_id: "puf", thickness_m: 0.08 }],
        windows: { area_m2: 2, kind: "glazed" },
        vents: { open: false },
        occupants: 4,
        setpoint_c: null,
      },
      comfort_band: { t_low_c: 19, t_high_c: 27 },
      t_in_initial_c: 24,
    });
  });

  test("serializes a setpoint configuration without a floating initial temperature", () => {
    const request = serializeSimulationRequest({
      location: { lat: delhi.lat, lon: delhi.lon, preset: delhi },
      geometry: { length_m: 6, width_m: 4, height_m: 2.5 },
      wallLayers: [{ material_id: "puf", thickness_m: 0.05 }],
      roofLayers: [{ material_id: "puf", thickness_m: 0.05 }],
      windows: { area_m2: 2, kind: "glazed" },
      vents: { open: true },
      occupants: 2,
      hvac: {
        mode: "setpoint",
        setpoint_c: 22,
        t_in_initial_c: 15,
        comfort_band: { t_low_c: 18, t_high_c: 26 },
      },
    });

    assert.equal(request.shelter.setpoint_c, 22);
    assert.equal(request.t_in_initial_c, null);
  });

  test("rejects incomplete configurations before making an API request", () => {
    assert.throws(
      () =>
        serializeSimulationRequest({
          location: null,
          geometry: null,
          wallLayers: [],
          roofLayers: [],
          windows: null,
          vents: null,
          occupants: null,
          hvac: null,
        }),
      /Location configuration is missing/,
    );
  });

  test("calculates envelope, window, ventilation, and occupant figures shown in the UI", () => {
    const assembly = calculateAssemblyMetrics(
      [{ material_id: "puf", thickness_m: 0.05 }],
      new Map([["puf", puf]]),
      0.13,
    );
    assert.ok(assembly);
    assert.equal(assembly.rTotal, 2.17);
    assert.ok(Math.abs(assembly.uValue - 1 / 2.17) < 0.000001);

    const window = calculateWindowMetrics(2, 50, 24, "glazed");
    assert.equal(window.netWallArea, 48);
    assert.equal(window.wwr_pct, 4);
    assert.ok(Math.abs((window.wfr_pct ?? 0) - 100 / 12) < 0.000001);
    assert.equal(window.tau, 0.5);

    const ventilation = calculateVentilationMetrics(true, 60);
    assert.equal(ventilation.ach, 5);
    assert.equal(ventilation.airflow_m3_h, 300);
    assert.ok(Math.abs((ventilation.mass_flow_kg_s ?? 0) - 0.1) < 0.000001);
    assert.deepEqual(calculateOccupantMetrics(4), { count: 4, sensible_heat_w: 280 });
  });

  test("requests climate with coordinates and preset ID, then accepts the hourly payload", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://api.test";
    let requestedUrl = "";
    globalThis.fetch = (async (input) => {
      requestedUrl = String(input);
      return new Response(
        JSON.stringify({
          lat: 28.61,
          lon: 77.21,
          preset_id: "delhi",
          climate_source: "fallback",
          climate_source_label: "Climate source: Bundled fallback — Open-Meteo unavailable",
          fallback_used: true,
          hours: [{ timestamp: "2026-01-01T00:00", t_out_c: 20, shortwave_wm2: 0, wind_ms: 1, rh_pct: 50 }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const climate = await fetchClimate(28.61, 77.21, "delhi");
    assert.equal(climate.hours.length, 1);
    assert.match(requestedUrl, /^http:\/\/api\.test\/api\/climate\?/);
    assert.match(requestedUrl, /preset_id=delhi/);
  });

  test("posts a simulation request and surfaces server validation errors", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://api.test";
    globalThis.fetch = (async (_input, init) => {
      assert.equal(init?.method, "POST");
      assert.equal(init?.headers && (init.headers as Record<string, string>)["Content-Type"], "application/json");
      return new Response(JSON.stringify({ error: { message: "Window area is too large" } }), { status: 400 });
    }) as typeof fetch;

    await assert.rejects(
      simulateShelter({
        location: { lat: 28.61, lon: 77.21 },
        shelter: {
          length_m: 6, width_m: 4, height_m: 2.5,
          wall_layers: [{ material_id: "puf", thickness_m: 0.05 }],
          roof_layers: [{ material_id: "puf", thickness_m: 0.05 }],
          windows: { area_m2: 2, kind: "glazed" }, vents: { open: false }, occupants: 2,
        },
        comfort_band: { t_low_c: 18, t_high_c: 26 },
      }),
      /Window area is too large/,
    );
  });
});
