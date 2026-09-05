/**
 * Thermal Failure Intervention & Candidate Evaluation Engine (Stage 9)
 * 
 * Generates deterministic, feasible single-parameter design interventions when a
 * thermal comfort failure is detected. Each candidate modification is evaluated
 * against the authoritative backend simulation endpoint (POST /api/simulate)
 * without duplicating physics in the frontend.
 * 
 * IMPORTANT:
 * Increment constants (+25 mm insulation, -20% glazing, vent toggling) are
 * PRODUCT-DESIGN SEARCH STEPS, NOT ENGINEERING STANDARDS OR DRDO CODES.
 */

import type {
  ComfortBand,
  HvacConfig,
  LocationPreset,
  MaterialLayer,
  ShelterGeometry,
  SimulationRequest,
  SimulationResponse,
  VentConfig,
  WindowConfig,
} from "./api.ts";
import { serializeSimulationRequest, simulateShelter } from "./api.ts";
import type { ThermalDiagnosis } from "./thermalDiagnosis.ts";

export type ThermalFixType =
  | "increase_wall_insulation"
  | "increase_roof_insulation"
  | "reduce_glazing"
  | "reduce_ventilation"
  | "adjust_setpoint";

export interface ShelterFullConfiguration {
  location: { lat: number; lon: number; preset: LocationPreset | null } | null;
  geometry: ShelterGeometry | null;
  wallLayers: MaterialLayer[];
  roofLayers: MaterialLayer[];
  windows: WindowConfig | null;
  vents: VentConfig | null;
  occupants: number | null;
  hvac: HvacConfig | null;
}

export interface ThermalFixCandidate {
  id: string;
  type: ThermalFixType;
  title: string;
  description: string;
  rationale: string;
  parameterName: string;
  currentValueDisplay: string;
  proposedValueDisplay: string;
  target: "wall" | "roof" | "windows" | "ventilation" | "hvac";
  targetLayerIndex?: number;
  applyModification: (baseline: ShelterFullConfiguration) => ShelterFullConfiguration;
  feasibility: {
    isFeasible: boolean;
    reason?: string;
  };
  priority: number;
}

export type FixOutcome = "improves" | "neutral" | "worsens";

export interface ThermalFixComparison {
  baselineComfortPct: number;
  candidateComfortPct: number;
  comfortDeltaPercentagePoints: number;
  baselineHoursOutside: number;
  candidateHoursOutside: number;
  hoursOutsideDelta: number;
  baselinePeakHeatingW: number;
  candidatePeakHeatingW: number;
  peakHeatingDeltaW: number;
  baselinePeakCoolingW: number;
  candidatePeakCoolingW: number;
  peakCoolingDeltaW: number;
  baselinePeakIndoorTemp: number;
  candidatePeakIndoorTemp: number;
  baselineMinIndoorTemp: number;
  candidateMinIndoorTemp: number;
  outcome: FixOutcome;
  explanation: string;
}

export interface ThermalFixEvaluation {
  candidateId: string;
  candidate: ThermalFixCandidate;
  simulationResponse: SimulationResponse;
  comparison: ThermalFixComparison;
  evaluatedAt: string;
}

// Product search increments (clearly documented as search steps, not physics standards)
export const INSULATION_INCREMENT_M = 0.025; // +25 mm
export const GLAZING_REDUCTION_FACTOR = 0.80; // -20% area

/**
 * Generates deterministic, feasible single-parameter intervention candidates
 * based on the active Stage 8 diagnosis and shelter configuration.
 */
