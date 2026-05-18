import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";
import { generarCuadroAmortizacion, TABLAS_AMORTIZACION, type TipoInmovilizado } from "@/lib/accounting/inmovilizado";

/**
 * Inmovilizado: alta/baja de elementos + cuadro de amortización.
 *
 * GET    ?empresa_id=...  o ?id=...
 * POST   alta nuevo elemento
 * PATCH  cambiar estado (en_uso, baja, vendido)
 * DELETE eliminar
 */

const Create = z.object({
  empresa_id: z.string().uuid(),
  descripcion: z.string().min(2).max(180),
  tipo: z.enum(["mobiliario", "equipo_informatico", "software", "vehiculo_turismo", "vehiculo_transporte", "maquinaria", "construccion", "instalacion_tecnica", "otro"]),
  precio_adquisicion: z.number().min(0.01).max(50_000_000),
  valor_residual: z.number().min(0).max(50_000_000).default(0),
  fecha_alta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vida_util_anyos: z.number().int().min(1).max(80),
  metodo: z.enum(["lineal", "degresivo"]).default("lineal"),
  porcentaje_degresivo: z.number().min(0).max(100).optional(),
  proveedor: z.string().max(180).optional(),
  ubicacion: z.string().max(180).optional(),
  factura_id: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const sp = request.nextUrl.searchParams;
  const id = sp.get("id");
  const admin = createSupabaseAdmin();

  if (id) {
    const { data: row } = await admin.from("inmovilizado").select("*").eq("id", id).maybeSingle();
    if (!row) return jsonError("No encontrado", 404);
    if (!(await isGestorOrAdmin(admin, user.id, row.empresa_id))) return jsonError("Sin permiso", 403);
    const cuadro = generarCuadroAmortizacion({
      precio_adquisicion: Number(row.precio_adquisicion),
      valor_residual: Number(row.valor_residual ?? 0),
      fecha_alta: row.fecha_alta,
      vida_util_anyos: Number(row.vida_util_anyos),
      metodo: row.metodo,
      porcentaje_degresivo: row.porcentaje_degresivo ?? undefined,
    });
    return NextResponse.json({ ok: true, item: row, cuadro_amortizacion: cuadro });
  }

  const empresaId = sp.get("empresa_id");
  if (!empresaId) return jsonError("Falta empresa_id");
  if (!(await isGestorOrAdmin(admin, user.id, empresaId))) return jsonError("Sin permiso", 403);
  const { data, error } = await admin
    .from("inmovilizado")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("fecha_alta", { ascending: false })
    .limit(500);
  if (error) return jsonError(error.message, 500);

  // Calcula amortización acumulada hasta hoy para cada item
  const hoy = new Date().toISOString().slice(0, 10);
  const yearActual = Number(hoy.slice(0, 4));
  const items = (data ?? []).map((row) => {
    const cuadro = generarCuadroAmortizacion({
      precio_adquisicion: Number(row.precio_adquisicion),
      valor_residual: Number(row.valor_residual ?? 0),
      fecha_alta: row.fecha_alta,
      vida_util_anyos: Number(row.vida_util_anyos),
      metodo: row.metodo,
      porcentaje_degresivo: row.porcentaje_degresivo ?? undefined,
    });
    const rowsHastaHoy = cuadro.filter((c) => c.anyo <= yearActual);
    const acumulada = rowsHastaHoy[rowsHastaHoy.length - 1]?.amortizacion_acumulada ?? 0;
    const vnc = Number(row.precio_adquisicion) - acumulada;
    return { ...row, amortizacion_acumulada_hoy: acumulada, valor_neto_contable_hoy: Math.round(vnc * 100) / 100 };
  });

  return NextResponse.json({ ok: true, items, tablas: TABLAS_AMORTIZACION });
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Create.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");
  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  // Aviso si vida_util_anyos > legal máximo
  const tabla = TABLAS_AMORTIZACION[parsed.data.tipo as TipoInmovilizado];
  let aviso: string | undefined;
  if (parsed.data.vida_util_anyos > tabla.anyos_max) {
    aviso = `Vida útil ${parsed.data.vida_util_anyos} años excede el máximo legal (${tabla.anyos_max}) para ${parsed.data.tipo}.`;
  }

  const { data, error } = await admin.from("inmovilizado").insert({
    empresa_id: parsed.data.empresa_id,
    gestor_id: user.id,
    descripcion: parsed.data.descripcion,
    tipo: parsed.data.tipo,
    precio_adquisicion: parsed.data.precio_adquisicion,
    valor_residual: parsed.data.valor_residual,
    fecha_alta: parsed.data.fecha_alta,
    vida_util_anyos: parsed.data.vida_util_anyos,
    metodo: parsed.data.metodo,
    porcentaje_degresivo: parsed.data.porcentaje_degresivo ?? null,
    proveedor: parsed.data.proveedor ?? null,
    ubicacion: parsed.data.ubicacion ?? null,
    factura_id: parsed.data.factura_id ?? null,
    cuenta_inmov: tabla.cuenta_inmov,
    cuenta_am_acum: tabla.cuenta_am_acum,
    cuenta_dotacion: tabla.cuenta_dotacion,
    estado: "en_uso",
  }).select("*").single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo crear", 500);
  return NextResponse.json({ ok: true, item: data, aviso });
}

const Patch = z.object({
  id: z.string().uuid(),
  estado: z.enum(["en_uso", "baja", "vendido"]).optional(),
  fecha_baja: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  importe_venta: z.number().nullable().optional(),
});

export async function PATCH(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");
  const admin = createSupabaseAdmin();
  const { data: row } = await admin.from("inmovilizado").select("empresa_id").eq("id", parsed.data.id).maybeSingle();
  if (!row) return jsonError("No encontrado", 404);
  if (!(await isGestorOrAdmin(admin, user.id, row.empresa_id))) return jsonError("Sin permiso", 403);
  const { id, ...patch } = parsed.data;
  const { data, error } = await admin.from("inmovilizado").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo actualizar", 500);
  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return jsonError("Falta id");
  const admin = createSupabaseAdmin();
  const { data: row } = await admin.from("inmovilizado").select("empresa_id").eq("id", id).maybeSingle();
  if (!row) return jsonError("No encontrado", 404);
  if (!(await isGestorOrAdmin(admin, user.id, row.empresa_id))) return jsonError("Sin permiso", 403);
  await admin.from("inmovilizado").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
