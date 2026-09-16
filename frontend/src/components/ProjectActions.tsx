"use client";

import { useEffect, useState } from "react";
import { FolderOpen, Save, Trash2, X } from "lucide-react";
import { useShelterConfiguration } from "@/context/ShelterConfigurationContext";
import type { Project, ProjectSnapshot } from "@/lib/projects";

function readError(payload: unknown, fallback: string) {
  return typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
    ? payload.error
    : fallback;
}

export function ProjectActions({ onProjectOpened }: { onProjectOpened: (stage: string, projectId?: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const configuration = useShelterConfiguration();

  function snapshot(): ProjectSnapshot {
    const { activeProjectStage, location, climate, geometry, wallLayers, roofLayers, windows, vents, occupants, hvac, simulationResult } = configuration;
    return { lastActiveItem: activeProjectStage, location, climate, geometry, wallLayers, roofLayers, windows, vents, occupants, hvac, simulationResult };
  }

  async function loadProjects() {
    setIsLoading(true);
    const response = await fetch("/api/projects", { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    setIsLoading(false);
    if (!response.ok) {
      setMessage(readError(payload, "Projects could not be loaded."));
      return;
    }
    if (!Array.isArray(payload?.projects)) {
      setMessage("The projects service returned an unexpected response.");
      return;
    }
    const fetchedProjects = payload.projects as Project[];
    setProjects(fetchedProjects);
    if (configuration.activeProjectId) {
      const active = fetchedProjects.find(({ id }) => id === configuration.activeProjectId);
      if (active) setName((current) => current || active.name);
    }
  }

  function openModal() {
    setName(configuration.activeProjectName ?? "Untitled shelter project");
    setMessage(null);
    setConfirmOverwrite(false);
    setIsOpen(true);
    void loadProjects();
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    if (isOpen) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  async function save(overwriteConfirmed = false) {
    const projectName = name.trim();
    if (!projectName) {
      setMessage("Give this project a name before saving.");
      return;
    }
    const isNewProject = !configuration.activeProjectId || projectName !== configuration.activeProjectName;
    if (!isNewProject && !overwriteConfirmed) {
      setConfirmOverwrite(true);
      return;
    }

    setIsSaving(true);
    setMessage(null);
    const savedSnapshot = snapshot();
    const url = isNewProject ? "/api/projects" : `/api/projects/${configuration.activeProjectId}`;
    const response = await fetch(url, {
      method: isNewProject ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: projectName, configuration: savedSnapshot }),
    });
    const payload = await response.json().catch(() => null);
    setIsSaving(false);

    if (!response.ok || !payload?.project) {
      setMessage(readError(payload, "Project could not be saved."));
      return;
    }

    const project = payload.project as Project;
    configuration.hydrateProject(savedSnapshot, project);
    setName(project.name);
    setProjects((current) => [project, ...current.filter(({ id }) => id !== project.id)]);
    setConfirmOverwrite(false);
    setMessage("Saved just now.");
  }

  function open(project: Project) {
    if (configuration.activeProjectId) {
      void fetch(`/api/projects/${configuration.activeProjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastActiveItem: configuration.activeProjectStage }),
      });
    }
    configuration.hydrateProject(project.configuration, project);
    setIsOpen(false);
    onProjectOpened(project.configuration.lastActiveItem ?? "Location Climate", project.id);
  }

  async function remove(project: Project) {
    if (!window.confirm(`Delete “${project.name}”? This cannot be undone.`)) return;
    const response = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setMessage(readError(payload, "Project could not be deleted."));
      return;
    }
    setProjects((current) => current.filter(({ id }) => id !== project.id));
  }

  return (
    <>
      <div className="project-actions">
        <span className="project-status" aria-live="polite"><small>Active project</small><strong>{configuration.activeProjectName ?? "Unsaved project"}</strong></span>
        <button type="button" className="project-action" onClick={openModal}><FolderOpen aria-hidden /> <span>Projects</span></button>
        <button type="button" className="project-action project-save" onClick={openModal}><Save aria-hidden /> <span>Save</span></button>
      </div>
      {isOpen && (
        <div className="project-modal-backdrop" role="presentation" onMouseDown={() => setIsOpen(false)}>
          <section className="project-modal" role="dialog" aria-modal="true" aria-labelledby="project-modal-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className="project-modal-header">
              <div><p className="eyebrow">YOUR WORKSPACE</p><h2 id="project-modal-title">Projects</h2></div>
              <button type="button" className="project-modal-close" onClick={() => setIsOpen(false)} aria-label="Close projects"><X aria-hidden /></button>
            </header>
            <div className="project-save-form">
              <label htmlFor="project-name">{configuration.activeProjectId ? "Current project name" : "Save current configuration"}</label>
              <div>
                <input id="project-name" value={name} onChange={(event) => { setName(event.target.value); setConfirmOverwrite(false); }} maxLength={120} autoFocus />
                <button type="button" className="btn-square" onClick={() => void save()} disabled={isSaving}>{isSaving ? "Saving…" : configuration.activeProjectId && name.trim() === configuration.activeProjectName ? "Save changes" : "Save as new"}</button>
              </div>
              {configuration.activeProjectId && <p className="project-save-hint">Change the name to save this configuration as a separate project.</p>}
            </div>
            {confirmOverwrite && configuration.activeProjectName && (
              <div className="project-overwrite-warning" role="alert">
                <p><strong>Overwrite “{configuration.activeProjectName}”?</strong> This replaces its saved configuration and simulation result.</p>
                <div><button type="button" className="project-warning-cancel" onClick={() => setConfirmOverwrite(false)}>Cancel</button><button type="button" className="btn-square" onClick={() => void save(true)} disabled={isSaving}>Overwrite project</button></div>
              </div>
            )}
            {message && <p className="project-modal-message" role="status">{message}</p>}
            <div className="project-modal-list-head"><h3>All saved projects</h3><span>{isLoading ? "Loading…" : `${projects.length} saved`}</span></div>
            <div className="project-modal-list">
              {!isLoading && projects.length === 0 && <p className="project-modal-empty">No saved projects yet.</p>}
              {projects.map((project) => (
                <article className="project-modal-row" key={project.id}>
                  <button type="button" className="project-modal-open" onClick={() => open(project)}>
                    <strong>{project.name}</strong>
                    <span>{project.configuration.location?.preset?.name ?? "No location selected"} · Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                  </button>
                  <button type="button" className="project-modal-delete" onClick={() => void remove(project)} aria-label={`Delete ${project.name}`}><Trash2 aria-hidden /></button>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
