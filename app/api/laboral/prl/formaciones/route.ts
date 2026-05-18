import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";

/**
 * Formaciones PRL del trabajador (Ley 31/1995 art. 19).
 * Soporta vencimiento y recordatorio antes de caducar.
 */

const Create = z.object({
  empresa_id: z.string().uuid(),
  trabajador_id: z.string().uuid(),
  curso: z.string().min(2).max(180),
  horas: z.number().min(0).max(2000).default(0),
  fecha_realizada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fecha_caducidad: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  centro_formador: z.string().max(180).optional(),
  diploma_url: z.string().max(500).optional(),
  modalidad: z.enum(["presencial", "online", "mixta"]).default("presencial"),
});

const Patch = z.object({
  id: z.string().uuid(),
  fecha_caducidad: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  diploma_url: z.string().max(500).nullable().optional(),
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
    .from("prl_formaciones")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("fecha_realizada", { ascending: false })
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
  const { data, error } = await admin.from("prl_formaciones").insert({
    empresa_id: parsed.data.empresa_id,
    trabajador_id: parsed.data.trabajador_id,
    gestor_id: user.id,
    curso: parsed.data.curso,
    horas: parsed.data.horas,
    fecha_realizada: parsed.data.fecha_realizada,
    fecha_caducidad: parsed.data.fecha_caducidad ?? null,
    centro_formador: parsed.data.centro_formador ?? null,
    diploma_url: parsed.data.diploma_url ?? null,
    modalidad: parsed.data.modalidad,
  }).select("*").single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo crear", 500);
  return NextResponse.json({ ok: true, item: data });
}

export async function PATCH(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");
  const admin = createSupabaseAdmin();
  const { data: row } = await admin.from("prl_formaciones").select("empresa_id").eq("id", parsed.data.id).maybeSingle();
  if (!row) return jsonError("No encontrado", 404);
  if (!(await isGestorOrAdmin(admin, user.id, row.empresa_id))) return jsonError("Sin permiso", 403);
  const { id, ...patch } = parsed.data;
  const { data, error } = await admin.from("prl_formaciones").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo actualizar", 500);
  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return jsonError("Falta id");
  const admin = createSupabaseAdmin();
  const { data: row } = await admin.from("prl_formaciones").select("empresa_id").eq("id", id).maybeSingle();
  if (!row) return jsonError("No encontrado", 404);
  if (!(await isGestorOrAdmin(admin, user.id, row.empresa_id))) return jsonError("Sin permiso", 403);
  await admin.from("prl_formaciones").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