export function generateFeasibleFixCandidates(
  config: ShelterFullConfiguration | null,
  diagnosis: ThermalDiagnosis | null
): ThermalFixCandidate[] {
  if (!config || !diagnosis) {
    return [];
  }

  // If no thermal failure or warning (100% comfortable), design interventions are not required
  if (diagnosis.status === "good" || diagnosis.failureType === "none" || diagnosis.hoursOutsideComfort === 0) {
    return [];
  }

  const candidates: ThermalFixCandidate[] = [];
  const { wallLayers, roofLayers, windows, vents, hvac, geometry } = config;

  // Candidate 1: Increase Wall Insulation (+25mm)
  if (wallLayers && wallLayers.length > 0) {
    // Find insulation layer or thickest layer
    const targetIdx = findPrimaryInsulationLayerIndex(wallLayers);
    const targetLayer = wallLayers[targetIdx];
    const currentMm = Math.round(targetLayer.thickness_m * 1000);
    const proposedMm = currentMm + Math.round(INSULATION_INCREMENT_M * 1000);

    candidates.push({
      id: "increase_wall_insulation",
      type: "increase_wall_insulation",
      title: "Increase Wall Insulation",
      description: `Increase wall insulation thickness from ${currentMm} mm to ${proposedMm} mm (+25 mm).`,
      rationale:
        diagnosis.failureType === "overcooling"
          ? "Wall conduction is one of the dominant heat-loss mechanisms during cold night hours; adding thermal resistance retards indoor heat dissipation."
          : "Enhanced wall insulation reduces external conductive heat transfer into the structure during peak ambient hours.",
      parameterName: "Wall Core Insulation Thickness",
      currentValueDisplay: `${currentMm} mm`,
      proposedValueDisplay: `${proposedMm} mm (+25 mm)`,
      target: "wall",
      targetLayerIndex: targetIdx,
      applyModification: (baseline) => {
        const clonedLayers = baseline.wallLayers.map((l, i) =>
          i === targetIdx ? { ...l, thickness_m: l.thickness_m + INSULATION_INCREMENT_M } : { ...l }
        );
        return {
          ...baseline,
          wallLayers: clonedLayers,
        };
      },
      feasibility: {
        isFeasible: true,
      },
      priority: 1,
    });
  }

  // Candidate 2: Increase Roof Insulation (+25mm)
  if (roofLayers && roofLayers.length > 0) {
    const targetIdx = findPrimaryInsulationLayerIndex(roofLayers);
    const targetLayer = roofLayers[targetIdx];
    const currentMm = Math.round(targetLayer.thickness_m * 1000);
    const proposedMm = currentMm + Math.round(INSULATION_INCREMENT_M * 1000);

    candidates.push({
      id: "increase_roof_insulation",
      type: "increase_roof_insulation",
      title: "Increase Roof Insulation",
      description: `Increase roof insulation thickness from ${currentMm} mm to ${proposedMm} mm (+25 mm).`,
      rationale:
        "The roof structure experiences severe solar exposure and high diurnal temperature swings. Additional insulation reduces roof conductive flux.",
      parameterName: "Roof Core Insulation Thickness",
      currentValueDisplay: `${currentMm} mm`,
      proposedValueDisplay: `${proposedMm} mm (+25 mm)`,
      target: "roof",
      targetLayerIndex: targetIdx,
      applyModification: (baseline) => {
        const clonedLayers = baseline.roofLayers.map((l, i) =>
          i === targetIdx ? { ...l, thickness_m: l.thickness_m + INSULATION_INCREMENT_M } : { ...l }
        );
        return {
          ...baseline,
          roofLayers: clonedLayers,
        };
      },
      feasibility: {
        isFeasible: true,
      },
      priority: 2,
    });
  }

  // Candidate 3: Reduce Glazing Aperture Area (-20%)
  if (windows && windows.area_m2 > 0.5) {
    const currentArea = windows.area_m2;
    const proposedArea = Math.max(0.2, Math.round(currentArea * GLAZING_REDUCTION_FACTOR * 10) / 10);
    const deltaArea = Math.round((currentArea - proposedArea) * 10) / 10;

    if (proposedArea < currentArea) {
      candidates.push({
        id: "reduce_glazing",
        type: "reduce_glazing",
        title: "Reduce Window Glazing Area",
        description: `Reduce total window area from ${currentArea.toFixed(1)} m² to ${proposedArea.toFixed(1)} m² (-20%).`,
        rationale:
          diagnosis.failureType === "overheating"
            ? "Glazing solar radiation is a major source of heat gain; reducing aperture area curbs direct shortwave solar infiltration."
            : "Window glass has higher thermal conductance than insulated assemblies; reducing glazed area decreases envelope conductive loss.",
        parameterName: "Total Glazing Area",
        currentValueDisplay: `${currentArea.toFixed(1)} m²`,
        proposedValueDisplay: `${proposedArea.toFixed(1)} m² (-${deltaArea.toFixed(1)} m²)`,
        target: "windows",
        applyModification: (baseline) => ({
          ...baseline,
          windows: baseline.windows ? { ...baseline.windows, area_m2: proposedArea } : null,
        }),
        feasibility: {
          isFeasible: true,
        },
        priority: 3,
      });
    }
  }

  // Candidate 4: Close Open Natural Ventilation (Only if currently open)
  if (vents && vents.open === true) {
    candidates.push({
      id: "reduce_ventilation",
      type: "reduce_ventilation",
      title: "Close Ventilation Openings",
      description: "Switch ventilation state from Open (ACH 5.0) to Closed (Infiltration ACH 0.5).",
      rationale:
        "Excessive outside air exchange rapidly pulls extreme ambient air into the shelter. Closing vents minimizes sensible convective heat exchange. Note: Operational fresh air requirements must be balanced separately.",
      parameterName: "Ventilation State",
      currentValueDisplay: "Open (ACH = 5.0 h⁻¹)",
      proposedValueDisplay: "Closed (ACH = 0.5 h⁻¹)",
      target: "ventilation",
      applyModification: (baseline) => ({
        ...baseline,
        vents: { open: false },
      }),
      feasibility: {
        isFeasible: true,
      },
      priority: 4,
    });
  }

  // Candidate 5: Introduce Active HVAC Setpoint Control (If currently in passive floating mode)
  if (hvac && hvac.mode === "floating") {
    const targetSetpoint = 22.0;
    candidates.push({
      id: "adjust_setpoint",
      type: "adjust_setpoint",
      title: "Activate HVAC Setpoint Control",
      description: `Switch from passive thermal drift to active heating/cooling setpoint control held at ${targetSetpoint.toFixed(1)}°C.`,
      rationale:
        "Passive envelope inertia is currently insufficient to prevent thermal comfort excursions in this climate. Active mechanical control will maintain indoor temperatures strictly within comfort limits.",
      parameterName: "Operational HVAC Mode",
      currentValueDisplay: "Passive Floating Drift (No HVAC)",
      proposedValueDisplay: `Active Setpoint Control (${targetSetpoint.toFixed(1)}°C)`,
      target: "hvac",
      applyModification: (baseline) => ({
        ...baseline,
        hvac: {
          mode: "setpoint",
          setpoint_c: targetSetpoint,
          t_in_initial_c: null,
          comfort_band: baseline.hvac?.comfort_band ?? { t_low_c: 18.0, t_high_c: 26.0 },
        },
      }),
      feasibility: {
        isFeasible: true,
      },
      priority: 5,
    });
  }

  // Sort candidates by priority
  return candidates.sort((a, b) => a.priority - b.priority);
}

