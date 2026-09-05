const SERVICE_NAME = "shelter-thermal-api";

export class ApiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiConfigError";
  }
}

export function getApiBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!value) {
    throw new ApiConfigError(
      "NEXT_PUBLIC_API_BASE_URL is not set. Copy frontend/.env.example to frontend/.env.local and restart npm run dev.",
    );
  }
  return value.replace(/\/$/, "");
}

export type HealthPayload = {
  status: string;
  service: string;
};

export function isHealthOk(payload: unknown): payload is HealthPayload {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }
  const record = payload as Record<string, unknown>;
  return record.status === "ok" && record.service === SERVICE_NAME;
}

export async function fetchHealth(): Promise<HealthPayload> {
  const url = `${getApiBaseUrl()}/api/health`;
  const response = await fetch(url, { method: "GET", cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Health request failed with HTTP ${response.status}.`);
  }
  const payload: unknown = await response.json();
  if (!isHealthOk(payload)) {
    throw new Error("The API returned an unexpected health payload.");
  }
  return payload;
}

export type LocationPreset = {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  lat: number;
  lon: number;
  environment_type: string;
  climate_type: string;
  description: string;
  fixture_id: string;
};

export type ClimateHour = {
  timestamp: string;
  t_out_c: number;
  shortwave_wm2: number;
  wind_ms: number | null;
  rh_pct: number | null;
};

export type ClimateResponse = {
  lat: number;
  lon: number;
  preset_id: string | null;
  climate_source: string;
  climate_source_label: string;
  fallback_used: boolean;
  hours: ClimateHour[];
};

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, { method: "GET", cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Request failed with HTTP ${response.status}.`);
  }
  return response.json() as Promise<T>;
}

export async function fetchLocations(): Promise<LocationPreset[]> {
  const payload = await fetchJson<{ locations: LocationPreset[] }>("/api/locations");
  if (!Array.isArray(payload.locations)) {
    throw new Error("The API returned no location presets.");
  }
  return payload.locations;
}

export async function fetchClimate(lat: number, lon: number, presetId?: string): Promise<ClimateResponse> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lon) });
  if (presetId) params.set("preset_id", presetId);
  const payload = await fetchJson<ClimateResponse>(`/api/climate?${params.toString()}`);
  if (!Array.isArray(payload.hours) || payload.hours.length === 0) {
    throw new Error("The climate service returned an empty hourly response.");
  }
  return payload;
}

export type CardinalOrientation = "North" | "East" | "South" | "West";

export type ShelterGeometry = {
  length_m: number;
  width_m: number;
  height_m: number;
  orientation?: CardinalOrientation;
};

export type MaterialItem = {
  id: string;
  name: string;
  category: string;
  k: number;
  thermal_conductivity: number;
  density: number;
  specific_heat: number;
  typical_thickness: number;
  relative_cost: string;
  relative_weight: string;
  confidence: string;
  source: string;
  notes: string;
};

export type MaterialLayer = {
  material_id: string;
  thickness_m: number;
};

export async function fetchMaterials(): Promise<MaterialItem[]> {
  const payload = await fetchJson<{ materials: MaterialItem[] }>("/api/materials");
  if (!Array.isArray(payload.materials) || payload.materials.length === 0) {
    throw new Error("The API returned no materials.");
  }
  return payload.materials;
}

export type AssemblyMetrics = {
  layerCount: number;
  totalThicknessMm: number;
  totalThicknessM: number;
  rTotal: number;
  uValue: number;
  layerResistances: { layerIndex: number; materialName: string; rValue: number }[];
};

export function calculateAssemblyMetrics(
  layers: MaterialLayer[],
  materialsMap: Map<string, MaterialItem>,
  rSi: number,
  rSo: number = 0.04
): AssemblyMetrics | null {
  if (!layers.length) return null;

  let totalThicknessM = 0;
  let sumLayerR = 0;
  const layerResistances: { layerIndex: number; materialName: string; rValue: number }[] = [];

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    if (layer.thickness_m <= 0) return null;
    const mat = materialsMap.get(layer.material_id);
    if (!mat || mat.k <= 0) return null;

    const rLayer = layer.thickness_m / mat.k;
    totalThicknessM += layer.thickness_m;
    sumLayerR += rLayer;
    layerResistances.push({
      layerIndex: i,
      materialName: mat.name,
      rValue: rLayer,
    });
  }

  const rTotal = rSi + sumLayerR + rSo;
  const uValue = rTotal > 0 ? 1.0 / rTotal : 0;

  return {
    layerCount: layers.length,
    totalThicknessMm: totalThicknessM * 1000,
    totalThicknessM,
    rTotal,
    uValue,
    layerResistances,
  };
}

