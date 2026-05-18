import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";

/**
 * Marca un modelo AEAT como presentado oficialmente.
 *
 * Lo usa:
 *   - El botón "He presentado" después de subir el TXT a la sede AEAT
 *   - El flujo de firma con Autofirma (auto-marca presentado al firmar)
 *
 * Persiste el CSV (Código Seguro de Verificación) que da AEAT como
 * justificante de presentación. El bot fiscal y el calendario lo leen
 * para saber que ya no es pendiente.
 */

const Create = z.object({
  empresa_id: z.string().uuid(),
  modelo: z.string().min(2).max(8),
  ejercicio: z.number().int().min(2017).max(2100),
  periodo: z.string().min(1).max(10),
  fecha_presentacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  importe: z.number().optional(),
  csv: z.string().max(60).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const sp = request.nextUrl.searchParams;
  const empresaId = sp.get("empresa_id");
  if (!empresaId) return jsonError("Falta empresa_id");
  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, empresaId))) return jsonError("Sin permiso", 403);

  let q = admin
    .from("aeat_presentaciones")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("fecha_presentacion", { ascending: false })
    .limit(200);
  const modelo = sp.get("modelo");
  if (modelo) q = q.eq("modelo", modelo);
  const ejercicio = sp.get("ejercicio");
  if (ejercicio) q = q.eq("ejercicio", Number(ejercicio));
  const { data, error } = await q;
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Create.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");
  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  const { data, error } = await admin
    .from("aeat_presentaciones")
    .upsert(
      {
        empresa_id: parsed.data.empresa_id,
        modelo: parsed.data.modelo,
        ejercicio: parsed.data.ejercicio,
        periodo: parsed.data.periodo,
        fecha_presentacion: parsed.data.fecha_presentacion ?? new Date().toISOString().slice(0, 10),
        importe: parsed.data.importe ?? null,
        csv: parsed.data.csv ?? null,
        estado: "presentado",
        presentado_por: user.id,
        metadata: parsed.data.metadata ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "empresa_id,modelo,ejercicio,periodo" },
    )
    .select("*")
    .single();

  if (error || !data) return jsonError(error?.message ?? "No se pudo registrar", 500);
  return NextResponse.json({ ok: true, item: data });
}

const Patch = z.object({
  id: z.string().uuid(),
  estado: z.enum(["presentado", "rectificado", "anulado"]).optional(),
  csv: z.string().max(60).nullable().optional(),
  importe: z.number().nullable().optional(),
});

export async function PATCH(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");
  const admin = createSupabaseAdmin();
  const { data: row } = await admin.from("aeat_presentaciones").select("empresa_id").eq("id", parsed.data.id).maybeSingle();
  if (!row) return jsonError("No encontrado", 404);
  if (!(await isGestorOrAdmin(admin, user.id, row.empresa_id))) return jsonError("Sin permiso", 403);
  const { id, ...patch } = parsed.data;
  const { data, error } = await admin.from("aeat_presentaciones").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo actualizar", 500);
  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return jsonError("Falta id");
  const admin = createSupabaseAdmin();
  const { data: row } = await admin.from("aeat_presentaciones").select("empresa_id").eq("id", id).maybeSingle();
  if (!row) return jsonError("No encontrado", 404);
  if (!(await isGestorOrAdmin(admin, user.id, row.empresa_id))) return jsonError("Sin permiso", 403);
  await admin.from("aeat_presentaciones").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
