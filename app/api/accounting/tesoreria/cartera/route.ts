import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Tesorería proyectada a N días para TODAS las empresas del gestor.
 * GET /api/accounting/tesoreria/cartera?horizonte=30
 *
 * Por empresa devuelve: saldo actual + cobros previstos + pagos previstos
 * + saldo final + día de descubierto (si aplica). Ordenadas por
 * criticidad (las que se quedan en negativo primero).
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const admin = createSupabaseAdmin();
  const { data: perfil } = await admin.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  if (perfil?.rol !== "admin" && perfil?.rol !== "gestor") return jsonError("Sin permiso", 403);

  const horizonte = Math.min(180, Math.max(7, Number(request.nextUrl.searchParams.get("horizonte") ?? 30)));
  const hoy = new Date().toISOString().slice(0, 10);
  const finDate = new Date(Date.now() + horizonte * 86_400_000);
  const fin = finDate.toISOString().slice(0, 10);

  let q = admin.from("empresas").select("id,nombre,nif");
  if (perfil.rol === "gestor") q = q.eq("gestor_id", user.id);
  const { data: empresas } = await q;
  const lista = empresas ?? [];

  if (lista.length === 0) {
    return NextResponse.json({ ok: true, items: [], totales: { empresas: 0, en_riesgo: 0, saldo_cartera: 0, cobros: 0, pagos: 0 } });
  }

  const items = await Promise.all(
    lista.map(async (e) => {
      try {
        const [{ data: ultimoMov }, { data: emitidas }, { data: recibidas }, { data: gastos }] = await Promise.all([
          admin
            .from("bank_movements")
            .select("saldo_acumulado")
            .eq("empresa_id", e.id)
            .order("fecha_operacion", { ascending: false })
            .limit(1)
            .maybeSingle(),
          admin
            .from("facturas")
            .select("total,fecha_vencimiento,fecha_emision,estado")
            .eq("empresa_id", e.id)
            .eq("tipo", "emitida")
            .not("estado", "in", "(pagada,cobrada)"),
          admin
            .from("facturas")
            .select("total,fecha_vencimiento,fecha_emision,estado")
            .eq("empresa_id", e.id)
            .eq("tipo", "recibida")
            .not("estado", "in", "(pagada,liquidada)"),
          admin
            .from("gastos")
            .select("total,fecha,estado")
            .eq("empresa_id", e.id)
            .eq("estado", "pendiente"),
        ]);

        const saldoActual = Number(ultimoMov?.saldo_acumulado ?? 0);

        let cobros = 0;
        let pagos = 0;
        // Para calcular el día de descubierto, ordenamos eventos por fecha
        const eventos: Array<{ fecha: string; importe: number; tipo: "cobro" | "pago" }> = [];
        for (const f of emitidas ?? []) {
          const fecha = f.fecha_vencimiento ?? f.fecha_emision ?? hoy;
          if (fecha > fin || fecha < hoy) continue;
          const imp = Number(f.total ?? 0);
          cobros += imp;
          eventos.push({ fecha, importe: imp, tipo: "cobro" });
        }
        for (const f of recibidas ?? []) {
          const fecha = f.fecha_vencimiento ?? f.fecha_emision ?? hoy;
          if (fecha > fin || fecha < hoy) continue;
          const imp = Number(f.total ?? 0);
          pagos += imp;
          eventos.push({ fecha, importe: imp, tipo: "pago" });
        }
        for (const g of gastos ?? []) {
          const fecha = g.fecha ?? hoy;
          if (fecha > fin || fecha < hoy) continue;
          const imp = Number(g.total ?? 0);
          pagos += imp;
          eventos.push({ fecha, importe: imp, tipo: "pago" });
        }

        eventos.sort((a, b) => a.fecha.localeCompare(b.fecha));

        let running = saldoActual;
        let diaDescubierto: string | null = null;
        let saldoMinimo = saldoActual;
        for (const ev of eventos) {
          running += ev.tipo === "cobro" ? ev.importe : -ev.importe;
          if (running < 0 && diaDescubierto == null) diaDescubierto = ev.fecha;
          if (running < saldoMinimo) saldoMinimo = running;
        }
        const saldoFinal = running;

        const nivel: "ok" | "atencion" | "critico" =
          diaDescubierto != null ? "critico" : saldoFinal < cobros * 0.1 ? "atencion" : "ok";

        return {
          empresa_id: e.id,
          nombre: e.nombre,
          nif: e.nif,
          saldo_actual: Math.round(saldoActual * 100) / 100,
          cobros_previstos: Math.round(cobros * 100) / 100,
          pagos_previstos: Math.round(pagos * 100) / 100,
          saldo_final: Math.round(saldoFinal * 100) / 100,
          saldo_minimo: Math.round(saldoMinimo * 100) / 100,
          dia_descubierto: diaDescubierto,
          nivel,
        };
      } catch {
        return {
          empresa_id: e.id,
          nombre: e.nombre,
          nif: e.nif,
          saldo_actual: 0,
          cobros_previstos: 0,
          pagos_previstos: 0,
          saldo_final: 0,
          saldo_minimo: 0,
          dia_descubierto: null,
          nivel: "ok" as const,
        };
      }
    })
  );

  // Ordenamos por criticidad: críticos primero (por día_descubierto asc), luego atención por saldo_final asc
  items.sort((a, b) => {
    if (a.nivel !== b.nivel) {
      const order = { critico: 0, atencion: 1, ok: 2 };
      return order[a.nivel] - order[b.nivel];
    }
    if (a.dia_descubierto && b.dia_descubierto) return a.dia_descubierto.localeCompare(b.dia_descubierto);
    return a.saldo_final - b.saldo_final;
  });

  const totales = items.reduce(
    (acc, it) => ({
      empresas: acc.empresas + 1,
      en_riesgo: acc.en_riesgo + (it.nivel === "critico" || it.nivel === "atencion" ? 1 : 0),
      criticos: acc.criticos + (it.nivel === "critico" ? 1 : 0),
      saldo_cartera: acc.saldo_cartera + it.saldo_actual,
      cobros: acc.cobros + it.cobros_previstos,
      pagos: acc.pagos + it.pagos_previstos,
    }),
    { empresas: 0, en_riesgo: 0, criticos: 0, saldo_cartera: 0, cobros: 0, pagos: 0 }
  );

  return NextResponse.json({ ok: true, horizonte_dias: horizonte, totales, items });
}
