import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { scanEmpresa } from "@/lib/agents/bot-fiscal";
import { computeHealthScore, type HealthCategoria } from "@/lib/agents/health-score";

/**
 * GET /api/dashboard/cartera
 *
 * Devuelve la cartera del gestor con health score real por empresa.
 * El score se calcula on-demand ejecutando el bot fiscal en paralelo
 * (limitado a 30 empresas para no exceder timeouts).
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const admin = createSupabaseAdmin();

  const { data: profile } = await admin
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();

  let empresasQ = admin
    .from("empresas")
    .select("id,nombre,nif,plan,account_type,tipo,gestor_id")
    .order("nombre")
    .limit(60);
  if (profile?.rol !== "admin") {
    empresasQ = empresasQ.eq("gestor_id", user.id);
  }
  const { data: empresas } = await empresasQ;
  if (!empresas || empresas.length === 0) {
    return NextResponse.json({
      ok: true,
      empresas: [],
      resumen: { total: 0, al_dia: 0, atencion: 0, critico: 0 },
    });
  }

  // Estrategia rápida: primero leer el snapshot del día (bot_scans, lo escribe el cron diario).
  // Si no existe, ejecutamos bot fiscal en paralelo solo para las que falten.
  const hoy = new Date().toISOString().slice(0, 10);
  const idsAll = empresas.map((e) => e.id);
  const { data: scans } = await admin
    .from("bot_scans")
    .select("empresa_id,score,categoria,alertas_total,alertas_danger")
    .in("empresa_id", idsAll)
    .eq("fecha", hoy);
  const cached = new Map((scans ?? []).map((s) => [s.empresa_id, s]));

  const sinScan = empresas.filter((e) => !cached.has(e.id)).slice(0, 20); // tope para no saturar la request
  const escaneos = await Promise.all(
    sinScan.map(async (e) => {
      try {
        const r = await scanEmpresa(admin, e.id);
        const { score, categoria } = computeHealthScore(r.alertas);
        return { id: e.id, score, categoria, alertas_total: r.resumen.total, alertas_danger: r.resumen.danger };
      } catch {
        return { id: e.id, score: 100, categoria: "al_dia" as HealthCategoria, alertas_total: 0, alertas_danger: 0 };
      }
    }),
  );
  const byId = new Map<string, { id: string; score: number; categoria: HealthCategoria; alertas_total: number; alertas_danger: number }>();
  for (const [empresaId, s] of cached.entries()) {
    byId.set(empresaId, {
      id: empresaId,
      score: Number(s.score ?? 100),
      categoria: (s.categoria as HealthCategoria) ?? "al_dia",
      alertas_total: Number(s.alertas_total ?? 0),
      alertas_danger: Number(s.alertas_danger ?? 0),
    });
  }
  for (const s of escaneos) byId.set(s.id, s);

  // KPIs agregados: facturación YTD, gastos YTD, margen, crecimiento YoY
  const yearActual = new Date().getUTCFullYear();
  const yearPrev = yearActual - 1;
  const [{ data: factsActual }, { data: factsPrev }, { data: gastosYTD }, { data: facturasRecibidasYTD }] = await Promise.all([
    admin
      .from("facturas")
      .select("empresa_id,base")
      .in("empresa_id", idsAll)
      .in("tipo", ["emitida", "simplificada"])
      .gte("fecha_emision", `${yearActual}-01-01`)
      .lte("fecha_emision", `${yearActual}-12-31`),
    admin
      .from("facturas")
      .select("empresa_id,base")
      .in("empresa_id", idsAll)
      .in("tipo", ["emitida", "simplificada"])
      .gte("fecha_emision", `${yearPrev}-01-01`)
      .lte("fecha_emision", `${yearPrev}-12-31`),
    admin
      .from("gastos")
      .select("empresa_id,base")
      .in("empresa_id", idsAll)
      .gte("fecha", `${yearActual}-01-01`)
      .lte("fecha", `${yearActual}-12-31`),
    admin
      .from("facturas")
      .select("empresa_id,base")
      .in("empresa_id", idsAll)
      .eq("tipo", "recibida")
      .gte("fecha_emision", `${yearActual}-01-01`)
      .lte("fecha_emision", `${yearActual}-12-31`),
  ]);

  const factActualByEmp = new Map<string, number>();
  for (const f of factsActual ?? []) factActualByEmp.set(f.empresa_id, (factActualByEmp.get(f.empresa_id) ?? 0) + Number(f.base ?? 0));
  const factPrevByEmp = new Map<string, number>();
  for (const f of factsPrev ?? []) factPrevByEmp.set(f.empresa_id, (factPrevByEmp.get(f.empresa_id) ?? 0) + Number(f.base ?? 0));
  const gastosByEmp = new Map<string, number>();
  for (const g of gastosYTD ?? []) gastosByEmp.set(g.empresa_id, (gastosByEmp.get(g.empresa_id) ?? 0) + Number(g.base ?? 0));
  for (const f of facturasRecibidasYTD ?? []) gastosByEmp.set(f.empresa_id, (gastosByEmp.get(f.empresa_id) ?? 0) + Number(f.base ?? 0));

  const items = empresas.map((e) => {
    const s = byId.get(e.id);
    const facturacion_ytd = Math.round((factActualByEmp.get(e.id) ?? 0) * 100) / 100;
    const facturacion_prev = factPrevByEmp.get(e.id) ?? 0;
    const gastos_ytd = Math.round((gastosByEmp.get(e.id) ?? 0) * 100) / 100;
    const margen = Math.round((facturacion_ytd - gastos_ytd) * 100) / 100;
    const margen_pct = facturacion_ytd > 0 ? Math.round((margen / facturacion_ytd) * 1000) / 10 : 0;
    const crecimiento_pct = facturacion_prev > 0 ? Math.round(((facturacion_ytd - facturacion_prev) / facturacion_prev) * 1000) / 10 : null;
    return {
      id: e.id,
      nombre: e.nombre,
      nif: e.nif,
      plan: e.plan,
      account_type: e.account_type,
      score: s?.score ?? null,
      categoria: s?.categoria ?? null,
      alertas_total: s?.alertas_total ?? 0,
      alertas_danger: s?.alertas_danger ?? 0,
      facturacion_ytd,
      gastos_ytd,
      margen,
      margen_pct,
      crecimiento_pct,
    };
  });

  // Ordenación
  const orden = request.nextUrl.searchParams.get("orden");
  if (orden === "facturacion") items.sort((a, b) => b.facturacion_ytd - a.facturacion_ytd);
  else if (orden === "margen") items.sort((a, b) => b.margen - a.margen);
  else if (orden === "crecimiento") items.sort((a, b) => (b.crecimiento_pct ?? -Infinity) - (a.crecimiento_pct ?? -Infinity));
  else if (orden === "riesgo") items.sort((a, b) => (b.alertas_danger - a.alertas_danger) || ((b.score === null ? 0 : 100 - b.score) - (a.score === null ? 0 : 100 - a.score)));
  // por defecto: nombre alfabético (ya vienen así de la query)

  const resumen = {
    total: items.length,
    al_dia: items.filter((i) => i.categoria === "al_dia").length,
    atencion: items.filter((i) => i.categoria === "atencion").length,
    critico: items.filter((i) => i.categoria === "critico").length,
    facturacion_total_ytd: Math.round(items.reduce((s, i) => s + i.facturacion_ytd, 0) * 100) / 100,
    margen_total_ytd: Math.round(items.reduce((s, i) => s + i.margen, 0) * 100) / 100,
  };

  return NextResponse.json({ ok: true, empresas: items, resumen, orden: orden ?? "nombre" });
}
