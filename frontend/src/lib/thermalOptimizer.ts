/**
 * Explainable Thermal Design Optimizer (Stage 10)
 * 
 * Implements a deterministic, explainable single-parameter candidate search engine.
 * Generates a bounded space of feasible design candidates (max 12), evaluates them
 * sequentially against the authoritative FastAPI backend endpoint (POST /api/simulate),
 * scores them via transparent engineering metrics, and produces explainable rankings.
 * 
 * IMPORTANT:
 * Objective weights (60% comfort, 30% HVAC demand, 10% design change magnitude)
 * are PRODUCT DESIGN PARAMETERS, NOT PHYSICAL LAWS OR DRDO STATUTORY STANDARDS.
 * 
 * The optimizer searches a bounded set of deterministic, single-parameter interventions
 * and recommends the best-performing evaluated candidate. It does not guarantee a global optimum.
 */

import type {
  MaterialLayer,
  SimulationResponse,
} from "./api";
import { serializeSimulationRequest, simulateShelter } from "./api";
import type { ShelterFullConfiguration } from "./thermalFixes";

export interface OptimizationWeights {
  comfortWeight: number; // default: 0.60
  hvacWeight: number;    // default: 0.30
  changeWeight: number;  // default: 0.10
}

export const DEFAULT_OPTIMIZATION_WEIGHTS: OptimizationWeights = {
  comfortWeight: 0.60,
  hvacWeight: 0.30,
  changeWeight: 0.10,
};

export type CandidateType =
  | "wall_insulation_25mm"
  | "wall_insulation_50mm"
  | "roof_insulation_25mm"
  | "roof_insulation_50mm"
  | "glazing_reduce_20"
  | "glazing_reduce_40"
  | "ventilation_close"
  | "hvac_setpoint_22c";

export interface OptimizationCandidate {
  id: string;
  type: CandidateType;
  title: string;
  category: "envelope_wall" | "envelope_roof" | "glazing" | "ventilation" | "hvac";
  description: string;
  parameterName: string;
  baselineValueDisplay: string;
  proposedValueDisplay: string;
  normalizedChangeMagnitude: number; // 0.0 to 1.0 (smaller = less disruptive)
  applyModification: (baseline: ShelterFullConfiguration) => ShelterFullConfiguration;
  feasibilityCheck: (baseline: ShelterFullConfiguration) => { isFeasible: boolean; reason?: string };
}

export interface OptimizationMetrics {
  comfortPct: number;
  hoursInBand: number;
  hoursOutside: number;
  peakHeatingW: number;
  peakCoolingW: number;
  peakTotalHvacW: number;
  minIndoorTempC: number;
  maxIndoorTempC: number;
  // Deltas vs baseline
  comfortDeltaPercentagePoints: number;
  hoursOutsideDelta: number;
  peakHeatingDeltaW: number;
  peakCoolingDeltaW: number;
  peakTotalHvacDeltaW: number;
}

export interface OptimizationScore {
  comfortScore: number;  // 0.0 to 1.0
  hvacScore: number;     // 0.0 to 1.0
  changeScore: number;   // 0.0 to 1.0
  totalScore: number;    // 0.0 to 1.0 (weighted composite)
  isMeaningfulImprovement: boolean;
}

export interface OptimizationResult {
  candidate: OptimizationCandidate;
  simulationResponse: SimulationResponse | null;
  metrics: OptimizationMetrics | null;
  score: OptimizationScore | null;
  rank: number;
  status: "recommended" | "evaluated" | "rejected" | "failed";
  statusReason?: string;
  explanation: string;
}

export interface OptimizationRun {
  baselineConfig: ShelterFullConfiguration;
  baselineResponse: SimulationResponse;
  baselineMetrics: OptimizationMetrics;
  results: OptimizationResult[];
  recommendedResult: OptimizationResult | null;
  objectiveWeights: OptimizationWeights;
  totalCandidateCount: number;
  completedCount: number;
  failedCount: number;
  isCompleted: boolean;
  runAt: string;
}

/**
 * Generates the bounded set of deterministic candidate interventions (max 12).
 */
