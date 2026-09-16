"use client";

import { useState } from "react";
import { FolderOpen, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useShelterConfiguration } from "@/context/ShelterConfigurationContext";
import type { Project, ProjectSnapshot } from "@/lib/projects";

function readError(payload: unknown, fallback: string) {
  return typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
    ? payload.error
    : fallback;
}

export function ProjectActions() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const configuration = useShelterConfiguration();

  function snapshot(): ProjectSnapshot {
    const { location, climate, geometry, wallLayers, roofLayers, windows, vents, occupants, hvac, simulationResult } = configuration;
    return { location, climate, geometry, wallLayers, roofLayers, windows, vents, occupants, hvac, simulationResult };
  }

  async function save() {
    let name = configuration.activeProjectName;
    if (!configuration.activeProjectId) {
      name = window.prompt("Name this project", "Untitled shelter project")?.trim() ?? "";
      if (!name) return;
    }

    setIsSaving(true);
    setMessage(null);
    const body = { name, configuration: snapshot() };
    const url = configuration.activeProjectId ? `/api/projects/${configuration.activeProjectId}` : "/api/projects";
    const response = await fetch(url, {
      method: configuration.activeProjectId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    setIsSaving(false);

    if (!response.ok || !payload?.project) {
      setMessage(readError(payload, "Project could not be saved."));
      return;
    }

    const project = payload.project as Project;
    configuration.hydrateProject(snapshot(), project);
    setMessage("Saved");
  }

  return (
    <div className="project-actions">
      <span className="project-status" aria-live="polite">{message ?? configuration.activeProjectName ?? "Unsaved project"}</span>
      <button type="button" className="project-action" onClick={() => router.push("/projects")} aria-label="Open projects">
        <FolderOpen aria-hidden /> <span>Projects</span>
      </button>
      <button type="button" className="project-action project-save" onClick={save} disabled={isSaving}>
        <Save aria-hidden /> <span>{isSaving ? "Saving…" : "Save"}</span>
      </button>
    </div>
  );
}
