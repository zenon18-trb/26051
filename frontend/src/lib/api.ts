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
