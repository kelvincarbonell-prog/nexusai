import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";
import { calcularNomina } from "@/lib/laboral/payroll/calc";

const Schema = z.object({
  empresa_id: z.string().uuid(),
  trabajador_id: z.string().uuid(),
  periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  base_extras: z.number().min(0).max(50_000).default(0),
  irpf_pct_override: z.number().min(0).max(60).optional(),
  hijos: z.number().min(0).max(20).default(0),
  conceptos_extras: z.array(z.object({
    codigo: z.string().min(1),
    importe: z.number().positive(),
  })).max(30).optional(),
  persist: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  const { data: trabajador } = await admin
    .from("trabajadores")
    .select("id,empresa_id,nombre,salario_bruto_anual,irpf_pct,activo")
    .eq("id", parsed.data.trabajador_id)
    .single();
  if (!trabajador || trabajador.empresa_id !== parsed.data.empresa_id) {
    return jsonError("Trabajador no encontrado en esta empresa", 404);
  }
  if (!trabajador.salario_bruto_anual || trabajador.salario_bruto_anual <= 0) {
    return jsonError("El trabajador no tiene salario bruto anual definido", 400);
  }

  const result = calcularNomina({
    salario_bruto_anual: Number(trabajador.salario_bruto_anual),
    pagas_anuales: 12,
    base_extras: parsed.data.base_extras,
    irpf_pct_override: parsed.data.irpf_pct_override ?? (trabajador.irpf_pct ? Number(trabajador.irpf_pct) : undefined),
    hijos: parsed.data.hijos,
    conceptos_extras: parsed.data.conceptos_extras,
  });

  let saved: { id: string } | null = null;
  if (parsed.data.persist) {
    const { data, error } = await admin
      .from("nominas")
      .upsert(
        {
          empresa_id: parsed.data.empresa_id,
          trabajador_id: parsed.data.trabajador_id,
          gestor_id: user.id,
          periodo: parsed.data.periodo,
          total: result.devengo_bruto,
          metadata: {
            devengo_bruto: result.devengo_bruto,
            base_cotizacion_cc: result.base_cotizacion_cc,
            base_cotizacion_atyepy: result.base_cotizacion_atyepy,
            base_irpf: result.base_irpf,
            ss_trabajador: result.ss_trabajador,
            irpf_retenido: result.irpf_retenido,
            irpf_pct: result.irpf_pct_aplicado,
            ss_empresa: result.ss_empresa,
            liquido: result.liquido,
            conceptos: result.conceptos,
            base_extras: parsed.data.base_extras,
            hijos: parsed.data.hijos,
          },
        },
        { onConflict: "empresa_id,trabajador_id,periodo" },
      )
      .select("id")
      .single();
    if (error || !data) return jsonError(error?.message ?? "No se pudo guardar", 500);
    saved = data;
  }

  return NextResponse.json({ ok: true, result, saved });
}
