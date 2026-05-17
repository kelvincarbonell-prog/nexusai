import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { scanEmpresa } from "@/lib/agents/bot-fiscal";
import { computeHealthScore } from "@/lib/agents/health-score";

/**
 * Cron diario: ejecuta el bot fiscal para todas las empresas y persiste
 * las alertas en `bot_alertas`. El dashboard del gestor las lee y el
 * digest por email se genera a partir de aquí.
 *
 * Ejecución recomendada: 07:00 Europe/Madrid.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    const provided = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
    if (provided !== secret) return NextResponse.json({ ok: false }, { status: 401 });
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "CRON_SECRET requerido en producción" }, { status: 503 });
  }

  const admin = createSupabaseAdmin();
  const { data: empresas } = await admin.from("empresas").select("id,nombre,gestor_id").limit(500);
  if (!empresas) return NextResponse.json({ ok: true, scanned: 0 });

  // Concurrencia controlada en grupos de 8
  const BATCH = 8;
  let totalAlertas = 0;
  let totalEmpresas = 0;
  const now = new Date().toISOString();

  for (let i = 0; i < empresas.length; i += BATCH) {
    const slice = empresas.slice(i, i + BATCH);
    await Promise.all(
      slice.map(async (e) => {
        try {
          const r = await scanEmpresa(admin, e.id);
          const { score, categoria } = computeHealthScore(r.alertas);

          // Persistencia: 1 fila por (empresa, fecha_scan)
          const fecha = now.slice(0, 10);
          await admin
            .from("bot_scans")
            .upsert(
              {
                empresa_id: e.id,
                fecha,
                score,
                categoria,
                alertas_total: r.resumen.total,
                alertas_danger: r.resumen.danger,
                alertas_warning: r.resumen.warning,
                alertas_info: r.resumen.info,
                alertas: r.alertas,
                created_at: now,
              },
              { onConflict: "empresa_id,fecha" }
            );

          totalEmpresas++;
          totalAlertas += r.resumen.total;
        } catch (err) {
          // Log silencioso, no romper el lote
          console.error(`[bot-fiscal-daily] empresa ${e.id} falló:`, err instanceof Error ? err.message : err);
        }
      })
    );
  }

  return NextResponse.json({
    ok: true,
    scanned: totalEmpresas,
    total_alertas: totalAlertas,
    ts: now,
  });
}
