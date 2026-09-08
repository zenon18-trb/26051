"use client";

import { useState, type ReactNode } from "react";
import { LocationClimate } from "@/components/LocationClimate";
import { ShelterConfiguration } from "@/components/ShelterConfiguration";
import { MaterialsLibrary } from "@/components/MaterialsLibrary";
import { WindowsGlazing } from "@/components/WindowsGlazing";
import { VentilationOccupants } from "@/components/VentilationOccupants";
import { HvacThermalControl } from "@/components/HvacThermalControl";
import { ThermalSimulation } from "@/components/ThermalSimulation";
import { SimulationResults } from "@/components/SimulationResults";
import { useShelterConfiguration } from "@/context/ShelterConfigurationContext";
import {
  Activity,
  AppWindow,
  Box,
  ClipboardList,
  CloudSun,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  X,
  CheckCircle2,
  Layers,
  Wind,
} from "lucide-react";

import { SystemStatus } from "@/components/SystemStatus";

const HERO_VIDEO =
  "https://designerstephen.github.io/public-assets/videos/serene-art-hero.mp4";

const centerLinks = [
  { label: "Location", item: "Location Climate" },
  { label: "Configuration", item: "Shelter Configuration" },
  { label: "Analysis", item: "Analysis" },
  { label: "Reports", item: "Reports" },
] as const;

const pipeline = [
  { label: "Overview", item: "Dashboard" },
  { label: "Location", item: "Location Climate" },
  { label: "Geometry", item: "Shelter Configuration" },
  { label: "Materials", item: "Materials Library" },
  { label: "Windows", item: "Windows & Glazing" },
  { label: "Ventilation", item: "Ventilation & Occupants" },
  { label: "HVAC", item: "HVAC & Thermal Control" },
  { label: "Analysis", item: "Analysis" },
  { label: "Reports", item: "Reports" },
] as const;

const mobileNav = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Location Climate", icon: CloudSun },
  { label: "Shelter Configuration", icon: Box },
  { label: "Materials Library", icon: FlaskConical },
  { label: "Windows & Glazing", icon: AppWindow },
  { label: "Ventilation & Occupants", icon: Wind },
  { label: "HVAC & Thermal Control", icon: Gauge },
  { label: "Analysis", icon: Activity },
  { label: "Reports", icon: ClipboardList },
];

