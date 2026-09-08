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
  ArrowUpRight,
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
  Wind,
} from "lucide-react";

import { SystemStatus } from "@/components/SystemStatus";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=2400&q=85";

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

const sidebarNav = mobileNav.filter(({ label }) => label !== "Dashboard");

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
          <img className="hero-image" src={HERO_IMAGE} alt="" />
          <div className="hero-scrim" />
          <div className="hero-glow" />
          <AppHeader
            overlay
            activeItem={activeItem}
            menuOpen={menuOpen}
            onToggleMenu={() => setMenuOpen((open) => !open)}
            onNavigate={goTo}
          />
          <div className="hero-content">
            <div className="hero-kicker-row">
              <p className="eyebrow hero-eyebrow">SIH26051 · THERMAL ANALYSIS WORKSPACE</p>
              <span className="terrain-status"><span /> FIELD READY</span>
            </div>
            <h1 className="headline-fluid">Design for the conditions <em>beyond</em> the map.</h1>
            <p className="hero-copy">
              Configure your shelter design and run area-specific thermal analysis for extreme environments.
            </p>
            <div className="hero-cta">
              <button type="button" className="btn-square btn-square-hero" onClick={() => goTo("Location Climate")}>
                Begin configuration
                <ArrowUpRight className="btn-arrow-lg" aria-hidden />
              </button>
            </div>
            <div className="hero-coordinates" aria-label="Terrain design values">
              <span>ALTITUDE / VARIABLE</span>
              <span>ORIENTATION / NORTH</span>
              <span>MODEL / FIRST-ORDER</span>
            </div>
          </div>
          <div className="terrain-lines" aria-hidden>
            <i /><i /><i /><i /><i />
          </div>
          <p className="hero-index" aria-hidden>01 — START AT THE EDGE</p>
        </section>
      ) : (
        <AppHeader
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
                aria-current={activeItem === item ? "step" : undefined}
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

function BrandMark() {
  return (
    <svg className="brand-geo" viewBox="0 0 28 28" aria-hidden>
      <rect x="1" y="1" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="15" y="1" width="12" height="12" fill="currentColor" />
      <rect x="1" y="15" width="12" height="12" fill="currentColor" />
      <rect x="15" y="15" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function AppHeader({
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
    <header className={`app-header ${overlay ? "app-header-overlay" : "app-header-solid"}`}>
      <div className="app-header-inner">
        <button type="button" className="brand-lockup" onClick={() => onNavigate("Dashboard")}>
          <BrandMark />
          <span className="brand-name">
            Shelter Thermal
            <small>Designer</small>
          </span>
        </button>
        <nav className="nav-center" aria-label="Primary navigation">
          <span className="sidebar-nav-label">Workspace</span>
          {sidebarNav.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={activeItem === label ? "nav-link-active" : undefined}
              onClick={() => onNavigate(label)}
              aria-current={activeItem === label ? "page" : undefined}
            >
              <Icon aria-hidden />
              {label}
            </button>
          ))}
        </nav>
        <div className="nav-right">
          <button
            className="mobile-menu"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            onClick={onToggleMenu}
          >
            {menuOpen ? <X aria-hidden /> : <Menu aria-hidden />}
          </button>
          <button type="button" className="btn-square btn-square-nav" onClick={() => onNavigate("Location Climate")}>
            Begin configuration
            <ArrowUpRight className="btn-arrow" aria-hidden />
          </button>
        </div>
      </div>
      {menuOpen && (
        <div className="mobile-fullscreen" role="dialog" aria-label="Navigation">
          <div className="mobile-fullscreen-bar">
            <button type="button" className="brand-lockup" onClick={() => onNavigate("Dashboard")}>
              <BrandMark />
              <span className="brand-name">Shelter Thermal</span>
            </button>
            <button className="mobile-menu" aria-label="Close navigation" onClick={onToggleMenu}>
              <X aria-hidden />
            </button>
          </div>
          <nav className="mobile-fullscreen-nav">
            {mobileNav.map(({ label }) => (
              <button key={label} onClick={() => onNavigate(label)} aria-current={activeItem === label ? "page" : undefined}>
                {label}
              </button>
            ))}
          </nav>
          <button type="button" className="btn-square btn-square-hero" onClick={() => onNavigate("Location Climate")}>
            Begin configuration
            <ArrowUpRight className="btn-arrow-lg" aria-hidden />
          </button>
        </div>
      )}
    </header>
  );
}

function StatusChip({
  tone,
  children,
}: {
  tone: "pass" | "warn" | "fail";
  children: ReactNode;
}) {
  return (
    <span className={`v-chip v-chip-${tone}`}>
      <span className="v-chip-dot" />
      {children}
    </span>
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

  const workflowRows = [
    {
      id: "01-LOC",
      title: "Location Climate",
      item: "Location Climate",
      configured: climateConfigured,
      detail: climateConfigured
        ? locationName
          ? `${locationName} climate configured.`
          : "Climate profile configured."
        : "Select a location and review climate parameters.",
    },
    {
      id: "02-GEOM",
      title: "Shelter Geometry",
      item: "Shelter Configuration",
      configured: geometryConfigured,
      detail: geometryConfigured ? (geometrySummary ?? "Geometry configured.") : "Define dimensions and physical orientation.",
    },
    {
      id: "03-ENV",
      title: "Materials & Envelope",
      item: "Materials Library",
      configured: materialsConfigured,
      detail: materialsConfigured
        ? `Wall: ${wallLayersCount} · Roof: ${roofLayersCount} layers`
        : "Select materials and build wall/roof assemblies.",
    },
    {
      id: "04-GLZ",
      title: "Windows & Glazing",
      item: "Windows & Glazing",
      configured: windowsConfigured,
      detail: windowsConfigured
        ? `${windowArea !== undefined ? windowArea.toFixed(1) : "0.0"} m² window area`
        : "Define glazed aperture area and glazing type.",
    },
    {
      id: "05-OCC",
      title: "Ventilation & Occupants",
      item: "Ventilation & Occupants",
      configured: stage5Configured,
      detail: stage5Configured
        ? `${ventsOpen ? "Open (5.0 ACH)" : "Closed (0.5 ACH)"} · ${occupantsCount ?? 0} pers`
        : "Configure natural air exchange and internal occupant load.",
    },
    {
      id: "06-HVAC",
      title: "HVAC & Control",
      item: "HVAC & Thermal Control",
      configured: hvacConfigured,
      detail: hvacConfigured
        ? hvacMode === "setpoint"
          ? `Setpoint: ${hvacSetpoint !== null && hvacSetpoint !== undefined ? hvacSetpoint.toFixed(1) : "--"} °C`
          : "Floating (0 W HVAC)"
        : "Choose floating temperature or setpoint mode.",
    },
  ];

  const firstPending = workflowRows.find((row) => !row.configured)?.id ?? workflowRows[workflowRows.length - 1].id;
  const completePct = Math.round((completedCount / 6) * 100);

  return (
    <>
      <div className="notice">
        <ShieldCheck aria-hidden />
        <div>
          <strong>First-order estimation tool</strong>
          <p>
            This workspace provides engineering estimates for early-stage design decisions. Results are not a
            substitute for CFD, EnergyPlus, or certification models.
          </p>
        </div>
      </div>

      <section className="kpi-metrics-grid" aria-label="Workspace metrics">
        <div className="kpi-cell">
          <div className="kpi-figure">
            <span className="kpi-number">{completedCount}</span>
            <span className="kpi-unit">/6</span>
          </div>
          <p className="kpi-subline">Design workflow</p>
        </div>
        <div className="kpi-cell">
          <div className="kpi-figure">
            <span className="kpi-number">6</span>
            <span className="kpi-unit">steps</span>
          </div>
          <p className="kpi-subline">Complete each step to prepare your thermal analysis.</p>
        </div>
        <div className="kpi-cell">
          <div className="kpi-figure">
            <span className="kpi-number">{completePct}</span>
            <span className="kpi-unit">%</span>
          </div>
          <p className="kpi-subline">{completedCount} of 6 complete</p>
        </div>
        <div className="kpi-cell">
          <div className="kpi-figure">
            <span className="kpi-number">0.1</span>
            <span className="kpi-unit">v</span>
          </div>
          <p className="kpi-subline">Prototype v0.1</p>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Design workflow</h2>
            <p>Complete each step to prepare your thermal analysis.</p>
          </div>
          <span className="progress-copy">{completedCount} of 6 complete</span>
        </div>

        <div className="bento-grid">
          <article className="surface-card bento-card">
            <header className="bento-card-head">
              <h3>Design workflow</h3>
              <StatusChip tone={completedCount === 6 ? "pass" : "fail"}>
                {completedCount === 6 ? "PASS" : "FAIL"}
              </StatusChip>
            </header>
            <ul className="status-rows">
              {workflowRows.map((row) => (
                <li key={row.id}>
                  <button type="button" onClick={() => onNavigate(row.item)}>
                    <span className="status-row-id">{row.id}</span>
                    <span className="status-row-title">{row.title}</span>
                    <StatusChip tone={row.configured ? "pass" : "fail"}>
                      {row.configured ? "PASS" : "FAIL"}
                    </StatusChip>
                    <span className="status-row-delta">{row.configured ? "+100%" : "0%"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </article>

          <article className="surface-card bento-card">
            <header className="bento-card-head">
              <h3>Current project</h3>
              <StatusChip tone={completedCount === 6 ? "pass" : "warn"}>
                {completedCount === 6 ? "PASS" : "WARN"}
              </StatusChip>
            </header>
            <div className="cluster-bars">
              {workflowRows.map((row) => (
                <div key={row.id} className="cluster-row">
                  <div className="cluster-label">
                    <span>{row.title}</span>
                    <span className="data-muted">{row.configured ? "100%" : "0%"}</span>
                  </div>
                  <div className="cluster-track">
                    <span
                      className={`cluster-fill ${row.id === firstPending ? "cluster-fill-active" : ""}`}
                      style={{ width: row.configured ? "100%" : "8%" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="surface-card bento-card">
            <header className="bento-card-head">
              <h3>First-order estimation tool</h3>
              <StatusChip tone="warn">WARN</StatusChip>
            </header>
            <div className="diff-view" aria-label="Model assumptions">
              <pre className="diff-line diff-add">+ First-order estimation tool</pre>
              <pre className="diff-line diff-add">+ Engineering estimates for early-stage design decisions</pre>
              <pre className="diff-line diff-mod">~ Results are not a substitute for CFD, EnergyPlus, or certification models.</pre>
            </div>
          </article>
        </div>
      </section>

      <section className="section-block">
        <div className="surface-card event-stream">
          <header className="event-stream-head">
            <div>
              <p className="eyebrow">Design workflow</p>
              <h2>Complete each step to prepare your thermal analysis.</h2>
            </div>
            <div className="event-stream-chips">
              <StatusChip tone="warn">SIH26051</StatusChip>
              <StatusChip tone="pass">Prototype v0.1</StatusChip>
            </div>
          </header>
          <div className="event-stream-body">
            <aside className="event-sidebar">
              {workflowRows.map((row) => (
                <button
                  key={row.id}
                  className={`event-id-row ${row.id === firstPending ? "event-id-row-active" : ""}`}
                  onClick={() => onNavigate(row.item)}
                >
                  <span className={`event-dot ${row.configured ? "event-dot-pass" : "event-dot-fail"}`} />
                  <span>{row.id}</span>
                </button>
              ))}
            </aside>
            <div className="event-table-wrap">
              <table className="event-table">
                <thead>
                  <tr>
                    <th>SPAN</th>
                    <th>START</th>
                    <th>DURATION</th>
                  </tr>
                </thead>
                <tbody>
                  {workflowRows.map((row, index) => {
                    const start = (index / workflowRows.length) * 100;
                    const width = 100 / workflowRows.length;
                    return (
                      <tr
                        key={row.id}
                        className={row.id === firstPending ? "event-row-focus" : undefined}
                        onClick={() => onNavigate(row.item)}
                      >
                        <td>
                          <strong>{row.title}</strong>
                          <span className="data-muted">{row.detail}</span>
                        </td>
                        <td>
                          <div className="timeline">
                            <span
                              className={`timeline-bar ${row.id === firstPending ? "timeline-bar-active" : ""}`}
                              style={{ left: `${start}%`, width: `${width}%` }}
                            />
                          </div>
                        </td>
                        <td>{row.configured ? "CONFIGURED" : "CONFIGURE"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="lower-grid">
        <div className="surface-card panel">
          <div className="panel-heading">
            <div>
              <h2>System status</h2>
              <p>Live connectivity and service health</p>
            </div>
            <span className="status-live">
              <span className="live-dot" />
              Live
            </span>
          </div>
          <SystemStatus />
        </div>
        <div className="surface-card panel session-panel">
          <div className="panel-heading">
            <div>
              <h2>Current project</h2>
              <p>Your active design workspace</p>
            </div>
            <ClipboardList aria-hidden />
          </div>
          <ProjectStatus
            climateConfigured={climateConfigured}
            geometryConfigured={geometryConfigured}
            materialsConfigured={materialsConfigured}
            windowsConfigured={windowsConfigured}
            stage5Configured={stage5Configured}
            hvacConfigured={hvacConfigured}
            hvacMode={hvacMode}
            hvacSetpoint={hvacSetpoint}
            ventsOpen={ventsOpen}
            occupantsCount={occupantsCount}
            windowArea={windowArea}
            locationName={locationName}
            geometrySummary={geometrySummary}
            onNavigate={onNavigate}
          />
        </div>
      </section>
    </>
  );
}

function ProjectStatus({
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
  geometrySummary,
  onNavigate,
}: {
  climateConfigured: boolean;
  geometryConfigured: boolean;
  materialsConfigured: boolean;
  windowsConfigured: boolean;
  stage5Configured: boolean;
  hvacConfigured: boolean;
  hvacMode?: "floating" | "setpoint";
  hvacSetpoint?: number | null;
  ventsOpen?: boolean;
  occupantsCount?: number | null;
  windowArea?: number;
  locationName?: string;
  geometrySummary?: string;
  onNavigate: (item: string) => void;
}) {
  return (
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
          <button className="btn-square" onClick={() => onNavigate("Analysis")}>
            Launch Thermal Simulation
            <ArrowUpRight className="btn-arrow" aria-hidden />
          </button>
        </>
      ) : climateConfigured && geometryConfigured && materialsConfigured && windowsConfigured && stage5Configured ? (
        <>
          <div className="empty-icon"><CheckCircle2 aria-hidden /></div>
          <h3>Shelter Envelope & Occupancy Configured</h3>
          <p>
            {locationName ? `${locationName} · ` : ""}
            {geometrySummary}. Next, configure HVAC operational mode and temperature setpoint.
          </p>
          <button className="btn-square" onClick={() => onNavigate("HVAC & Thermal Control")}>
            Configure HVAC & setpoint
            <ArrowUpRight className="btn-arrow" aria-hidden />
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
          <button className="btn-square" onClick={() => onNavigate("Ventilation & Occupants")}>
            Configure ventilation & occupants
            <ArrowUpRight className="btn-arrow" aria-hidden />
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
          <button className="btn-square" onClick={() => onNavigate("Windows & Glazing")}>
            Configure windows & glazing
            <ArrowUpRight className="btn-arrow" aria-hidden />
          </button>
        </>
      ) : climateConfigured && geometryConfigured ? (
        <>
          <div className="empty-icon"><CheckCircle2 aria-hidden /></div>
          <h3>Location & Geometry Configured</h3>
          <p>
            {locationName ? `${locationName} · ` : ""}
            {geometrySummary}. Next, configure materials and envelope assemblies.
          </p>
          <button className="btn-square" onClick={() => onNavigate("Materials Library")}>
            Configure envelope materials
            <ArrowUpRight className="btn-arrow" aria-hidden />
          </button>
        </>
      ) : climateConfigured ? (
        <>
          <div className="empty-icon"><CheckCircle2 aria-hidden /></div>
          <h3>Location configured</h3>
          <p>Your climate profile is ready. Next, configure shelter geometry dimensions.</p>
          <button className="btn-square" onClick={() => onNavigate("Shelter Configuration")}>
            Configure geometry
            <ArrowUpRight className="btn-arrow" aria-hidden />
          </button>
        </>
      ) : geometryConfigured ? (
        <>
          <div className="empty-icon"><CheckCircle2 aria-hidden /></div>
          <h3>Geometry configured</h3>
          <p>Shelter dimensions are set. Next, select a location to load climate data.</p>
          <button className="btn-square" onClick={() => onNavigate("Location Climate")}>
            Select location climate
            <ArrowUpRight className="btn-arrow" aria-hidden />
          </button>
        </>
      ) : (
        <>
          <div className="empty-icon"><Box aria-hidden /></div>
          <h3>No project configured</h3>
          <p>Start by selecting a location climate to create your first thermal design.</p>
          <button className="btn-square" onClick={() => onNavigate("Location Climate")}>
            Begin configuration
            <ArrowUpRight className="btn-arrow" aria-hidden />
          </button>
        </>
      )}
    </div>
  );
}
