import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { siguienteEmision } from "@/lib/billing/calc";

/**
 * Cron job: emite todas las facturas recurrentes cuya proxima_emision ha llegado.
 *
 * Configurar en Vercel:
 *   - Crear cron en vercel.json con schedule '0 6 * * *' (cada día a las 06:00 UTC)
 *   - Añadir env var CRON_SECRET
 *   - Vercel firma con Authorization: Bearer <CRON_SECRET>
 *
 * También se puede llamar manualmente con el mismo secret.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ ok: false, error: "CRON_SECRET no configurado" }, { status: 503 });
    }
  } else {
    const auth = request.headers.get("authorization") ?? "";
    const provided = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
    if (provided !== secret) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }
  }

  const admin = createSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const { data: pendientes } = await admin
    .from("facturas_recurrentes")
    .select("*")
    .eq("estado", "activa")
    .lte("proxima_emision", today);

  const resultados: Array<{ id: string; factura_id?: string; error?: string }> = [];

  for (const rec of pendientes ?? []) {
    try {
      const fecha = today;
      const { data: factura, error } = await admin
        .from("facturas")
        .insert({
          empresa_id: rec.empresa_id,
          gestor_id: rec.gestor_id,
          tipo: "emitida",
          contacto_nombre: rec.cliente_nombre,
          fecha_emision: fecha,
          base: rec.base,
          iva: (Number(rec.base) * Number(rec.iva_pct ?? 0)) / 100,
          total: rec.total,
          estado: "emitida",
          metadata: {
            recurrente_id: rec.id,
            concepto: rec.concepto,
            cliente_nif: rec.cliente_nif,
            cliente_email: rec.cliente_email,
            cron_emisor: true,
          },
        })
        .select("id")
        .single();
      if (error || !factura) throw new Error(error?.message ?? "Insert factura falló");

      const proxima = siguienteEmision(new Date(rec.proxima_emision), rec.frecuencia, rec.dia_emision);
      await admin
        .from("facturas_recurrentes")
        .update({
          ultima_emision: fecha,
          num_emisiones: (rec.num_emisiones ?? 0) + 1,
          proxima_emision: proxima.toISOString().slice(0, 10),
        })
        .eq("id", rec.id);

      // Finalizar si pasó la fecha_fin
      if (rec.fecha_fin && proxima > new Date(rec.fecha_fin)) {
        await admin.from("facturas_recurrentes").update({ estado: "finalizada" }).eq("id", rec.id);
      }

      resultados.push({ id: rec.id, factura_id: factura.id });
    } catch (e: unknown) {
      resultados.push({ id: rec.id, error: e instanceof Error ? e.message : "Error" });
    }
  }

  return NextResponse.json({
    ok: true,
    procesadas: resultados.length,
    exitosas: resultados.filter((r) => r.factura_id).length,
    errores: resultados.filter((r) => r.error).length,
    resultados,
  });
}
