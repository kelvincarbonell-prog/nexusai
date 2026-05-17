import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";
import { asentarFacturaEmitida, asentarFacturaRecibida, asentarGasto } from "@/lib/accounting/auto-asientos";

const Schema = z.object({
  empresa_id: z.string().uuid(),
  source_type: z.enum(["factura_emitida", "factura_recibida", "gasto"]),
  source_id: z.string().uuid(),
  cuenta_pgc: z.string().max(8).optional(),
});

/**
 * Genera (o regenera) manualmente el asiento contable de una factura/gasto
 * concreto, útil para los registros que no se asentaron automáticamente
 * (importados, creados antes de activar auto-asientos, etc).
 */
export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  // Si ya existe el asiento, lo borramos antes (regenerar).
  await admin
    .from("journal_entries")
    .delete()
    .eq("empresa_id", parsed.data.empresa_id)
    .eq("source_type", parsed.data.source_type)
    .eq("source_id", parsed.data.source_id);

  let asiento: { id: string } | null = null;
  if (parsed.data.source_type === "factura_emitida" || parsed.data.source_type === "factura_recibida") {
    const { data: factura } = await admin
      .from("facturas")
      .select("*")
      .eq("id", parsed.data.source_id)
      .eq("empresa_id", parsed.data.empresa_id)
      .maybeSingle();
    if (!factura) return jsonError("Factura no encontrada", 404);
    const facturaInput = {
      id: factura.id,
      empresa_id: factura.empresa_id,
      fecha_emision: factura.fecha_emision,
      contacto_nombre: factura.contacto_nombre,
      numero: factura.numero,
      base: Number(factura.base ?? 0),
      iva: Number(factura.iva ?? 0),
      total: Number(factura.total ?? 0),
      metadata: (factura.metadata ?? {}) as Record<string, unknown>,
    };
    asiento = parsed.data.source_type === "factura_emitida"
      ? await asentarFacturaEmitida(admin, facturaInput, user.id)
      : await asentarFacturaRecibida(admin, facturaInput, user.id, { cuenta_pgc: parsed.data.cuenta_pgc });
  } else {
    const { data: gasto } = await admin
      .from("gastos")
      .select("*")
      .eq("id", parsed.data.source_id)
      .eq("empresa_id", parsed.data.empresa_id)
      .maybeSingle();
    if (!gasto) return jsonError("Gasto no encontrado", 404);
    asiento = await asentarGasto(
      admin,
      {
        id: gasto.id,
        empresa_id: gasto.empresa_id,
        fecha: gasto.fecha,
        proveedor: gasto.proveedor,
        concepto: gasto.concepto,
        base: Number(gasto.base ?? 0),
        iva: Number(gasto.iva ?? 0),
        total: Number(gasto.total ?? 0),
        metadata: (gasto.metadata ?? {}) as Record<string, unknown>,
      },
      user.id,
      { cuenta_pgc: parsed.data.cuenta_pgc },
    );
  }

  if (!asiento) return jsonError("No se pudo generar el asiento", 500);
  return NextResponse.json({ ok: true, asiento_id: asiento.id });
}

/**
 * Asentado masivo: regenera asientos para todas las facturas/gastos sin asiento.
 */
const BulkSchema = z.object({
  empresa_id: z.string().uuid(),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function PATCH(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = BulkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  const desde = parsed.data.desde ?? `${new Date().getUTCFullYear()}-01-01`;

  // Facturas sin asiento
  const { data: existingFacturas } = await admin
    .from("journal_entries")
    .select("source_id")
    .eq("empresa_id", parsed.data.empresa_id)
    .in("source_type", ["factura_emitida", "factura_recibida"]);
  const facturaIds = new Set((existingFacturas ?? []).map((e) => e.source_id));

  const { data: facturas } = await admin
    .from("facturas")
    .select("*")
    .eq("empresa_id", parsed.data.empresa_id)
    .gte("fecha_emision", desde);

  let creados = 0;
  for (const f of facturas ?? []) {
    if (facturaIds.has(f.id)) continue;
    const input = {
      id: f.id,
      empresa_id: f.empresa_id,
      fecha_emision: f.fecha_emision,
      contacto_nombre: f.contacto_nombre,
      numero: f.numero,
      base: Number(f.base ?? 0),
      iva: Number(f.iva ?? 0),
      total: Number(f.total ?? 0),
      metadata: (f.metadata ?? {}) as Record<string, unknown>,
    };
    const r = f.tipo === "emitida"
      ? await asentarFacturaEmitida(admin, input, user.id)
      : await asentarFacturaRecibida(admin, input, user.id, { cuenta_pgc: (f.metadata ?? {} as Record<string, unknown>).cuenta_pgc as string | undefined });
    if (r) creados++;
  }

  // Gastos sin asiento
  const { data: existingGastos } = await admin
    .from("journal_entries")
    .select("source_id")
    .eq("empresa_id", parsed.data.empresa_id)
    .eq("source_type", "gasto");
  const gastoIds = new Set((existingGastos ?? []).map((e) => e.source_id));

  const { data: gastos } = await admin
    .from("gastos")
    .select("*")
    .eq("empresa_id", parsed.data.empresa_id)
    .gte("fecha", desde);

  for (const g of gastos ?? []) {
    if (gastoIds.has(g.id)) continue;
    const r = await asentarGasto(
      admin,
      {
        id: g.id,
        empresa_id: g.empresa_id,
        fecha: g.fecha,
        proveedor: g.proveedor,
        concepto: g.concepto,
        base: Number(g.base ?? 0),
        iva: Number(g.iva ?? 0),
        total: Number(g.total ?? 0),
        metadata: (g.metadata ?? {}) as Record<string, unknown>,
      },
      user.id,
      { cuenta_pgc: (g.metadata ?? {} as Record<string, unknown>).cuenta_pgc as string | undefined },
    );
    if (r) creados++;
  }

  return NextResponse.json({ ok: true, asientos_creados: creados });
}
