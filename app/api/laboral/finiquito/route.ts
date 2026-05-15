import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";
import { calcularFiniquito } from "@/lib/laboral/payroll/finiquito";

const Schema = z.object({
  empresa_id: z.string().uuid(),
  trabajador_id: z.string().uuid(),
  fecha_baja: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  causa: z.enum(["despido_improcedente", "despido_objetivo", "fin_contrato", "dimision", "mutuo_acuerdo", "jubilacion"]),
  pagas_extras_prorrateadas_en_nomina: z.boolean().default(false),
  dias_vacaciones_anuales: z.number().min(0).max(60).default(30),
  dias_vacaciones_disfrutadas_anyo: z.number().min(0).max(365).default(0),
});

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  const { data: trabajador } = await admin
    .from("trabajadores")
    .select("id,empresa_id,nombre,fecha_alta,salario_bruto_anual,irpf_pct,activo")
    .eq("id", parsed.data.trabajador_id)
    .single();
  if (!trabajador || trabajador.empresa_id !== parsed.data.empresa_id) {
    return jsonError("Trabajador no encontrado", 404);
  }
  if (!trabajador.fecha_alta) return jsonError("El trabajador no tiene fecha de alta", 400);
  if (!trabajador.salario_bruto_anual) return jsonError("El trabajador no tiene salario bruto anual", 400);

  const result = calcularFiniquito({
    salario_bruto_anual: Number(trabajador.salario_bruto_anual),
    fecha_alta: trabajador.fecha_alta,
    fecha_baja: parsed.data.fecha_baja,
    causa: parsed.data.causa,
    irpf_pct: trabajador.irpf_pct ? Number(trabajador.irpf_pct) : undefined,
    pagas_extras_prorrateadas_en_nomina: parsed.data.pagas_extras_prorrateadas_en_nomina,
    dias_vacaciones_anuales: parsed.data.dias_vacaciones_anuales,
    dias_vacaciones_disfrutadas_anyo: parsed.data.dias_vacaciones_disfrutadas_anyo,
  });

  return NextResponse.json({ ok: true, result, trabajador: { nombre: trabajador.nombre } });
}
