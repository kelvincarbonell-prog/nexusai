import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany, isGestorOrAdmin } from "@/lib/laboral/access";

/**
 * Cuadrante de turnos: planificación de horarios por trabajador.
 *
 * GET    ?empresa_id=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 * POST   crear/actualizar turno
 * DELETE ?id=
 */

const Schema = z.object({
  id: z.string().uuid().optional(),
  empresa_id: z.string().uuid(),
  trabajador_id: z.string().uuid(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/),
  hora_fin: z.string().regex(/^\d{2}:\d{2}$/),
  descanso_min: z.number().min(0).max(480).default(0),
  ubicacion: z.string().max(180).optional(),
  notas: z.string().max(500).optional(),
});

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const sp = request.nextUrl.searchParams;
  const empresaId = sp.get("empresa_id");
  if (!empresaId) return jsonError("Falta empresa_id");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, empresaId))) return jsonError("Sin acceso", 403);

  const from = sp.get("from");
  const to = sp.get("to");
  let q = admin
    .from("turnos")
    .select("id,trabajador_id,fecha,hora_inicio,hora_fin,descanso_min,ubicacion,notas")
    .eq("empresa_id", empresaId)
    .order("fecha", { ascending: true })
    .order("hora_inicio", { ascending: true })
    .limit(500);
  if (from) q = q.gte("fecha", from);
  if (to) q = q.lte("fecha", to);
  const { data, error } = await q;
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  // Validación: hora_fin > hora_inicio (mismo día) o turno nocturno (fin < inicio = pasa medianoche)
  const inicio = parsed.data.hora_inicio.replace(":", "");
  const fin = parsed.data.hora_fin.replace(":", "");
  if (inicio === fin) return jsonError("La hora de fin no puede ser igual a la de inicio.");

  const row = {
    empresa_id: parsed.data.empresa_id,
    trabajador_id: parsed.data.trabajador_id,
    gestor_id: user.id,
    fecha: parsed.data.fecha,
    hora_inicio: parsed.data.hora_inicio,
    hora_fin: parsed.data.hora_fin,
    descanso_min: parsed.data.descanso_min,
    ubicacion: parsed.data.ubicacion ?? null,
    notas: parsed.data.notas ?? null,
  };

  if (parsed.data.id) {
    const { data, error } = await admin.from("turnos").update(row).eq("id", parsed.data.id).select("*").single();
    if (error || !data) return jsonError(error?.message ?? "No se pudo actualizar", 500);
    return NextResponse.json({ ok: true, item: data });
  }

  const { data, error } = await admin.from("turnos").insert(row).select("*").single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo crear", 500);
  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return jsonError("Falta id");
  const admin = createSupabaseAdmin();
  const { data: row } = await admin.from("turnos").select("empresa_id").eq("id", id).maybeSingle();
  if (!row) return jsonError("Turno no encontrado", 404);
  if (!(await isGestorOrAdmin(admin, user.id, row.empresa_id))) return jsonError("Sin permiso", 403);
  await admin.from("turnos").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
