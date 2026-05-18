import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";

const UpdateSchema = z.object({
  nombre: z.string().min(2).max(180).optional(),
  dni: z.string().max(20).optional(),
  nss: z.string().max(20).optional(),
  fecha_nacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  fecha_alta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  fecha_baja: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  email: z.string().email().nullable().optional(),
  telefono: z.string().max(30).optional(),
  iban: z.string().max(40).optional(),
  puesto: z.string().max(120).optional(),
  categoria: z.string().max(120).optional(),
  tipo_contrato: z.string().max(60).optional(),
  jornada_horas: z.number().min(0).max(60).optional(),
  salario_bruto_anual: z.number().min(0).max(1_000_000).optional(),
  irpf_pct: z.number().min(0).max(60).optional(),
  convenio: z.string().max(180).optional(),
  activo: z.boolean().optional(),
  pagas_anuales: z.union([z.literal(12), z.literal(14)]).optional(),
  pagas_prorrateadas: z.boolean().optional(),
  trienio_importe: z.number().min(0).max(50_000).optional(),
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;
  const parsed = UpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  const { data: existing } = await admin.from("trabajadores").select("empresa_id").eq("id", id).maybeSingle();
  if (!existing) return jsonError("No encontrado", 404);
  if (!(await isGestorOrAdmin(admin, user.id, existing.empresa_id))) return jsonError("Sin permiso", 403);

  const { data, error } = await admin.from("trabajadores").update(parsed.data).eq("id", id).select("*").single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo actualizar", 500);
  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;
  const admin = createSupabaseAdmin();
  const { data: existing } = await admin.from("trabajadores").select("empresa_id").eq("id", id).maybeSingle();
  if (!existing) return jsonError("No encontrado", 404);
  if (!(await isGestorOrAdmin(admin, user.id, existing.empresa_id))) return jsonError("Sin permiso", 403);
  const { error } = await admin.from("trabajadores").update({ activo: false, fecha_baja: new Date().toISOString().slice(0, 10) }).eq("id", id);
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}
