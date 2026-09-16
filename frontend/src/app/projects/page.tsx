"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, FolderPlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useShelterConfiguration } from "@/context/ShelterConfigurationContext";
import type { Project } from "@/lib/projects";

function projectError(payload: unknown, fallback: string) {
  return typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
    ? payload.error
    : fallback;
}

export default function ProjectsPage() {
  const router = useRouter();
  const { hydrateProject, resetProject } = useShelterConfiguration();
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(projectError(payload, "Projects could not be loaded."));
        return payload.projects as Project[];
      })
      .then(setProjects)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Projects could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  async function remove(project: Project) {
    if (!window.confirm(`Delete “${project.name}”? This cannot be undone.`)) return;
    const response = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(projectError(payload, "Project could not be deleted."));
      return;
    }
    setProjects((current) => current.filter(({ id }) => id !== project.id));
  }

  function open(project: Project) {
    hydrateProject(project.configuration, project);
    router.push("/configure");
  }

  function create() {
    resetProject();
    router.push("/configure");
  }

  return (
    <main className="projects-page">
      <header className="projects-header">
        <div>
          <p className="eyebrow">SHELTER THERMAL DESIGNER</p>
          <h1>Your projects</h1>
          <p>Save a shelter design, return to it later, and continue where you left off.</p>
        </div>
        <button type="button" className="btn-square" onClick={create}><FolderPlus aria-hidden /> New project</button>
      </header>
      {loading && <p className="projects-message">Loading projects…</p>}
      {error && <p className="projects-message projects-error" role="alert">{error}</p>}
      {!loading && !error && projects.length === 0 && <p className="projects-message">No saved projects yet. Create a new shelter design to get started.</p>}
      <section className="projects-grid" aria-label="Saved projects">
        {projects.map((project) => (
          <article className="project-card" key={project.id}>
            <p className="eyebrow">UPDATED {new Date(project.updatedAt).toLocaleDateString()}</p>
            <h2>{project.name}</h2>
            <p>{project.configuration.location?.preset?.name ?? "Location not selected"}</p>
            <div className="project-card-actions">
              <button type="button" className="btn-square" onClick={() => open(project)}>Open <ArrowUpRight aria-hidden /></button>
              <button type="button" className="project-delete" onClick={() => remove(project)} aria-label={`Delete ${project.name}`}><Trash2 aria-hidden /></button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
