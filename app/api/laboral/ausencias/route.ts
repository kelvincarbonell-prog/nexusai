import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany, daysBetween, isGestorOrAdmin } from "@/lib/laboral/access";

const AusenciaSchema = z.object({
  empresa_id: z.string().uuid(),
  trabajador_id: z.string().uuid(),
  tipo: z.enum(["vacaciones", "it", "permiso", "maternidad", "paternidad", "excedencia", "otro"]),
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  motivo: z.string().max(500).optional(),
  parte_baja_storage: z.string().max(500).optional(),
});

const UpdateSchema = z.object({
  estado: z.enum(["pendiente", "aprobada", "rechazada", "cancelada"]).optional(),
  motivo: z.string().max(500).optional(),
});

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const empresaId = request.nextUrl.searchParams.get("empresa_id");
  if (!empresaId) return jsonError("Falta empresa_id");
  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, empresaId))) return jsonError("Sin acceso", 403);
  const { data, error } = await admin
    .from("ausencias")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("fecha_inicio", { ascending: false });
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = AusenciaSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");
  if (parsed.data.fecha_fin < parsed.data.fecha_inicio) return jsonError("Fechas inválidas");
  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);
  const dias = daysBetween(parsed.data.fecha_inicio, parsed.data.fecha_fin);
  const { data, error } = await admin
    .from("ausencias")
    .insert({ ...parsed.data, dias, gestor_id: user.id })
    .select("*")
    .single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo crear", 500);
  return NextResponse.json({ ok: true, item: data });
}

export async function PATCH(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return jsonError("Falta id");
  const parsed = UpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");
  const admin = createSupabaseAdmin();
  const { data: existing } = await admin.from("ausencias").select("empresa_id").eq("id", id).maybeSingle();
  if (!existing) return jsonError("No encontrado", 404);
  if (!(await isGestorOrAdmin(admin, user.id, existing.empresa_id))) return jsonError("Sin permiso", 403);
  const { data, error } = await admin.from("ausencias").update(parsed.data).eq("id", id).select("*").single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo actualizar", 500);
  return NextResponse.json({ ok: true, item: data });
}
