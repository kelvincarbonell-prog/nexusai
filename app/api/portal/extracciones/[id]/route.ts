import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";

const PatchSchema = z.object({
  status: z.enum(["pending", "extracted", "reviewed", "rejected", "failed"]).optional(),
  datos_extraidos: z.record(z.unknown()).optional(),
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  const { data: existing } = await admin
    .from("facturas_recibidas_extracciones")
    .select("empresa_id")
    .eq("id", id)
    .single();
  if (!existing) return jsonError("Extracción no encontrada", 404);
  if (!(await canAccessLaborCompany(admin, user.id, existing.empresa_id))) return jsonError("Sin acceso", 403);

  const update: Record<string, unknown> = {};
  if (parsed.data.status) update.status = parsed.data.status;
  if (parsed.data.datos_extraidos) update.datos_extraidos = parsed.data.datos_extraidos;

  const { data, error } = await admin
    .from("facturas_recibidas_extracciones")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) return jsonError(error?.message ?? "Error", 500);
  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;
  const admin = createSupabaseAdmin();

  const { data: existing } = await admin
    .from("facturas_recibidas_extracciones")
    .select("empresa_id,storage_path,factura_id,gasto_id")
    .eq("id", id)
    .single();
  if (!existing) return jsonError("Extracción no encontrada", 404);
  if (!(await canAccessLaborCompany(admin, user.id, existing.empresa_id))) return jsonError("Sin acceso", 403);

  // Borra el archivo de storage si existía (no falla si no está).
  if (existing.storage_path) {
    await admin.storage.from("ocr-uploads").remove([existing.storage_path]).catch(() => null);
  }

  const { error } = await admin.from("facturas_recibidas_extracciones").delete().eq("id", id);
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}
