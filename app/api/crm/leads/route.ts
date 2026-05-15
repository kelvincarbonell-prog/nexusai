import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const LeadSchema = z.object({
  nombre: z.string().min(1).max(180),
  empresa: z.string().max(180).optional(),
  nif: z.string().max(30).optional(),
  email: z.string().email().optional(),
  telefono: z.string().max(30).optional(),
  fuente: z.enum(["manual", "web", "referido", "campaña", "inbound", "cl@ve"]).default("manual"),
  valor_estimado: z.number().min(0).max(10_000_000).optional(),
  probabilidad: z.number().int().min(0).max(100).optional(),
  notas: z.string().max(2000).optional(),
  proxima_accion: z.string().max(180).optional(),
  fecha_proxima_accion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const UpdateSchema = z.object({
  id: z.string().uuid(),
  estado: z.enum(["nuevo", "contactado", "cualificado", "propuesta", "ganado", "perdido"]).optional(),
  valor_estimado: z.number().min(0).optional(),
  probabilidad: z.number().int().min(0).max(100).optional(),
  notas: z.string().max(2000).optional(),
  proxima_accion: z.string().max(180).optional(),
  fecha_proxima_accion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const admin = createSupabaseAdmin();
  const { data: profile } = await admin.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  const isAdmin = profile?.rol === "admin";

  const query = admin.from("crm_leads").select("*").order("updated_at", { ascending: false }).limit(500);
  const { data } = isAdmin ? await query : await query.eq("gestor_id", user.id);
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = LeadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("crm_leads")
    .insert({ ...parsed.data, gestor_id: user.id })
    .select("*")
    .single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo crear", 500);
  return NextResponse.json({ ok: true, lead: data });
}

export async function PATCH(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = UpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");
  const admin = createSupabaseAdmin();
  const { id, ...update } = parsed.data;
  const { data, error } = await admin
    .from("crm_leads")
    .update(update)
    .eq("id", id)
    .eq("gestor_id", user.id)
    .select("*")
    .single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo actualizar", 500);
  return NextResponse.json({ ok: true, lead: data });
}
