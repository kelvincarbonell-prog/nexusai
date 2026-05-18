import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";

/**
 * Reconocimientos médicos (Ley 31/1995 Prevención de Riesgos Laborales).
 *
 * GET    ?empresa_id=...&trabajador_id=...
 * POST   nuevo reconocimiento
 * PATCH  actualizar (apto/no_apto, próxima revisión, etc.)
 * DELETE
 */

const Create = z.object({
  empresa_id: z.string().uuid(),
  trabajador_id: z.string().uuid(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tipo: z.enum(["inicial", "periodico", "tras_baja", "cambio_puesto"]).default("periodico"),
  servicio_prevencion: z.string().max(180).optional(),
  resultado: z.enum(["apto", "apto_con_restricciones", "no_apto", "pendiente"]).default("pendiente"),
  restricciones: z.string().max(2000).optional(),
  proxima_revision: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  observaciones: z.string().max(2000).optional(),
});

const Patch = z.object({
  id: z.string().uuid(),
  resultado: z.enum(["apto", "apto_con_restricciones", "no_apto", "pendiente"]).optional(),
  restricciones: z.string().max(2000).nullable().optional(),
  proxima_revision: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  observaciones: z.string().max(2000).nullable().optional(),
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
    .from("prl_reconocimientos")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("fecha", { ascending: false })
    .limit(500);
  const t = sp.get("trabajador_id");
  if (t) q = q.eq("trabajador_id", t);
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
    .from("prl_reconocimientos")
    .insert({
      empresa_id: parsed.data.empresa_id,
      trabajador_id: parsed.data.trabajador_id,
      gestor_id: user.id,
      fecha: parsed.data.fecha,
      tipo: parsed.data.tipo,
      servicio_prevencion: parsed.data.servicio_prevencion ?? null,
      resultado: parsed.data.resultado,
      restricciones: parsed.data.restricciones ?? null,
      proxima_revision: parsed.data.proxima_revision ?? null,
      observaciones: parsed.data.observaciones ?? null,
    })
    .select("*")
    .single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo crear", 500);
  return NextResponse.json({ ok: true, item: data });
}

export async function PATCH(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");
  const admin = createSupabaseAdmin();
  const { data: row } = await admin.from("prl_reconocimientos").select("empresa_id").eq("id", parsed.data.id).maybeSingle();
  if (!row) return jsonError("No encontrado", 404);
  if (!(await isGestorOrAdmin(admin, user.id, row.empresa_id))) return jsonError("Sin permiso", 403);
  const { id, ...patch } = parsed.data;
  const { data, error } = await admin.from("prl_reconocimientos").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo actualizar", 500);
  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return jsonError("Falta id");
  const admin = createSupabaseAdmin();
  const { data: row } = await admin.from("prl_reconocimientos").select("empresa_id").eq("id", id).maybeSingle();
  if (!row) return jsonError("No encontrado", 404);
  if (!(await isGestorOrAdmin(admin, user.id, row.empresa_id))) return jsonError("Sin permiso", 403);
  await admin.from("prl_reconocimientos").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
