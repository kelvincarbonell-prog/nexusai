import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { buildCalendar } from "@/lib/aeat/calendar";

/**
 * Datos agregados para la sección Inteligencia.
 *
 * Devuelve:
 *  - KPIs globales del despacho (cartera, ingresos, top clientes)
 *  - Tiempo dedicado por cliente (proxy: nº de acciones del gestor en
 *    agent_runs + journal_entries del últimos 30 días)
 *  - Alertas (clientes sin actividad >30d, modelos próximos a vencer
 *    sin presentar, facturas vencidas, fichajes abiertos)
 *  - Top clientes por valor facturado
 *  - Distribución por plan y account_type
 */

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const admin = createSupabaseAdmin();

  const { data: profile } = await admin.from("perfiles").select("rol,nombre").eq("id", user.id).maybeSingle();
  const isAdmin = profile?.rol === "admin";

  const empresasQ = admin.from("empresas").select("id,nombre,account_type,plan,created_at");
  const { data: empresas } = isAdmin
    ? await empresasQ
    : await empresasQ.or(`gestor_id.eq.${user.id},owner_user_id.eq.${user.id}`);
  const empresaIds = (empresas ?? []).map((e) => e.id);

  if (empresaIds.length === 0) {
    return NextResponse.json({
      ok: true,
      kpis: { total_clientes: 0, autonomos: 0, empresas: 0, ingresos_ytd: 0, gastos_ytd: 0, pendiente_cobro: 0 },
      top_clientes: [],
      alertas: [],
      tiempo_por_cliente: [],
      distribucion_plan: [],
    });
  }

  const year = new Date().getUTCFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

  // Facturas YTD
  const { data: factEmit } = await admin
    .from("facturas")
    .select("empresa_id,total,estado,fecha_emision,fecha_vencimiento")
    .in("empresa_id", empresaIds)
    .eq("tipo", "emitida")
    .gte("fecha_emision", yearStart)
    .lte("fecha_emision", yearEnd);
  const { data: gastosYTD } = await admin
    .from("gastos")
    .select("empresa_id,total,fecha")
    .in("empresa_id", empresaIds)
    .gte("fecha", yearStart)
    .lte("fecha", yearEnd);
  const { data: agentRuns } = await admin
    .from("agent_runs")
    .select("empresa_id,duration_ms,agent_id,created_at")
    .in("empresa_id", empresaIds)
    .gte("created_at", thirtyDaysAgo);
  const { data: aeatDecl } = await admin
    .from("aeat_declaraciones")
    .select("empresa_id,modelo,ejercicio,periodo,status")
    .in("empresa_id", empresaIds)
    .in("status", ["presentado", "revisado"]);
  const { data: fichajesAbiertos } = await admin
    .from("registro_horario")
    .select("empresa_id")
    .in("empresa_id", empresaIds)
    .is("hora_salida", null)
    .gte("fecha", new Date().toISOString().slice(0, 10));

  // Agregados
  const ingresosYTD = (factEmit ?? []).reduce((s, f) => s + Number(f.total ?? 0), 0);
  const gastosTotalYTD = (gastosYTD ?? []).reduce((s, g) => s + Number(g.total ?? 0), 0);
  const pendienteCobro = (factEmit ?? [])
    .filter((f) => f.estado !== "cobrada" && f.estado !== "pagada")
    .reduce((s, f) => s + Number(f.total ?? 0), 0);

  // Top clientes por facturación YTD
  const facturadoPorCliente = new Map<string, number>();
  for (const f of factEmit ?? []) {
    facturadoPorCliente.set(f.empresa_id, (facturadoPorCliente.get(f.empresa_id) ?? 0) + Number(f.total ?? 0));
  }
  const top = (empresas ?? [])
    .map((e) => ({ ...e, facturado: facturadoPorCliente.get(e.id) ?? 0 }))
    .sort((a, b) => b.facturado - a.facturado)
    .slice(0, 10);

  // Tiempo por cliente (proxy: nº de acciones × 30s estimado)
  const accionesPorCliente = new Map<string, { num: number; ms: number }>();
  for (const r of agentRuns ?? []) {
    if (!r.empresa_id) continue;
    const prev = accionesPorCliente.get(r.empresa_id) ?? { num: 0, ms: 0 };
    prev.num++;
    prev.ms += Number(r.duration_ms ?? 30_000);
    accionesPorCliente.set(r.empresa_id, prev);
  }
  const tiempoPorCliente = (empresas ?? [])
    .map((e) => {
      const a = accionesPorCliente.get(e.id) ?? { num: 0, ms: 0 };
      // Estimación: cada acción del gestor + 2 min "humano". Heurística.
      const minutos = (a.num * 2) + Math.round(a.ms / 60000);
      return { empresa_id: e.id, nombre: e.nombre, num_acciones: a.num, minutos_estimados: minutos };
    })
    .sort((a, b) => b.minutos_estimados - a.minutos_estimados)
    .slice(0, 15);

  // Alertas
  const alertas: Array<{ tipo: string; severidad: "info" | "warn" | "bad"; mensaje: string; empresa_id?: string }> = [];

  // Facturas vencidas
  const today = new Date().toISOString().slice(0, 10);
  const vencidas = (factEmit ?? []).filter(
    (f) => f.fecha_vencimiento && f.fecha_vencimiento < today && f.estado !== "cobrada",
  );
  if (vencidas.length > 0) {
    const total = vencidas.reduce((s, f) => s + Number(f.total ?? 0), 0);
    alertas.push({
      tipo: "facturas_vencidas",
      severidad: "bad",
      mensaje: `${vencidas.length} facturas vencidas · ${total.toFixed(2)} € sin cobrar`,
    });
  }

  // Clientes sin actividad >30 días
  const clientesActivos = new Set((agentRuns ?? []).map((r) => r.empresa_id).filter(Boolean));
  const inactivos = (empresas ?? []).filter((e) => !clientesActivos.has(e.id));
  if (inactivos.length > 0) {
    alertas.push({
      tipo: "clientes_inactivos",
      severidad: "warn",
      mensaje: `${inactivos.length} clientes sin actividad en los últimos 30 días`,
    });
  }

  // Fichajes abiertos
  const fichajesEmpresas = new Set((fichajesAbiertos ?? []).map((f) => f.empresa_id));
  if (fichajesEmpresas.size > 0) {
    alertas.push({
      tipo: "fichajes_abiertos",
      severidad: "warn",
      mensaje: `${fichajesEmpresas.size} empresas con fichajes abiertos hoy`,
    });
  }

  // Modelos próximos a vencer
  let proximosVencimientos = 0;
  for (const e of empresas ?? []) {
    const presentadas = (aeatDecl ?? [])
      .filter((d) => d.empresa_id === e.id)
      .map((d) => ({ modelo: d.modelo, ejercicio: d.ejercicio, periodo: d.periodo }));
    const cal = buildCalendar({
      empresaTipo: e.account_type === "autonomo" ? "autonomo" : "empresa",
      presentadas,
      horizonteDias: 14,
    });
    proximosVencimientos += cal.filter((c) => !c.esta_presentada && c.dias_restantes >= 0).length;
  }
  if (proximosVencimientos > 0) {
    alertas.push({
      tipo: "modelos_proximos",
      severidad: "warn",
      mensaje: `${proximosVencimientos} modelos AEAT vencen en los próximos 14 días`,
    });
  }

  // Distribución por plan
  const planMap = new Map<string, number>();
  for (const e of empresas ?? []) {
    const plan = e.plan ?? "negocio";
    planMap.set(plan, (planMap.get(plan) ?? 0) + 1);
  }
  const distribucionPlan = Array.from(planMap.entries()).map(([plan, count]) => ({ plan, count }));

  const autonomos = (empresas ?? []).filter((e) => e.account_type === "autonomo").length;
  const empresasCount = (empresas ?? []).filter((e) => e.account_type === "empresa").length;

  return NextResponse.json({
    ok: true,
    kpis: {
      total_clientes: empresas?.length ?? 0,
      autonomos,
      empresas: empresasCount,
      ingresos_ytd: Math.round(ingresosYTD * 100) / 100,
      gastos_ytd: Math.round(gastosTotalYTD * 100) / 100,
      pendiente_cobro: Math.round(pendienteCobro * 100) / 100,
      acciones_30d: agentRuns?.length ?? 0,
    },
    top_clientes: top,
    alertas,
    tiempo_por_cliente: tiempoPorCliente,
    distribucion_plan: distribucionPlan,
  });
}
