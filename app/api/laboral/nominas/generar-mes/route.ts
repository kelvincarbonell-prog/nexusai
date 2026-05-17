import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";
import { calcularNomina } from "@/lib/laboral/payroll/calc";
import { calcularBonificaciones } from "@/lib/laboral/payroll/bonificaciones";
import { calcularEmbargoLegal } from "@/lib/laboral/embargos";

const Schema = z.object({
  empresa_id: z.string().uuid(),
  periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  sobreescribir: z.boolean().default(false),
});

/**
 * Generador masivo: crea las nóminas del mes para TODOS los trabajadores
 * activos de la empresa en un solo clic. Idempotente: si la nómina del
 * trabajador+periodo ya existe, la salta (a menos que sobreescribir=true).
 */
export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  const { data: trabajadores } = await admin
    .from("trabajadores")
    .select("id,nombre,salario_bruto_anual,irpf_pct,hijos,activo,fecha_alta,fecha_nacimiento,tipo_contrato,sexo,metadata")
    .eq("empresa_id", parsed.data.empresa_id)
    .eq("activo", true)
    .limit(500);

  if (!trabajadores || trabajadores.length === 0) {
    return jsonError("No hay trabajadores activos en esta empresa");
  }

  // Pre-carga nóminas ya existentes para el periodo
  const ids = trabajadores.map((t) => t.id);
  const { data: existentes } = await admin
    .from("nominas")
    .select("trabajador_id")
    .eq("empresa_id", parsed.data.empresa_id)
    .eq("periodo", parsed.data.periodo)
    .in("trabajador_id", ids);
  const yaCreadas = new Set((existentes ?? []).map((n) => n.trabajador_id));

  // Pre-carga embargos activos y anticipos con saldo pendiente por trabajador (1 sola query cada uno)
  const [embargosRes, anticiposRes] = await Promise.all([
    admin
      .from("embargos")
      .select("trabajador_id,deuda_total,saldo_pendiente,pension_alimentos,porcentaje_pension,id")
      .eq("empresa_id", parsed.data.empresa_id)
      .eq("estado", "activo")
      .in("trabajador_id", ids),
    admin
      .from("anticipos_nomina")
      .select("trabajador_id,id,saldo_pendiente,cuota_importe,cuotas,importe")
      .eq("empresa_id", parsed.data.empresa_id)
      .eq("estado", "activo")
      .in("trabajador_id", ids)
      .gt("saldo_pendiente", 0),
  ]);
  const embargosByTrab = new Map<string, NonNullable<typeof embargosRes.data>>();
  for (const e of embargosRes.data ?? []) {
    const arr = embargosByTrab.get(e.trabajador_id) ?? [];
    arr.push(e);
    embargosByTrab.set(e.trabajador_id, arr);
  }
  const anticiposByTrab = new Map<string, NonNullable<typeof anticiposRes.data>>();
  for (const a of anticiposRes.data ?? []) {
    const arr = anticiposByTrab.get(a.trabajador_id) ?? [];
    arr.push(a);
    anticiposByTrab.set(a.trabajador_id, arr);
  }

  const resultados: Array<{
    trabajador_id: string;
    nombre: string | null;
    status: "creada" | "sobrescrita" | "saltada" | "error";
    error?: string;
    liquido?: number;
    bruto?: number;
    ss_empresa?: number;
  }> = [];

  let totalBruto = 0;
  let totalLiquido = 0;
  let totalSsEmpresa = 0;
  let totalIrpf = 0;

  for (const t of trabajadores) {
    if (!t.salario_bruto_anual || Number(t.salario_bruto_anual) <= 0) {
      resultados.push({
        trabajador_id: t.id,
        nombre: t.nombre,
        status: "error",
        error: "Sin salario bruto anual definido",
      });
      continue;
    }
    if (yaCreadas.has(t.id) && !parsed.data.sobreescribir) {
      resultados.push({ trabajador_id: t.id, nombre: t.nombre, status: "saltada" });
      continue;
    }
    try {
      const calc = calcularNomina({
        salario_bruto_anual: Number(t.salario_bruto_anual),
        pagas_anuales: 12,
        irpf_pct_override: t.irpf_pct ? Number(t.irpf_pct) : undefined,
        hijos: t.hijos ? Number(t.hijos) : 0,
      });

      // Bonificaciones SS aplicables (reducen SS empresa)
      const tMeta = (t.metadata ?? {}) as Record<string, unknown>;
      const edad = t.fecha_nacimiento
        ? Math.floor((Date.now() - new Date(t.fecha_nacimiento as string).getTime()) / (365.25 * 86400000))
        : 30;
      const bonis = calcularBonificaciones({
        edad,
        fecha_alta: (t.fecha_alta as string | null) ?? new Date().toISOString().slice(0, 10),
        tipo_contrato: (t.tipo_contrato as string | null) ?? "indefinido",
        genero: t.sexo === "6" ? "F" : "M",
        discapacidad_pct: typeof tMeta.discapacidad_pct === "number" ? (tMeta.discapacidad_pct as number) : undefined,
        victima_violencia: tMeta.victima_violencia === true,
        parado_larga_duracion: tMeta.parado_larga_duracion === true,
        primer_empleo_joven: tMeta.primer_empleo_joven === true,
        zona_rural_despoblada: tMeta.zona_rural_despoblada === true,
      });
      const bonifMensual = bonis.reduce((s, b) => s + b.importe_anual / 12, 0);
      const ssEmpresaNeta = Math.max(0, calc.ss_empresa - bonifMensual);

      // ===== Embargos judiciales (LEC art. 607) =====
      const embargosTrab = embargosByTrab.get(t.id) ?? [];
      let embargoMes = 0;
      const embargosAplicados: Array<{ id: string; importe_mes: number }> = [];
      for (const emb of embargosTrab) {
        const e = calcularEmbargoLegal({
          liquido_mensual: calc.liquido,
          pension_alimentos: Boolean(emb.pension_alimentos),
          porcentaje_pension: emb.porcentaje_pension ? Number(emb.porcentaje_pension) : undefined,
        });
        // No descontar más que el saldo pendiente
        const importe = Math.min(e.embargable_legal, Number(emb.saldo_pendiente ?? 0));
        if (importe > 0) {
          embargoMes += importe;
          embargosAplicados.push({ id: emb.id, importe_mes: Math.round(importe * 100) / 100 });
        }
      }

      // ===== Anticipos pendientes =====
      const anticiposTrab = anticiposByTrab.get(t.id) ?? [];
      let anticipoMes = 0;
      const anticiposAplicados: Array<{ id: string; importe_mes: number }> = [];
      for (const ant of anticiposTrab) {
        const cuota = Math.min(Number(ant.cuota_importe ?? 0), Number(ant.saldo_pendiente ?? 0));
        if (cuota > 0) {
          anticipoMes += cuota;
          anticiposAplicados.push({ id: ant.id, importe_mes: Math.round(cuota * 100) / 100 });
        }
      }

      const totalDeducciones = Math.round((embargoMes + anticipoMes) * 100) / 100;
      const liquidoFinal = Math.round((calc.liquido - totalDeducciones) * 100) / 100;

      const { error: errIns } = await admin
        .from("nominas")
        .upsert(
          {
            empresa_id: parsed.data.empresa_id,
            trabajador_id: t.id,
            gestor_id: user.id,
            periodo: parsed.data.periodo,
            total: calc.devengo_bruto,
            metadata: {
              devengo_bruto: calc.devengo_bruto,
              base_cotizacion_cc: calc.base_cotizacion_cc,
              base_cotizacion_atyepy: calc.base_cotizacion_atyepy,
              base_irpf: calc.base_irpf,
              ss_trabajador: calc.ss_trabajador,
              irpf_retenido: calc.irpf_retenido,
              irpf_pct: calc.irpf_pct_aplicado,
              ss_empresa: calc.ss_empresa,
              ss_empresa_neta: ssEmpresaNeta,
              bonificaciones: bonis,
              bonificacion_mes: Math.round(bonifMensual * 100) / 100,
              embargo_mes: Math.round(embargoMes * 100) / 100,
              anticipo_mes: Math.round(anticipoMes * 100) / 100,
              embargos_aplicados: embargosAplicados,
              anticipos_aplicados: anticiposAplicados,
              liquido_pre_deducciones: calc.liquido,
              liquido: liquidoFinal,
              conceptos: calc.conceptos,
              hijos: t.hijos ?? 0,
              generado_masivo: true,
            },
          },
          { onConflict: "empresa_id,trabajador_id,periodo" },
        );

      // Actualiza saldos de embargos y anticipos
      for (const a of anticiposAplicados) {
        const ant = anticiposTrab.find((x) => x.id === a.id);
        if (!ant) continue;
        const nuevoSaldo = Math.max(0, Number(ant.saldo_pendiente) - a.importe_mes);
        await admin
          .from("anticipos_nomina")
          .update({
            saldo_pendiente: nuevoSaldo,
            estado: nuevoSaldo <= 0 ? "pagado" : "activo",
            updated_at: new Date().toISOString(),
          })
          .eq("id", a.id);
      }
      for (const e of embargosAplicados) {
        const emb = embargosTrab.find((x) => x.id === e.id);
        if (!emb) continue;
        const nuevoSaldo = Math.max(0, Number(emb.saldo_pendiente) - e.importe_mes);
        await admin
          .from("embargos")
          .update({
            saldo_pendiente: nuevoSaldo,
            estado: nuevoSaldo <= 0 ? "finalizado" : "activo",
            updated_at: new Date().toISOString(),
          })
          .eq("id", e.id);
      }
      if (errIns) throw new Error(errIns.message);
      resultados.push({
        trabajador_id: t.id,
        nombre: t.nombre,
        status: yaCreadas.has(t.id) ? "sobrescrita" : "creada",
        bruto: calc.devengo_bruto,
        liquido: liquidoFinal,
        ss_empresa: calc.ss_empresa,
      });
      totalBruto += calc.devengo_bruto;
      totalLiquido += liquidoFinal;
      totalSsEmpresa += ssEmpresaNeta;
      totalIrpf += calc.irpf_retenido;
    } catch (e: unknown) {
      resultados.push({
        trabajador_id: t.id,
        nombre: t.nombre,
        status: "error",
        error: e instanceof Error ? e.message : "Error",
      });
    }
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  return NextResponse.json({
    ok: true,
    periodo: parsed.data.periodo,
    total_trabajadores: trabajadores.length,
    resumen: {
      creadas: resultados.filter((r) => r.status === "creada").length,
      sobrescritas: resultados.filter((r) => r.status === "sobrescrita").length,
      saltadas: resultados.filter((r) => r.status === "saltada").length,
      errores: resultados.filter((r) => r.status === "error").length,
    },
    totales: {
      bruto: round2(totalBruto),
      liquido: round2(totalLiquido),
      ss_empresa: round2(totalSsEmpresa),
      irpf_retenido: round2(totalIrpf),
      coste_total_empresa: round2(totalBruto + totalSsEmpresa),
    },
    resultados,
  });
}
