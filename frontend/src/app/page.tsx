"use client";

import { useState, type ReactNode } from "react";
import { LocationClimate } from "@/components/LocationClimate";
import { ShelterConfiguration } from "@/components/ShelterConfiguration";
import { MaterialsLibrary } from "@/components/MaterialsLibrary";
import { useShelterConfiguration } from "@/context/ShelterConfigurationContext";
import {
  Activity,
  Box,
  ChevronDown,
  ClipboardList,
  CloudSun,
  Download,
  FlaskConical,
  HelpCircle,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Thermometer,
  CheckCircle2,
  Layers,
} from "lucide-react";

import { SystemStatus } from "@/components/SystemStatus";

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Location Climate", icon: CloudSun },
  { label: "Shelter Configuration", icon: Box },
  { label: "Materials Library", icon: FlaskConical },
  { label: "Analysis", icon: Activity },
  { label: "Reports", icon: ClipboardList },
];

export default function Home() {
  const [activeItem, setActiveItem] = useState("Dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const { climate, geometry, location, wallLayers, roofLayers, isMaterialsConfigured } =
    useShelterConfiguration();

  return (
    <div className="app-shell">
      <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark"><Thermometer aria-hidden /></div>
          {!collapsed && <div><p className="brand-title">Shelter Thermal</p><p className="brand-subtitle">Designer</p></div>}
        </div>
        <div className="sidebar-section-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${activeItem === label ? "nav-item-active" : ""}`}
              onClick={() => setActiveItem(label)}
              title={collapsed ? label : undefined}
            >
              <Icon aria-hidden /><span>{!collapsed && label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="nav-item" title={collapsed ? "Settings" : undefined}><Settings aria-hidden />{!collapsed && <span>Settings</span>}</button>
          <button className="nav-item" title={collapsed ? "Help & Documentation" : undefined}><HelpCircle aria-hidden />{!collapsed && <span>Help & Documentation</span>}</button>
          <button className="collapse-button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}{!collapsed && <span>Collapse sidebar</span>}</button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left"><button className="mobile-menu" aria-label="Open navigation"><Menu aria-hidden /></button><span className="breadcrumb-muted">Workspace</span><span className="breadcrumb-separator">/</span><span>{activeItem}</span></div>
          <div className="topbar-right"><span className="env-badge"><span className="live-dot" />Development</span><button className="icon-button" aria-label="Download report"><Download aria-hidden /></button><div className="user-chip"><span className="avatar">DR</span><span className="user-name">DRDO Engineer</span><ChevronDown aria-hidden /></div></div>
        </header>

        <main className="content-area">
          {activeItem === "Location Climate" && <LocationClimate />}
          {activeItem === "Shelter Configuration" && <ShelterConfiguration />}
          {activeItem === "Materials Library" && <MaterialsLibrary />}
          {activeItem !== "Location Climate" &&
            activeItem !== "Shelter Configuration" &&
            activeItem !== "Materials Library" && (
              <DashboardHome
                climateConfigured={Boolean(climate)}
                geometryConfigured={Boolean(geometry)}
                materialsConfigured={isMaterialsConfigured}
                locationName={location?.preset?.name}
                wallLayersCount={wallLayers.length}
                roofLayersCount={roofLayers.length}
                geometrySummary={
                  geometry
                    ? `${geometry.length_m}m × ${geometry.width_m}m × ${geometry.height_m}m (${geometry.orientation ?? "North"})`
                    : undefined
                }
                onNavigate={(item) => setActiveItem(item)}
              />
            )}
        </main>
        <footer className="footer"><span>DRDO Thermal Analysis Initiative · Internal prototype</span><span>Data stays in your workspace</span></footer>
      </div>
    </div>
  );
}

function DashboardHome({
  climateConfigured,
  geometryConfigured,
  materialsConfigured,
  locationName,
  wallLayersCount,
  roofLayersCount,
  geometrySummary,
  onNavigate,
}: {
  climateConfigured: boolean;
  geometryConfigured: boolean;
  materialsConfigured: boolean;
  locationName?: string;
  wallLayersCount: number;
  roofLayersCount: number;
  geometrySummary?: string;
  onNavigate: (item: string) => void;
}) {
  const completedCount =
    (climateConfigured ? 1 : 0) +
    (geometryConfigured ? 1 : 0) +
    (materialsConfigured ? 1 : 0);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">SIH26051 · THERMAL ANALYSIS WORKSPACE</p>
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
          <span className="progress-copy">{completedCount} of 3 complete</span>
        </div>
        <div className="workflow-grid">
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
                ? `Wall: ${wallLayersCount} layers · Roof: ${roofLayersCount} layers`
                : "Select materials and build wall/roof assemblies."
            }
            configured={materialsConfigured}
            onClick={() => onNavigate("Materials Library")}
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
            {climateConfigured && geometryConfigured && materialsConfigured ? (
              <>
                <div className="empty-icon"><CheckCircle2 aria-hidden /></div>
                <h3>Envelope Ready for Simulation</h3>
                <p>
                  {locationName ? `${locationName} · ` : ""}
                  {geometrySummary} · {wallLayersCount} wall / {roofLayersCount} roof layers
                </p>
                <button className="primary-button" onClick={() => onNavigate("Materials Library")}>
                  Review envelope assembly
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


