"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, CloudSun, Database, LoaderCircle, MapPin, Navigation, Satellite } from "lucide-react";
import { fetchClimate, fetchLocations, type ClimateResponse, type LocationPreset } from "@/lib/api";
import { useShelterConfiguration } from "@/context/ShelterConfigurationContext";

type Mode = "preset" | "custom";

export function LocationClimate() {
  const { location, climate, setLocationClimate } = useShelterConfiguration();
  const [locations, setLocations] = useState<LocationPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState(location?.preset?.id ?? "");
  const [mode, setMode] = useState<Mode>(location?.preset ? "preset" : "preset");
  const [latitude, setLatitude] = useState(location ? String(location.lat) : "");
  const [longitude, setLongitude] = useState(location ? String(location.lon) : "");
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [loadingClimate, setLoadingClimate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLocations = useCallback(async () => {
    setLoadingLocations(true);
    setError(null);
    try {
      setLocations(await fetchLocations());
    } catch {
      setError("Preset locations are unavailable. Check the API connection and retry.");
    } finally {
      setLoadingLocations(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadLocations(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadLocations]);

  const selectedPreset = locations.find((preset) => preset.id === selectedPresetId) ?? null;
  const temperatureRange = useMemo(() => {
    if (!climate?.hours.length) return null;
    const temperatures = climate.hours.map((hour) => hour.t_out_c);
    return `${Math.min(...temperatures).toFixed(1)}°C to ${Math.max(...temperatures).toFixed(1)}°C`;
  }, [climate]);
  const irradianceRange = useMemo(() => {
    if (!climate?.hours.length) return null;
    const values = climate.hours.map((hour) => hour.shortwave_wm2);
    return `${Math.min(...values).toFixed(0)}–${Math.max(...values).toFixed(0)} W/m²`;
  }, [climate]);

  async function retrieveClimate() {
    setError(null);
    let lat: number;
    let lon: number;
    let presetId: string | undefined;
    let preset: LocationPreset | null = null;

    if (mode === "preset") {
      preset = selectedPreset;
      if (!preset) { setError("Select a preset location before retrieving climate data."); return; }
      lat = preset.latitude;
      lon = preset.longitude;
      presetId = preset.id;
    } else {
      lat = Number(latitude);
      lon = Number(longitude);
      if (!latitude.trim() || !Number.isFinite(lat) || lat < -90 || lat > 90) { setError("Latitude must be a number between -90 and +90 degrees."); return; }
      if (!longitude.trim() || !Number.isFinite(lon) || lon < -180 || lon > 180) { setError("Longitude must be a number between -180 and +180 degrees."); return; }
    }

    setLoadingClimate(true);
    try {
      const result = await fetchClimate(lat, lon, presetId);
      setLocationClimate({ preset, lat, lon }, result);
    } catch {
      setError("Climate retrieval failed. The service may be unavailable or returned no hourly data. Retry when ready.");
    } finally {
      setLoadingClimate(false);
    }
  }

  return <div className="climate-page">
    <div className="page-heading climate-heading"><div><p className="eyebrow">STAGE 1 · LOCATION & CLIMATE</p><h1>Location & Climate</h1><p className="page-description">Choose a reference environment or enter coordinates to load the 24-hour climate profile for your thermal analysis.</p></div><div className="configured-pill"><span className={`status-dot ${climate ? "status-dot-configured" : ""}`} />{climate ? "Configured" : "Not configured"}</div></div>

    {error && <div className="climate-error" role="alert"><AlertTriangle aria-hidden /><div><strong>Climate data could not be loaded</strong><p>{error}</p></div><button className="text-button" onClick={() => setError(null)}>Dismiss</button></div>}

    <div className="climate-layout">
      <section className="climate-panel selection-panel"><div className="panel-heading"><div><h2>Choose a location</h2><p>Preset coordinates are supplied by the climate service.</p></div><MapPin aria-hidden /></div>
        <div className="mode-toggle" role="tablist" aria-label="Location input mode"><button className={mode === "preset" ? "mode-active" : ""} onClick={() => setMode("preset")} role="tab" aria-selected={mode === "preset"}>Preset locations</button><button className={mode === "custom" ? "mode-active" : ""} onClick={() => setMode("custom")} role="tab" aria-selected={mode === "custom"}>Custom coordinates</button></div>
        {mode === "preset" ? <div className="preset-list">{loadingLocations ? <div className="inline-loading"><LoaderCircle className="spin" aria-hidden /> Loading preset locations...</div> : locations.map((preset) => <button key={preset.id} className={`preset-card ${selectedPresetId === preset.id ? "preset-selected" : ""}`} onClick={() => { setSelectedPresetId(preset.id); setError(null); }}><div className="preset-card-top"><span className="preset-name">{preset.name}</span><span className="preset-type">{preset.environment_type}</span></div><p>{preset.region}</p><p className="preset-description">{preset.description}</p><span className="preset-coordinates">{preset.latitude.toFixed(4)}°, {preset.longitude.toFixed(4)}° <ChevronRight aria-hidden /></span></button>)}</div> : <div className="coordinate-fields"><label>Latitude<input inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="e.g. 34.1526" aria-describedby="latitude-help" /><small id="latitude-help">Range: -90 to +90°</small></label><label>Longitude<input inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="e.g. 77.5771" aria-describedby="longitude-help" /><small id="longitude-help">Range: -180 to +180°</small></label><div className="custom-note"><Navigation aria-hidden /> Custom coordinates are sent directly to the climate service without a preset identifier.</div></div>}
        <button className="primary-button climate-submit" onClick={() => void retrieveClimate()} disabled={loadingClimate || loadingLocations}>{loadingClimate ? <><LoaderCircle className="spin" aria-hidden /> Retrieving climate...</> : <><CloudSun aria-hidden /> Retrieve climate data</>}</button>
      </section>

      <section className="climate-panel summary-panel"><div className="panel-heading"><div><h2>Climate summary</h2><p>{climate ? `${climate.lat.toFixed(4)}°, ${climate.lon.toFixed(4)}° · 24-hour profile` : "Retrieve climate data to populate this summary."}</p></div><Satellite aria-hidden /></div>{climate ? <ClimateSummary climate={climate} temperatureRange={temperatureRange} irradianceRange={irradianceRange} /> : <div className="summary-empty"><div className="summary-empty-icon"><CloudSun aria-hidden /></div><h3>No climate profile loaded</h3><p>Select a preset or enter coordinates, then retrieve climate data.</p></div>}</section>
    </div>
  </div>;
}

function ClimateSummary({ climate, temperatureRange, irradianceRange }: { climate: ClimateResponse; temperatureRange: string | null; irradianceRange: string | null }) {
  return <div className="climate-result"><div className={`source-banner ${climate.fallback_used ? "source-fallback" : "source-live"}`}><Database aria-hidden /><div><strong>{climate.fallback_used ? "Bundled climate fixture used" : "Live climate service"}</strong><p>{climate.fallback_used ? "Live climate retrieval was unavailable, so the system used a bundled engineering fixture. Results are explicitly labelled to maintain data-source transparency." : climate.climate_source_label}</p></div></div><div className="metrics-grid"><Metric label="Temperature range" value={temperatureRange ?? "Unavailable"} /><Metric label="Hourly availability" value={`${climate.hours.length} data points`} /><Metric label="Solar irradiance" value={irradianceRange ?? "Unavailable"} /><Metric label="Climate source" value={climate.climate_source_label} /></div><div className="result-footer"><CheckCircle2 aria-hidden /> Climate profile loaded successfully and stored in the current workspace.</div></div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="climate-metric"><span>{label}</span><strong>{value}</strong></div>; }
