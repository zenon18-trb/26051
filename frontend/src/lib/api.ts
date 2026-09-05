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



