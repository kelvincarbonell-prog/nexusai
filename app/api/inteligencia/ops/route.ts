import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Centro de Inteligencia Ops — vista cruzada de toda la cartera del gestor:
 *
 *   - Top 5 mayor facturación YTD
 *   - Top 5 mayor margen %
 *   - Top 5 más crecimiento YoY
 *   - Top 5 más riesgo de inspección
 *   - Morosos persistentes (3+ recordatorios sin pago)
 *   - Patrones atípicos (facturas con importe redondo > 5k, posibles duplicados)
 *   - Hot zones (empresas con >5 alertas activas)
 *   - Oportunidades upsell (plan free + facturación > 50k YTD)
 *   - Mapa por sector (CNAE) — distribución de clientes
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const admin = createSupabaseAdmin();
  const { data: profile } = await admin.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  const isAdmin = profile?.rol === "admin";

  const empresasQ = isAdmin
    ? admin.from("empresas").select("id,nombre,nif,plan,cnae,account_type,tipo,created_at").limit(500)
    : admin.from("empresas").select("id,nombre,nif,plan,cnae,account_type,tipo,created_at").or(`gestor_id.eq.${user.id},owner_user_id.eq.${user.id}`).limit(500);
  const { data: empresas } = await empresasQ;
  if (!empresas || empresas.length === 0) {
    return NextResponse.json({ ok: true, vacio: true });
  }
  const ids = empresas.map((e) => e.id);
  const eById = new Map(empresas.map((e) => [e.id, e]));
  const yearActual = new Date().getUTCFullYear();
  const yearPrev = yearActual - 1;

  // Datos crudos en paralelo (1 sola tanda)
  const [
    { data: factsAct },
    { data: factsPrev },
    { data: gastosYTD },
    { data: recibidasYTD },
    { data: facturasVencidas },
    { data: scans },
  ] = await Promise.all([
    admin.from("facturas").select("empresa_id,base,total,fecha_emision,metadata").in("empresa_id", ids).in("tipo", ["emitida", "simplificada"]).gte("fecha_emision", `${yearActual}-01-01`),
    admin.from("facturas").select("empresa_id,base").in("empresa_id", ids).in("tipo", ["emitida", "simplificada"]).gte("fecha_emision", `${yearPrev}-01-01`).lte("fecha_emision", `${yearPrev}-12-31`),
    admin.from("gastos").select("empresa_id,base").in("empresa_id", ids).gte("fecha", `${yearActual}-01-01`),
    admin.from("facturas").select("empresa_id,base").in("empresa_id", ids).eq("tipo", "recibida").gte("fecha_emision", `${yearActual}-01-01`),
    admin.from("facturas").select("empresa_id,total,contacto_nombre,fecha_vencimiento,metadata").in("empresa_id", ids).in("tipo", ["emitida", "simplificada"]).neq("estado", "cobrada").lt("fecha_vencimiento", new Date().toISOString().slice(0, 10)),
    admin.from("bot_scans").select("empresa_id,score,categoria,alertas_total,alertas_danger,alertas").in("empresa_id", ids).eq("fecha", new Date().toISOString().slice(0, 10)),
  ]);

  // Agregaciones por empresa
  type Agg = { empresa_id: string; facturacion_ytd: number; facturacion_prev: number; gastos_ytd: number };
  const aggs = new Map<string, Agg>();
  for (const id of ids) aggs.set(id, { empresa_id: id, facturacion_ytd: 0, facturacion_prev: 0, gastos_ytd: 0 });
  for (const f of factsAct ?? []) aggs.get(f.empresa_id)!.facturacion_ytd += Number(f.base ?? 0);
  for (const f of factsPrev ?? []) aggs.get(f.empresa_id)!.facturacion_prev += Number(f.base ?? 0);
  for (const g of gastosYTD ?? []) aggs.get(g.empresa_id)!.gastos_ytd += Number(g.base ?? 0);
  for (const f of recibidasYTD ?? []) aggs.get(f.empresa_id)!.gastos_ytd += Number(f.base ?? 0);

  function nombre(empresaId: string) { return eById.get(empresaId)?.nombre ?? "—"; }
  function r2(n: number) { return Math.round(n * 100) / 100; }

  // 1) Top facturación
  const topFacturacion = Array.from(aggs.values())
    .filter((a) => a.facturacion_ytd > 0)
    .sort((a, b) => b.facturacion_ytd - a.facturacion_ytd)
    .slice(0, 5)
    .map((a) => ({ empresa_id: a.empresa_id, nombre: nombre(a.empresa_id), facturacion: r2(a.facturacion_ytd) }));

  // 2) Top margen %
  const topMargen = Array.from(aggs.values())
    .filter((a) => a.facturacion_ytd > 5000)
    .map((a) => ({ empresa_id: a.empresa_id, nombre: nombre(a.empresa_id), margen_pct: r2(((a.facturacion_ytd - a.gastos_ytd) / a.facturacion_ytd) * 100), margen: r2(a.facturacion_ytd - a.gastos_ytd) }))
    .sort((a, b) => b.margen_pct - a.margen_pct)
    .slice(0, 5);

  // 3) Top crecimiento YoY
  const topCrecimiento = Array.from(aggs.values())
    .filter((a) => a.facturacion_prev > 1000)
    .map((a) => ({ empresa_id: a.empresa_id, nombre: nombre(a.empresa_id), crecimiento_pct: r2(((a.facturacion_ytd - a.facturacion_prev) / a.facturacion_prev) * 100), prev: r2(a.facturacion_prev), actual: r2(a.facturacion_ytd) }))
    .sort((a, b) => b.crecimiento_pct - a.crecimiento_pct)
    .slice(0, 5);

  // 4) Top riesgo (basado en bot_scans + alertas_danger)
  const topRiesgo = (scans ?? [])
    .filter((s) => s.alertas_danger > 0 || s.categoria === "critico")
    .sort((a, b) => Number(b.alertas_danger) - Number(a.alertas_danger))
    .slice(0, 5)
    .map((s) => ({ empresa_id: s.empresa_id, nombre: nombre(s.empresa_id), score: s.score, alertas_danger: s.alertas_danger, categoria: s.categoria }));

  // 5) Morosos persistentes (3+ recordatorios enviados, sin cobrar)
  const morosos: Array<{ empresa_id: string; nombre: string; contacto: string; total: number; recordatorios: number }> = [];
  for (const f of facturasVencidas ?? []) {
    const meta = (f.metadata ?? {}) as Record<string, unknown>;
    const recs = (meta.recordatorios_cobro as unknown[] | undefined) ?? [];
    if (recs.length >= 3) {
      morosos.push({
        empresa_id: f.empresa_id,
        nombre: nombre(f.empresa_id),
        contacto: (f.contacto_nombre as string) ?? "—",
        total: Number(f.total ?? 0),
        recordatorios: recs.length,
      });
    }
  }
  morosos.sort((a, b) => b.total - a.total);

  // 6) Patrones atípicos: facturas grandes con importe redondo (.00 €) y total > 5000
  const sospechosas: Array<{ empresa_id: string; nombre: string; total: number; fecha: string; razon: string }> = [];
  for (const f of factsAct ?? []) {
    const t = Number(f.total ?? f.base ?? 0);
    if (t >= 5000 && Math.abs(t - Math.round(t)) < 0.01 && t % 100 === 0) {
      sospechosas.push({
        empresa_id: f.empresa_id,
        nombre: nombre(f.empresa_id),
        total: t,
        fecha: f.fecha_emision ?? "",
        razon: "Importe múltiplo de 100 muy redondo en factura grande",
      });
    }
  }

  // 7) Hot zones (empresas con >=3 alertas activas)
  const hotZones = (scans ?? [])
    .filter((s) => s.alertas_total >= 3)
    .sort((a, b) => Number(b.alertas_total) - Number(a.alertas_total))
    .slice(0, 5)
    .map((s) => ({ empresa_id: s.empresa_id, nombre: nombre(s.empresa_id), alertas: s.alertas_total }));

  // 8) Oportunidades upsell: plan free + facturación > 50k
  const upsell = empresas
    .filter((e) => (e.plan ?? "free") === "free")
    .map((e) => ({ ...e, fact: aggs.get(e.id)?.facturacion_ytd ?? 0 }))
    .filter((e) => e.fact > 50000)
    .sort((a, b) => b.fact - a.fact)
    .slice(0, 5)
    .map((e) => ({ empresa_id: e.id, nombre: e.nombre ?? "—", facturacion: r2(e.fact), plan_actual: e.plan ?? "free" }));

  // 9) Mapa por sector (CNAE de 2 dígitos)
  const sectores = new Map<string, number>();
  for (const e of empresas) {
    const c = (e.cnae ?? "").toString().slice(0, 2) || "??";
    sectores.set(c, (sectores.get(c) ?? 0) + 1);
  }
  const mapaSectores = Array.from(sectores.entries())
    .map(([cnae, count]) => ({ cnae, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return NextResponse.json({
    ok: true,
    total_empresas: empresas.length,
    top_facturacion: topFacturacion,
    top_margen: topMargen,
    top_crecimiento: topCrecimiento,
    top_riesgo: topRiesgo,
    morosos_persistentes: morosos.slice(0, 10),
    patrones_sospechosos: sospechosas.slice(0, 10),
    hot_zones: hotZones,
    oportunidades_upsell: upsell,
    mapa_sectores: mapaSectores,
  });
}
