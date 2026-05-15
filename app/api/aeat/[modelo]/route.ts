import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany, isGestorOrAdmin } from "@/lib/laboral/access";
import { currentTrimestre, type Trimestre } from "@/lib/aeat/queries";
import { calcular111, type Casillas111 } from "@/lib/aeat/calc/m111";
import { calcular115, type Casillas115 } from "@/lib/aeat/calc/m115";
import { calcular130 } from "@/lib/aeat/calc/m130";
import { calcular390, type DeclaracionTrimestral } from "@/lib/aeat/calc/m390";
import { calcular347 } from "@/lib/aeat/calc/m347";
import { calcular349 } from "@/lib/aeat/calc/m349";
import { calcular180 } from "@/lib/aeat/calc/m180";
import { calcular190 } from "@/lib/aeat/calc/m190";
import type { Casillas303 } from "@/lib/aeat/calc/m303";
import { fetchDatos111, fetchDatos115, fetchDatos130 } from "@/lib/aeat/queries-extra";
import { validateNif } from "@/lib/aeat/validators";

const SUPPORTED = ["111", "115", "130", "180", "190", "347", "349", "390"] as const;
type Modelo = (typeof SUPPORTED)[number];

const QuerySchema = z.object({
  empresa_id: z.string().uuid(),
  ejercicio: z.coerce.number().int().min(2020).max(2099).optional(),
  periodo: z.enum(["1T", "2T", "3T", "4T", "ANUAL"]).optional(),
});

const SaveSchema = z.object({
  empresa_id: z.string().uuid(),
  ejercicio: z.number().int().min(2020).max(2099),
  periodo: z.enum(["1T", "2T", "3T", "4T", "ANUAL"]),
  status: z.enum(["borrador", "revisado", "presentado"]).default("borrador"),
  notas: z.string().max(2000).optional(),
});

