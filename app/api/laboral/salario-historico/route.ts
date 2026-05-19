import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";

const Create = z.object({
  empresa_id: z.string().uuid(),
  trabajador_id: z.string().uuid(),
  fecha_efecto: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  bruto_anual: z.number().positive().max(1_000_000),
  motivo: z.string().max(200).optional(),
  convenio_codigo: z.string().max(40).optional(),
});

/**
 * GET ?empresa_id=...&trabajador_id=... — devuelve el histórico ordenado.
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const empresaId = request.nextUrl.searchParams.get("empresa_id");
  const trabajadorId = request.nextUrl.searchParams.get("trabajador_id");
  if (!empresaId) return jsonError("Falta empresa_id");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, empresaId))) return jsonError("Sin permiso", 403);

  let q = admin
    .from("salario_historico")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("fecha_efecto", { ascending: false });
  if (trabajadorId) q = q.eq("trabajador_id", trabajadorId);

  const { data } = await q;
  return NextResponse.json({ ok: true, items: data ?? [] });
}

/**
 * POST — registra un cambio salarial. Actualiza también
 * trabajadores.salario_bruto_anual al nuevo valor (a partir de fecha_efecto
 * el cálculo de nómina usará el nuevo bruto).
 */
export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Create.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  const { data: trabajador } = await admin
    .from("trabajadores")
    .select("id,empresa_id,salario_bruto_anual")
    .eq("id", parsed.data.trabajador_id)
    .maybeSingle();
  if (!trabajador || trabajador.empresa_id !== parsed.data.empresa_id) {
    return jsonError("Trabajador no encontrado en esta empresa", 404);
  }

  const brutoAnterior = trabajador.salario_bruto_anual ? Number(trabajador.salario_bruto_anual) : null;
  const delta = brutoAnterior == null ? null : parsed.data.bruto_anual - brutoAnterior;

  const { data: insertado, error: insErr } = await admin
    .from("salario_historico")
    .insert({
      empresa_id: parsed.data.empresa_id,
      trabajador_id: parsed.data.trabajador_id,
      gestor_id: user.id,
      fecha_efecto: parsed.data.fecha_efecto,
      bruto_anual: parsed.data.bruto_anual,
      motivo: parsed.data.motivo ?? null,
      convenio_codigo: parsed.data.convenio_codigo ?? null,
      bruto_anual_anterior: brutoAnterior,
      delta_anual: delta,
    })
    .select("*")
    .single();
  if (insErr) return jsonError(insErr.message, 500);

  // Si la fecha de efecto es hoy o anterior, actualizamos el salario actual.
  const hoy = new Date().toISOString().slice(0, 10);
  if (parsed.data.fecha_efecto <= hoy) {
    const { error: updErr } = await admin
      .from("trabajadores")
      .update({ salario_bruto_anual: parsed.data.bruto_anual })
      .eq("id", parsed.data.trabajador_id);
    if (updErr) return jsonError(updErr.message, 500);
  }

  return NextResponse.json({ ok: true, item: insertado });
}
