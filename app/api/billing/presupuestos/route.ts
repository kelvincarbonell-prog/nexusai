import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany, isGestorOrAdmin } from "@/lib/laboral/access";
import { calcularLineas } from "@/lib/billing/calc";

const LineaSchema = z.object({
  descripcion: z.string().min(1).max(500),
  cantidad: z.number().min(0).max(1_000_000),
  precio_unitario: z.number().min(0).max(1_000_000),
  descuento_pct: z.number().min(0).max(100).default(0),
  iva_pct: z.number().min(0).max(30).default(21),
  irpf_pct: z.number().min(0).max(30).default(0),
});

const CreateSchema = z.object({
  empresa_id: z.string().uuid(),
  cliente_nombre: z.string().min(1).max(180),
  cliente_nif: z.string().max(30).optional(),
  cliente_email: z.string().email().optional(),
  cliente_direccion: z.string().max(500).optional(),
  fecha_emision: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fecha_validez: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  moneda: z.string().max(3).default("EUR"),
  lineas: z.array(LineaSchema).min(1).max(50),
  notas: z.string().max(2000).optional(),
});

const UpdateEstadoSchema = z.object({
  id: z.string().uuid(),
  estado: z.enum(["borrador", "enviado", "aceptado", "rechazado", "expirado", "facturado"]),
});

async function nextNumero(admin: ReturnType<typeof createSupabaseAdmin>, empresaId: string): Promise<string> {
  const year = new Date().getUTCFullYear();
  const { count } = await admin
    .from("presupuestos")
    .select("*", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .gte("fecha_emision", `${year}-01-01`)
    .lte("fecha_emision", `${year}-12-31`);
  return `PRES-${year}-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const empresaId = request.nextUrl.searchParams.get("empresa_id");
  if (!empresaId) return jsonError("Falta empresa_id");
  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, empresaId))) return jsonError("Sin acceso", 403);
  const { data, error } = await admin
    .from("presupuestos")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("fecha_emision", { ascending: false })
    .limit(100);
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");
  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  const totales = calcularLineas(parsed.data.lineas);
  const numero = await nextNumero(admin, parsed.data.empresa_id);

  const { data: presupuesto, error: presError } = await admin
    .from("presupuestos")
    .insert({
      empresa_id: parsed.data.empresa_id,
      gestor_id: user.id,
      numero,
      cliente_nombre: parsed.data.cliente_nombre,
      cliente_nif: parsed.data.cliente_nif ?? null,
      cliente_email: parsed.data.cliente_email ?? null,
      cliente_direccion: parsed.data.cliente_direccion ?? null,
      fecha_emision: parsed.data.fecha_emision ?? new Date().toISOString().slice(0, 10),
      fecha_validez: parsed.data.fecha_validez ?? null,
      moneda: parsed.data.moneda,
      base: totales.base_imponible,
      iva: totales.cuota_iva,
      irpf: totales.retencion_irpf,
      total: totales.total,
      notas: parsed.data.notas ?? null,
    })
    .select("*")
    .single();
  if (presError || !presupuesto) return jsonError(presError?.message ?? "No se pudo crear", 500);

  const lineasRows = totales.lineas.map((l, i) => ({
    presupuesto_id: presupuesto.id,
    line_number: i + 1,
    descripcion: l.descripcion,
    cantidad: l.cantidad,
    precio_unitario: l.precio_unitario,
    descuento_pct: l.descuento_pct ?? 0,
    iva_pct: l.iva_pct ?? 21,
    irpf_pct: l.irpf_pct ?? 0,
    base: l.base,
    iva: l.iva,
    total: l.total,
  }));
  const { error: lineasError } = await admin.from("presupuestos_lineas").insert(lineasRows);
  if (lineasError) return jsonError(lineasError.message, 500);

  return NextResponse.json({ ok: true, presupuesto });
}

export async function PATCH(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = UpdateEstadoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");
  const admin = createSupabaseAdmin();
  const { data: existing } = await admin.from("presupuestos").select("empresa_id").eq("id", parsed.data.id).maybeSingle();
  if (!existing) return jsonError("No encontrado", 404);
  if (!(await isGestorOrAdmin(admin, user.id, existing.empresa_id))) return jsonError("Sin permiso", 403);
  const { data, error } = await admin
    .from("presupuestos")
    .update({ estado: parsed.data.estado })
    .eq("id", parsed.data.id)
    .select("*")
    .single();
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, presupuesto: data });
}