export default function Home() {
  const [activeItem, setActiveItem] = useState("Dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const {
    climate,
    geometry,
    location,
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
  } = useShelterConfiguration();

  const isDashboard = activeItem === "Dashboard";

  function goTo(item: string) {
    setActiveItem(item);
    setMenuOpen(false);
  }

  return (
    <div className="app-shell">
      {isDashboard ? (
        <section className="hero-section">
          <video
            className="hero-video"
            autoPlay
            muted
            loop
            playsInline
            aria-hidden
          >
            <source src={HERO_VIDEO} type="video/mp4" />
          </video>
          <div className="hero-overlay" />
          <EditorialNav
            overlay
            activeItem={activeItem}
            menuOpen={menuOpen}
            onToggleMenu={() => setMenuOpen((open) => !open)}
            onNavigate={goTo}
          />
          <div className="hero-content">
            <h1 className="hero-heading">
              Area-specific <em>shelter</em> thermal design
            </h1>
            <p className="hero-copy">
              A first-order estimation tool for heat flow, 24-hour indoor
              temperature, and comfort — traceable physics, not CFD.
            </p>
            <div className="hero-cta">
              <button
                className="pill-button pill-button-hero"
                onClick={() => goTo("Location Climate")}
              >
                Begin analysis
              </button>
            </div>
          </div>
        </section>
      ) : (
        <EditorialNav
          overlay={false}
          activeItem={activeItem}
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((open) => !open)}
          onNavigate={goTo}
        />
      )}

      <div className="main-area">
        {!isDashboard && (
          <div className="stage-strip" aria-label="Design pipeline">
            {pipeline.map(({ label, item }) => (
              <button
                key={item}
                className={`stage-chip ${activeItem === item ? "stage-chip-active" : ""}`}
                onClick={() => goTo(item)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <main className="content-area">
          {activeItem === "Location Climate" && <LocationClimate />}
          {activeItem === "Shelter Configuration" && <ShelterConfiguration />}
          {activeItem === "Materials Library" && <MaterialsLibrary />}
          {activeItem === "Windows & Glazing" && <WindowsGlazing />}
          {activeItem === "Ventilation & Occupants" && <VentilationOccupants />}
          {activeItem === "HVAC & Thermal Control" && <HvacThermalControl />}
          {activeItem === "Analysis" && (
            <ThermalSimulation onNavigateToResults={() => goTo("Reports")} />
          )}
          {activeItem === "Reports" && (
            <SimulationResults onNavigateToSimulation={() => goTo("Analysis")} />
          )}
          {isDashboard && (
            <DashboardHome
              climateConfigured={Boolean(climate)}
              geometryConfigured={Boolean(geometry)}
              materialsConfigured={isMaterialsConfigured}
              windowsConfigured={isWindowsConfigured}
              ventilationConfigured={isVentilationConfigured}
              occupantsConfigured={isOccupantsConfigured}
              stage5Configured={isVentilationAndOccupantsConfigured}
              hvacConfigured={isHvacConfigured}
              hvacMode={hvac?.mode}
              hvacSetpoint={hvac?.setpoint_c}
              ventsOpen={vents?.open}
              occupantsCount={occupants}
              windowArea={windows?.area_m2}
              locationName={location?.preset?.name}
              wallLayersCount={wallLayers.length}
              roofLayersCount={roofLayers.length}
              geometrySummary={
                geometry
                  ? `${geometry.length_m}m × ${geometry.width_m}m × ${geometry.height_m}m (${geometry.orientation ?? "North"})`
                  : undefined
              }
              onNavigate={(item) => goTo(item)}
            />
          )}
        </main>
        <footer className="footer">
          <span>DRDO Thermal Analysis Initiative · Internal prototype</span>
          <span>Data stays in your workspace</span>
        </footer>
      </div>
    </div>
  );
}

function EditorialNav({
  overlay,
  activeItem,
  menuOpen,
  onToggleMenu,
  onNavigate,
}: {
  overlay: boolean;
  activeItem: string;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onNavigate: (item: string) => void;
}) {
  return (
    <header className={`editorial-nav ${overlay ? "editorial-nav-overlay" : "editorial-nav-solid"}`}>
      <div className="editorial-nav-inner">
        <button className="brand-wordmark" onClick={() => onNavigate("Dashboard")}>
          Shelter Thermal<sup>®</sup>
        </button>
        <nav className="nav-center" aria-label="Primary navigation">
          {centerLinks.map(({ label, item }) => (
            <button
              key={item}
              className={activeItem === item ? "nav-link-active" : undefined}
              onClick={() => onNavigate(item)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="nav-right">
          <button className="mobile-menu" aria-label={menuOpen ? "Close navigation" : "Open navigation"} onClick={onToggleMenu}>
            {menuOpen ? <X aria-hidden /> : <Menu aria-hidden />}
          </button>
          <button className="pill-button" onClick={() => onNavigate("Location Climate")}>
            Begin analysis
          </button>
        </div>
      </div>
      {menuOpen && (
        <div className="mobile-drawer mobile-drawer-open">
          {mobileNav.map(({ label }) => (
            <button key={label} onClick={() => onNavigate(label)}>
              {label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}

function DashboardHome({
  climateConfigured,
  geometryConfigured,
  materialsConfigured,
  windowsConfigured,
  stage5Configured,
  hvacConfigured,
  hvacMode,
  hvacSetpoint,
  ventsOpen,
  occupantsCount,
  windowArea,
  locationName,
  wallLayersCount,
  roofLayersCount,
  geometrySummary,
  onNavigate,
}: {
  climateConfigured: boolean;
  geometryConfigured: boolean;
  materialsConfigured: boolean;
  windowsConfigured: boolean;
  ventilationConfigured?: boolean;
  occupantsConfigured?: boolean;
  stage5Configured: boolean;
  hvacConfigured: boolean;
  hvacMode?: "floating" | "setpoint";
  hvacSetpoint?: number | null;
  ventsOpen?: boolean;
  occupantsCount?: number | null;
  windowArea?: number;
  locationName?: string;
  wallLayersCount: number;
  roofLayersCount: number;
  geometrySummary?: string;
  onNavigate: (item: string) => void;
}) {
  const completedCount =
    (climateConfigured ? 1 : 0) +
    (geometryConfigured ? 1 : 0) +
    (materialsConfigured ? 1 : 0) +
    (windowsConfigured ? 1 : 0) +
    (stage5Configured ? 1 : 0) +
    (hvacConfigured ? 1 : 0);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">SIH26051 · Thermal analysis workspace</p>
          <h1>Welcome to Shelter Thermal Designer</h1>
          <p className="page-description">
            Configure your shelter design and run area-specific thermal analysis for extreme environments.
          </p>
        </div>
        <div className="prototype-tag"><ShieldCheck aria-hidden /> Prototype v0.1</div>
      </div>
      <div className="notice">
        <ShieldCheck aria-hidden />
        <div>
          <strong>First-order estimation tool</strong>
          <p>This workspace provides engineering estimates for early-stage design decisions. Results are not a substitute for CFD, EnergyPlus, or certification models.</p>
        </div>
      </div>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Design workflow</h2>
            <p>Complete each step to prepare your thermal analysis.</p>
          </div>
          <span className="progress-copy">{completedCount} of 6 complete</span>
        </div>
        <div className="workflow-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <WorkflowCard
            number="01"
            icon={<CloudSun aria-hidden />}
            title="Location Climate"
            description={climateConfigured ? (locationName ? `${locationName} climate configured.` : "Climate profile configured.") : "Select a location and review climate parameters."}
            configured={climateConfigured}
            onClick={() => onNavigate("Location Climate")}
          />
          <WorkflowCard
            number="02"
            icon={<Box aria-hidden />}
            title="Shelter Geometry"
            description={geometryConfigured ? (geometrySummary ?? "Geometry configured.") : "Define dimensions and physical orientation."}
            configured={geometryConfigured}
            onClick={() => onNavigate("Shelter Configuration")}
          />
          <WorkflowCard
            number="03"
            icon={<Layers aria-hidden />}
            title="Materials &amp; Envelope"
            description={
              materialsConfigured
                ? `Wall: ${wallLayersCount} · Roof: ${roofLayersCount} layers`
                : "Select materials and build wall/roof assemblies."
            }
            configured={materialsConfigured}
            onClick={() => onNavigate("Materials Library")}
          />
          <WorkflowCard
            number="04"
            icon={<AppWindow aria-hidden />}
            title="Windows &amp; Glazing"
            description={
              windowsConfigured
                ? `${windowArea !== undefined ? windowArea.toFixed(1) : "0.0"} m² window area`
                : "Define glazed aperture area and glazing type."
            }
            configured={windowsConfigured}
            onClick={() => onNavigate("Windows & Glazing")}
          />
          <WorkflowCard
            number="05"
            icon={<Wind aria-hidden />}
            title="Ventilation &amp; Occupants"
            description={
              stage5Configured
                ? `${ventsOpen ? "Open (5.0 ACH)" : "Closed (0.5 ACH)"} · ${occupantsCount ?? 0} pers`
                : "Configure natural air exchange and internal occupant load."
            }
            configured={stage5Configured}
            onClick={() => onNavigate("Ventilation & Occupants")}
          />
          <WorkflowCard
            number="06"
            icon={<Gauge aria-hidden />}
            title="HVAC &amp; Control"
            description={
              hvacConfigured
                ? hvacMode === "setpoint"
                  ? `Setpoint: ${hvacSetpoint !== null && hvacSetpoint !== undefined ? hvacSetpoint.toFixed(1) : "--"} °C`
                  : "Floating (0 W HVAC)"
                : "Choose floating temperature or setpoint mode."
            }
            configured={hvacConfigured}
            onClick={() => onNavigate("HVAC & Thermal Control")}
          />
        </div>
      </section>

      <section className="lower-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>System status</h2>
              <p>Live connectivity and service health</p>
            </div>
            <span className="status-live"><span className="live-dot" />Live</span>
          </div>
          <SystemStatus />
        </div>
        <div className="panel session-panel">
          <div className="panel-heading">
            <div>
              <h2>Current project</h2>
              <p>Your active design workspace</p>
            </div>
            <ClipboardList aria-hidden />
          </div>
          <div className="empty-project">
            {climateConfigured && geometryConfigured && materialsConfigured && windowsConfigured && stage5Configured && hvacConfigured ? (
              <>
                <div className="empty-icon"><CheckCircle2 aria-hidden /></div>
                <h3>Complete Shelter Model Ready for Simulation</h3>
                <p>
                  {locationName ? `${locationName} · ` : ""}
                  {geometrySummary} · {windowArea !== undefined ? windowArea.toFixed(1) : "0.0"} m² glazing ·{" "}
                  {ventsOpen ? "5.0 ACH Open" : "0.5 ACH Closed"} · {occupantsCount ?? 0} occupants ·{" "}
                  {hvacMode === "setpoint" ? `Setpoint ${hvacSetpoint?.toFixed(1)} °C` : "Floating Drift (0 W HVAC)"}
                </p>
                <button className="primary-button" onClick={() => onNavigate("Analysis")}>
                  Launch Thermal Simulation
                </button>
              </>
            ) : climateConfigured && geometryConfigured && materialsConfigured && windowsConfigured && stage5Configured ? (
              <>
                <div className="empty-icon"><CheckCircle2 aria-hidden /></div>
                <h3>Shelter Envelope &amp; Occupancy Configured</h3>
                <p>
                  {locationName ? `${locationName} · ` : ""}
                  {geometrySummary}. Next, configure HVAC operational mode and temperature setpoint.
                </p>
                <button className="primary-button" onClick={() => onNavigate("HVAC & Thermal Control")}>
                  Configure HVAC &amp; setpoint
                </button>
              </>
            ) : climateConfigured && geometryConfigured && materialsConfigured && windowsConfigured ? (
              <>
                <div className="empty-icon"><CheckCircle2 aria-hidden /></div>
                <h3>Glazed Envelope Configured</h3>
                <p>
                  {locationName ? `${locationName} · ` : ""}
                  {geometrySummary}. Next, configure ventilation state and occupant internal heat load.
                </p>
                <button className="primary-button" onClick={() => onNavigate("Ventilation & Occupants")}>
                  Configure ventilation &amp; occupants
                </button>
              </>
            ) : climateConfigured && geometryConfigured && materialsConfigured ? (
              <>
                <div className="empty-icon"><CheckCircle2 aria-hidden /></div>
                <h3>Envelope Materials Ready</h3>
                <p>
                  {locationName ? `${locationName} · ` : ""}
                  {geometrySummary}. Next, configure windows and glazing aperture.
                </p>
                <button className="primary-button" onClick={() => onNavigate("Windows & Glazing")}>
                  Configure windows &amp; glazing
                </button>
              </>
            ) : climateConfigured && geometryConfigured ? (
              <>
                <div className="empty-icon"><CheckCircle2 aria-hidden /></div>
                <h3>Location &amp; Geometry Configured</h3>
                <p>
                  {locationName ? `${locationName} · ` : ""}
                  {geometrySummary}. Next, configure materials and envelope assemblies.
                </p>
                <button className="primary-button" onClick={() => onNavigate("Materials Library")}>
                  Configure envelope materials
                </button>
              </>
            ) : climateConfigured ? (
              <>
                <div className="empty-icon"><CheckCircle2 aria-hidden /></div>
                <h3>Location configured</h3>
                <p>Your climate profile is ready. Next, configure shelter geometry dimensions.</p>
                <button className="primary-button" onClick={() => onNavigate("Shelter Configuration")}>
                  Configure geometry
                </button>
              </>
            ) : geometryConfigured ? (
              <>
                <div className="empty-icon"><CheckCircle2 aria-hidden /></div>
                <h3>Geometry configured</h3>
                <p>Shelter dimensions are set. Next, select a location to load climate data.</p>
                <button className="primary-button" onClick={() => onNavigate("Location Climate")}>
                  Select location climate
                </button>
              </>
            ) : (
              <>
                <div className="empty-icon"><Box aria-hidden /></div>
                <h3>No project configured</h3>
                <p>Start by selecting a location climate to create your first thermal design.</p>
                <button className="primary-button" onClick={() => onNavigate("Location Climate")}>
                  Begin configuration
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function WorkflowCard({
  number,
  icon,
  title,
  description,
  configured = false,
  onClick,
}: {
  number: string;
  icon: ReactNode;
  title: string;
  description: string;
  configured?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`workflow-card ${configured ? "workflow-card-configured" : ""}`}
      onClick={onClick}
    >
      <div className="card-topline">
        <span className="step-number">{number}</span>
        <span className="card-icon">{icon}</span>
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      <span className="card-action">
        {configured ? "Configured" : "Configure"} <span aria-hidden>→</span>
      </span>
    </button>
  );
}
