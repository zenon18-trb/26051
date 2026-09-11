"use client";

import { useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
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
  ArrowDown,
  Box,
  ClipboardList,
  CloudSun,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  X,
  Wind,
} from "lucide-react";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=88";

const overviewImages = [
  {
    src: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=1200&q=82",
    alt: "Snow-covered Himalayan ridgeline under a clear sky",
  },
  {
    src: "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=82",
    alt: "Small shelter set within an alpine landscape",
  },
  {
    src: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=82",
    alt: "Mountain lake reflecting the surrounding terrain",
  },
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

const sidebarNav = mobileNav.filter(({ label }) => label !== "Dashboard");

const landingNav = [
  { label: "Overview", item: "Dashboard" },
  { label: "Climate", item: "Location Climate" },
  { label: "Analysis", item: "Analysis" },
  { label: "Reports", item: "Reports" },
] as const;

export default function Home() {
  const [activeItem, setActiveItem] = useState("Dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const heroImageY = useTransform(scrollY, [0, 900], [0, -82]);
  const heroImageScale = useTransform(scrollY, [0, 900], [1.01, 1.14]);
  const heroContentY = useTransform(scrollY, [0, 650], [0, -104]);
  const heroContentOpacity = useTransform(scrollY, [0, 580], [1, 0]);
  const terrainY = useTransform(scrollY, [0, 900], [0, -148]);
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
    <div className={`app-shell ${isDashboard ? "app-shell-landing" : ""}`}>
      {isDashboard ? (
        <section className="hero-section">
          <motion.img
            className="hero-image"
            src={HERO_IMAGE}
            alt=""
            style={shouldReduceMotion ? undefined : { y: heroImageY, scale: heroImageScale }}
          />
          <div className="hero-scrim" />
          <div className="hero-glow" />
          <motion.div className="hero-atmosphere" aria-hidden style={shouldReduceMotion ? undefined : { y: terrainY }}>
            <span className="hero-grid" />
            <span className="hero-orbit hero-orbit-one" />
            <span className="hero-orbit hero-orbit-two" />
            <ThermalCore className="thermal-core-hero" />
          </motion.div>
          <AppHeader
            overlay
            activeItem={activeItem}
            menuOpen={menuOpen}
            onToggleMenu={() => setMenuOpen((open) => !open)}
            onNavigate={goTo}
          />
          <motion.div
            className="hero-content"
            style={shouldReduceMotion ? undefined : { y: heroContentY, opacity: heroContentOpacity }}
          >
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
          </motion.div>
          <motion.div className="terrain-lines" aria-hidden style={shouldReduceMotion ? undefined : { y: terrainY }}>
            <i /><i /><i /><i /><i />
          </motion.div>
          <p className="hero-index" aria-hidden>01 — START AT THE EDGE</p>
          <button
            type="button"
            className="scroll-cue"
            onClick={() => document.getElementById("overview-brief")?.scrollIntoView({ behavior: "smooth" })}
          >
            <span>Explore the conditions</span>
            <ArrowDown aria-hidden />
          </button>
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
            <>
              <FieldConditions />
              <OverviewBrief />
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
            </>
          )}
        </main>
        {isDashboard ? (
          <LandingFooter onNavigate={goTo} />
        ) : (
          <footer className="footer">
            <span>DRDO Thermal Analysis Initiative · Internal prototype</span>
            <span>Data stays in your workspace</span>
          </footer>
        )}
      </div>
    </div>
  );
}

const fieldConditions = [
  {
    label: "01 / AIR",
    title: "The climate sets the first constraint.",
    copy: "A shelter does not encounter an average day. It encounters an hour-by-hour sequence of cold, sun, wind and recovery.",
    value: "−06°",
    unit: "OUTDOOR LOW",
    image: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1800&q=85",
    alt: "Snowy high-altitude mountain range at dusk",
  },
  {
    label: "02 / SUN",
    title: "Solar gain can turn a wall into a thermal battery.",
    copy: "Orientation, glazing and material layers determine how much of the day’s energy reaches the occupied space.",
    value: "790",
    unit: "W/M² PEAK SOLAR",
    image: "https://images.unsplash.com/photo-1464278533981-50106e6176b1?auto=format&fit=crop&w=1800&q=85",
    alt: "Low sun crossing a rugged mountain ridge",
  },
  {
    label: "03 / SHELTER",
    title: "A first-order model makes the next decision clearer.",
    copy: "Test the envelope before committing to a detailed study, a procurement choice or a site-ready prototype.",
    value: "24H",
    unit: "THERMAL RESPONSE",
    image: "https://images.unsplash.com/photo-1483347756197-71ef80e95f73?auto=format&fit=crop&w=1800&q=85",
    alt: "Compact shelter in a remote alpine valley",
  },
] as const;

function FieldConditions() {
  const sectionRef = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const progress = useSpring(scrollYProgress, { stiffness: 95, damping: 28, restDelta: 0.001 });
  const x = useTransform(progress, [0, 1], ["0%", "-66.666%"]);
  const imageScale = useTransform(progress, [0, 1], [1.03, 1.14]);

  return (
    <section className="field-sequence" ref={sectionRef} aria-label="Field conditions">
      <div className="field-sequence-sticky">
        <div className="field-sequence-head">
          <p className="eyebrow">THE CONDITIONS MOVE FIRST</p>
          <span>SCROLL TO FOLLOW / 03</span>
        </div>
        <motion.div className="field-progress" style={{ scaleX: shouldReduceMotion ? 0 : progress }} aria-hidden />
        <motion.div className="field-sequence-track" style={{ x: shouldReduceMotion ? 0 : x }}>
          {fieldConditions.map((condition, index) => (
            <article className="field-panel" key={condition.label}>
              <motion.img
                className="field-panel-image"
                src={condition.image}
                alt={condition.alt}
                style={shouldReduceMotion ? undefined : { scale: imageScale }}
              />
              <div className="field-panel-scrim" />
              <div className="field-panel-content">
                <span className="field-panel-index">{condition.label}</span>
                <div className="field-panel-stat">
                  <strong>{condition.value}</strong>
                  <span>{condition.unit}</span>
                </div>
                <div className="field-panel-copy">
                  <h2>{condition.title}</h2>
                  <p>{condition.copy}</p>
                </div>
              </div>
              <span className="field-panel-page" aria-hidden>0{index + 1}</span>
            </article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function OverviewBrief() {
  return (
    <section className="overview-brief" id="overview-brief" aria-labelledby="overview-brief-title">
      <div className="overview-brief-intro">
        <p className="eyebrow">A FIELD DECISION, NOT A FEATURE TOUR</p>
        <h2 id="overview-brief-title">Every shelter begins with the environment it has to answer to.</h2>
      </div>
      <div className="overview-path" aria-label="Engineering decision journey">
        {[
          ["01 / READ", "Start with terrain.", "Climate, altitude, solar exposure and wind establish the conditions before a wall is drawn."],
          ["02 / TEST", "Make the trade-offs visible.", "Build a credible envelope, then trace how the choices alter a 24-hour thermal response."],
          ["03 / DECIDE", "Leave with an informed next move.", "Use a first-order estimate to focus detailed modelling and physical testing where they matter most."],
        ].map(([label, title, copy], index) => (
          <motion.article
            key={label}
            className={`overview-step ${index === 2 ? "overview-step-decision" : ""}`}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.55, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <span>{label}</span>
            <div className="overview-story-image">
              {index === 2 ? (
                <DecisionVisual image={overviewImages[index]} />
              ) : (
                <img src={overviewImages[index].src} alt={overviewImages[index].alt} />
              )}
            </div>
            <h3>{title}</h3>
            <p>{copy}</p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

function DecisionVisual({ image }: { image: (typeof overviewImages)[number] }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <>
      <img src={image.src} alt={image.alt} />
      <div className="decision-visual-scrim" aria-hidden />
      <div className="decision-visual-meta" aria-hidden>
        <span>THERMAL WINDOW</span>
        <strong>18:00 — 06:00</strong>
      </div>
      <svg className="decision-trace" viewBox="0 0 260 74" preserveAspectRatio="none" aria-hidden>
        <path className="decision-trace-guide" d="M0 57 H260" />
        <motion.path
          d="M0 58 C28 56 35 39 56 43 S91 63 114 46 S149 13 174 28 S211 48 260 16"
          className="decision-trace-line"
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: shouldReduceMotion ? 0 : 1.45, ease: "easeInOut", delay: 0.25 }}
        />
        <motion.circle
          cx="174"
          cy="28"
          r="4"
          className="decision-trace-node"
          initial={{ scale: 0, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.35, delay: 1.35 }}
        />
      </svg>
      <motion.span
        className="decision-visual-status"
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.45, delay: 1.15 }}
      >
        <i /> RESPONSE VISIBLE
      </motion.span>
    </>
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
  const navItems = overlay ? landingNav : sidebarNav;

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
          {!overlay && <span className="sidebar-nav-label">Workspace</span>}
          {navItems.map(({ label, ...navItem }) => {
            const item = "item" in navItem ? navItem.item : label;
            const Icon = "icon" in navItem ? navItem.icon : undefined;

            return (
            <button
              key={item}
              className={activeItem === item ? "nav-link-active" : undefined}
              onClick={() => onNavigate(item)}
              aria-current={activeItem === item ? "page" : undefined}
            >
              {Icon && <Icon aria-hidden />}
              {label}
            </button>
            );
          })}
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
      <ProjectReadiness
        workflowRows={workflowRows}
        completedCount={completedCount}
        completePct={completePct}
        firstPending={firstPending}
        onNavigate={onNavigate}
      />

    </>
  );
}

type WorkflowRow = {
  id: string;
  title: string;
  item: string;
  configured: boolean;
  detail: string;
};

function ProjectReadiness({
  workflowRows,
  completedCount,
  completePct,
  firstPending,
  onNavigate,
}: {
  workflowRows: WorkflowRow[];
  completedCount: number;
  completePct: number;
  firstPending: string;
  onNavigate: (item: string) => void;
}) {
  const nextStep = workflowRows.find((row) => row.id === firstPending) ?? workflowRows[0];
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="readiness-command" aria-labelledby="readiness-title">
      <motion.div
        className="readiness-brief"
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <ThermalCore />
        <div className="readiness-brief-copy">
          <p className="eyebrow">PROJECT READINESS / SIH26051</p>
          <h2 id="readiness-title">Define the system before you ask it a question.</h2>
          <p>
            Six inputs become one traceable thermal response. Start with the site, then move along the route at your own pace.
          </p>
          <button type="button" className="readiness-start" onClick={() => onNavigate(nextStep.item)}>
            Continue with {nextStep.title}
            <ArrowUpRight aria-hidden />
          </button>
        </div>
        <div className="readiness-meter" aria-label={`${completedCount} of 6 stages configured`}>
          <span>READINESS</span>
          <strong>{completePct}<small>%</small></strong>
          <div className="readiness-meter-track"><motion.i initial={{ scaleX: 0 }} whileInView={{ scaleX: completePct / 100 }} viewport={{ once: true }} transition={{ duration: shouldReduceMotion ? 0 : 0.9, delay: 0.25 }} /></div>
          <p>{completedCount} / 6 inputs defined</p>
        </div>
      </motion.div>

      <div className="readiness-route" aria-label="Configuration route">
        {workflowRows.map((row, index) => (
          <motion.button
            type="button"
            key={row.id}
            className={`readiness-node ${row.configured ? "readiness-node-complete" : ""} ${row.id === firstPending ? "readiness-node-next" : ""}`}
            onClick={() => onNavigate(row.item)}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.42, delay: index * 0.075 }}
          >
            <span className="readiness-node-marker">{row.configured ? "✓" : `0${index + 1}`}</span>
            <span className="readiness-node-title">{row.title}</span>
            <span className="readiness-node-detail">{row.configured ? row.detail : row.id === firstPending ? "Next input" : "Awaiting input"}</span>
            {index < workflowRows.length - 1 && <i className="readiness-connector" aria-hidden />}
          </motion.button>
        ))}
      </div>

      <motion.aside
        className="readiness-note"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.5, delay: 0.2 }}
      >
        <ShieldCheck aria-hidden />
        <p><strong>First-order estimation tool.</strong> Use results to direct detailed modelling, physical testing and certification—not replace them.</p>
      </motion.aside>
    </section>
  );
}

function LandingFooter({ onNavigate }: { onNavigate: (item: string) => void }) {
  const shouldReduceMotion = useReducedMotion();
  const footerPhotos = [
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=700&q=80",
    "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=700&q=80",
    "https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=700&q=80",
  ];

  return (
    <footer className="landing-footer">
      <motion.div
        className="footer-polaroids"
        initial={{ opacity: 0, y: 34 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.65, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden
      >
        {footerPhotos.map((photo, index) => (
          <motion.figure
            key={photo}
            className={`footer-polaroid footer-polaroid-${index + 1}`}
            whileHover={shouldReduceMotion ? undefined : { y: -12, rotate: index === 1 ? 0 : index === 0 ? -2 : 2 }}
            transition={{ type: "spring", stiffness: 240, damping: 18 }}
          >
            <img src={photo} alt="" />
            <figcaption>{["LEH / 3524 M", "SOLAR / 790 W/M²", "FIELD / READY"][index]}</figcaption>
          </motion.figure>
        ))}
      </motion.div>
      <div className="landing-footer-main">
        <div>
          <p className="eyebrow">THE NEXT READING STARTS HERE</p>
          <h2>Bring the conditions <em>into</em> the design.</h2>
        </div>
        <button type="button" className="landing-footer-cta" onClick={() => onNavigate("Location Climate")}>
          Begin configuration <ArrowUpRight aria-hidden />
        </button>
      </div>
      <div className="landing-footer-bottom">
        <button type="button" className="landing-footer-brand" onClick={() => onNavigate("Dashboard")}>
          <BrandMark /> <span>Shelter Thermal <small>Designer</small></span>
        </button>
        <nav aria-label="Footer navigation">
          <button type="button" onClick={() => onNavigate("Location Climate")}>Climate</button>
          <button type="button" onClick={() => onNavigate("Analysis")}>Analysis</button>
          <button type="button" onClick={() => onNavigate("Reports")}>Reports</button>
        </nav>
        <span>DRDO Thermal Analysis Initiative · Internal prototype</span>
      </div>
    </footer>
  );
}

function ThermalCore({ className = "" }: { className?: string }) {
  const shouldReduceMotion = useReducedMotion();
  const loop = shouldReduceMotion ? undefined : { duration: 18, repeat: Infinity, ease: "linear" as const };

  return (
    <div className={`thermal-core-scene ${className}`} aria-hidden>
      <motion.div
        className="thermal-core-world"
        animate={shouldReduceMotion ? undefined : { rotateY: [-18, 24, -18], rotateX: [10, -8, 10] }}
        transition={shouldReduceMotion ? undefined : { duration: 9, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.span className="thermal-ring thermal-ring-one" animate={shouldReduceMotion ? undefined : { rotateZ: 360 }} transition={loop} />
        <motion.span className="thermal-ring thermal-ring-two" animate={shouldReduceMotion ? undefined : { rotateZ: -360 }} transition={{ ...loop, duration: 13 }} />
        <motion.span className="thermal-ring thermal-ring-three" animate={shouldReduceMotion ? undefined : { rotateZ: 360 }} transition={{ ...loop, duration: 23 }} />
        <motion.span className="thermal-core-dot" animate={shouldReduceMotion ? undefined : { z: [0, 24, 0], scale: [1, 1.12, 1] }} transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }} />
        <motion.i className="thermal-particle thermal-particle-one" animate={shouldReduceMotion ? undefined : { rotateZ: 360 }} transition={{ ...loop, duration: 8 }} />
        <motion.i className="thermal-particle thermal-particle-two" animate={shouldReduceMotion ? undefined : { rotateZ: -360 }} transition={{ ...loop, duration: 11 }} />
      </motion.div>
      {className && <><span className="thermal-core-tag thermal-core-tag-top">FIELD VECTOR / NNE</span><span className="thermal-core-tag thermal-core-tag-bottom">SIGNAL ACQUIRED</span></>}
    </div>
  );
}
