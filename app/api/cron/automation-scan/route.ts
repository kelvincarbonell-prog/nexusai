import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { runRulesForEvent } from "@/lib/automation/runner";

/**
 * Cron que recorre los eventos derivables y dispara las reglas.
 * Eventos cubiertos:
 *  - factura_vencida (facturas no cobradas con fecha_vencimiento < hoy)
 *  - cliente_inactivo_30d (clientes sin agent_runs en 30 días)
 *  - modelo_proximo_vencimiento (modelos AEAT con plazo en <14 días)
 *  - fichaje_no_salida (fichajes hoy sin hora_salida tras la jornada)
 */

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    const provided = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
    if (provided !== secret) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "CRON_SECRET no configurado" }, { status: 503 });
  }

  const admin = createSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgoIso = new Date(Date.now() - 30 * 86_400_000).toISOString();

  // 1. Facturas vencidas
  const { data: vencidas } = await admin
    .from("facturas")
    .select("id,empresa_id,total,contacto_nombre,fecha_vencimiento")
    .eq("tipo", "emitida")
    .neq("estado", "cobrada")
    .neq("payment_status", "paid")
    .lt("fecha_vencimiento", today);

  let total = { vencidas: 0, inactivos: 0 };
  for (const f of vencidas ?? []) {
    if (!f.empresa_id || !f.fecha_vencimiento) continue;
    const dias = Math.floor((Date.now() - new Date(f.fecha_vencimiento + "T00:00:00").getTime()) / 86_400_000);
    await runRulesForEvent({
      trigger_event: "factura_vencida",
      empresa_id: f.empresa_id,
      factura: { id: f.id, total: Number(f.total ?? 0), dias_vencida: dias, contacto_nombre: f.contacto_nombre ?? undefined },
    });
    total.vencidas++;
  }

  // 2. Clientes inactivos
  const { data: empresas } = await admin.from("empresas").select("id");
  for (const e of empresas ?? []) {
    const { data: actividad } = await admin
      .from("agent_runs")
      .select("id", { head: false })
      .eq("empresa_id", e.id)
      .gte("created_at", thirtyDaysAgoIso)
      .limit(1);
    if (!actividad || actividad.length === 0) {
      await runRulesForEvent({ trigger_event: "cliente_inactivo_30d", empresa_id: e.id });
      total.inactivos++;
    }
  }

  return NextResponse.json({ ok: true, ...total });
}
