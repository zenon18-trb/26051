/**
 * Thermal Failure Detection & Explainable Diagnosis Engine
 * 
 * Evaluates simulation outputs deterministically against the user-defined comfort band.
 * 
 * IMPORTANT:
 * The severity thresholds (Good: 0h, Warning: 1-25% hours, Critical: >25% hours)
 * are PRODUCT DIAGNOSTIC THRESHOLDS, NOT PHYSICS LAWS OR DRDO STANDARDS.
 * 
 * All diagnosis metrics and contributor rankings are derived directly from the
 * authoritative SimulationResponse from POST /api/simulate without client-side
 * physics approximation or AI/LLM generation.
 */

import type { SimulationResponse, HourlySimulationPoint, ComfortBand } from "./api";

export type ThermalSeverity = "good" | "warning" | "critical";

export type ThermalFailureType = "none" | "overheating" | "overcooling" | "mixed";

export interface ThermalContributor {
  id: string;
  name: string;
  signed_w: number;
  magnitude_w: number;
  peak_hour_iso: string;
  direction: "entering" | "leaving" | "neutral";
  meaning: string;
  evidence: string;
}

export interface HourlyAssessment {
  timestamp: string;
  hour_label: string;
  t_out_c: number;
  t_in_c: number;
  status: "comfortable" | "overheating" | "overcooling";
  deviation_k: number;
}

export interface ThermalDiagnosis {
  status: ThermalSeverity;
  failureType: ThermalFailureType;
  headline: string;
  summary: string;
  comfortPercent: number;
  hoursInComfort: number;
  totalHours: number;
  hoursOutsideComfort: number;
  overheatingHours: number;
  overcoolingHours: number;
  peakIndoorTemperature: number;
  peakIndoorTemperatureHour: string;
  minimumIndoorTemperature: number;
  minimumIndoorTemperatureHour: string;
  peakHotDeviation: number;
  peakColdDeviation: number;
  comfortBand: ComfortBand;
  hourlyAssessments: HourlyAssessment[];
  contributors: ThermalContributor[];
  explanation: string;
  evidence: string[];
}

function formatHour(isoString: string): string {
  try {
    if (isoString.includes("T")) {
      return isoString.split("T")[1].slice(0, 5);
    }
    return isoString.slice(11, 16) || isoString;
  } catch {
    return isoString;
  }
}

/**
 * Deterministically analyzes simulation results to detect comfort failures
 * and rank likely physical heat-flow contributors.
 */
