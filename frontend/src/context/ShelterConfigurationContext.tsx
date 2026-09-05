"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { ClimateResponse, LocationPreset } from "@/lib/api";

type SelectedLocation = {
  preset: LocationPreset | null;
  lat: number;
  lon: number;
};

type ShelterConfigurationValue = {
  location: SelectedLocation | null;
  climate: ClimateResponse | null;
  setLocationClimate: (location: SelectedLocation, climate: ClimateResponse) => void;
};

const ShelterConfigurationContext = createContext<ShelterConfigurationValue | null>(null);

export function ShelterConfigurationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<SelectedLocation | null>(null);
  const [climate, setClimate] = useState<ClimateResponse | null>(null);

  const value = useMemo(() => ({
    location,
    climate,
    setLocationClimate: (nextLocation: SelectedLocation, nextClimate: ClimateResponse) => {
      setLocation(nextLocation);
      setClimate(nextClimate);
    },
  }), [location, climate]);

  return <ShelterConfigurationContext.Provider value={value}>{children}</ShelterConfigurationContext.Provider>;
}

export function useShelterConfiguration() {
  const context = useContext(ShelterConfigurationContext);
  if (!context) throw new Error("useShelterConfiguration must be used within ShelterConfigurationProvider");
  return context;
}