export function calculateWallAssemblyMetrics(
  layers: MaterialLayer[],
  materialsMap: Map<string, MaterialItem>
): AssemblyMetrics | null {
  // Inside surface resistance for vertical walls R_si = 0.13 m²·K/W, outside R_so = 0.04 m²·K/W
  return calculateAssemblyMetrics(layers, materialsMap, 0.13, 0.04);
}

export function calculateRoofAssemblyMetrics(
  layers: MaterialLayer[],
  materialsMap: Map<string, MaterialItem>
): AssemblyMetrics | null {
  // Inside surface resistance for horizontal/roof R_si = 0.10 m²·K/W, outside R_so = 0.04 m²·K/W
  return calculateAssemblyMetrics(layers, materialsMap, 0.10, 0.04);
}

export type WindowConfig = {
  area_m2: number;
  kind: "glazed" | "open";
};

export type WindowMetrics = {
  area_m2: number;
  kind: string;
  grossWallArea: number | null;
  floorArea: number | null;
  netWallArea: number | null;
  wwr_pct: number | null;
  wfr_pct: number | null;
  u_window: number;
  tau: number;
};

export function calculateWindowMetrics(
  area_m2: number,
  grossWallArea: number | null,
  floorArea: number | null,
  kind: "glazed" | "open" = "glazed"
): WindowMetrics {
  // Glass: k = 0.96 W/(m·K), d = 0.006 m, R_so = 0.04, R_si = 0.13
  // R_total = 0.13 + (0.006 / 0.96) + 0.04 = 0.17625 m²·K/W -> U = 5.674 W/(m²·K)
  const u_window = kind === "glazed" ? 1.0 / (0.13 + 0.006 / 0.96 + 0.04) : 0;
  const tau = kind === "glazed" ? 0.5 : 1.0;

  const netWallArea =
    grossWallArea !== null ? Math.max(0, grossWallArea - area_m2) : null;
  const wwr_pct =
    grossWallArea !== null && grossWallArea > 0
      ? (area_m2 / grossWallArea) * 100
      : null;
  const wfr_pct =
    floorArea !== null && floorArea > 0 ? (area_m2 / floorArea) * 100 : null;

  return {
    area_m2,
    kind,
    grossWallArea,
    floorArea,
    netWallArea,
    wwr_pct,
    wfr_pct,
    u_window,
    tau,
  };
}

export type VentConfig = {
  open: boolean;
};

export type VentilationMetrics = {
  open: boolean;
  ach: number;
  volume_m3: number | null;
  airflow_m3_h: number | null;
  airflow_m3_s: number | null;
  mass_flow_kg_s: number | null;
};

export function calculateVentilationMetrics(
  open: boolean,
  volume_m3: number | null
): VentilationMetrics {
  const ach = open ? 5.0 : 0.5;
  const airflow_m3_h = volume_m3 !== null ? ach * volume_m3 : null;
  const airflow_m3_s = airflow_m3_h !== null ? airflow_m3_h / 3600 : null;
  const mass_flow_kg_s = airflow_m3_s !== null ? 1.2 * airflow_m3_s : null;

  return {
    open,
    ach,
    volume_m3,
    airflow_m3_h,
    airflow_m3_s,
    mass_flow_kg_s,
  };
}

export type OccupantsMetrics = {
  count: number;
  sensible_heat_w: number;
};

export function calculateOccupantMetrics(count: number): OccupantsMetrics {
  const validCount = Number.isInteger(count) && count >= 0 ? count : 0;
  return {
    count: validCount,
    sensible_heat_w: validCount * 70.0,
  };
}

export type ComfortBand = {
  t_low_c: number;
  t_high_c: number;
};

export const DEFAULT_COMFORT_BAND: ComfortBand = {
  t_low_c: 18.0,
  t_high_c: 26.0,
};

export type HvacMode = "floating" | "setpoint";

export type HvacConfig = {
  mode: HvacMode;
  setpoint_c: number | null;
  t_in_initial_c: number | null;
  comfort_band: ComfortBand;
};

export type LocationConfig = {
  lat: number;
  lon: number;
  preset_id?: string | null;
};

export type MaterialLayerConfig = {
  material_id: string;
  thickness_m: number;
};

export type ShelterConfig = {
  length_m: number;
  width_m: number;
  height_m: number;
  wall_layers: MaterialLayerConfig[];
  roof_layers: MaterialLayerConfig[];
  windows: WindowConfig;
  vents: VentConfig;
  occupants: number;
  setpoint_c?: number | null;
};

export type SimulationRequest = {
  location: LocationConfig;
  shelter: ShelterConfig;
  comfort_band: ComfortBand;
  t_in_initial_c?: number | null;
};

