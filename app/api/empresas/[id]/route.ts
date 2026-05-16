import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";

const UpdateSchema = z.object({
  nombre: z.string().min(1).max(180).optional(),
  nif: z.string().max(30).optional(),
  account_type: z.enum(["autonomo", "empresa"]).optional(),
  plan: z.string().max(40).optional(),
  gestor_id: z.string().uuid().nullable().optional(),
  inbox_alias: z.string().max(60).optional(),
  metadata_patch: z.record(z.unknown()).optional(),
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;

  const parsed = UpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, id))) return jsonError("Sin permiso", 403);

  const { metadata_patch, ...rest } = parsed.data;
  const update: Record<string, unknown> = { ...rest };

  if (metadata_patch) {
    const { data: existing } = await admin.from("empresas").select("metadata").eq("id", id).single();
    const prevMeta = (existing?.metadata ?? {}) as Record<string, unknown>;
    update.metadata = { ...prevMeta, ...metadata_patch };
  }

  const { data, error } = await admin.from("empresas").update(update).eq("id", id).select("*").single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo actualizar", 500);
  return NextResponse.json({ ok: true, empresa: data });
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;
  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, id))) return jsonError("Sin permiso", 403);

  // Soft delete: marcamos como inactiva en metadata + estado='archivada'.
  const { data: existing } = await admin.from("empresas").select("metadata").eq("id", id).single();
  const prevMeta = ((existing?.metadata ?? {}) as Record<string, unknown>);
  const { error } = await admin
    .from("empresas")
    .update({
      metadata: { ...prevMeta, archived: true, archived_at: new Date().toISOString() },
      estado: "archivada",
    })
    .eq("id", id);
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}