export function diagnoseThermalPerformance(
  simulationResult: SimulationResponse | null,
  overrideComfortBand?: ComfortBand
): ThermalDiagnosis | null {
  if (!simulationResult || !simulationResult.hourly || simulationResult.hourly.length === 0) {
    return null;
  }

  const { hourly, comfort, mode } = simulationResult;
  const comfortBand: ComfortBand = overrideComfortBand ?? {
    t_low_c: comfort?.t_low_c ?? 18.0,
    t_high_c: comfort?.t_high_c ?? 26.0,
  };

  const totalHours = hourly.length;
  let overheatingHours = 0;
  let overcoolingHours = 0;
  let hoursInComfort = 0;

  let peakIndoorTemperature = -Infinity;
  let peakIndoorTemperatureHour = hourly[0].timestamp;
  let minimumIndoorTemperature = Infinity;
  let minimumIndoorTemperatureHour = hourly[0].timestamp;

  let maxHotDeviation = 0;
  let maxColdDeviation = 0;

  const hourlyAssessments: HourlyAssessment[] = [];

  // 1. Hourly Evaluation
  for (const point of hourly) {
    const t_in = point.t_in_c;
    const t_out = point.t_out_c;

    if (t_in > peakIndoorTemperature) {
      peakIndoorTemperature = t_in;
      peakIndoorTemperatureHour = point.timestamp;
    }
    if (t_in < minimumIndoorTemperature) {
      minimumIndoorTemperature = t_in;
      minimumIndoorTemperatureHour = point.timestamp;
    }

    let status: "comfortable" | "overheating" | "overcooling" = "comfortable";
    let deviation_k = 0;

    if (t_in > comfortBand.t_high_c) {
      status = "overheating";
      overheatingHours++;
      deviation_k = t_in - comfortBand.t_high_c;
      if (deviation_k > maxHotDeviation) {
        maxHotDeviation = deviation_k;
      }
    } else if (t_in < comfortBand.t_low_c) {
      status = "overcooling";
      overcoolingHours++;
      deviation_k = comfortBand.t_low_c - t_in;
      if (deviation_k > maxColdDeviation) {
        maxColdDeviation = deviation_k;
      }
    } else {
      hoursInComfort++;
    }

    hourlyAssessments.push({
      timestamp: point.timestamp,
      hour_label: formatHour(point.timestamp),
      t_out_c: t_out,
      t_in_c: t_in,
      status,
      deviation_k: Math.round(deviation_k * 100) / 100,
    });
  }

  const hoursOutsideComfort = overheatingHours + overcoolingHours;
  
  // Use authoritative comfort percentage from backend when available and consistent
  const calculatedComfortPct = totalHours > 0 ? (hoursInComfort / totalHours) * 100 : 0;
  const comfortPercent = comfort?.comfort_pct !== undefined ? comfort.comfort_pct : calculatedComfortPct;

  const peakHotDeviation = comfort?.peak_deviation_above_k !== undefined ? comfort.peak_deviation_above_k : Math.round(maxHotDeviation * 100) / 100;
  const peakColdDeviation = comfort?.peak_deviation_below_k !== undefined ? comfort.peak_deviation_below_k : Math.round(maxColdDeviation * 100) / 100;

  // 2. Determine Severity
  // PRODUCT DIAGNOSTIC THRESHOLDS:
  // Good: 0 hours outside comfort (100% comfort)
  // Warning: 1 to 25% of hours outside comfort
  // Critical: > 25% of hours outside comfort
  let status: ThermalSeverity = "good";
  const fractionOutside = totalHours > 0 ? hoursOutsideComfort / totalHours : 0;

  if (hoursOutsideComfort === 0) {
    status = "good";
  } else if (fractionOutside <= 0.25) {
    status = "warning";
  } else {
    status = "critical";
  }

  // 3. Determine Failure Type
  let failureType: ThermalFailureType = "none";
  if (hoursOutsideComfort === 0) {
    failureType = "none";
  } else if (overheatingHours > 0 && overcoolingHours === 0) {
    failureType = "overheating";
  } else if (overcoolingHours > 0 && overheatingHours === 0) {
    failureType = "overcooling";
  } else {
    failureType = "mixed";
  }

  // 4. Determine Headline and Summary
  let headline = "THERMALLY STABLE";
  let summary = `All ${hoursInComfort} of ${totalHours} simulated hours remain within the selected comfort band (${comfortBand.t_low_c}°C — ${comfortBand.t_high_c}°C).`;

  if (status === "warning") {
    headline = "THERMAL WARNING";
    summary = `${hoursOutsideComfort} of ${totalHours} hours spend time outside comfort band (Comfort: ${comfortPercent.toFixed(1)}%). Short-duration thermal discomfort detected.`;
  } else if (status === "critical") {
    headline = "THERMAL FAILURE DETECTED";
    summary = `${hoursOutsideComfort} of ${totalHours} hours spend time outside comfort band (Comfort: ${comfortPercent.toFixed(1)}%). Significant thermal discomfort detected.`;
  }

  // 5. Contributor Diagnosis and Ranking
  const rawContributors = extractContributors(hourly, failureType);

  // 6. Formulate Human-Readable Explanation and Evidence
  const evidenceList: string[] = [];
  evidenceList.push(`Simulated period: ${totalHours} hours (comfort band: ${comfortBand.t_low_c}°C to ${comfortBand.t_high_c}°C).`);
  evidenceList.push(`Indoor temperature extremes: Min ${minimumIndoorTemperature.toFixed(1)}°C at ${formatHour(minimumIndoorTemperatureHour)}, Max ${peakIndoorTemperature.toFixed(1)}°C at ${formatHour(peakIndoorTemperatureHour)}.`);
  
  if (overheatingHours > 0) {
    evidenceList.push(`Overheating duration: ${overheatingHours} hours with peak deviation +${peakHotDeviation.toFixed(1)} K.`);
  }
  if (overcoolingHours > 0) {
    evidenceList.push(`Overcooling duration: ${overcoolingHours} hours with peak deviation -${peakColdDeviation.toFixed(1)} K.`);
  }

  if (rawContributors.length > 0) {
    const top = rawContributors[0];
    evidenceList.push(`Dominant heat-flow contributor: ${top.name} (${top.signed_w > 0 ? "+" : ""}${top.signed_w.toFixed(0)} W peak at ${formatHour(top.peak_hour_iso)}).`);
  }

  const explanation = generateExplanation({
    status,
    failureType,
    comfortPercent,
    hoursOutsideComfort,
    totalHours,
    overheatingHours,
    overcoolingHours,
    peakIndoorTemperature,
    minimumIndoorTemperature,
    peakIndoorTemperatureHour,
    minimumIndoorTemperatureHour,
    comfortBand,
    topContributors: rawContributors.slice(0, 3),
    mode,
  });

  return {
    status,
    failureType,
    headline,
    summary,
    comfortPercent: Math.round(comfortPercent * 10) / 10,
    hoursInComfort,
    totalHours,
    hoursOutsideComfort,
    overheatingHours,
    overcoolingHours,
    peakIndoorTemperature: Math.round(peakIndoorTemperature * 10) / 10,
    peakIndoorTemperatureHour,
    minimumIndoorTemperature: Math.round(minimumIndoorTemperature * 10) / 10,
    minimumIndoorTemperatureHour,
    peakHotDeviation: Math.round(peakHotDeviation * 10) / 10,
    peakColdDeviation: Math.round(peakColdDeviation * 10) / 10,
    comfortBand,
    hourlyAssessments,
    contributors: rawContributors,
    explanation,
    evidence: evidenceList,
  };
}

