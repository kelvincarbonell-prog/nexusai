import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany, daysBetween } from "@/lib/laboral/access";

/**
 * GET /api/laboral/vacaciones/saldo?empresa_id=...&anyo=2026
 *
 * Calcula el saldo de vacaciones por trabajador para el ejercicio:
 *   - días anuales según convenio (o 30 naturales por defecto)
 *   - prorrateo si fecha_alta dentro del año
 *   - menos días ya disfrutados (tipo "vacaciones" en ausencias)
 *   - menos días aprobados pendientes
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const sp = request.nextUrl.searchParams;
  const empresaId = sp.get("empresa_id");
  if (!empresaId) return jsonError("Falta empresa_id");
  const anyo = Number(sp.get("anyo") ?? new Date().getUTCFullYear());

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, empresaId))) return jsonError("Sin acceso", 403);

  // Cargar convenios para saber días por convenio
  const { CONVENIOS } = await import("@/lib/laboral/convenios");
  const convenioDias = new Map(CONVENIOS.map((c) => [c.codigo, c.vacaciones_dias]));

  const { data: trabajadores } = await admin
    .from("trabajadores")
    .select("id,nombre,apellidos,fecha_alta,fecha_baja,convenio_codigo,activo,metadata")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .limit(500);
  if (!trabajadores || trabajadores.length === 0) {
    return NextResponse.json({ ok: true, items: [], anyo });
  }

  const ids = trabajadores.map((t) => t.id);
  const { data: ausencias } = await admin
    .from("ausencias")
    .select("trabajador_id,tipo,fecha_inicio,fecha_fin,estado")
    .eq("empresa_id", empresaId)
    .in("trabajador_id", ids)
    .eq("tipo", "vacaciones")
    .gte("fecha_inicio", `${anyo}-01-01`)
    .lte("fecha_fin", `${anyo}-12-31`);

  const yearStart = `${anyo}-01-01`;
  const yearEnd = `${anyo}-12-31`;

  function diasAnualesPorTrabajador(t: { convenio_codigo: string | null; metadata: unknown }): number {
    const meta = (t.metadata ?? {}) as Record<string, number | undefined>;
    if (typeof meta.vacaciones_dias === "number" && meta.vacaciones_dias > 0) return meta.vacaciones_dias;
    if (t.convenio_codigo && convenioDias.has(t.convenio_codigo)) {
      return convenioDias.get(t.convenio_codigo) as number;
    }
    return 30; // mínimo legal
  }

  function prorratearAnual(diasBase: number, fechaAlta: string | null, fechaBaja: string | null): number {
    const inicio = fechaAlta && fechaAlta > yearStart ? fechaAlta : yearStart;
    const fin = fechaBaja && fechaBaja < yearEnd ? fechaBaja : yearEnd;
    const diasTrabajados = daysBetween(inicio, fin);
    const diasAnyo = 366; // bisiesto seguro mayor; conservador
    const prorr = Math.round((diasBase * diasTrabajados) / diasAnyo);
    return Math.min(diasBase, Math.max(0, prorr));
  }

  const items = trabajadores.map((t) => {
    const base = diasAnualesPorTrabajador(t);
    const generados = prorratearAnual(base, t.fecha_alta ?? null, t.fecha_baja ?? null);
    const mias = (ausencias ?? []).filter((a) => a.trabajador_id === t.id);
    const disfrutados = mias
      .filter((a) => a.estado === "aprobada" || a.estado === "tomada")
      .reduce((s, a) => s + daysBetween(a.fecha_inicio, a.fecha_fin), 0);
    const pendientes = mias
      .filter((a) => a.estado === "solicitada" || a.estado === "pendiente")
      .reduce((s, a) => s + daysBetween(a.fecha_inicio, a.fecha_fin), 0);
    return {
      trabajador_id: t.id,
      nombre: t.apellidos ? `${t.apellidos}, ${t.nombre}` : t.nombre,
      base_anual: base,
      generados,
      disfrutados,
      pendientes,
      saldo: generados - disfrutados - pendientes,
    };
  });

  return NextResponse.json({ ok: true, anyo, items });
}
