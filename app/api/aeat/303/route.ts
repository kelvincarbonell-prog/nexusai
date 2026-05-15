import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany, isGestorOrAdmin } from "@/lib/laboral/access";
import { calcular303, type Casillas303 } from "@/lib/aeat/calc/m303";
import { currentTrimestre, fetchPeriodoFiscal, type Trimestre } from "@/lib/aeat/queries";
import { validateNif } from "@/lib/aeat/validators";

const QuerySchema = z.object({
  empresa_id: z.string().uuid(),
  ejercicio: z.coerce.number().int().min(2020).max(2099).optional(),
  periodo: z.enum(["1T", "2T", "3T", "4T"]).optional(),
});

const SaveSchema = z.object({
  empresa_id: z.string().uuid(),
  ejercicio: z.number().int().min(2020).max(2099),
  periodo: z.enum(["1T", "2T", "3T", "4T"]),
  casillas: z.record(z.number()).optional(),
  status: z.enum(["borrador", "revisado", "presentado"]).default("borrador"),
  ref_aeat: z.string().max(80).optional(),
  notas: z.string().max(2000).optional(),
});

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = QuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("Parámetros inválidos");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);

  const { year: currentYear, trimestre: currentT } = currentTrimestre();
  const ejercicio = parsed.data.ejercicio ?? currentYear;
  const periodo = (parsed.data.periodo ?? currentT) as Trimestre;

  const { data: empresa } = await admin
    .from("empresas")
    .select("id,nombre,nif")
    .eq("id", parsed.data.empresa_id)
    .single();

  const { facturas, gastos, from, to } = await fetchPeriodoFiscal(admin, parsed.data.empresa_id, ejercicio, periodo);
  const { casillas, warnings, resumen } = calcular303({ facturas, gastos });

  const nifCheck = empresa?.nif ? validateNif(empresa.nif) : { ok: false, reason: "Empresa sin NIF" };
  const nifWarning = nifCheck.ok ? null : `NIF inválido: ${nifCheck.reason}.`;

  const { data: existing } = await admin
    .from("aeat_declaraciones")
    .select("*")
    .eq("empresa_id", parsed.data.empresa_id)
    .eq("modelo", "303")
    .eq("ejercicio", ejercicio)
    .eq("periodo", periodo)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    empresa,
    ejercicio,
    periodo,
    rango: { from, to },
    casillas,
    resumen,
    warnings: [...(nifWarning ? [nifWarning] : []), ...warnings],
    declaracion: existing ?? null,
  });
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = SaveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  // recalcular siempre desde la fuente, no confiar en casillas posteadas
  const { facturas, gastos } = await fetchPeriodoFiscal(admin, parsed.data.empresa_id, parsed.data.ejercicio, parsed.data.periodo);
  const { casillas, warnings, resumen } = calcular303({ facturas, gastos });
  const merged: Casillas303 = { ...casillas, ...(parsed.data.casillas ?? {}) } as Casillas303;

  const { data, error } = await admin
    .from("aeat_declaraciones")
    .upsert(
      {
        empresa_id: parsed.data.empresa_id,
        gestor_id: user.id,
        modelo: "303",
        ejercicio: parsed.data.ejercicio,
        periodo: parsed.data.periodo,
        casillas: merged,
        resumen,
        warnings,
        status: parsed.data.status,
        resultado: merged.c71,
        ref_aeat: parsed.data.ref_aeat ?? null,
        notas: parsed.data.notas ?? null,
        ...(parsed.data.status === "presentado"
          ? { presentado_en: new Date().toISOString(), presentado_por: user.id }
          : {}),
      },
      { onConflict: "empresa_id,modelo,ejercicio,periodo" },
    )
    .select("*")
    .single();

  if (error || !data) return jsonError(error?.message ?? "No se pudo guardar", 500);
  return NextResponse.json({ ok: true, declaracion: data });
}
