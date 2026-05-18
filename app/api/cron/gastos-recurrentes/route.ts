import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Cron diario que crea los gastos a partir de las plantillas recurrentes
 * cuando ha llegado su próximo_envio. Tras crear, calcula el siguiente
 * envío según la periodicidad.
 *
 * Sugerido: cron diario a las 06:00 (0 6 * * *).
 */

function siguienteFecha(base: string, periodicidad: string, diaEmision: number): string {
  const d = new Date(base + "T00:00:00");
  if (periodicidad === "mensual") d.setUTCMonth(d.getUTCMonth() + 1);
  else if (periodicidad === "trimestral") d.setUTCMonth(d.getUTCMonth() + 3);
  else if (periodicidad === "semestral") d.setUTCMonth(d.getUTCMonth() + 6);
  else d.setUTCFullYear(d.getUTCFullYear() + 1);
  // Ajusta día (capando al último del mes si excede)
  const ultimoDia = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(diaEmision, ultimoDia));
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    const provided = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
    if (provided !== secret) return NextResponse.json({ ok: false }, { status: 401 });
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "CRON_SECRET requerido" }, { status: 503 });
  }

  const admin = createSupabaseAdmin();
  const hoy = new Date().toISOString().slice(0, 10);

  const { data: plantillas } = await admin
    .from("gastos_recurrentes")
    .select("*")
    .eq("activo", true)
    .lte("proximo_envio", hoy)
    .limit(500);

  if (!plantillas || plantillas.length === 0) {
    return NextResponse.json({ ok: true, generados: 0 });
  }

  let generados = 0;
  let actualizados = 0;

  for (const p of plantillas) {
    if (p.fecha_fin && p.fecha_fin < hoy) {
      // Vencida: desactiva
      await admin.from("gastos_recurrentes").update({ activo: false }).eq("id", p.id);
      continue;
    }

    // Anti-duplicado: si ya existe un gasto del mismo proveedor + total + fecha del mes, saltar
    const { data: yaExiste } = await admin
      .from("gastos")
      .select("id")
      .eq("empresa_id", p.empresa_id)
      .eq("fecha", p.proximo_envio)
      .filter("metadata->>recurrente_id", "eq", p.id)
      .maybeSingle();

    if (!yaExiste) {
      const { error } = await admin.from("gastos").insert({
        empresa_id: p.empresa_id,
        gestor_id: p.gestor_id,
        proveedor: p.proveedor,
        concepto: p.concepto,
        fecha: p.proximo_envio,
        base: p.base,
        iva: p.iva,
        total: p.total,
        estado: "pendiente",
        metadata: {
          proveedor_nif: p.proveedor_nif,
          cuenta_pgc: p.cuenta_pgc,
          irpf: p.irpf,
          recurrente_id: p.id,
          generado_automaticamente: true,
        },
      });
      if (!error) generados++;
    }

    const next = siguienteFecha(p.proximo_envio, p.periodicidad, p.dia_emision ?? 1);
    await admin
      .from("gastos_recurrentes")
      .update({ proximo_envio: next, ultima_generacion: hoy, updated_at: new Date().toISOString() })
      .eq("id", p.id);
    actualizados++;
  }

  return NextResponse.json({ ok: true, generados, actualizados });
}
