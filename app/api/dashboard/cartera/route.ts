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

  // Escanea las primeras 30 con bot fiscal (paralelo). El resto se queda sin score.
  const LIMITE = 30;
  const escaneables = empresas.slice(0, LIMITE);
  const escaneos = await Promise.all(
    escaneables.map(async (e) => {
      try {
        const r = await scanEmpresa(admin, e.id);
        const { score, categoria } = computeHealthScore(r.alertas);
        return { id: e.id, score, categoria, alertas_total: r.resumen.total, alertas_danger: r.resumen.danger };
      } catch {
        return { id: e.id, score: 100, categoria: "al_dia" as HealthCategoria, alertas_total: 0, alertas_danger: 0 };
      }
    })
  );
  const byId = new Map(escaneos.map((s) => [s.id, s]));

  const items = empresas.map((e) => {
    const s = byId.get(e.id);
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
    };
  });

  const resumen = {
    total: items.length,
    al_dia: items.filter((i) => i.categoria === "al_dia").length,
    atencion: items.filter((i) => i.categoria === "atencion").length,
    critico: items.filter((i) => i.categoria === "critico").length,
  };

  return NextResponse.json({ ok: true, empresas: items, resumen });
}
