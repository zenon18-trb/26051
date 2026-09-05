"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { ClimateResponse, LocationPreset, MaterialLayer, ShelterGeometry } from "@/lib/api";

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
  setLocationClimate: (location: SelectedLocation, climate: ClimateResponse) => void;
  setGeometry: (geometry: ShelterGeometry | null) => void;
  setWallLayers: (layers: MaterialLayer[]) => void;
  setRoofLayers: (layers: MaterialLayer[]) => void;
  isMaterialsConfigured: boolean;
};

const ShelterConfigurationContext = createContext<ShelterConfigurationValue | null>(null);

export function ShelterConfigurationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<SelectedLocation | null>(null);
  const [climate, setClimate] = useState<ClimateResponse | null>(null);
  const [geometry, setGeometry] = useState<ShelterGeometry | null>(null);
  const [wallLayers, setWallLayers] = useState<MaterialLayer[]>([]);
  const [roofLayers, setRoofLayers] = useState<MaterialLayer[]>([]);

  const isMaterialsConfigured = useMemo(() => {
    return (
      wallLayers.length > 0 &&
      roofLayers.length > 0 &&
      wallLayers.every((l) => l.thickness_m > 0 && l.material_id) &&
      roofLayers.every((l) => l.thickness_m > 0 && l.material_id)
    );
  }, [wallLayers, roofLayers]);

  const value = useMemo(
    () => ({
      location,
      climate,
      geometry,
      wallLayers,
      roofLayers,
      isMaterialsConfigured,
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
    }),
    [location, climate, geometry, wallLayers, roofLayers, isMaterialsConfigured]
  );

  return <ShelterConfigurationContext.Provider value={value}>{children}</ShelterConfigurationContext.Provider>;
}

export function useShelterConfiguration() {
  const context = useContext(ShelterConfigurationContext);
  if (!context) throw new Error("useShelterConfiguration must be used within ShelterConfigurationProvider");
  return context;
}