async function compute(
  modelo: Modelo,
  admin: ReturnType<typeof createSupabaseAdmin>,
  empresaId: string,
  ejercicio: number,
  periodo: Trimestre | "ANUAL",
) {
  if (modelo === "111") {
    if (periodo === "ANUAL") throw new Error("El 111 es trimestral");
    const data = await fetchDatos111(admin, empresaId, ejercicio, periodo);
    const r = calcular111(data);
    return { casillas: r.casillas as unknown as Record<string, number>, warnings: r.warnings, resumen: r.resumen };
  }
  if (modelo === "115") {
    if (periodo === "ANUAL") throw new Error("El 115 es trimestral");
    const gastos = await fetchDatos115(admin, empresaId, ejercicio, periodo);
    const r = calcular115({ gastos });
    return { casillas: r.casillas as unknown as Record<string, number>, warnings: r.warnings, resumen: r.resumen };
  }
  if (modelo === "130") {
    if (periodo === "ANUAL") throw new Error("El 130 es trimestral");
    const { facturas, gastos, pagosAnteriores } = await fetchDatos130(admin, empresaId, ejercicio, periodo);
    const r = calcular130({ facturas, gastos, pagosFraccionadosAnteriores: pagosAnteriores });
    return { casillas: r.casillas as unknown as Record<string, number>, warnings: r.warnings, resumen: r.resumen };
  }
  if (modelo === "390") {
    const { data } = await admin
      .from("aeat_declaraciones")
      .select("modelo,ejercicio,periodo,status,casillas")
      .eq("empresa_id", empresaId)
      .eq("modelo", "303")
      .eq("ejercicio", ejercicio);
    const decls: DeclaracionTrimestral[] = (data ?? []).map((d) => ({
      modelo: d.modelo,
      ejercicio: d.ejercicio,
      periodo: d.periodo,
      status: d.status,
      casillas: d.casillas as Casillas303,
    }));
    const r = calcular390({ declaraciones303: decls });
    return { casillas: r.casillas as unknown as Record<string, number>, warnings: r.warnings, resumen: r.resumen };
  }
  if (modelo === "180" || modelo === "190") {
    const sourceModel = modelo === "180" ? "115" : "111";
    const { data } = await admin
      .from("aeat_declaraciones")
      .select("modelo,ejercicio,periodo,status,casillas")
      .eq("empresa_id", empresaId)
      .eq("modelo", sourceModel)
      .eq("ejercicio", ejercicio);
    const decls = (data ?? []).map((d) => ({
      modelo: d.modelo,
      ejercicio: d.ejercicio,
      periodo: d.periodo,
      status: d.status,
      casillas: d.casillas as Casillas111 | Casillas115,
    }));
    const r =
      modelo === "180"
        ? calcular180({ declaraciones115: decls as Array<{ modelo: string; ejercicio: number; periodo: string; status: string; casillas: Casillas115 }> })
        : calcular190({ declaraciones111: decls as Array<{ modelo: string; ejercicio: number; periodo: string; status: string; casillas: Casillas111 }> });
    return { casillas: r.casillas as unknown as Record<string, number>, warnings: r.warnings, resumen: r.resumen };
  }
  if (modelo === "347") {
    const from = `${ejercicio}-01-01`;
    const to = `${ejercicio}-12-31`;
    const { data } = await admin
      .from("facturas")
      .select("id,tipo,contacto_nombre,base,iva,fecha_emision,metadata")
      .eq("empresa_id", empresaId)
      .gte("fecha_emision", from)
      .lte("fecha_emision", to);
    const facturas = (data ?? []).map((f) => ({
      id: f.id,
      tipo: f.tipo as "emitida" | "recibida" | "simplificada",
      contacto_nombre: f.contacto_nombre,
      contacto_nif: ((f.metadata as Record<string, unknown> | null)?.contacto_nif as string | undefined) ?? null,
      base: Number(f.base ?? 0),
      iva: Number(f.iva ?? 0),
      fecha_emision: f.fecha_emision ?? null,
      metadata: f.metadata as Record<string, unknown> | null,
    }));
    const r = calcular347({ facturas });
    return {
      casillas: r.casillas as unknown as Record<string, number>,
      warnings: r.warnings,
      resumen: { operadores: r.operadores.length, top: r.operadores.slice(0, 5) },
    };
  }
  if (modelo === "349") {
    // Periodo mensual o trimestral: para MVP usamos trimestral
    if (periodo === "ANUAL") throw new Error("El 349 es trimestral o mensual");
    const { trimestreToRange } = await import("@/lib/aeat/queries");
    const { from, to } = trimestreToRange(ejercicio, periodo);
    const { data } = await admin
      .from("facturas")
      .select("id,tipo,contacto_nombre,base,fecha_emision,metadata")
      .eq("empresa_id", empresaId)
      .gte("fecha_emision", from)
      .lte("fecha_emision", to);
    const facturas = (data ?? []).map((f) => ({
      id: f.id,
      tipo: f.tipo as "emitida" | "recibida" | "simplificada",
      contacto_nombre: f.contacto_nombre,
      contacto_nif: ((f.metadata as Record<string, unknown> | null)?.contacto_nif as string | undefined) ?? null,
      base: Number(f.base ?? 0),
      fecha_emision: f.fecha_emision ?? null,
      metadata: f.metadata as Record<string, unknown> | null,
    }));
    const r = calcular349({ facturas });
    return {
      casillas: r.casillas as unknown as Record<string, number>,
      warnings: r.warnings,
      resumen: { operadores: r.operaciones.length, top: r.operaciones.slice(0, 5) },
    };
  }
  throw new Error("Modelo no soportado");
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ modelo: string }> }) {
  const { modelo } = await ctx.params;
  if (!SUPPORTED.includes(modelo as Modelo)) return jsonError("Modelo no soportado", 404);
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = QuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("Parámetros inválidos");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);

  const { year, trimestre } = currentTrimestre();
  const ejercicio = parsed.data.ejercicio ?? year;
  const anualModels = ["390", "347", "180", "190"] as const;
  const periodo = (anualModels.includes(modelo as "390" | "347" | "180" | "190")
    ? "ANUAL"
    : (parsed.data.periodo ?? trimestre)) as Trimestre | "ANUAL";

  const { data: empresa } = await admin
    .from("empresas")
    .select("id,nombre,nif")
    .eq("id", parsed.data.empresa_id)
    .single();

  const result = await compute(modelo as Modelo, admin, parsed.data.empresa_id, ejercicio, periodo);
  const nifCheck = empresa?.nif ? validateNif(empresa.nif) : { ok: false, reason: "Empresa sin NIF" };
  const nifWarning = nifCheck.ok ? null : `NIF inválido: ${nifCheck.reason}.`;

  const { data: existing } = await admin
    .from("aeat_declaraciones")
    .select("*")
    .eq("empresa_id", parsed.data.empresa_id)
    .eq("modelo", modelo)
    .eq("ejercicio", ejercicio)
    .eq("periodo", periodo)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    modelo,
    empresa,
    ejercicio,
    periodo,
    casillas: result.casillas,
    resumen: result.resumen,
    warnings: [...(nifWarning ? [nifWarning] : []), ...result.warnings],
    declaracion: existing ?? null,
  });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ modelo: string }> }) {
  const { modelo } = await ctx.params;
  if (!SUPPORTED.includes(modelo as Modelo)) return jsonError("Modelo no soportado", 404);

  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = SaveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  const result = await compute(modelo as Modelo, admin, parsed.data.empresa_id, parsed.data.ejercicio, parsed.data.periodo);
  const resultado =
    modelo === "111"
      ? (result.casillas as { c28?: number }).c28 ?? 0
      : modelo === "115"
        ? (result.casillas as { c28?: number }).c28 ?? 0
        : (result.casillas as { c19?: number }).c19 ?? 0;

  const { data, error } = await admin
    .from("aeat_declaraciones")
    .upsert(
      {
        empresa_id: parsed.data.empresa_id,
        gestor_id: user.id,
        modelo,
        ejercicio: parsed.data.ejercicio,
        periodo: parsed.data.periodo,
        casillas: result.casillas,
        resumen: result.resumen,
        warnings: result.warnings,
        status: parsed.data.status,
        resultado,
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