export function generateOptimizationCandidates(
  baselineConfig: ShelterFullConfiguration
): OptimizationCandidate[] {
  const candidates: OptimizationCandidate[] = [];
  const { wallLayers, roofLayers, windows, vents, hvac } = baselineConfig;

  // 1. Wall Insulation +25mm
  if (wallLayers && wallLayers.length > 0) {
    const targetIdx = findPrimaryInsulationLayerIndex(wallLayers);
    const targetLayer = wallLayers[targetIdx];
    const currMm = Math.round(targetLayer.thickness_m * 1000);
    const propMm = currMm + 25;

    candidates.push({
      id: "wall_insulation_25mm",
      type: "wall_insulation_25mm",
      title: "Wall Insulation (+25 mm)",
      category: "envelope_wall",
      description: `Increase wall insulation thickness from ${currMm} mm to ${propMm} mm (+25 mm).`,
      parameterName: "Wall Core Insulation",
      baselineValueDisplay: `${currMm} mm`,
      proposedValueDisplay: `${propMm} mm (+25 mm)`,
      normalizedChangeMagnitude: 0.15,
      applyModification: (baseline) => {
        const cloned = baseline.wallLayers.map((l, i) =>
          i === targetIdx ? { ...l, thickness_m: l.thickness_m + 0.025 } : { ...l }
        );
        return { ...baseline, wallLayers: cloned };
      },
      feasibilityCheck: (baseline) => {
        if (!baseline.wallLayers || baseline.wallLayers.length === 0) {
          return { isFeasible: false, reason: "No wall assembly configured." };
        }
        return { isFeasible: true };
      },
    });

    // 2. Wall Insulation +50mm
    const propMm50 = currMm + 50;
    candidates.push({
      id: "wall_insulation_50mm",
      type: "wall_insulation_50mm",
      title: "Wall Insulation (+50 mm)",
      category: "envelope_wall",
      description: `Increase wall insulation thickness from ${currMm} mm to ${propMm50} mm (+50 mm).`,
      parameterName: "Wall Core Insulation",
      baselineValueDisplay: `${currMm} mm`,
      proposedValueDisplay: `${propMm50} mm (+50 mm)`,
      normalizedChangeMagnitude: 0.30,
      applyModification: (baseline) => {
        const cloned = baseline.wallLayers.map((l, i) =>
          i === targetIdx ? { ...l, thickness_m: l.thickness_m + 0.05 } : { ...l }
        );
        return { ...baseline, wallLayers: cloned };
      },
      feasibilityCheck: (baseline) => {
        if (!baseline.wallLayers || baseline.wallLayers.length === 0) {
          return { isFeasible: false, reason: "No wall assembly configured." };
        }
        return { isFeasible: true };
      },
    });
  }

  // 3. Roof Insulation +25mm
  if (roofLayers && roofLayers.length > 0) {
    const targetIdx = findPrimaryInsulationLayerIndex(roofLayers);
    const targetLayer = roofLayers[targetIdx];
    const currMm = Math.round(targetLayer.thickness_m * 1000);
    const propMm = currMm + 25;

    candidates.push({
      id: "roof_insulation_25mm",
      type: "roof_insulation_25mm",
      title: "Roof Insulation (+25 mm)",
      category: "envelope_roof",
      description: `Increase roof insulation thickness from ${currMm} mm to ${propMm} mm (+25 mm).`,
      parameterName: "Roof Core Insulation",
      baselineValueDisplay: `${currMm} mm`,
      proposedValueDisplay: `${propMm} mm (+25 mm)`,
      normalizedChangeMagnitude: 0.15,
      applyModification: (baseline) => {
        const cloned = baseline.roofLayers.map((l, i) =>
          i === targetIdx ? { ...l, thickness_m: l.thickness_m + 0.025 } : { ...l }
        );
        return { ...baseline, roofLayers: cloned };
      },
      feasibilityCheck: (baseline) => {
        if (!baseline.roofLayers || baseline.roofLayers.length === 0) {
          return { isFeasible: false, reason: "No roof assembly configured." };
        }
        return { isFeasible: true };
      },
    });

    // 4. Roof Insulation +50mm
    const propMm50 = currMm + 50;
    candidates.push({
      id: "roof_insulation_50mm",
      type: "roof_insulation_50mm",
      title: "Roof Insulation (+50 mm)",
      category: "envelope_roof",
      description: `Increase roof insulation thickness from ${currMm} mm to ${propMm50} mm (+50 mm).`,
      parameterName: "Roof Core Insulation",
      baselineValueDisplay: `${currMm} mm`,
      proposedValueDisplay: `${propMm50} mm (+50 mm)`,
      normalizedChangeMagnitude: 0.30,
      applyModification: (baseline) => {
        const cloned = baseline.roofLayers.map((l, i) =>
          i === targetIdx ? { ...l, thickness_m: l.thickness_m + 0.05 } : { ...l }
        );
        return { ...baseline, roofLayers: cloned };
      },
      feasibilityCheck: (baseline) => {
        if (!baseline.roofLayers || baseline.roofLayers.length === 0) {
          return { isFeasible: false, reason: "No roof assembly configured." };
        }
        return { isFeasible: true };
      },
    });
  }

  // 5. Glazing -20%
  if (windows && windows.area_m2 > 0.5) {
    const currArea = windows.area_m2;
    const propArea20 = Math.max(0.2, Math.round(currArea * 0.8 * 10) / 10);
    if (propArea20 < currArea) {
      candidates.push({
        id: "glazing_reduce_20",
        type: "glazing_reduce_20",
        title: "Reduce Glazing (-20%)",
        category: "glazing",
        description: `Reduce total window glazing area from ${currArea.toFixed(1)} m² to ${propArea20.toFixed(1)} m² (-20%).`,
        parameterName: "Window Glazing Area",
        baselineValueDisplay: `${currArea.toFixed(1)} m²`,
        proposedValueDisplay: `${propArea20.toFixed(1)} m² (-20%)`,
        normalizedChangeMagnitude: 0.20,
        applyModification: (baseline) => ({
          ...baseline,
          windows: baseline.windows ? { ...baseline.windows, area_m2: propArea20 } : null,
        }),
        feasibilityCheck: (baseline) => {
          if (!baseline.windows || baseline.windows.area_m2 <= 0.2) {
            return { isFeasible: false, reason: "Window area too small to reduce." };
          }
          return { isFeasible: true };
        },
      });
    }

    // 6. Glazing -40%
    const propArea40 = Math.max(0.2, Math.round(currArea * 0.6 * 10) / 10);
    if (propArea40 < currArea && propArea40 !== propArea20) {
      candidates.push({
        id: "glazing_reduce_40",
        type: "glazing_reduce_40",
        title: "Reduce Glazing (-40%)",
        category: "glazing",
        description: `Reduce total window glazing area from ${currArea.toFixed(1)} m² to ${propArea40.toFixed(1)} m² (-40%).`,
        parameterName: "Window Glazing Area",
        baselineValueDisplay: `${currArea.toFixed(1)} m²`,
        proposedValueDisplay: `${propArea40.toFixed(1)} m² (-40%)`,
        normalizedChangeMagnitude: 0.40,
        applyModification: (baseline) => ({
          ...baseline,
          windows: baseline.windows ? { ...baseline.windows, area_m2: propArea40 } : null,
        }),
        feasibilityCheck: (baseline) => {
          if (!baseline.windows || baseline.windows.area_m2 <= 0.4) {
            return { isFeasible: false, reason: "Window area too small to reduce by 40%." };
          }
          return { isFeasible: true };
        },
      });
    }
  }

  // 7. Ventilation State (Close Vents if currently open)
  if (vents && vents.open === true) {
    candidates.push({
      id: "ventilation_close",
      type: "ventilation_close",
      title: "Close Ventilation Openings",
      category: "ventilation",
      description: "Switch natural ventilation from Open (ACH 5.0) to Closed (Infiltration ACH 0.5).",
      parameterName: "Ventilation Aperture State",
      baselineValueDisplay: "Open (ACH = 5.0 h⁻¹)",
      proposedValueDisplay: "Closed (ACH = 0.5 h⁻¹)",
      normalizedChangeMagnitude: 0.10,
      applyModification: (baseline) => ({
        ...baseline,
        vents: { open: false },
      }),
      feasibilityCheck: (baseline) => {
        if (!baseline.vents || baseline.vents.open === false) {
          return { isFeasible: false, reason: "Ventilation is already closed in baseline." };
        }
        return { isFeasible: true };
      },
    });
  }

  // 8. HVAC Setpoint Activation (If currently in passive floating mode)
  if (hvac && hvac.mode === "floating") {
    const targetSetpoint = 22.0;
    candidates.push({
      id: "hvac_setpoint_22c",
      type: "hvac_setpoint_22c",
      title: "Activate HVAC Setpoint (22.0°C)",
      category: "hvac",
      description: `Switch operational mode from passive thermal drift to active heating/cooling setpoint held at ${targetSetpoint.toFixed(1)}°C.`,
      parameterName: "Operational HVAC Mode",
      baselineValueDisplay: "Passive Floating Drift (0 W HVAC)",
      proposedValueDisplay: `Active Setpoint (${targetSetpoint.toFixed(1)}°C)`,
      normalizedChangeMagnitude: 0.45,
      applyModification: (baseline) => ({
        ...baseline,
        hvac: {
          mode: "setpoint",
          setpoint_c: targetSetpoint,
          t_in_initial_c: null,
          comfort_band: baseline.hvac?.comfort_band ?? { t_low_c: 18.0, t_high_c: 26.0 },
        },
      }),
      feasibilityCheck: (baseline) => {
        if (baseline.hvac?.mode === "setpoint") {
          return { isFeasible: false, reason: "Active setpoint mode is already active." };
        }
        return { isFeasible: true };
      },
    });
  }

  // Strictly enforce maximum 12 candidates
  return candidates.slice(0, 12);
}

