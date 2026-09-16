import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createProjectSchema, toProject } from "@/lib/projects";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, schema_version, configuration, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: (data ?? []).map(toProject) });
}

export async function POST(request: NextRequest) {
  const parsed = createProjectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid project data." }, { status: 400 });

  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      configuration: parsed.data.configuration,
      simulation_result: parsed.data.configuration.simulationResult,
    })
    .select("id, name, schema_version, configuration, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: toProject(data) }, { status: 201 });
}
