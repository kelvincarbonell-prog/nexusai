import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";
import { calcularIndemnizacion, type TipoExtincion } from "@/lib/laboral/indemnizacion";

const Schema = z.object({
  empresa_id: z.string().uuid(),
  trabajador_id: z.string().uuid(),
  tipo: z.enum([
    "despido_objetivo",
    "despido_improcedente",
    "despido_disciplinario_procedente",
    "fin_temporal",
    "modificacion_sustancial",
    "baja_voluntaria",
    "jubilacion",
    "mutuo_acuerdo",
  ]),
  fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pre_2012: z.boolean().default(false),
  salario_anual_bruto_override: z.number().min(0).optional(),
});

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  const { data: trab } = await admin
    .from("trabajadores")
    .select("nombre,fecha_alta,salario_bruto_anual")
    .eq("id", parsed.data.trabajador_id)
    .eq("empresa_id", parsed.data.empresa_id)
    .maybeSingle();
  if (!trab) return jsonError("Trabajador no encontrado", 404);
  if (!trab.fecha_alta) return jsonError("El trabajador no tiene fecha de alta registrada", 400);

  const salario = parsed.data.salario_anual_bruto_override ?? Number(trab.salario_bruto_anual ?? 0);
  if (salario <= 0) return jsonError("Salario anual bruto requerido", 400);

  const result = calcularIndemnizacion({
    tipo: parsed.data.tipo as TipoExtincion,
    salario_anual_bruto: salario,
    fecha_inicio: trab.fecha_alta as string,
    fecha_fin: parsed.data.fecha_fin,
    pre_2012: parsed.data.pre_2012,
  });

  return NextResponse.json({ ok: true, trabajador: trab.nombre, result });
}