/**
 * Finds primary insulation layer index in an envelope assembly.
 */
function findPrimaryInsulationLayerIndex(layers: MaterialLayer[]): number {
  if (layers.length === 0) return 0;
  const insulationIds = ["puf_panel", "glass_wool", "eps_insulation", "mineral_wool"];
  for (let i = 0; i < layers.length; i++) {
    if (insulationIds.includes(layers[i].material_id.toLowerCase())) {
      return i;
    }
  }
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
 * Extracts normalized performance metrics from a SimulationResponse.
 */
export function extractSimulationMetrics(
  response: SimulationResponse,
  baselineMetrics?: OptimizationMetrics
): OptimizationMetrics {
  const comfortPct = response.comfort?.comfort_pct ?? 0;
  const hoursInBand = response.comfort?.hours_in_band ?? 0;
  const totalHours = response.comfort?.total_hours ?? 24;
  const hoursOutside = Math.max(0, totalHours - hoursInBand);

  const peakHeatingW = response.hvac_summary?.peak_heating_w ?? 0;
  const peakCoolingW = response.hvac_summary?.peak_cooling_w ?? 0;
  const peakTotalHvacW = peakHeatingW + peakCoolingW;

  const hourly = response.hourly ?? [];
  const minIndoorTempC = hourly.length > 0 ? Math.min(...hourly.map((h) => h.t_in_c)) : 0;
  const maxIndoorTempC = hourly.length > 0 ? Math.max(...hourly.map((h) => h.t_in_c)) : 0;

  let comfortDeltaPercentagePoints = 0;
  let hoursOutsideDelta = 0;
  let peakHeatingDeltaW = 0;
  let peakCoolingDeltaW = 0;
  let peakTotalHvacDeltaW = 0;

  if (baselineMetrics) {
    comfortDeltaPercentagePoints =
      Math.round((comfortPct - baselineMetrics.comfortPct) * 10) / 10;
    hoursOutsideDelta = hoursOutside - baselineMetrics.hoursOutside;
    peakHeatingDeltaW = Math.round((peakHeatingW - baselineMetrics.peakHeatingW) * 10) / 10;
    peakCoolingDeltaW = Math.round((peakCoolingW - baselineMetrics.peakCoolingW) * 10) / 10;
    peakTotalHvacDeltaW =
      Math.round((peakTotalHvacW - baselineMetrics.peakTotalHvacW) * 10) / 10;
  }

  return {
    comfortPct: Math.round(comfortPct * 10) / 10,
    hoursInBand,
    hoursOutside,
    peakHeatingW: Math.round(peakHeatingW * 10) / 10,
    peakCoolingW: Math.round(peakCoolingW * 10) / 10,
    peakTotalHvacW: Math.round(peakTotalHvacW * 10) / 10,
    minIndoorTempC: Math.round(minIndoorTempC * 10) / 10,
    maxIndoorTempC: Math.round(maxIndoorTempC * 10) / 10,
    comfortDeltaPercentagePoints,
    hoursOutsideDelta,
    peakHeatingDeltaW,
    peakCoolingDeltaW,
    peakTotalHvacDeltaW,
  };
}

/**
 * Computes transparent, deterministic scores for a candidate against baseline.
 */
export function calculateOptimizationScore(
  candidateMetrics: OptimizationMetrics,
  baselineMetrics: OptimizationMetrics,
  normalizedChangeMagnitude: number,
  weights: OptimizationWeights = DEFAULT_OPTIMIZATION_WEIGHTS
): OptimizationScore {
  // 1. Comfort Score (0.0 to 1.0): Direct percentage of hours in comfort band
  const comfortScore = Math.min(1.0, Math.max(0.0, candidateMetrics.comfortPct / 100));

  // 2. HVAC Score (0.0 to 1.0): Rewards low HVAC plant demand
  let hvacScore = 1.0;
  if (baselineMetrics.peakTotalHvacW > 0) {
    // Baseline has non-zero HVAC load -> score reflects reduction
    hvacScore = Math.max(
      0.0,
      1.0 - Math.min(1.0, candidateMetrics.peakTotalHvacW / baselineMetrics.peakTotalHvacW)
    );
  } else {
    // Baseline is passive (0 W HVAC).
    if (candidateMetrics.peakTotalHvacW === 0) {
      hvacScore = 1.0; // Pure passive candidate with 0 active energy
    } else {
      // Candidate introduces active HVAC demand; penalize added mechanical holding load safely (scale: 3000 W reference)
      hvacScore = Math.max(0.0, 1.0 - Math.min(1.0, candidateMetrics.peakTotalHvacW / 3000.0));
    }
  }

  // 3. Design Change Magnitude Score (0.0 to 1.0): Prefers less disruptive interventions
  const changeScore = Math.max(0.0, 1.0 - Math.min(1.0, normalizedChangeMagnitude));

  // 4. Weighted Composite Total Score
  const totalScore =
    weights.comfortWeight * comfortScore +
    weights.hvacWeight * hvacScore +
    weights.changeWeight * changeScore;

  // 5. Meaningful Improvement Detection
  // Candidate must either:
  // (a) improve comfort percentage points by >= 2.0 or reduce discomfort hours, OR
  // (b) maintain identical comfort while reducing peak HVAC by >= 100 W.
  const isMeaningfulImprovement =
    candidateMetrics.comfortDeltaPercentagePoints >= 2.0 ||
    candidateMetrics.hoursOutsideDelta < 0 ||
    (candidateMetrics.comfortDeltaPercentagePoints >= 0 &&
      candidateMetrics.peakTotalHvacDeltaW <= -100);

  return {
    comfortScore: Math.round(comfortScore * 1000) / 1000,
    hvacScore: Math.round(hvacScore * 1000) / 1000,
    changeScore: Math.round(changeScore * 1000) / 1000,
    totalScore: Math.round(totalScore * 1000) / 1000,
    isMeaningfulImprovement,
  };
}

/**
 * Generates an explainable synthesis statement for an evaluated candidate.
 */
export function generateCandidateExplanation(
  candidate: OptimizationCandidate,
  metrics: OptimizationMetrics,
  baselineMetrics: OptimizationMetrics,
  score: OptimizationScore,
  isRecommended: boolean
): string {
  const comfortDelta = metrics.comfortDeltaPercentagePoints;
  const hoursSaved = Math.abs(metrics.hoursOutsideDelta);
  const hvacDelta = metrics.peakTotalHvacDeltaW;

  if (isRecommended) {
    let rationale = `"${candidate.title}" ranked first with an optimization score of ${score.totalScore.toFixed(3)}. `;
    if (comfortDelta > 0) {
      rationale += `It increased simulated thermal comfort by +${comfortDelta.toFixed(1)} percentage points (${baselineMetrics.comfortPct.toFixed(1)}% → ${metrics.comfortPct.toFixed(1)}%), eliminating ${hoursSaved} hours of discomfort. `;
    } else {
      rationale += `It maintained ${metrics.comfortPct.toFixed(1)}% thermal comfort while minimizing active energy sizing demand. `;
    }

    if (hvacDelta < 0) {
      rationale += `Peak HVAC demand decreased by ${Math.abs(hvacDelta).toFixed(0)} W. `;
    } else if (hvacDelta > 0 && candidate.category === "hvac") {
      rationale += `Active mechanical conditioning requires ${metrics.peakTotalHvacW.toFixed(0)} W peak plant capacity to guarantee 100% comfort. `;
    }

    rationale += `Among the evaluated feasible single-parameter interventions, this design produced the strongest combined thermal and operational performance under the 60/30/10 objective weighting.`;
    return rationale;
  }

  if (score.isMeaningfulImprovement) {
    return `${candidate.title} improved simulated comfort from ${baselineMetrics.comfortPct.toFixed(1)}% to ${metrics.comfortPct.toFixed(1)}% (+${comfortDelta.toFixed(1)} percentage points, score: ${score.totalScore.toFixed(3)}).`;
  }

  return `${candidate.title} yielded minimal or negligible improvement over baseline (Comfort: ${metrics.comfortPct.toFixed(1)}% vs ${baselineMetrics.comfortPct.toFixed(1)}%, score: ${score.totalScore.toFixed(3)}).`;
}

/**
 * Runs the complete optimization pipeline over the candidate space.
 * Calls the real backend simulation (POST /api/simulate) sequentially for each feasible candidate.
 */
export async function runThermalOptimization(
  baselineConfig: ShelterFullConfiguration,
  baselineResponse: SimulationResponse,
  weights: OptimizationWeights = DEFAULT_OPTIMIZATION_WEIGHTS,
  onProgress?: (completed: number, total: number, currentCandidateTitle: string) => void
): Promise<OptimizationRun> {
  const baselineMetrics = extractSimulationMetrics(baselineResponse);
  const candidates = generateOptimizationCandidates(baselineConfig);

  const rawResults: OptimizationResult[] = [];
  let completedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (onProgress) {
      onProgress(completedCount, candidates.length, candidate.title);
    }

    // 1. Feasibility Filter
    const check = candidate.feasibilityCheck(baselineConfig);
    if (!check.isFeasible) {
      rawResults.push({
        candidate,
        simulationResponse: null,
        metrics: null,
        score: null,
        rank: 999,
        status: "rejected",
        statusReason: check.reason ?? "Infeasible configuration parameter.",
        explanation: `${candidate.title} was filtered out as infeasible: ${check.reason}`,
      });
      continue;
    }

    // 2. Real Backend Simulation (POST /api/simulate)
    try {
      const modifiedConfig = candidate.applyModification(baselineConfig);
      const request = serializeSimulationRequest(modifiedConfig);
      const candidateResponse = await simulateShelter(request);

      // 3. Performance Metrics & Scoring
      const metrics = extractSimulationMetrics(candidateResponse, baselineMetrics);
      const score = calculateOptimizationScore(
        metrics,
        baselineMetrics,
        candidate.normalizedChangeMagnitude,
        weights
      );

      rawResults.push({
        candidate,
        simulationResponse: candidateResponse,
        metrics,
        score,
        rank: 0,
        status: "evaluated",
        explanation: "",
      });
      completedCount++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Simulation request failed.";
      rawResults.push({
        candidate,
        simulationResponse: null,
        metrics: null,
        score: null,
        rank: 999,
        status: "failed",
        statusReason: msg,
        explanation: `Backend simulation failed for ${candidate.title}: ${msg}`,
      });
      failedCount++;
    }
  }

  // 4. Candidate Ranking
  // Sort evaluated candidates by totalScore descending
  const evaluatedResults = rawResults
    .filter((r) => r.status === "evaluated" && r.score !== null)
    .sort((a, b) => (b.score?.totalScore ?? 0) - (a.score?.totalScore ?? 0));

  // Determine recommendation
  let recommendedResult: OptimizationResult | null = null;
  const bestMeaningful = evaluatedResults.find((r) => r.score?.isMeaningfulImprovement === true);

  if (bestMeaningful) {
    recommendedResult = bestMeaningful;
    bestMeaningful.status = "recommended";
  }

  // Assign ranks & generate explanations
  let currentRank = 1;
  for (const res of evaluatedResults) {
    res.rank = currentRank++;
    const isRec = res === recommendedResult;
    if (res.metrics && res.score) {
      res.explanation = generateCandidateExplanation(
        res.candidate,
        res.metrics,
        baselineMetrics,
        res.score,
        isRec
      );
    }
  }

  // Append rejected/failed at the bottom
  const finalResults = [
    ...evaluatedResults,
    ...rawResults.filter((r) => r.status === "rejected" || r.status === "failed"),
  ];

  if (onProgress) {
    onProgress(candidates.length, candidates.length, "Optimization Complete");
  }

  return {
    baselineConfig,
    baselineResponse,
    baselineMetrics,
    results: finalResults,
    recommendedResult,
    objectiveWeights: weights,
    totalCandidateCount: candidates.length,
    completedCount,
    failedCount,
    isCompleted: true,
    runAt: new Date().toISOString(),
  };
}
