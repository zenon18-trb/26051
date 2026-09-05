"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { ClimateResponse, LocationPreset, ShelterGeometry } from "@/lib/api";

export type SelectedLocation = {
  preset: LocationPreset | null;
  lat: number;
  lon: number;
};

type ShelterConfigurationValue = {
  location: SelectedLocation | null;
  climate: ClimateResponse | null;
  geometry: ShelterGeometry | null;
  setLocationClimate: (location: SelectedLocation, climate: ClimateResponse) => void;
  setGeometry: (geometry: ShelterGeometry | null) => void;
};

const ShelterConfigurationContext = createContext<ShelterConfigurationValue | null>(null);

export function ShelterConfigurationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<SelectedLocation | null>(null);
  const [climate, setClimate] = useState<ClimateResponse | null>(null);
  const [geometry, setGeometry] = useState<ShelterGeometry | null>(null);

  const value = useMemo(() => ({
    location,
    climate,
    geometry,
    setLocationClimate: (nextLocation: SelectedLocation, nextClimate: ClimateResponse) => {
      setLocation(nextLocation);
      setClimate(nextClimate);
    },
    setGeometry: (nextGeometry: ShelterGeometry | null) => {
      setGeometry(nextGeometry);
    },
  }), [location, climate, geometry]);

  return <ShelterConfigurationContext.Provider value={value}>{children}</ShelterConfigurationContext.Provider>;
}

export function useShelterConfiguration() {
  const context = useContext(ShelterConfigurationContext);
  if (!context) throw new Error("useShelterConfiguration must be used within ShelterConfigurationProvider");
  return context;
}

