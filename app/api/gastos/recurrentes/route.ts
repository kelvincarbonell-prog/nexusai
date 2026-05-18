import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";

/**
 * Gastos recurrentes: plantillas que generan un gasto automáticamente
 * cada periodo (mensual / trimestral / anual).
 *
 * Ejemplos típicos: alquiler oficina, fibra, software SaaS, gestoría,
 * hosting, dominio anual.
 *
 * El cron /api/cron/recurrentes mira esta tabla y crea los gastos
 * cuando llega la fecha próxima.
 */

const Create = z.object({
  empresa_id: z.string().uuid(),
  proveedor: z.string().min(2).max(180),
  proveedor_nif: z.string().max(20).optional(),
  concepto: z.string().min(2).max(500),
  cuenta_pgc: z.string().max(10).optional(),
  base: z.number().min(0).max(1_000_000),
  iva_pct: z.number().min(0).max(30).default(21),
  irpf_pct: z.number().min(0).max(30).default(0),
  periodicidad: z.enum(["mensual", "trimestral", "semestral", "anual"]).default("mensual"),
  dia_emision: z.number().int().min(1).max(31).default(1),
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  iban_cargo: z.string().max(40).optional(),
});

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const sp = request.nextUrl.searchParams;
  const empresaId = sp.get("empresa_id");
  if (!empresaId) return jsonError("Falta empresa_id");
  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, empresaId))) return jsonError("Sin permiso", 403);
  const { data, error } = await admin
    .from("gastos_recurrentes")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("proveedor")
    .limit(200);
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

  const base = parsed.data.base;
  const iva = Math.round(base * parsed.data.iva_pct) / 100;
  const irpf = Math.round(base * parsed.data.irpf_pct) / 100;
  const total = Math.round((base + iva - irpf) * 100) / 100;

  const { data, error } = await admin
    .from("gastos_recurrentes")
    .insert({
      empresa_id: parsed.data.empresa_id,
      gestor_id: user.id,
      proveedor: parsed.data.proveedor,
      proveedor_nif: parsed.data.proveedor_nif ?? null,
      concepto: parsed.data.concepto,
      cuenta_pgc: parsed.data.cuenta_pgc ?? null,
      base,
      iva,
      iva_pct: parsed.data.iva_pct,
      irpf,
      irpf_pct: parsed.data.irpf_pct,
      total,
      periodicidad: parsed.data.periodicidad,
      dia_emision: parsed.data.dia_emision,
      fecha_inicio: parsed.data.fecha_inicio,
      fecha_fin: parsed.data.fecha_fin ?? null,
      proximo_envio: parsed.data.fecha_inicio,
      iban_cargo: parsed.data.iban_cargo ?? null,
      activo: true,
    })
    .select("*")
    .single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo crear", 500);
  return NextResponse.json({ ok: true, item: data });
}

const Patch = z.object({
  id: z.string().uuid(),
  activo: z.boolean().optional(),
  base: z.number().min(0).max(1_000_000).optional(),
  fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function PATCH(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");
  const admin = createSupabaseAdmin();
  const { data: row } = await admin.from("gastos_recurrentes").select("empresa_id").eq("id", parsed.data.id).maybeSingle();
  if (!row) return jsonError("No encontrado", 404);
  if (!(await isGestorOrAdmin(admin, user.id, row.empresa_id))) return jsonError("Sin permiso", 403);
  const { id, ...patch } = parsed.data;
  const { data, error } = await admin.from("gastos_recurrentes").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo actualizar", 500);
  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return jsonError("Falta id");
  const admin = createSupabaseAdmin();
  const { data: row } = await admin.from("gastos_recurrentes").select("empresa_id").eq("id", id).maybeSingle();
  if (!row) return jsonError("No encontrado", 404);
  if (!(await isGestorOrAdmin(admin, user.id, row.empresa_id))) return jsonError("Sin permiso", 403);
  await admin.from("gastos_recurrentes").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
