import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany, isGestorOrAdmin } from "@/lib/laboral/access";

const TRIGGERS = [
  "factura_creada", "factura_vencida", "factura_pagada",
  "gasto_creado", "gasto_alto",
  "fichaje_no_entrada", "fichaje_no_salida",
  "modelo_proximo_vencimiento", "modelo_presentado",
  "cliente_creado", "cliente_inactivo_30d",
  "email_recibido", "extraccion_baja_confianza",
] as const;

const ACTIONS = [
  "email_recordatorio", "whatsapp", "asignar_categoria",
  "crear_tarea", "notificar_gestor", "webhook",
] as const;

const Schema = z.object({
  empresa_id: z.string().uuid(),
  nombre: z.string().min(1).max(180),
  trigger_event: z.enum(TRIGGERS),
  trigger_filters: z.record(z.unknown()).default({}),
  action_type: z.enum(ACTIONS),
  action_config: z.record(z.unknown()).default({}),
});

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const empresaId = request.nextUrl.searchParams.get("empresa_id");
  if (!empresaId) return jsonError("Falta empresa_id");
  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, empresaId))) return jsonError("Sin acceso", 403);
  const { data } = await admin.from("automation_rules").select("*").eq("empresa_id", empresaId).order("updated_at", { ascending: false });
  return NextResponse.json({ ok: true, rules: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");
  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);
  const { data, error } = await admin.from("automation_rules").insert({ ...parsed.data, gestor_id: user.id }).select("*").single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo crear", 500);
  return NextResponse.json({ ok: true, rule: data });
}

export async function PATCH(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const body = (await request.json().catch(() => null)) as { id?: string; estado?: string } | null;
  if (!body?.id) return jsonError("Falta id");
  const admin = createSupabaseAdmin();
  const { data: existing } = await admin.from("automation_rules").select("empresa_id").eq("id", body.id).maybeSingle();
  if (!existing) return jsonError("No encontrada", 404);
  if (!(await isGestorOrAdmin(admin, user.id, existing.empresa_id))) return jsonError("Sin permiso", 403);
  const update: Record<string, unknown> = {};
  if (body.estado) update.estado = body.estado;
  const { data, error } = await admin.from("automation_rules").update(update).eq("id", body.id).select("*").single();
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, rule: data });
}
