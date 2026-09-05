"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Database,
  Info,
  Layers,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  calculateRoofAssemblyMetrics,
  calculateWallAssemblyMetrics,
  fetchMaterials,
  type MaterialItem,
  type MaterialLayer,
} from "@/lib/api";
import { useShelterConfiguration } from "@/context/ShelterConfigurationContext";

type AssemblyTarget = "wall" | "roof";

type StandardAssemblyPreset = {
  id: string;
  name: string;
  description: string;
  wallLayers: MaterialLayer[];
  roofLayers: MaterialLayer[];
};

const ENVELOPE_PRESETS: StandardAssemblyPreset[] = [
  {
    id: "insulated-cabin",
    name: "Standard Insulated Cabin",
    description: "Timber exterior with 50mm PUF core and interior finish.",
    wallLayers: [
      { material_id: "timber", thickness_m: 0.05 },
      { material_id: "puf", thickness_m: 0.05 },
      { material_id: "plasterboard", thickness_m: 0.012 },
    ],
    roofLayers: [
      { material_id: "timber", thickness_m: 0.025 },
      { material_id: "puf", thickness_m: 0.05 },
    ],
  },
  {
    id: "extreme-cold-post",
    name: "High-Altitude Cold Post",
    description: "Heavy insulation package (100mm PUF) for Leh / Siachen outposts.",
    wallLayers: [
      { material_id: "brick", thickness_m: 0.11 },
      { material_id: "puf", thickness_m: 0.10 },
      { material_id: "plasterboard", thickness_m: 0.012 },
    ],
    roofLayers: [
      { material_id: "timber", thickness_m: 0.05 },
      { material_id: "puf", thickness_m: 0.10 },
    ],
  },
  {
    id: "tactical-tent",
    name: "Lightweight Tactical Shelter",
    description: "Rapid deployment canvas envelope with glass wool batt insulation.",
    wallLayers: [
      { material_id: "canvas", thickness_m: 0.002 },
      { material_id: "glass_wool", thickness_m: 0.05 },
      { material_id: "canvas", thickness_m: 0.002 },
    ],
    roofLayers: [
      { material_id: "canvas", thickness_m: 0.002 },
      { material_id: "glass_wool", thickness_m: 0.05 },
    ],
  },
];

