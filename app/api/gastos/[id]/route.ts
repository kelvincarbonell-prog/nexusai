import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";

/**
 * PATCH /api/gastos/[id]   — actualiza un gasto (estado, importes, metadatos).
 * DELETE /api/gastos/[id]  — borra el gasto.
 */

const Patch = z.object({
  estado: z.enum(["pendiente", "pagada", "cobrada", "registrada", "anulada"]).optional(),
  proveedor: z.string().max(180).optional(),
  concepto: z.string().max(500).optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  base: z.number().min(-1_000_000).max(1_000_000).optional(),
  iva: z.number().min(-1_000_000).max(1_000_000).optional(),
  total: z.number().min(-1_000_000).max(1_000_000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;

  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");

  const admin = createSupabaseAdmin();
  const { data: gasto } = await admin.from("gastos").select("empresa_id,metadata").eq("id", id).maybeSingle();
  if (!gasto) return jsonError("Gasto no encontrado", 404);
  if (!(await canAccessLaborCompany(admin, user.id, gasto.empresa_id))) return jsonError("Sin acceso", 403);

  // Fusiona metadata si lo manda parcialmente
  const newMeta = parsed.data.metadata
    ? { ...((gasto.metadata ?? {}) as Record<string, unknown>), ...parsed.data.metadata }
    : undefined;

  const update: Record<string, unknown> = {};
  for (const k of ["estado", "proveedor", "concepto", "fecha", "base", "iva", "total"] as const) {
    if (parsed.data[k] !== undefined) update[k] = parsed.data[k];
  }
  if (newMeta) update.metadata = newMeta;
  update.updated_at = new Date().toISOString();

  const { data, error } = await admin.from("gastos").update(update).eq("id", id).select("*").single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo actualizar", 500);
  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;
  const admin = createSupabaseAdmin();
  const { data: gasto } = await admin.from("gastos").select("empresa_id").eq("id", id).maybeSingle();
  if (!gasto) return jsonError("Gasto no encontrado", 404);
  if (!(await canAccessLaborCompany(admin, user.id, gasto.empresa_id))) return jsonError("Sin acceso", 403);

  // Si existe un asiento asociado (source_type=gasto, source_id), lo elimina
  await admin.from("journal_entries").delete().eq("source_type", "gasto").eq("source_id", id);
  await admin.from("gastos").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
