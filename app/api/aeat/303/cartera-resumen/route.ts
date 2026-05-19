import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { calcular303 } from "@/lib/aeat/calc/m303";
import { currentTrimestre, fetchPeriodoFiscal, type Trimestre } from "@/lib/aeat/queries";

/**
 * Calcula el borrador del modelo 303 para TODAS las empresas del gestor
 * en un trimestre. Devuelve el resumen por empresa: resultado a ingresar
 * / a compensar, warnings, número de facturas y gastos del periodo.
 *
 * Pensado para el wow del dashboard: «X clientes con 303 listo para firmar».
 */
const Q = z.object({
  ejercicio: z.coerce.number().int().min(2020).max(2099).optional(),
  periodo: z.enum(["1T", "2T", "3T", "4T"]).optional(),
});

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Q.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("Parámetros inválidos");

  const admin = createSupabaseAdmin();
  const { data: perfil } = await admin.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  if (perfil?.rol !== "admin" && perfil?.rol !== "gestor") return jsonError("Sin permiso", 403);

  const { year: curY, trimestre: curT } = currentTrimestre();
  const ejercicio = parsed.data.ejercicio ?? curY;
  const periodo = (parsed.data.periodo ?? curT) as Trimestre;

  let empQ = admin.from("empresas").select("id,nombre,nif,plan,account_type");
  if (perfil.rol === "gestor") empQ = empQ.eq("gestor_id", user.id);
  const { data: empresas } = await empQ;
  const items = empresas ?? [];

  // Estado guardado por empresa (si existe declaración)
  const ids = items.map((e) => e.id);
  const { data: decls } = ids.length
    ? await admin
        .from("aeat_declaraciones")
        .select("empresa_id,status,resultado,presentado_en")
        .eq("modelo", "303")
        .eq("ejercicio", ejercicio)
        .eq("periodo", periodo)
        .in("empresa_id", ids)
    : { data: [] as Array<{ empresa_id: string; status: string; resultado: number | null; presentado_en: string | null }> };
  const declMap = new Map((decls ?? []).map((d) => [d.empresa_id, d]));

  // Calcula el borrador para cada empresa en paralelo
  const resultados = await Promise.all(
    items.map(async (e) => {
      try {
        const { facturas, gastos } = await fetchPeriodoFiscal(admin, e.id, ejercicio, periodo);
        const { casillas, warnings } = calcular303({ facturas, gastos });
        const resultado = Number(casillas.c71 ?? 0);
        const decl = declMap.get(e.id);
        return {
          empresa_id: e.id,
          nombre: e.nombre,
          nif: e.nif,
          account_type: e.account_type,
          n_facturas: facturas.length,
          n_gastos: gastos.length,
          resultado,                          // €: +ingresar, -compensar
          warnings_count: warnings.length,
          status: decl?.status ?? "pendiente",
          presentado_en: decl?.presentado_en ?? null,
        };
      } catch (err: unknown) {
        return {
          empresa_id: e.id,
          nombre: e.nombre,
          nif: e.nif,
          account_type: e.account_type,
          n_facturas: 0,
          n_gastos: 0,
          resultado: 0,
          warnings_count: 0,
          status: "error" as const,
          presentado_en: null,
          error: err instanceof Error ? err.message : "Error",
        };
      }
    })
  );

  const totales = resultados.reduce(
    (acc, r) => ({
      a_ingresar: acc.a_ingresar + (r.resultado > 0 ? r.resultado : 0),
      a_compensar: acc.a_compensar + (r.resultado < 0 ? -r.resultado : 0),
      empresas: acc.empresas + 1,
      pendientes: acc.pendientes + (r.status === "pendiente" ? 1 : 0),
      borradores: acc.borradores + (r.status === "borrador" ? 1 : 0),
      presentados: acc.presentados + (r.status === "presentado" ? 1 : 0),
      con_warnings: acc.con_warnings + (r.warnings_count > 0 ? 1 : 0),
    }),
    { a_ingresar: 0, a_compensar: 0, empresas: 0, pendientes: 0, borradores: 0, presentados: 0, con_warnings: 0 }
  );

  return NextResponse.json({ ok: true, ejercicio, periodo, totales, items: resultados });
}