/**
 * Extracts, analyzes, and ranks physical thermal contributors from hourly simulation data.
 */
function extractContributors(
  hourly: HourlySimulationPoint[],
  failureType: ThermalFailureType
): ThermalContributor[] {
  type ContributorDef = {
    id: string;
    name: string;
    key: keyof HourlySimulationPoint;
    description: string;
  };

  const defs: ContributorDef[] = [
    { id: "solar", name: "Glazing Solar Radiation", key: "q_solar_w", description: "Solar radiation transmitted through window glazing" },
    { id: "walls", name: "Wall Assembly Conduction", key: "q_cond_walls_w", description: "Conductive heat transfer through external wall envelope" },
    { id: "roof", name: "Roof Assembly Conduction", key: "q_cond_roof_w", description: "Conductive heat transfer through roof structure" },
    { id: "windows_cond", name: "Window Glazing Conduction", key: "q_cond_windows_w", description: "Conductive heat transfer through window glass" },
    { id: "ventilation", name: "Ventilation / Infiltration", key: "q_vent_w", description: "Sensible air exchange heat transfer" },
    { id: "occupants", name: "Sensible Occupant Gains", key: "q_occ_w", description: "Internal sensible heat output from shelter occupants" },
  ];

  const results: ThermalContributor[] = [];

  for (const def of defs) {
    let maxAbs = -1;
    let signedAtMax = 0;
    let peakHourIso = hourly[0]?.timestamp ?? "";

    for (const pt of hourly) {
      const val = pt[def.key];
      if (typeof val === "number") {
        const absVal = Math.abs(val);
        if (absVal > maxAbs) {
          maxAbs = absVal;
          signedAtMax = val;
          peakHourIso = pt.timestamp;
        }
      }
    }

    if (maxAbs >= 0) {
      const direction: "entering" | "leaving" | "neutral" =
        signedAtMax > 0.5 ? "entering" : signedAtMax < -0.5 ? "leaving" : "neutral";

      const meaning =
        direction === "entering"
          ? "Heat entering shelter (+ gain)"
          : direction === "leaving"
          ? "Heat leaving shelter (- loss)"
          : "Neutral heat balance (0 W)";

      let evidence = "";
      const hourFmt = formatHour(peakHourIso);
      if (def.id === "solar") {
        evidence = `Peak solar heat gain of ${signedAtMax.toFixed(0)} W entering through glazing at ${hourFmt}.`;
      } else if (def.id === "walls") {
        evidence = `Peak wall conduction of ${signedAtMax.toFixed(0)} W (${direction === "entering" ? "heat gain" : "heat loss"}) at ${hourFmt}.`;
      } else if (def.id === "roof") {
        evidence = `Peak roof conduction of ${signedAtMax.toFixed(0)} W (${direction === "entering" ? "heat gain" : "heat loss"}) at ${hourFmt}.`;
      } else if (def.id === "windows_cond") {
        evidence = `Peak window conductive load of ${signedAtMax.toFixed(0)} W (${direction === "entering" ? "heat gain" : "heat loss"}) at ${hourFmt}.`;
      } else if (def.id === "ventilation") {
        evidence = `Peak ventilation/infiltration load of ${signedAtMax.toFixed(0)} W at ${hourFmt}.`;
      } else if (def.id === "occupants") {
        evidence = `Continuous internal occupant sensible gain of ${signedAtMax.toFixed(0)} W.`;
      }

      results.push({
        id: def.id,
        name: def.name,
        signed_w: Math.round(signedAtMax * 10) / 10,
        magnitude_w: Math.round(maxAbs * 10) / 10,
        peak_hour_iso: peakHourIso,
        direction,
        meaning,
        evidence,
      });
    }
  }

  // Sort contributors based on context:
  // If overheating: prioritize positive gain magnitude (heat entering).
  // If overcooling: prioritize negative loss magnitude (heat leaving).
  // Otherwise: sort by absolute peak magnitude.
  results.sort((a, b) => {
    if (failureType === "overheating") {
      const aGain = a.signed_w > 0 ? a.signed_w : 0;
      const bGain = b.signed_w > 0 ? b.signed_w : 0;
      if (bGain !== aGain) return bGain - aGain;
    } else if (failureType === "overcooling") {
      const aLoss = a.signed_w < 0 ? Math.abs(a.signed_w) : 0;
      const bLoss = b.signed_w < 0 ? Math.abs(b.signed_w) : 0;
      if (bLoss !== aLoss) return bLoss - aLoss;
    }
    return b.magnitude_w - a.magnitude_w;
  });

  return results;
}