/**
 * Finds the primary insulation layer index (e.g. PUF, glass wool, EPS, or lowest conductivity).
 */
function findPrimaryInsulationLayerIndex(layers: MaterialLayer[]): number {
  if (layers.length === 0) return 0;

  // Check known insulation IDs
  const insulationIds = ["puf_panel", "glass_wool", "eps_insulation", "mineral_wool"];
  for (let i = 0; i < layers.length; i++) {
    if (insulationIds.includes(layers[i].material_id.toLowerCase())) {
      return i;
    }
  }

  // Fallback: middle layer or thickest layer
  let maxIdx = 0;
  let maxThick = -1;
  for (let i = 0; i < layers.length; i++) {
    if (layers[i].thickness_m > maxThick) {
      maxThick = layers[i].thickness_m;
      maxIdx = i;
    }
  }
  return maxIdx;
}

/**
 * Evaluates a single candidate intervention by serializing the modified configuration
 * and executing POST /api/simulate with the real backend engine.
 */
export async function evaluateThermalFix(
  candidate: ThermalFixCandidate,
  baselineConfig: ShelterFullConfiguration,
  baselineResponse: SimulationResponse
): Promise<ThermalFixEvaluation> {
  // 1. Create modified configuration (deep clone, no mutation of baseline)
  const modifiedConfig = candidate.applyModification(baselineConfig);

  // 2. Serialize simulation request payload
  const request = serializeSimulationRequest(modifiedConfig);

  // 3. Call authoritative backend API
  const candidateResponse = await simulateShelter(request);

  // 4. Compare baseline vs candidate simulation outputs
  const comparison = compareSimulationResults(baselineResponse, candidateResponse, candidate);

  return {
    candidateId: candidate.id,
    candidate,
    simulationResponse: candidateResponse,
    comparison,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Computes transparent comparison metrics between baseline and candidate SimulationResponse.
 */
export function compareSimulationResults(
  baseline: SimulationResponse,
  candidate: SimulationResponse,
  candidateMeta?: { title?: string; description?: string }
): ThermalFixComparison {
  const baselineComfortPct = baseline.comfort?.comfort_pct ?? 0;
  const candidateComfortPct = candidate.comfort?.comfort_pct ?? 0;
  const comfortDeltaPercentagePoints =
    Math.round((candidateComfortPct - baselineComfortPct) * 10) / 10;

  const baselineHoursOutside =
    (baseline.comfort?.total_hours ?? 24) - (baseline.comfort?.hours_in_band ?? 0);
  const candidateHoursOutside =
    (candidate.comfort?.total_hours ?? 24) - (candidate.comfort?.hours_in_band ?? 0);
  const hoursOutsideDelta = candidateHoursOutside - baselineHoursOutside;

  const baselinePeakHeatingW = baseline.hvac_summary?.peak_heating_w ?? 0;
  const candidatePeakHeatingW = candidate.hvac_summary?.peak_heating_w ?? 0;
  const peakHeatingDeltaW =
    Math.round((candidatePeakHeatingW - baselinePeakHeatingW) * 10) / 10;

  const baselinePeakCoolingW = baseline.hvac_summary?.peak_cooling_w ?? 0;
  const candidatePeakCoolingW = candidate.hvac_summary?.peak_cooling_w ?? 0;
  const peakCoolingDeltaW =
    Math.round((candidatePeakCoolingW - baselinePeakCoolingW) * 10) / 10;

  const baselineHourly = baseline.hourly ?? [];
  const candidateHourly = candidate.hourly ?? [];

  const baselinePeakIndoorTemp =
    baselineHourly.length > 0 ? Math.max(...baselineHourly.map((h) => h.t_in_c)) : 0;
  const candidatePeakIndoorTemp =
    candidateHourly.length > 0 ? Math.max(...candidateHourly.map((h) => h.t_in_c)) : 0;

  const baselineMinIndoorTemp =
    baselineHourly.length > 0 ? Math.min(...baselineHourly.map((h) => h.t_in_c)) : 0;
  const candidateMinIndoorTemp =
    candidateHourly.length > 0 ? Math.min(...candidateHourly.map((h) => h.t_in_c)) : 0;

  // Determine outcome
  let outcome: FixOutcome = "neutral";
  if (comfortDeltaPercentagePoints >= 2.0 || (hoursOutsideDelta < 0 && comfortDeltaPercentagePoints >= 0)) {
    outcome = "improves";
  } else if (comfortDeltaPercentagePoints <= -2.0 || hoursOutsideDelta > 0) {
    outcome = "worsens";
  } else {
    // Check HVAC reduction if comfort remains identical
    if (peakHeatingDeltaW < -50 || peakCoolingDeltaW < -50) {
      outcome = "improves";
    } else if (peakHeatingDeltaW > 50 || peakCoolingDeltaW > 50) {
      outcome = "worsens";
    }
  }

  // Generate explainable engineering impact statement
  let explanation = "";
  const title = candidateMeta?.title ?? "The proposed modification";

  if (outcome === "improves") {
    if (comfortDeltaPercentagePoints > 0) {
      explanation = `${title} improved simulated thermal comfort from ${baselineComfortPct.toFixed(
        1
      )}% to ${candidateComfortPct.toFixed(1)}% (+${comfortDeltaPercentagePoints.toFixed(
        1
      )} percentage points), reducing discomfort duration by ${Math.abs(hoursOutsideDelta)} hours.`;
    } else {
      explanation = `${title} maintained ${candidateComfortPct.toFixed(
        1
      )}% comfort while reducing peak HVAC plant sizing demand.`;
    }
  } else if (outcome === "worsens") {
    explanation = `${title} degraded simulated thermal performance, shifting comfort from ${baselineComfortPct.toFixed(
      1
    )}% to ${candidateComfortPct.toFixed(1)}% (${comfortDeltaPercentagePoints.toFixed(
      1
    )} percentage points) with ${candidateHoursOutside} hours outside comfort limits.`;
  } else {
    explanation = `${title} produced no meaningful change in simulated thermal comfort (${baselineComfortPct.toFixed(
      1
    )}% vs ${candidateComfortPct.toFixed(1)}%).`;
  }

  return {
    baselineComfortPct: Math.round(baselineComfortPct * 10) / 10,
    candidateComfortPct: Math.round(candidateComfortPct * 10) / 10,
    comfortDeltaPercentagePoints,
    baselineHoursOutside,
    candidateHoursOutside,
    hoursOutsideDelta,
    baselinePeakHeatingW: Math.round(baselinePeakHeatingW * 10) / 10,
    candidatePeakHeatingW: Math.round(candidatePeakHeatingW * 10) / 10,
    peakHeatingDeltaW,
    baselinePeakCoolingW: Math.round(baselinePeakCoolingW * 10) / 10,
    candidatePeakCoolingW: Math.round(candidatePeakCoolingW * 10) / 10,
    peakCoolingDeltaW,
    baselinePeakIndoorTemp: Math.round(baselinePeakIndoorTemp * 10) / 10,
    candidatePeakIndoorTemp: Math.round(candidatePeakIndoorTemp * 10) / 10,
    baselineMinIndoorTemp: Math.round(baselineMinIndoorTemp * 10) / 10,
    candidateMinIndoorTemp: Math.round(candidateMinIndoorTemp * 10) / 10,
    outcome,
    explanation,
  };
}
