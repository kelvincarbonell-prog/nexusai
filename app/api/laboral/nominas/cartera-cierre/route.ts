import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { calcularNomina } from "@/lib/laboral/payroll/calc";
import { trieniosDevengados } from "@/lib/laboral/payroll/pagas-extra";

/**
 * Autocierre de nóminas del mes para TODAS las empresas del gestor.
 * GET (preview): lee qué hay generado vs pendiente, no toca nada.
 * POST (ejecuta): genera + persiste las que falten, opción de publicar al portal.
 *
 * Devuelve resumen ejecutivo agregado (totales del despacho) + detalle por
 * empresa para que el gestor vea de un vistazo cuántas se cerraron, cuánto
 * cuesta el mes en SS y qué irá al modelo 111.
 */
const Schema = z.object({
  periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  publicar: z.boolean().default(false),
  sobreescribir: z.boolean().default(false),
});

type EmpresaResultado = {
  empresa_id: string;
  nombre: string | null;
  trabajadores: number;
  generadas: number;
  saltadas: number;
  errores: number;
  total_bruto: number;
  total_liquido: number;
  total_ss_empresa: number;
  total_ss_trab: number;
  total_irpf: number;
  coste_empresa: number;
};

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  const { data: perfil } = await admin.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  if (perfil?.rol !== "admin" && perfil?.rol !== "gestor") return jsonError("Sin permiso", 403);

  let q = admin.from("empresas").select("id,nombre");
  if (perfil.rol === "gestor") q = q.eq("gestor_id", user.id);
  const { data: empresas } = await q;
  const lista = empresas ?? [];

  if (lista.length === 0) {
    return NextResponse.json({ ok: true, totales: vacioTotales(), por_empresa: [] });
  }

  const periodo = parsed.data.periodo;
  const mesPeriodo = Number(periodo.split("-")[1]);

  const porEmpresa: EmpresaResultado[] = [];

  // Procesamos empresas con concurrencia baja para no saturar BBDD
  const CONC = 3;
  for (let i = 0; i < lista.length; i += CONC) {
    const batch = lista.slice(i, i + CONC);
    const results = await Promise.all(batch.map((e) => procesarEmpresa(admin, user.id, e, periodo, mesPeriodo, parsed.data.sobreescribir)));
    porEmpresa.push(...results);
  }

  // Publicar al portal si pidió
  if (parsed.data.publicar) {
    await Promise.all(porEmpresa.filter((p) => p.generadas > 0).map((p) =>
      admin
        .from("nominas")
        .update({ publicada: true, publicada_at: new Date().toISOString() })
        .eq("empresa_id", p.empresa_id)
        .eq("periodo", periodo)
    ));
  }

  // Totales del despacho
  const totales = porEmpresa.reduce((acc, e) => ({
    empresas: acc.empresas + 1,
    empresas_con_nominas: acc.empresas_con_nominas + (e.trabajadores > 0 ? 1 : 0),
    trabajadores: acc.trabajadores + e.trabajadores,
    generadas: acc.generadas + e.generadas,
    saltadas: acc.saltadas + e.saltadas,
    errores: acc.errores + e.errores,
    total_bruto: acc.total_bruto + e.total_bruto,
    total_liquido: acc.total_liquido + e.total_liquido,
    total_ss_empresa: acc.total_ss_empresa + e.total_ss_empresa,
    total_ss_trab: acc.total_ss_trab + e.total_ss_trab,
    total_irpf: acc.total_irpf + e.total_irpf,
    coste_total: acc.coste_total + e.coste_empresa,
  }), vacioTotales());

  return NextResponse.json({ ok: true, periodo, totales, por_empresa: porEmpresa });
}

function vacioTotales() {
  return {
    empresas: 0,
    empresas_con_nominas: 0,
    trabajadores: 0,
    generadas: 0,
    saltadas: 0,
    errores: 0,
    total_bruto: 0,
    total_liquido: 0,
    total_ss_empresa: 0,
    total_ss_trab: 0,
    total_irpf: 0,
    coste_total: 0,
  };
}