/**
 * Generates an engineering explanation distinguishing observed result,
 * likely contributors, and physical interpretation.
 */
function generateExplanation(params: {
  status: ThermalSeverity;
  failureType: ThermalFailureType;
  comfortPercent: number;
  hoursOutsideComfort: number;
  totalHours: number;
  overheatingHours: number;
  overcoolingHours: number;
  peakIndoorTemperature: number;
  minimumIndoorTemperature: number;
  peakIndoorTemperatureHour: string;
  minimumIndoorTemperatureHour: string;
  comfortBand: ComfortBand;
  topContributors: ThermalContributor[];
  mode: string;
}): string {
  const {
    status,
    failureType,
    overheatingHours,
    overcoolingHours,
    peakIndoorTemperature,
    minimumIndoorTemperature,
    peakIndoorTemperatureHour,
    minimumIndoorTemperatureHour,
    comfortBand,
    topContributors,
    mode,
  } = params;

  const topNames = topContributors.map((c) => c.name.toLowerCase()).join(" and ");

  if (status === "good") {
    if (mode === "setpoint") {
      return `Under active setpoint control, the shelter remains 100% within the ${comfortBand.t_low_c}°C – ${comfortBand.t_high_c}°C comfort band. The HVAC holding loads successfully counterbalance external conduction and solar radiation.`;
    }
    return `The simulated indoor temperature remains within the selected comfort band (${comfortBand.t_low_c}°C — ${comfortBand.t_high_c}°C) for the full 24-hour cycle (Min: ${minimumIndoorTemperature.toFixed(1)}°C, Max: ${peakIndoorTemperature.toFixed(1)}°C). The envelope thermal resistance and effective capacitance provide sufficient thermal stability against diurnal outdoor fluctuations.`;
  }

  if (failureType === "overheating") {
    return `During the identified hot period, indoor temperature rises to a peak of ${peakIndoorTemperature.toFixed(1)}°C at ${formatHour(peakIndoorTemperatureHour)}, exceeding the upper comfort limit (${comfortBand.t_high_c}°C) for ${overheatingHours} hours. ${topNames ? `${topNames} are among the dominant positive heat-flow contributors during this period.` : ""} This indicates substantial heat addition relative to the shelter's heat dissipation and thermal mass.`;
  }

  if (failureType === "overcooling") {
    return `During the identified cold period, indoor temperature falls to a minimum of ${minimumIndoorTemperature.toFixed(1)}°C at ${formatHour(minimumIndoorTemperatureHour)}, dropping below the lower comfort limit (${comfortBand.t_low_c}°C) for ${overcoolingHours} hours. ${topNames ? `${topNames} represent the dominant heat-loss contributors during this period.` : ""} This indicates significant envelope conduction or infiltration loss to the cold ambient environment.`;
  }

  return `The shelter experiences mixed thermal instability, spending ${overheatingHours} hours above ${comfortBand.t_high_c}°C (peak ${peakIndoorTemperature.toFixed(1)}°C at ${formatHour(peakIndoorTemperatureHour)}) and ${overcoolingHours} hours below ${comfortBand.t_low_c}°C (min ${minimumIndoorTemperature.toFixed(1)}°C at ${formatHour(minimumIndoorTemperatureHour)}). Large diurnal outdoor swings combined with ${topNames || "envelope heat flows"} drive wide interior temperature excursions.`;
}
