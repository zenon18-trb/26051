"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type {
  ClimateResponse,
  ComfortBand,
  HvacConfig,
  LocationPreset,
  MaterialLayer,
  ShelterGeometry,
  VentConfig,
  WindowConfig,
} from "@/lib/api";

export type SelectedLocation = {
  preset: LocationPreset | null;
  lat: number;
  lon: number;
};

type ShelterConfigurationValue = {
  location: SelectedLocation | null;
  climate: ClimateResponse | null;
  geometry: ShelterGeometry | null;
  wallLayers: MaterialLayer[];
  roofLayers: MaterialLayer[];
  windows: WindowConfig | null;
  vents: VentConfig | null;
  occupants: number | null;
  hvac: HvacConfig | null;
  setLocationClimate: (location: SelectedLocation, climate: ClimateResponse) => void;
  setGeometry: (geometry: ShelterGeometry | null) => void;
  setWallLayers: (layers: MaterialLayer[]) => void;
  setRoofLayers: (layers: MaterialLayer[]) => void;
  setWindows: (config: WindowConfig | null) => void;
  setVents: (vents: VentConfig | null) => void;
  setOccupants: (occupants: number | null) => void;
  setHvac: (hvac: HvacConfig | null) => void;
  isMaterialsConfigured: boolean;
  isWindowsConfigured: boolean;
  isVentilationConfigured: boolean;
  isOccupantsConfigured: boolean;
  isVentilationAndOccupantsConfigured: boolean;
  isHvacConfigured: boolean;
};

const ShelterConfigurationContext = createContext<ShelterConfigurationValue | null>(null);

export function ShelterConfigurationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<SelectedLocation | null>(null);
  const [climate, setClimate] = useState<ClimateResponse | null>(null);
  const [geometry, setGeometry] = useState<ShelterGeometry | null>(null);
  const [wallLayers, setWallLayers] = useState<MaterialLayer[]>([]);
  const [roofLayers, setRoofLayers] = useState<MaterialLayer[]>([]);
  const [windows, setWindows] = useState<WindowConfig | null>(null);
  const [vents, setVents] = useState<VentConfig | null>(null);
  const [occupants, setOccupants] = useState<number | null>(null);
  const [hvac, setHvac] = useState<HvacConfig | null>(null);

  const isMaterialsConfigured = useMemo(() => {
    return (
      wallLayers.length > 0 &&
      roofLayers.length > 0 &&
      wallLayers.every((l) => l.thickness_m > 0 && l.material_id) &&
      roofLayers.every((l) => l.thickness_m > 0 && l.material_id)
    );
  }, [wallLayers, roofLayers]);

  const isWindowsConfigured = useMemo(() => {
    return windows !== null && windows.area_m2 >= 0 && Boolean(windows.kind);
  }, [windows]);

  const isVentilationConfigured = useMemo(() => {
    return vents !== null && typeof vents.open === "boolean";
  }, [vents]);

  const isOccupantsConfigured = useMemo(() => {
    return occupants !== null && Number.isInteger(occupants) && occupants >= 0;
  }, [occupants]);

  const isVentilationAndOccupantsConfigured = useMemo(() => {
    return isVentilationConfigured && isOccupantsConfigured;
  }, [isVentilationConfigured, isOccupantsConfigured]);

  const isHvacConfigured = useMemo(() => {
    if (!hvac) return false;
    if (hvac.mode === "floating") return true;
    if (hvac.mode === "setpoint") {
      return hvac.setpoint_c !== null && !isNaN(hvac.setpoint_c);
    }
    return false;
  }, [hvac]);

  const value = useMemo(
    () => ({
      location,
      climate,
      geometry,
      wallLayers,
      roofLayers,
      windows,
      vents,
      occupants,
      hvac,
      isMaterialsConfigured,
      isWindowsConfigured,
      isVentilationConfigured,
      isOccupantsConfigured,
      isVentilationAndOccupantsConfigured,
      isHvacConfigured,
      setLocationClimate: (nextLocation: SelectedLocation, nextClimate: ClimateResponse) => {
        setLocation(nextLocation);
        setClimate(nextClimate);
      },
      setGeometry: (nextGeometry: ShelterGeometry | null) => {
        setGeometry(nextGeometry);
      },
      setWallLayers: (layers: MaterialLayer[]) => {
        setWallLayers(layers);
      },
      setRoofLayers: (layers: MaterialLayer[]) => {
        setRoofLayers(layers);
      },
      setWindows: (nextWindows: WindowConfig | null) => {
        setWindows(nextWindows);
      },
      setVents: (nextVents: VentConfig | null) => {
        setVents(nextVents);
      },
      setOccupants: (nextOccupants: number | null) => {
        setOccupants(nextOccupants);
      },
      setHvac: (nextHvac: HvacConfig | null) => {
        setHvac(nextHvac);
      },
    }),
    [
      location,
      climate,
      geometry,
      wallLayers,
      roofLayers,
      windows,
      vents,
      occupants,
      hvac,
      isMaterialsConfigured,
      isWindowsConfigured,
      isVentilationConfigured,
      isOccupantsConfigured,
      isVentilationAndOccupantsConfigured,
      isHvacConfigured,
    ]
  );

  return <ShelterConfigurationContext.Provider value={value}>{children}</ShelterConfigurationContext.Provider>;
}

export function useShelterConfiguration() {
  const context = useContext(ShelterConfigurationContext);
  if (!context) throw new Error("useShelterConfiguration must be used within ShelterConfigurationProvider");
  return context;
}



