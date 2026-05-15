import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany, isGestorOrAdmin } from "@/lib/laboral/access";
import { siguienteEmision } from "@/lib/billing/calc";

const Schema = z.object({
  empresa_id: z.string().uuid(),
  nombre: z.string().min(1).max(180),
  cliente_nombre: z.string().min(1).max(180),
  cliente_nif: z.string().max(30).optional(),
  cliente_email: z.string().email().optional(),
  cliente_direccion: z.string().max(500).optional(),
  frecuencia: z.enum(["mensual", "bimestral", "trimestral", "semestral", "anual"]),
  dia_emision: z.number().int().min(1).max(28).default(1),
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  base: z.number().min(0).max(1_000_000),
  iva_pct: z.number().min(0).max(30).default(21),
  irpf_pct: z.number().min(0).max(30).default(0),
  concepto: z.string().max(500).optional(),
});

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const empresaId = request.nextUrl.searchParams.get("empresa_id");
  if (!empresaId) return jsonError("Falta empresa_id");
  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, empresaId))) return jsonError("Sin acceso", 403);
  const { data } = await admin
    .from("facturas_recurrentes")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("proxima_emision", { ascending: true });
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");
  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  const inicio = parsed.data.fecha_inicio ?? new Date().toISOString().slice(0, 10);
  const proxima = siguienteEmision(new Date(inicio), parsed.data.frecuencia, parsed.data.dia_emision);
  const iva = parsed.data.base * (parsed.data.iva_pct / 100);
  const irpf = parsed.data.base * (parsed.data.irpf_pct / 100);
  const total = Math.round((parsed.data.base + iva - irpf) * 100) / 100;

  const { data, error } = await admin
    .from("facturas_recurrentes")
    .insert({
      empresa_id: parsed.data.empresa_id,
      gestor_id: user.id,
      nombre: parsed.data.nombre,
      cliente_nombre: parsed.data.cliente_nombre,
      cliente_nif: parsed.data.cliente_nif ?? null,
      cliente_email: parsed.data.cliente_email ?? null,
      cliente_direccion: parsed.data.cliente_direccion ?? null,
      frecuencia: parsed.data.frecuencia,
      dia_emision: parsed.data.dia_emision,
      fecha_inicio: inicio,
      fecha_fin: parsed.data.fecha_fin ?? null,
      proxima_emision: proxima.toISOString().slice(0, 10),
      base: parsed.data.base,
      iva_pct: parsed.data.iva_pct,
      irpf_pct: parsed.data.irpf_pct,
      total,
      concepto: parsed.data.concepto ?? null,
    })
    .select("*")
    .single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo crear", 500);
  return NextResponse.json({ ok: true, recurrente: data });
}

export async function PATCH(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const body = (await request.json().catch(() => null)) as { id?: string; estado?: string } | null;
  if (!body?.id || !body.estado) return jsonError("Datos inválidos");
  const admin = createSupabaseAdmin();
  const { data: existing } = await admin
    .from("facturas_recurrentes")
    .select("empresa_id")
    .eq("id", body.id)
    .maybeSingle();
  if (!existing) return jsonError("No encontrado", 404);
  if (!(await isGestorOrAdmin(admin, user.id, existing.empresa_id))) return jsonError("Sin permiso", 403);
  const { data, error } = await admin
    .from("facturas_recurrentes")
    .update({ estado: body.estado })
    .eq("id", body.id)
    .select("*")
    .single();
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, recurrente: data });
}