async function procesarEmpresa(
  admin: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  empresa: { id: string; nombre: string | null },
  periodo: string,
  mesPeriodo: number,
  sobreescribir: boolean,
): Promise<EmpresaResultado> {
  const r: EmpresaResultado = {
    empresa_id: empresa.id,
    nombre: empresa.nombre,
    trabajadores: 0,
    generadas: 0,
    saltadas: 0,
    errores: 0,
    total_bruto: 0,
    total_liquido: 0,
    total_ss_empresa: 0,
    total_ss_trab: 0,
    total_irpf: 0,
    coste_empresa: 0,
  };

  const { data: trabajadores } = await admin
    .from("trabajadores")
    .select("id,nombre,salario_bruto_anual,irpf_pct,hijos,activo,fecha_alta,pagas_anuales,pagas_prorrateadas,trienio_importe")
    .eq("empresa_id", empresa.id)
    .eq("activo", true);

  if (!trabajadores || trabajadores.length === 0) return r;
  r.trabajadores = trabajadores.length;

  const { data: existentes } = await admin
    .from("nominas")
    .select("trabajador_id,total,metadata")
    .eq("empresa_id", empresa.id)
    .eq("periodo", periodo);

  const yaCreadas = new Map((existentes ?? []).map((n) => [n.trabajador_id as string, n]));

  for (const t of trabajadores) {
    if (!t.salario_bruto_anual || Number(t.salario_bruto_anual) <= 0) {
      r.errores += 1;
      continue;
    }

    // Si ya existe y no sobreescribir, suma a totales pero no regenera
    if (yaCreadas.has(t.id) && !sobreescribir) {
      r.saltadas += 1;
      const meta = (yaCreadas.get(t.id)!.metadata ?? {}) as Record<string, number>;
      r.total_bruto += Number(meta.devengo_bruto ?? 0);
      r.total_liquido += Number(meta.liquido ?? 0);
      r.total_ss_empresa += Number(meta.ss_empresa ?? 0);
      r.total_ss_trab += Number(meta.ss_trabajador ?? 0);
      r.total_irpf += Number(meta.irpf_retenido ?? 0);
      continue;
    }

    try {
      const trienios = t.fecha_alta
        ? trieniosDevengados(t.fecha_alta as string, `${periodo}-01`)
        : 0;
      const calc = calcularNomina({
        salario_bruto_anual: Number(t.salario_bruto_anual),
        pagas_anuales: (t as { pagas_anuales?: number | null }).pagas_anuales ?? 12,
        pagas_prorrateadas: (t as { pagas_prorrateadas?: boolean | null }).pagas_prorrateadas ?? true,
        mes_periodo: mesPeriodo,
        trienio_importe_anual: (t as { trienio_importe?: number | null }).trienio_importe
          ? Number((t as { trienio_importe?: number | null }).trienio_importe)
          : 0,
        trienios,
        irpf_pct_override: t.irpf_pct ? Number(t.irpf_pct) : undefined,
        hijos: t.hijos ? Number(t.hijos) : 0,
      });

      await admin
        .from("nominas")
        .upsert({
          empresa_id: empresa.id,
          trabajador_id: t.id,
          gestor_id: userId,
          periodo,
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
            liquido: calc.liquido,
            conceptos: calc.conceptos,
          },
        }, { onConflict: "empresa_id,trabajador_id,periodo" });

      r.generadas += 1;
      r.total_bruto += calc.devengo_bruto;
      r.total_liquido += calc.liquido;
      r.total_ss_empresa += calc.ss_empresa;
      r.total_ss_trab += calc.ss_trabajador;
      r.total_irpf += calc.irpf_retenido;
    } catch {
      r.errores += 1;
    }
  }

  r.coste_empresa = r.total_bruto + r.total_ss_empresa;
  return r;
}
