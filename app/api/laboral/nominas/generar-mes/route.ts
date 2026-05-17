import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";
import { calcularNomina } from "@/lib/laboral/payroll/calc";
import { calcularBonificaciones } from "@/lib/laboral/payroll/bonificaciones";

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
              liquido: calc.liquido,
              conceptos: calc.conceptos,
              hijos: t.hijos ?? 0,
              generado_masivo: true,
            },
          },
          { onConflict: "empresa_id,trabajador_id,periodo" },
        );
      if (errIns) throw new Error(errIns.message);
      resultados.push({
        trabajador_id: t.id,
        nombre: t.nombre,
        status: yaCreadas.has(t.id) ? "sobrescrita" : "creada",
        bruto: calc.devengo_bruto,
        liquido: calc.liquido,
        ss_empresa: calc.ss_empresa,
      });
      totalBruto += calc.devengo_bruto;
      totalLiquido += calc.liquido;
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
