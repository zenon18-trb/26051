import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toProject, updateProjectSchema } from "@/lib/projects";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

type Context = { params: Promise<{ id: string }> };
const fields = "id, name, schema_version, configuration, created_at, updated_at";

export async function GET(_request: NextRequest, { params }: Context) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  const { data, error } = await supabase.from("projects").select(fields).eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  return NextResponse.json({ project: toProject(data) });
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const parsed = updateProjectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid project data." }, { status: 400 });
  const { id } = await params;
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  const updates = {
    ...parsed.data,
    ...(parsed.data.configuration === undefined
      ? {}
      : { simulation_result: parsed.data.configuration.simulationResult }),
  };
  const { data, error } = await supabase.from("projects").update(updates).eq("id", id).select(fields).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  return NextResponse.json({ project: toProject(data) });
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  const { error, count } = await supabase.from("projects").delete({ count: "exact" }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!count) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
