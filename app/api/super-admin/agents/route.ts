import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const AgentSchema = z.object({
  id: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(120),
  category: z.string().min(2).max(80),
  enabled: z.boolean(),
  priority: z.number().int().min(1).max(999),
  mission: z.string().min(1).max(4000),
  rules_do: z.array(z.string().min(1).max(1000)).default([]),
  rules_dont: z.array(z.string().min(1).max(1000)).default([]),
  order_prompt: z.string().min(1).max(8000),
});

async function requireAdmin(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return { user: null, admin: null, allowed: false };

  const admin = createSupabaseAdmin();
  const { data } = await admin.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  return { user, admin, allowed: data?.rol === "admin" };
}

export async function GET(request: NextRequest) {
  const { admin, allowed } = await requireAdmin(request);
  if (!allowed || !admin) return jsonError("No autorizado", 403);

  const { data, error } = await admin.from("agent_configs").select("*").order("priority", { ascending: true });
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, agents: data ?? [] });
}

export async function PUT(request: NextRequest) {
  const { user, admin, allowed } = await requireAdmin(request);
  if (!allowed || !admin || !user) return jsonError("No autorizado", 403);

  const parsed = AgentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Body inválido");

  const { error } = await admin.from("agent_configs").upsert({
    ...parsed.data,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  });

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { admin, allowed } = await requireAdmin(request);
  if (!allowed || !admin) return jsonError("No autorizado", 403);

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return jsonError("Falta id");

  const { error } = await admin.from("agent_configs").delete().eq("id", id);
  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ ok: true });
}
