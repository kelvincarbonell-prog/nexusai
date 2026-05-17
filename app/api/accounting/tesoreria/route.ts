import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";

const Query = z.object({
  empresa_id: z.string().uuid(),
  horizonte: z.coerce.number().int().min(7).max(180).default(60),
});

/**
 * Previsión de tesorería a N días:
 *  - Saldo actual = último saldo acumulado de bank_movements + facturas/gastos no asentados
 *  - Cobros previstos: facturas emitidas no pagadas con fecha_vencimiento <= hoy + N
 *  - Pagos previstos: facturas recibidas + gastos pendientes con fecha_vencimiento <= hoy + N
 *
 * Devuelve buckets diarios + flujo acumulado para gráfica.
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("Parámetros inválidos");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);

  const hoy = new Date().toISOString().slice(0, 10);
  const fin = new Date(Date.now() + parsed.data.horizonte * 86_400_000).toISOString().slice(0, 10);

  const [{ data: ultimoMov }, { data: emitidas }, { data: recibidas }, { data: gastos }] = await Promise.all([
    admin
      .from("bank_movements")
      .select("saldo_acumulado,fecha_operacion")
      .eq("empresa_id", parsed.data.empresa_id)
      .order("fecha_operacion", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("facturas")
      .select("id,numero,contacto_nombre,total,fecha_vencimiento,fecha_emision,estado")
      .eq("empresa_id", parsed.data.empresa_id)
      .eq("tipo", "emitida")
      .not("estado", "in", "(pagada,cobrada)"),
    admin
      .from("facturas")
      .select("id,numero,contacto_nombre,total,fecha_vencimiento,fecha_emision,estado")
      .eq("empresa_id", parsed.data.empresa_id)
      .eq("tipo", "recibida")
      .not("estado", "in", "(pagada,liquidada)"),
    admin
      .from("gastos")
      .select("id,proveedor,concepto,total,fecha,estado")
      .eq("empresa_id", parsed.data.empresa_id)
      .eq("estado", "pendiente"),
  ]);

  const saldoActual = Number(ultimoMov?.saldo_acumulado ?? 0);

  type Item = { fecha: string; tipo: "cobro" | "pago"; importe: number; descripcion: string; id: string; ref: string };
  const items: Item[] = [];

  for (const f of emitidas ?? []) {
    const fecha = f.fecha_vencimiento ?? f.fecha_emision ?? hoy;
    if (fecha > fin) continue;
    items.push({
      fecha, tipo: "cobro", importe: Number(f.total ?? 0),
      descripcion: `Cobro ${f.numero ?? ""} · ${f.contacto_nombre ?? ""}`,
      id: f.id, ref: "factura",
    });
  }
  for (const f of recibidas ?? []) {
    const fecha = f.fecha_vencimiento ?? f.fecha_emision ?? hoy;
    if (fecha > fin) continue;
    items.push({
      fecha, tipo: "pago", importe: Number(f.total ?? 0),
      descripcion: `Pago ${f.numero ?? ""} · ${f.contacto_nombre ?? ""}`,
      id: f.id, ref: "factura_recibida",
    });
  }
  for (const g of gastos ?? []) {
    const fecha = g.fecha ?? hoy;
    if (fecha > fin) continue;
    items.push({
      fecha, tipo: "pago", importe: Number(g.total ?? 0),
      descripcion: `Gasto · ${g.proveedor ?? g.concepto ?? ""}`,
      id: g.id, ref: "gasto",
    });
  }

  items.sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Buckets diarios desde hoy hasta hoy+horizonte
  const dias: { fecha: string; cobros: number; pagos: number; flujo_dia: number; saldo: number }[] = [];
  let saldoRunning = saldoActual;
  const inicio = new Date(hoy + "T00:00:00");
  for (let i = 0; i <= parsed.data.horizonte; i++) {
    const fecha = new Date(inicio.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    const cobros = items.filter((it) => it.fecha === fecha && it.tipo === "cobro").reduce((s, it) => s + it.importe, 0);
    const pagos = items.filter((it) => it.fecha === fecha && it.tipo === "pago").reduce((s, it) => s + it.importe, 0);
    const flujo = cobros - pagos;
    saldoRunning += flujo;
    dias.push({ fecha, cobros, pagos, flujo_dia: flujo, saldo: Math.round(saldoRunning * 100) / 100 });
  }

  const totalCobros = items.filter((i) => i.tipo === "cobro").reduce((s, i) => s + i.importe, 0);
  const totalPagos = items.filter((i) => i.tipo === "pago").reduce((s, i) => s + i.importe, 0);

  return NextResponse.json({
    ok: true,
    saldo_actual: saldoActual,
    horizonte_dias: parsed.data.horizonte,
    total_cobros_previstos: Math.round(totalCobros * 100) / 100,
    total_pagos_previstos: Math.round(totalPagos * 100) / 100,
    flujo_neto: Math.round((totalCobros - totalPagos) * 100) / 100,
    saldo_final_previsto: Math.round((saldoActual + totalCobros - totalPagos) * 100) / 100,
    dias,
    items: items.slice(0, 100),
  });
}