export function MaterialsLibrary() {
  const { wallLayers, roofLayers, setWallLayers, setRoofLayers, isMaterialsConfigured } =
    useShelterConfiguration();

  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"assemblies" | "catalog">("assemblies");
  const [activeAssembly, setActiveAssembly] = useState<AssemblyTarget>("wall");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);

  // Load materials from backend API
  const loadMaterialsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMaterials();
      setMaterials(data);
      if (data.length > 0 && !selectedMaterialId) {
        setSelectedMaterialId(data[0].id);
      }
    } catch {
      setError("Failed to load materials catalog from API. Please verify the backend connection.");
    } finally {
      setLoading(false);
    }
  }, [selectedMaterialId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMaterialsData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMaterialsData]);

  // Materials lookup map
  const materialsMap = useMemo(() => {
    const map = new Map<string, MaterialItem>();
    materials.forEach((m) => map.set(m.id, m));
    return map;
  }, [materials]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    materials.forEach((m) => set.add(m.category));
    return ["all", ...Array.from(set)];
  }, [materials]);

  // Filtered materials
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchesCategory = selectedCategory === "all" || m.category === selectedCategory;
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        m.name.toLowerCase().includes(query) ||
        m.id.toLowerCase().includes(query) ||
        m.category.toLowerCase().includes(query) ||
        m.notes.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [materials, selectedCategory, searchQuery]);

  // Selected material detail
  const selectedMaterial = useMemo(() => {
    return materials.find((m) => m.id === selectedMaterialId) ?? materials[0] ?? null;
  }, [materials, selectedMaterialId]);

  // Live assembly calculations using exact backend physics formulas
  const wallMetrics = useMemo(() => {
    return calculateWallAssemblyMetrics(wallLayers, materialsMap);
  }, [wallLayers, materialsMap]);

  const roofMetrics = useMemo(() => {
    return calculateRoofAssemblyMetrics(roofLayers, materialsMap);
  }, [roofLayers, materialsMap]);

  // Current active assembly layers and metrics
  const currentLayers = activeAssembly === "wall" ? wallLayers : roofLayers;
  const currentMetrics = activeAssembly === "wall" ? wallMetrics : roofMetrics;

  function updateCurrentLayers(nextLayers: MaterialLayer[]) {
    if (activeAssembly === "wall") {
      setWallLayers(nextLayers);
    } else {
      setRoofLayers(nextLayers);
    }
  }

  // Layer manipulation handlers
  function handleAddLayer(materialId: string, defaultThicknessM?: number) {
    const mat = materialsMap.get(materialId);
    const thickness = defaultThicknessM ?? (mat?.typical_thickness ?? 0.05);
    const newLayer: MaterialLayer = {
      material_id: materialId,
      thickness_m: Math.max(0.001, thickness),
    };
    updateCurrentLayers([...currentLayers, newLayer]);
  }

  function handleRemoveLayer(index: number) {
    updateCurrentLayers(currentLayers.filter((_, i) => i !== index));
  }

  function handleMoveLayer(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentLayers.length) return;
    const copy = [...currentLayers];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);
    updateCurrentLayers(copy);
  }

  function handleThicknessChange(index: number, thicknessMm: number) {
    if (isNaN(thicknessMm) || thicknessMm <= 0) return;
    const thicknessM = thicknessMm / 1000;
    const copy = [...currentLayers];
    copy[index] = { ...copy[index], thickness_m: thicknessM };
    updateCurrentLayers(copy);
  }

  function handleApplyTypicalThickness(index: number) {
    const layer = currentLayers[index];
    const mat = materialsMap.get(layer.material_id);
    if (!mat || !mat.typical_thickness) return;
    const copy = [...currentLayers];
    copy[index] = { ...copy[index], thickness_m: mat.typical_thickness };
    updateCurrentLayers(copy);
  }

  function handleApplyPreset(preset: StandardAssemblyPreset) {
    setWallLayers(preset.wallLayers);
    setRoofLayers(preset.roofLayers);
  }

  return (
    <div className="climate-page">
      {/* Page Heading */}
      <div className="page-heading climate-heading">
        <div>
          <p className="eyebrow">STAGE 3 · MATERIALS &amp; ENVELOPE ASSEMBLY</p>
          <h1>Materials &amp; Envelope Assembly</h1>
          <p className="page-description">
            Browse the verified materials catalog and configure physical multi-layer wall and roof constructions.
          </p>
        </div>
        <div className="configured-pill">
          <span className={`status-dot ${isMaterialsConfigured ? "status-dot-configured" : ""}`} />
          {isMaterialsConfigured ? "Configured" : "Not configured"}
        </div>
      </div>

      {error && (
        <div className="climate-error" role="alert">
          <AlertTriangle aria-hidden />
          <div>
            <strong>Materials API Error</strong>
            <p>{error}</p>
          </div>
          <button className="text-button" onClick={() => void loadMaterialsData()}>
            Retry
          </button>
        </div>
      )}

      {/* Main View Mode Selector */}
      <div className="materials-view-toggle">
        <button
          className={activeTab === "assemblies" ? "mode-active" : ""}
          onClick={() => setActiveTab("assemblies")}
        >
          <Layers aria-hidden /> Envelope Assemblies (Walls &amp; Roof)
        </button>
        <button
          className={activeTab === "catalog" ? "mode-active" : ""}
          onClick={() => setActiveTab("catalog")}
        >
          <BookOpen aria-hidden /> Materials Catalog ({materials.length})
        </button>
      </div>

      {/* Tab 1: Envelope Assemblies Workspace */}
      {activeTab === "assemblies" && (
        <div className="climate-layout">
          {/* Left Column: Layer Construction Builder */}
          <section className="climate-panel selection-panel">
            <div className="panel-heading">
              <div>
                <h2>{activeAssembly === "wall" ? "Wall Assembly Construction" : "Roof Assembly Construction"}</h2>
                <p>Define physical layers ordered from exterior to interior.</p>
              </div>
              <Layers aria-hidden className="text-slate-400" />
            </div>

            {/* Target Assembly Switcher: Wall vs Roof */}
            <div className="assembly-target-switch">
              <button
                type="button"
                className={`assembly-target-btn ${activeAssembly === "wall" ? "assembly-target-btn-active" : ""}`}
                onClick={() => setActiveAssembly("wall")}
              >
                <strong>Wall Assembly</strong>
                <span>{wallLayers.length} layers · U = {wallMetrics ? `${wallMetrics.uValue.toFixed(3)} W/m²K` : "—"}</span>
              </button>
              <button
                type="button"
                className={`assembly-target-btn ${activeAssembly === "roof" ? "assembly-target-btn-active" : ""}`}
                onClick={() => setActiveAssembly("roof")}
              >
                <strong>Roof Assembly</strong>
                <span>{roofLayers.length} layers · U = {roofMetrics ? `${roofMetrics.uValue.toFixed(3)} W/m²K` : "—"}</span>
              </button>
            </div>

            {/* Quick Envelope Presets */}
            <div className="geometry-presets-block">
              <span className="geometry-presets-title">Standard Envelope Presets</span>
              <div className="geometry-presets-grid">
                {ENVELOPE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="geometry-preset-btn"
                    onClick={() => handleApplyPreset(preset)}
                  >
                    <strong>{preset.name}</strong>
                    <span>{preset.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Physical Layer Stack Container */}
            <div className="layer-stack-container">
              {/* Outdoor Marker */}
              <div className="layer-boundary-marker outdoor-marker">
                <span>OUTSIDE / OUTDOOR ENVIRONMENT</span>
                <small>Surface resistance R_so = 0.04 m²·K/W</small>
              </div>

              {currentLayers.length === 0 ? (
                <div className="empty-layer-box">
                  <p>No material layers added yet.</p>
                  <span>Select a material below or choose a preset to construct this assembly.</span>
                </div>
              ) : (
                <div className="layer-cards-list">
                  {currentLayers.map((layer, idx) => {
                    const mat = materialsMap.get(layer.material_id);
                    const thicknessMm = Math.round(layer.thickness_m * 1000 * 10) / 10;
                    const rLayer = mat && mat.k > 0 ? (layer.thickness_m / mat.k).toFixed(3) : "—";

                    return (
                      <div key={`${layer.material_id}-${idx}`} className="layer-item-card">
                        <div className="layer-item-header">
                          <div className="layer-item-title">
                            <span className="layer-badge">Layer {idx + 1}</span>
                            <strong>{mat?.name ?? layer.material_id}</strong>
                            <span className="layer-category-tag">{mat?.category ?? "custom"}</span>
                          </div>
                          <div className="layer-item-actions">
                            <button
                              type="button"
                              className="layer-btn-icon"
                              title="Move layer outward"
                              disabled={idx === 0}
                              onClick={() => handleMoveLayer(idx, "up")}
                              aria-label={`Move Layer ${idx + 1} upward`}
                            >
                              <ArrowUp aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="layer-btn-icon"
                              title="Move layer inward"
                              disabled={idx === currentLayers.length - 1}
                              onClick={() => handleMoveLayer(idx, "down")}
                              aria-label={`Move Layer ${idx + 1} downward`}
                            >
                              <ArrowDown aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="layer-btn-icon layer-btn-delete"
                              title="Remove layer"
                              onClick={() => handleRemoveLayer(idx)}
                              aria-label={`Remove Layer ${idx + 1}`}
                            >
                              <Trash2 aria-hidden />
                            </button>
                          </div>
                        </div>

                        <div className="layer-item-body">
                          <div className="layer-input-row">
                            <label className="layer-thickness-label">
                              Thickness:
                              <div className="layer-thickness-input-wrap">
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={thicknessMm}
                                  onChange={(e) => handleThicknessChange(idx, parseFloat(e.target.value))}
                                  aria-label={`Thickness in millimeters for layer ${idx + 1}`}
                                />
                                <span>mm</span>
                              </div>
                            </label>

                            {mat?.typical_thickness && (
                              <button
                                type="button"
                                className="typical-thickness-btn"
                                onClick={() => handleApplyTypicalThickness(idx)}
                                title={`Set to catalog typical thickness (${mat.typical_thickness * 1000}mm)`}
                              >
                                Typical ({mat.typical_thickness * 1000}mm)
                              </button>
                            )}
                          </div>

                          <div className="layer-specs-bar">
                            <span>k = {mat?.k ?? "—"} W/(m·K)</span>
                            <span>R = {rLayer} m²·K/W</span>
                            <span>d = {layer.thickness_m.toFixed(3)} m</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Indoor Marker */}
              <div className="layer-boundary-marker indoor-marker">
                <span>INSIDE / INDOOR SHELTER AIR</span>
                <small>
                  Surface resistance R_si = {activeAssembly === "wall" ? "0.13" : "0.10"} m²·K/W
                </small>
              </div>
            </div>

            {/* Add Layer Selector */}
            <div className="add-layer-toolbar">
              <span className="add-layer-title">+ Add Material Layer</span>
              <div className="add-layer-select-grid">
                <select
                  value={selectedMaterialId ?? ""}
                  onChange={(e) => setSelectedMaterialId(e.target.value)}
                  className="add-layer-select"
                  aria-label="Select material to add"
                >
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.category}) · k={m.k} W/(m·K)
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="primary-button add-layer-btn"
                  onClick={() => selectedMaterialId && handleAddLayer(selectedMaterialId)}
                  disabled={!selectedMaterialId || loading}
                >
                  <Plus aria-hidden /> Add to {activeAssembly === "wall" ? "Wall" : "Roof"}
                </button>
              </div>
            </div>
          </section>

          {/* Right Column: Assembly Thermal Metrics & Preview */}
          <section className="climate-panel summary-panel">
            <div className="panel-heading">
              <div>
                <h2>Thermal Assembly Preview</h2>
                <p>Calculated using backend series conduction formulas.</p>
              </div>
              <ShieldCheck aria-hidden className="text-slate-400" />
            </div>

            {currentMetrics ? (
              <div className="geometry-preview-container">
                {/* Visual Layer Cross-Section Schematic */}
                <div className="assembly-cross-section">
                  <span className="cross-section-title">
                    {activeAssembly === "wall" ? "Wall Assembly Cross-Section" : "Roof Assembly Cross-Section"}
                  </span>
                  <div className="cross-section-layers">
                    <div className="cs-boundary cs-outdoor">Outdoor (R_so = 0.04)</div>
                    {currentLayers.map((layer, idx) => {
                      const mat = materialsMap.get(layer.material_id);
                      const fraction = Math.max(15, (layer.thickness_m / (currentMetrics.totalThicknessM || 1)) * 100);
                      return (
                        <div
                          key={`cs-${idx}`}
                          className="cs-layer-bar"
                          style={{ minHeight: `${Math.min(60, Math.max(26, fraction * 0.8))}px` }}
                        >
                          <div className="cs-layer-info">
                            <strong>{mat?.name ?? layer.material_id}</strong>
                            <span>{Math.round(layer.thickness_m * 1000)} mm · k={mat?.k}</span>
                          </div>
                          <span className="cs-layer-r">
                            R = {mat && mat.k > 0 ? (layer.thickness_m / mat.k).toFixed(3) : "—"} m²·K/W
                          </span>
                        </div>
                      );
                    })}
                    <div className="cs-boundary cs-indoor">
                      Indoor (R_si = {activeAssembly === "wall" ? "0.13" : "0.10"})
                    </div>
                  </div>
                </div>

                {/* Disclaimer Banner */}
                <div className="source-banner source-live">
                  <Database aria-hidden />
                  <div>
                    <strong>Assembly Preview</strong>
                    <p>
                      Derived using steady-state thermal resistance summation. Final 24-hour simulation heat flows and comfort indices are computed by the server engine.
                    </p>
                  </div>
                </div>

                {/* Derived Metrics Grid */}
                <div className="metrics-grid">
                  <div className="climate-metric">
                    <span>Assembly Type</span>
                    <strong>{activeAssembly === "wall" ? "Vertical Wall" : "Horizontal Roof"}</strong>
                  </div>
                  <div className="climate-metric">
                    <span>Number of Layers</span>
                    <strong>{currentMetrics.layerCount} active layers</strong>
                  </div>
                  <div className="climate-metric">
                    <span>Total Thickness</span>
                    <strong>{currentMetrics.totalThicknessMm.toFixed(1)} mm ({currentMetrics.totalThicknessM.toFixed(3)} m)</strong>
                  </div>
                  <div className="climate-metric">
                    <span>Total Resistance (R_total)</span>
                    <strong>{currentMetrics.rTotal.toFixed(3)} m²·K/W</strong>
                  </div>
                  <div className="climate-metric">
                    <span>Thermal Transmittance (U)</span>
                    <strong>{currentMetrics.uValue.toFixed(3)} W/(m²·K)</strong>
                  </div>
                  <div className="climate-metric">
                    <span>Inside Surface R_si</span>
                    <strong>{activeAssembly === "wall" ? "0.130" : "0.100"} m²·K/W</strong>
                  </div>
                </div>

                {/* Dual Assembly Summary Status */}
                <div className="envelope-readiness-card">
                  <div className="readiness-item">
                    <span className={`status-dot ${wallLayers.length > 0 ? "status-dot-configured" : ""}`} />
                    <div>
                      <strong>Wall Construction:</strong>{" "}
                      {wallLayers.length > 0
                        ? `${wallLayers.length} layers (U = ${wallMetrics?.uValue.toFixed(3)} W/m²K)`
                        : "No layers configured"}
                    </div>
                  </div>
                  <div className="readiness-item">
                    <span className={`status-dot ${roofLayers.length > 0 ? "status-dot-configured" : ""}`} />
                    <div>
                      <strong>Roof Construction:</strong>{" "}
                      {roofLayers.length > 0
                        ? `${roofLayers.length} layers (U = ${roofMetrics?.uValue.toFixed(3)} W/m²K)`
                        : "No layers configured"}
                    </div>
                  </div>
                </div>

                <div className="result-footer">
                  <CheckCircle2 aria-hidden />
                  {isMaterialsConfigured
                    ? "Both wall and roof envelope assemblies configured and stored."
                    : "Add at least one layer to both Wall and Roof assemblies to complete this stage."}
                </div>
              </div>
            ) : (
              <div className="summary-empty">
                <div className="summary-empty-icon">
                  <Layers aria-hidden />
                </div>
                <h3>No Layers in Assembly</h3>
                <p>Add material layers to preview thermal resistance (R) and transmittance (U-value).</p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Tab 2: Materials Catalog Browser */}
      {activeTab === "catalog" && (
        <div className="materials-catalog-layout">
          {/* Left Column: Filterable Materials List */}
          <section className="climate-panel catalog-list-panel">
            <div className="catalog-toolbar">
              <div className="catalog-search-wrap">
                <Search aria-hidden />
                <input
                  type="text"
                  placeholder="Search materials by name or application..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search materials"
                />
              </div>

              {/* Category Filter Chips */}
              <div className="category-chips-list" role="tablist" aria-label="Filter by material category">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={selectedCategory === cat}
                    className={`category-chip ${selectedCategory === cat ? "category-chip-active" : ""}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="inline-loading">
                <LoaderCircle className="spin" aria-hidden /> Loading materials catalog from backend...
              </div>
            ) : (
              <div className="catalog-grid">
                {filteredMaterials.map((mat) => (
                  <button
                    key={mat.id}
                    type="button"
                    className={`material-card ${selectedMaterialId === mat.id ? "material-card-selected" : ""}`}
                    onClick={() => setSelectedMaterialId(mat.id)}
                  >
                    <div className="material-card-top">
                      <strong className="material-name">{mat.name}</strong>
                      <span className="material-cat-badge">{mat.category}</span>
                    </div>

                    <div className="material-props-row">
                      <span>k: <strong>{mat.k}</strong> W/m·K</span>
                      <span>ρ: <strong>{mat.density}</strong> kg/m³</span>
                      <span>d_typ: <strong>{mat.typical_thickness * 1000}</strong> mm</span>
                    </div>

                    <p className="material-notes">{mat.notes}</p>

                    <div className="material-card-footer">
                      <span className={`confidence-tag confidence-${mat.confidence}`}>
                        {mat.confidence === "reference" ? "✓ Reference" : "≈ Approx"}
                      </span>
                      <span className="select-material-link">
                        Details <ChevronRight aria-hidden />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Right Column: Selected Material Deep Technical Detail */}
          <section className="climate-panel catalog-detail-panel">
            {selectedMaterial ? (
              <div className="material-detail-view">
                <div className="panel-heading">
                  <div>
                    <h2>{selectedMaterial.name}</h2>
                    <p>Category: {selectedMaterial.category.toUpperCase()} · ID: {selectedMaterial.id}</p>
                  </div>
                  <span className={`confidence-pill confidence-${selectedMaterial.confidence}`}>
                    {selectedMaterial.confidence === "reference" ? "Reference standard" : "Approximate property"}
                  </span>
                </div>

                <div className="material-quick-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => handleAddLayer(selectedMaterial.id)}
                  >
                    <Plus aria-hidden /> Add to Wall Assembly
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setActiveAssembly("roof");
                      handleAddLayer(selectedMaterial.id);
                    }}
                  >
                    <Plus aria-hidden /> Add to Roof Assembly
                  </button>
                </div>

                <div className="metrics-grid">
                  <div className="climate-metric">
                    <span>Thermal Conductivity (k)</span>
                    <strong>{selectedMaterial.k} W/(m·K)</strong>
                  </div>
                  <div className="climate-metric">
                    <span>Density (ρ)</span>
                    <strong>{selectedMaterial.density} kg/m³</strong>
                  </div>
                  <div className="climate-metric">
                    <span>Specific Heat (c_p)</span>
                    <strong>{selectedMaterial.specific_heat} J/(kg·K)</strong>
                  </div>
                  <div className="climate-metric">
                    <span>Typical Application Thickness</span>
                    <strong>{selectedMaterial.typical_thickness * 1000} mm ({selectedMaterial.typical_thickness} m)</strong>
                  </div>
                  <div className="climate-metric">
                    <span>Relative Cost</span>
                    <strong>{selectedMaterial.relative_cost}</strong>
                  </div>
                  <div className="climate-metric">
                    <span>Relative Weight</span>
                    <strong>{selectedMaterial.relative_weight}</strong>
                  </div>
                </div>

                <div className="material-notes-block">
                  <div className="notes-item">
                    <Info aria-hidden />
                    <div>
                      <strong>Engineering Notes:</strong>
                      <p>{selectedMaterial.notes}</p>
                    </div>
                  </div>
                  <div className="notes-item">
                    <Database aria-hidden />
                    <div>
                      <strong>Reference Data Source:</strong>
                      <p>{selectedMaterial.source}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="summary-empty">
                <p>Select a material to inspect technical properties.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
