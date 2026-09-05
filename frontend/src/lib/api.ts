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