export type SteadyStateBreakdown = {
  representative_hour: string;
  t_out_c: number;
  t_in_c: number;
  q_cond_walls_w: number;
  q_cond_roof_w: number;
  q_cond_windows_w: number;
  q_solar_w: number;
  q_vent_w: number;
  q_occ_w: number;
  q_hvac_w: number;
  q_other_w: number;
  q_net_w: number;
};

export type HourlySimulationPoint = {
  timestamp: string;
  t_out_c: number;
  t_in_c: number;
  q_cond_walls_w: number;
  q_cond_roof_w: number;
  q_cond_windows_w: number;
  q_solar_w: number;
  q_vent_w: number;
  q_occ_w: number;
  q_hvac_w: number;
  q_other_w: number;
  q_net_w: number;
};

export type ComfortSummary = {
  comfort_pct: number;
  hours_in_band: number;
  total_hours: number;
  peak_deviation_above_k: number;
  peak_deviation_below_k: number;
  t_low_c: number;
  t_high_c: number;
};

export type HVACSummary = {
  peak_heating_w: number;
  peak_cooling_w: number;
};

export type SimulationResponse = {
  climate_source: string;
  climate_source_label: string;
  capacitance_j_per_k: number;
  capacitance_clamped: boolean;
  mode: string;
  steady_state: SteadyStateBreakdown;
  hourly: HourlySimulationPoint[];
  comfort: ComfortSummary;
  hvac_summary: HVACSummary;
  units: Record<string, string>;
  assumptions: string[];
};

export function serializeSimulationRequest(params: {
  location: { lat: number; lon: number; preset: LocationPreset | null } | null;
  geometry: ShelterGeometry | null;
  wallLayers: MaterialLayer[];
  roofLayers: MaterialLayer[];
  windows: WindowConfig | null;
  vents: VentConfig | null;
  occupants: number | null;
  hvac: HvacConfig | null;
}): SimulationRequest {
  if (!params.location) {
    throw new Error("Location configuration is missing.");
  }
  if (!params.geometry) {
    throw new Error("Shelter geometry configuration is missing.");
  }
  if (!params.wallLayers || params.wallLayers.length === 0) {
    throw new Error("Wall assembly layers are missing.");
  }
  if (!params.roofLayers || params.roofLayers.length === 0) {
    throw new Error("Roof assembly layers are missing.");
  }
  if (!params.windows) {
    throw new Error("Window glazing configuration is missing.");
  }
  if (!params.vents) {
    throw new Error("Ventilation state is missing.");
  }
  if (params.occupants === null || params.occupants === undefined) {
    throw new Error("Occupant count is missing.");
  }

  const locationConfig: LocationConfig = {
    lat: params.location.lat,
    lon: params.location.lon,
    preset_id: params.location.preset?.id ?? null,
  };

  const shelterConfig: ShelterConfig = {
    length_m: params.geometry.length_m,
    width_m: params.geometry.width_m,
    height_m: params.geometry.height_m,
    wall_layers: params.wallLayers.map((layer) => ({
      material_id: layer.material_id,
      thickness_m: layer.thickness_m,
    })),
    roof_layers: params.roofLayers.map((layer) => ({
      material_id: layer.material_id,
      thickness_m: layer.thickness_m,
    })),
    windows: {
      area_m2: params.windows.area_m2,
      kind: params.windows.kind,
    },
    vents: {
      open: params.vents.open,
    },
    occupants: Math.round(params.occupants),
    setpoint_c:
      params.hvac?.mode === "setpoint" && params.hvac.setpoint_c !== null
        ? params.hvac.setpoint_c
        : null,
  };

  const comfortBand: ComfortBand =
    params.hvac?.comfort_band ?? DEFAULT_COMFORT_BAND;

  const t_in_initial_c =
    params.hvac?.mode === "floating" && params.hvac.t_in_initial_c !== null
      ? params.hvac.t_in_initial_c
      : null;

  return {
    location: locationConfig,
    shelter: shelterConfig,
    comfort_band: comfortBand,
    t_in_initial_c,
  };
}

export async function simulateShelter(
  request: SimulationRequest
): Promise<SimulationResponse> {
  const url = `${getApiBaseUrl()}/api/simulate`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    cache: "no-store",
  });

  if (!response.ok) {
    let errorMessage = `Simulation request failed with HTTP ${response.status}.`;
    try {
      const errPayload = await response.json();
      if (errPayload.error?.message) {
        errorMessage = errPayload.error.message;
      } else if (errPayload.detail) {
        errorMessage =
          typeof errPayload.detail === "string"
            ? errPayload.detail
            : JSON.stringify(errPayload.detail);
      }
    } catch {
      // Fall back to default error message
    }
    throw new Error(errorMessage);
  }

  return response.json() as Promise<SimulationResponse>;
}



