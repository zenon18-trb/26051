import { z } from "zod";
import type {
  ClimateResponse,
  HvacConfig,
  MaterialLayer,
  ShelterGeometry,
  SimulationResponse,
  VentConfig,
  WindowConfig,
} from "@/lib/api";
import type { SelectedLocation } from "@/context/ShelterConfigurationContext";

export type ProjectSnapshot = {
  lastActiveItem?: string;
  location: SelectedLocation | null;
  climate: ClimateResponse | null;
  geometry: ShelterGeometry | null;
  wallLayers: MaterialLayer[];
  roofLayers: MaterialLayer[];
  windows: WindowConfig | null;
  vents: VentConfig | null;
  occupants: number | null;
  hvac: HvacConfig | null;
  simulationResult: SimulationResponse | null;
};

export type Project = {
  id: string;
  name: string;
  schemaVersion: number;
  configuration: ProjectSnapshot;
  createdAt: string;
  updatedAt: string;
};

const jsonObject = z.object({}).passthrough();

export const projectSnapshotSchema = z.object({
  lastActiveItem: z.string().min(1).max(80).optional(),
  location: jsonObject.nullable(),
  climate: jsonObject.nullable(),
  geometry: jsonObject.nullable(),
  wallLayers: z.array(jsonObject),
  roofLayers: z.array(jsonObject),
  windows: jsonObject.nullable(),
  vents: jsonObject.nullable(),
  occupants: z.number().int().nonnegative().nullable(),
  hvac: jsonObject.nullable(),
  simulationResult: jsonObject.nullable(),
});

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "A project name is required.").max(120),
  configuration: projectSnapshotSchema,
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  lastActiveItem: z.string().trim().min(1).max(80).optional(),
}).refine(
  (value) => value.name !== undefined || value.configuration !== undefined || value.lastActiveItem !== undefined,
  "Provide a name or configuration to update.",
);

type ApiProject = {
  id: string;
  name: string;
  schema_version: number;
  configuration: ProjectSnapshot;
  created_at: string;
  updated_at: string;
};

export function toProject(row: ApiProject): Project {
  return {
    id: row.id,
    name: row.name,
    schemaVersion: row.schema_version,
    configuration: row.configuration,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
