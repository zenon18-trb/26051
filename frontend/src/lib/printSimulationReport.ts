import type {
  HvacConfig,
  MaterialLayer,
  ShelterGeometry,
  SimulationResponse,
  VentConfig,
  WindowConfig,
} from "@/lib/api";

type ReportData = {
  result: SimulationResponse;
  locationName?: string;
  locationCoordinates?: string;
  geometry: ShelterGeometry | null;
  wallLayers: MaterialLayer[];
  roofLayers: MaterialLayer[];
  windows: WindowConfig | null;
  vents: VentConfig | null;
  occupants: number | null;
  hvac: HvacConfig | null;
  houseImage?: string;
};

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function temperatureChart(result: SimulationResponse): string {
  const points = result.hourly;
  if (!points.length) return "";

  const width = 720;
  const height = 270;
  const pad = { top: 24, right: 22, bottom: 38, left: 44 };
  const values = points.flatMap((point) => [point.t_in_c, point.t_out_c, result.comfort.t_low_c, result.comfort.t_high_c]);
  const min = Math.floor(Math.min(...values) - 2);
  const max = Math.ceil(Math.max(...values) + 2);
  const range = Math.max(1, max - min);
  const x = (index: number) => pad.left + (index / Math.max(1, points.length - 1)) * (width - pad.left - pad.right);
  const y = (value: number) => pad.top + ((max - value) / range) * (height - pad.top - pad.bottom);
  const line = (key: "t_in_c" | "t_out_c") => points.map((point, index) => `${x(index).toFixed(1)},${y(point[key]).toFixed(1)}`).join(" ");
  const yTicks = Array.from({ length: 5 }, (_, index) => min + (range * index) / 4);
  const xLabels = points.map((point, index) => index % 4 === 0 || index === points.length - 1 ? `<text x="${x(index)}" y="${height - 14}" text-anchor="middle">${escapeHtml(point.timestamp.slice(11, 16))}</text>` : "").join("");

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="24-hour indoor and outdoor temperature chart">
    <rect x="${pad.left}" y="${y(result.comfort.t_high_c)}" width="${width - pad.left - pad.right}" height="${y(result.comfort.t_low_c) - y(result.comfort.t_high_c)}" fill="#e7f4e9" />
    ${yTicks.map((tick) => `<g><line x1="${pad.left}" x2="${width - pad.right}" y1="${y(tick)}" y2="${y(tick)}" stroke="#d9e1de" /><text x="${pad.left - 8}" y="${y(tick) + 4}" text-anchor="end">${tick.toFixed(0)}°</text></g>`).join("")}
    <line x1="${pad.left}" x2="${width - pad.right}" y1="${y(result.comfort.t_low_c)}" y2="${y(result.comfort.t_low_c)}" stroke="#4c9362" stroke-dasharray="5 4" />
    <line x1="${pad.left}" x2="${width - pad.right}" y1="${y(result.comfort.t_high_c)}" y2="${y(result.comfort.t_high_c)}" stroke="#4c9362" stroke-dasharray="5 4" />
    <polyline points="${line("t_out_c")}" fill="none" stroke="#557b9f" stroke-width="2.5" />
    <polyline points="${line("t_in_c")}" fill="none" stroke="#d95c31" stroke-width="3" />
    ${xLabels}
    <text x="${pad.left}" y="14" class="legend indoor">● Indoor temperature</text><text x="${pad.left + 150}" y="14" class="legend outdoor">● Outdoor temperature</text><text x="${pad.left + 314}" y="14" class="legend comfort">— Comfort band</text>
  </svg>`;
}

export function openPrintableSimulationReport(data: ReportData): void {
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    throw new Error("The report window was blocked. Allow pop-ups and try again.");
  }

  const { result, geometry, windows, vents, occupants, hvac, houseImage } = data;
  const formatLayer = (layer: MaterialLayer) => `${escapeHtml(layer.material_id)} · ${(layer.thickness_m * 1000).toFixed(0)} mm`;
  const hourlyRows = result.hourly.map((point) => `<tr><td>${escapeHtml(point.timestamp.slice(11, 16))}</td><td>${point.t_out_c.toFixed(1)}</td><td>${point.t_in_c.toFixed(1)}</td><td>${point.q_net_w.toFixed(0)}</td><td>${point.q_hvac_w.toFixed(0)}</td></tr>`).join("");

  reportWindow.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>Thermal Analysis Report</title><style>
    @page { size: A4; margin: 12mm; } * { box-sizing: border-box; } body { color: #24332a; font: 10pt/1.45 Arial, sans-serif; } h1,h2,h3 { margin: 0; color: #253128; } h1 { font: 700 25pt/1.1 Georgia, serif; } h2 { margin: 21px 0 9px; padding-bottom: 5px; border-bottom: 2px solid #d95c31; font-size: 14pt; break-after: avoid; } h3 { font-size: 10pt; } .eyebrow { margin: 0 0 7px; color: #b84a29; font-size: 8pt; font-weight: 700; letter-spacing: .12em; } .muted { color: #607167; } .header { display:flex; justify-content:space-between; gap:24px; padding-bottom:15px; border-bottom:1px solid #bdcabe; } .header p { margin: 6px 0 0; } .tag { padding: 6px 9px; background:#e9f0e6; color:#365943; font-size:8pt; font-weight:700; white-space:nowrap; } .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:9px; } .card { min-height:64px; padding:10px; border:1px solid #cdd8d0; background:#fbfcfa; } .card span { display:block; margin-bottom:4px; color:#607167; font-size:8pt; } .card strong { font-size:13pt; } .two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; } .box { padding:11px; border:1px solid #cdd8d0; } ul { margin:7px 0 0; padding-left:18px; } li { margin:3px 0; } table { width:100%; border-collapse:collapse; font-size:8.5pt; } thead { display:table-header-group; } tr { break-inside:avoid; } th { background:#e9f0e6; color:#334838; text-align:left; } th,td { padding:6px 7px; border:1px solid #ccd6cf; } td.num { text-align:right; } svg { width:100%; height:auto; overflow:visible; } svg text { fill:#596b60; font: 10px Arial, sans-serif; } svg .legend.indoor { fill:#c3482a; } svg .legend.outdoor { fill:#466d94; } svg .legend.comfort { fill:#4c9362; } .model-shot { width:100%; max-height:315px; object-fit:cover; border:1px solid #cdd8d0; background:#e7ece2; } .chart-note { margin:3px 0 0; color:#607167; font-size:8pt; } .foot { margin-top:16px; color:#607167; font-size:8pt; text-align:center; } @media print { .no-print { display:none; } }
  </style></head><body><header class="header"><div><p class="eyebrow">SIH26051 · THERMAL ANALYSIS WORKSPACE</p><h1>24-Hour Thermal Analysis Report</h1><p class="muted">${escapeHtml(data.locationName ?? "Configured site")} · ${escapeHtml(data.locationCoordinates)} · Generated ${escapeHtml(new Date().toLocaleString())}</p></div><div class="tag">${escapeHtml(result.mode).toUpperCase()} MODE</div></header>
  <h2>Executive summary</h2><section class="grid"><div class="card"><span>Comfort achieved</span><strong>${result.comfort.comfort_pct.toFixed(1)}%</strong><div>${result.comfort.hours_in_band} of ${result.comfort.total_hours} hours in band</div></div><div class="card"><span>Peak heating load</span><strong>${result.hvac_summary.peak_heating_w.toFixed(0)} W</strong><div>Required at peak condition</div></div><div class="card"><span>Peak cooling load</span><strong>${result.hvac_summary.peak_cooling_w.toFixed(0)} W</strong><div>Required at peak condition</div></div><div class="card"><span>Comfort band</span><strong>${result.comfort.t_low_c.toFixed(1)}–${result.comfort.t_high_c.toFixed(1)} °C</strong><div>Target indoor range</div></div><div class="card"><span>Max deviation</span><strong>+${result.comfort.peak_deviation_above_k.toFixed(1)} / −${result.comfort.peak_deviation_below_k.toFixed(1)} K</strong><div>Above / below target band</div></div><div class="card"><span>Thermal capacitance</span><strong>${(result.capacitance_j_per_k / 1000).toFixed(1)} kJ/K</strong><div>${result.capacitance_clamped ? "Model value clamped" : "Calculated fabric + air value"}</div></div></section>
  <h2>Temperature visualization</h2>${temperatureChart(result)}<p class="chart-note">Indoor temperature is shown in orange, outdoor temperature in blue, and the target comfort zone in green.</p>
  <h2>Configured shelter</h2>${houseImage ? `<figure><img class="model-shot" src="${houseImage}" alt="Rendered configured shelter model" /><figcaption class="chart-note">Rendered assembled shelter from the active analysis configuration.</figcaption></figure>` : ""}<section class="two-col"><div class="box"><h3>Site and geometry</h3><ul><li>Location: ${escapeHtml(data.locationName ?? "Custom coordinates")}</li><li>Coordinates: ${escapeHtml(data.locationCoordinates)}</li><li>Dimensions: ${geometry ? `${geometry.length_m} × ${geometry.width_m} × ${geometry.height_m} m` : "—"}</li><li>Orientation: ${escapeHtml(geometry?.orientation ?? "—")}</li><li>Climate source: ${escapeHtml(result.climate_source_label)}</li></ul></div><div class="box"><h3>Operating conditions</h3><ul><li>Windows: ${windows ? `${windows.area_m2.toFixed(1)} m², ${windows.kind}` : "—"}</li><li>Ventilation: ${vents ? vents.open ? "Open (5.0 ACH)" : "Closed (0.5 ACH)" : "—"}</li><li>Occupancy: ${occupants ?? "—"} people (${occupants !== null ? occupants * 70 : "—"} W sensible heat)</li><li>HVAC: ${hvac?.mode === "setpoint" ? `Setpoint ${hvac.setpoint_c?.toFixed(1)} °C` : "Floating"}</li><li>Comfort range: ${hvac ? `${hvac.comfort_band.t_low_c}–${hvac.comfort_band.t_high_c} °C` : "—"}</li></ul></div></section><section class="two-col"><div class="box"><h3>Wall layers</h3><ul>${data.wallLayers.map((layer) => `<li>${formatLayer(layer)}</li>`).join("") || "<li>—</li>"}</ul></div><div class="box"><h3>Roof layers</h3><ul>${data.roofLayers.map((layer) => `<li>${formatLayer(layer)}</li>`).join("") || "<li>—</li>"}</ul></div></section>
  <h2>Representative heat balance</h2><table><thead><tr><th>Representative hour</th><th>Outdoor</th><th>Indoor</th><th>Wall conduction</th><th>Roof conduction</th><th>Window conduction</th><th>Solar</th><th>Ventilation</th><th>Occupants</th><th>HVAC</th><th>Net</th></tr></thead><tbody><tr><td>${escapeHtml(result.steady_state.representative_hour.slice(11,16))}</td><td>${result.steady_state.t_out_c.toFixed(1)} °C</td><td>${result.steady_state.t_in_c.toFixed(1)} °C</td><td>${result.steady_state.q_cond_walls_w.toFixed(0)} W</td><td>${result.steady_state.q_cond_roof_w.toFixed(0)} W</td><td>${result.steady_state.q_cond_windows_w.toFixed(0)} W</td><td>${result.steady_state.q_solar_w.toFixed(0)} W</td><td>${result.steady_state.q_vent_w.toFixed(0)} W</td><td>${result.steady_state.q_occ_w.toFixed(0)} W</td><td>${result.steady_state.q_hvac_w.toFixed(0)} W</td><td>${result.steady_state.q_net_w.toFixed(0)} W</td></tr></tbody></table>
  <h2>24-hour simulation data</h2><table><thead><tr><th>Time</th><th>Outdoor °C</th><th>Indoor °C</th><th>Net load W</th><th>HVAC W</th></tr></thead><tbody>${hourlyRows}</tbody></table>
  <h2>Model assumptions</h2><ul>${result.assumptions.map((assumption) => `<li>${escapeHtml(assumption)}</li>`).join("")}</ul><p class="foot">Generated from the active workspace configuration. Use browser print → Save as PDF to retain this report.</p><script>window.onload = () => window.print();</script></body></html>`);
  reportWindow.document.close();
}
