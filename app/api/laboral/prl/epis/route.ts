import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";

/**
 * Registro de entrega de EPIs (Equipos Protección Individual).
 * Cumplimiento Ley 31/1995 art. 17 — obligatorio firmar.
 */

const Create = z.object({
  empresa_id: z.string().uuid(),
  trabajador_id: z.string().uuid(),
  fecha_entrega: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  epi: z.string().min(2).max(180),     // "Casco", "Guantes nitrilo", "Calzado seguridad S3"
  cantidad: z.number().int().min(1).max(1000).default(1),
  talla: z.string().max(20).optional(),
  marca_modelo: z.string().max(180).optional(),
  certificacion: z.string().max(120).optional(),  // EN, UNE
  vida_util_meses: z.number().int().min(0).max(120).optional(),
  observaciones: z.string().max(500).optional(),
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
    .from("prl_epis")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("fecha_entrega", { ascending: false })
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
  const { data, error } = await admin.from("prl_epis").insert({
    empresa_id: parsed.data.empresa_id,
    trabajador_id: parsed.data.trabajador_id,
    gestor_id: user.id,
    fecha_entrega: parsed.data.fecha_entrega,
    epi: parsed.data.epi,
    cantidad: parsed.data.cantidad,
    talla: parsed.data.talla ?? null,
    marca_modelo: parsed.data.marca_modelo ?? null,
    certificacion: parsed.data.certificacion ?? null,
    vida_util_meses: parsed.data.vida_util_meses ?? null,
    observaciones: parsed.data.observaciones ?? null,
  }).select("*").single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo crear", 500);
  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return jsonError("Falta id");
  const admin = createSupabaseAdmin();
  const { data: row } = await admin.from("prl_epis").select("empresa_id").eq("id", id).maybeSingle();
  if (!row) return jsonError("No encontrado", 404);
  if (!(await isGestorOrAdmin(admin, user.id, row.empresa_id))) return jsonError("Sin permiso", 403);
  await admin.from("prl_epis").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
