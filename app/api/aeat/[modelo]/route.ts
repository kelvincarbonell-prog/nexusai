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
import { calcular232 } from "@/lib/aeat/calc/m232";
import { calcular200, type Modelo200Input } from "@/lib/aeat/calc/m200";
import { calcular202, type Modelo202Input } from "@/lib/aeat/calc/m202";
import { calcular100, type Modelo100Input } from "@/lib/aeat/calc/m100";
import { calcular184, type Modelo184Input } from "@/lib/aeat/calc/m184";
import { calcular720, type BienExtranjero } from "@/lib/aeat/calc/m720";
import { calcular309 } from "@/lib/aeat/calc/m309";
import { calcular210 } from "@/lib/aeat/calc/m210";
import { calcular296 } from "@/lib/aeat/calc/m296";
import { calcular123 } from "@/lib/aeat/calc/m123";
import { calcular193, type DeclTrim } from "@/lib/aeat/calc/m193";
import { calcular036, calcular037, type Modelo036Input } from "@/lib/aeat/calc/m036";
import type { Casillas123 } from "@/lib/aeat/calc/m123";
import type { Casillas303 } from "@/lib/aeat/calc/m303";
import { fetchDatos111, fetchDatos115, fetchDatos130 } from "@/lib/aeat/queries-extra";
import { validateNif } from "@/lib/aeat/validators";

const SUPPORTED = ["036", "037", "100", "111", "115", "123", "130", "180", "184", "190", "193", "200", "202", "210", "232", "296", "309", "347", "349", "390", "720"] as const;
type Modelo = (typeof SUPPORTED)[number];

const QuerySchema = z.object({
  empresa_id: z.string().uuid(),
  ejercicio: z.coerce.number().int().min(2020).max(2099).optional(),
  periodo: z.enum(["1T", "2T", "3T", "4T", "ANUAL"]).optional(),
});

const M200InputSchema = z.object({
  resultado_contable: z.number().optional(),
  ajuste_aumento_permanente: z.number().min(0).optional(),
  ajuste_disminucion_permanente: z.number().min(0).optional(),
  ajuste_aumento_temporal: z.number().min(0).optional(),
  ajuste_disminucion_temporal: z.number().min(0).optional(),
  compensacion_bin: z.number().min(0).optional(),
  bin_disponible: z.number().min(0).optional(),
  tipo_gravamen: z.enum(["general", "nueva_creacion", "pyme", "otro"]).optional(),
  tipo_gravamen_custom: z.number().min(0).max(50).optional(),
  deduccion_id_i: z.number().min(0).optional(),
  deduccion_doble_imposicion: z.number().min(0).optional(),
  deduccion_donativos: z.number().min(0).optional(),
  deduccion_otras: z.number().min(0).optional(),
  retenciones_soportadas: z.number().min(0).optional(),
  pagos_fraccionados: z.number().min(0).optional(),
  cifra_negocios: z.number().min(0).optional(),
});

const M202InputSchema = z.object({
  modalidad: z.enum(["A", "B"]),
  periodo: z.enum(["1P", "2P", "3P"]),
  cuota_is_ejercicio_anterior: z.number().min(0).optional(),
  base_imponible_acumulada: z.number().optional(),
  retenciones_acumuladas: z.number().min(0).optional(),
  pagos_fraccionados_anteriores: z.number().min(0).optional(),
  cifra_negocios: z.number().min(0).optional(),
});

const SaveSchema = z.object({
  empresa_id: z.string().uuid(),
  ejercicio: z.number().int().min(2020).max(2099),
  periodo: z.enum(["1T", "2T", "3T", "4T", "ANUAL"]),
  status: z.enum(["borrador", "revisado", "presentado"]).default("borrador"),
  notas: z.string().max(2000).optional(),
  inputs_200: M200InputSchema.optional(),
  inputs_202: M202InputSchema.optional(),
  inputs_100: z.record(z.unknown()).optional(),
  inputs_184: z.record(z.unknown()).optional(),
  inputs_720: z.record(z.unknown()).optional(),
  inputs_036: z.record(z.unknown()).optional(),
});

function trimestreToPago202(periodo: "1T" | "2T" | "3T" | "4T" | "ANUAL"): "1P" | "2P" | "3P" {
  // 1P = abril → datos del 1T, 2P = octubre → datos hasta sep, 3P = diciembre → datos hasta nov.
  // El Modelo 202 NO usa 4T. Mapeamos 1T→1P, 2T/3T→2P, 4T→3P.
  if (periodo === "1T") return "1P";
  if (periodo === "4T") return "3P";
  return "2P";
}

async function autoResultadoContable(
  admin: ReturnType<typeof createSupabaseAdmin>,
  empresaId: string,
  ejercicio: number,
): Promise<number> {
  const from = `${ejercicio}-01-01`;
  const to = `${ejercicio}-12-31`;
  const [{ data: entries }, { data: lines }] = await Promise.all([
    admin
      .from("journal_entries")
      .select("id,entry_date,status")
      .eq("empresa_id", empresaId)
      .gte("entry_date", from)
      .lte("entry_date", to)
      .neq("status", "draft"),
    admin
      .from("journal_lines")
      .select("debit,credit,account_id,entry_id")
      .eq("empresa_id", empresaId),
  ]);
  const validIds = new Set((entries ?? []).map((e) => e.id));
  const accountIds = Array.from(new Set((lines ?? []).map((l) => l.account_id)));
  const { data: accounts } = await admin
    .from("pgc_accounts")
    .select("id,code")
    .in("id", accountIds);
  const codeMap = new Map((accounts ?? []).map((a) => [a.id, a.code]));

  let ingresos = 0;
  let gastos = 0;
  for (const l of lines ?? []) {
    if (!validIds.has(l.entry_id)) continue;
    const code = codeMap.get(l.account_id);
    if (!code) continue;
    const g = Number(code.charAt(0));
    const debit = Number(l.debit ?? 0);
    const credit = Number(l.credit ?? 0);
    if (g === 7) ingresos += credit - debit;       // saldo acreedor neto
    if (g === 6) gastos += debit - credit;          // saldo deudor neto
  }
  return Math.round((ingresos - gastos) * 100) / 100;
}

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
  if (modelo === "232") {
    const from = `${ejercicio}-01-01`;
    const to = `${ejercicio}-12-31`;
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
      base: Number(f.base ?? 0),
      fecha_emision: f.fecha_emision ?? null,
      metadata: f.metadata as Record<string, unknown> | null,
    }));
    const r = calcular232({ facturas });
    return {
      casillas: r.casillas as unknown as Record<string, number>,
      warnings: r.warnings,
      resumen: { operadores: r.operadores.length, paraisos: r.operadores.filter((o) => o.es_paraiso).length },
    };
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
  if (modelo === "100") {
    // Datos guardados previamente o defaults a 0
    const { data: prev } = await admin
      .from("aeat_declaraciones")
      .select("resumen")
      .eq("empresa_id", empresaId)
      .eq("modelo", "100")
      .eq("ejercicio", ejercicio)
      .maybeSingle();
    const prevInputs = ((prev?.resumen as Record<string, unknown> | undefined)?.inputs_aplicados ?? {}) as Modelo100Input;
    const inputs: Modelo100Input = { ...prevInputs, rend_trabajo: Number(prevInputs.rend_trabajo ?? 0) };
    const r = calcular100(inputs);
    return {
      casillas: r.casillas as unknown as Record<string, number>,
      warnings: r.warnings,
      resumen: { ...r.resumen, inputs_aplicados: inputs },
    };
  }
  if (modelo === "184") {
    const { data: prev } = await admin
      .from("aeat_declaraciones")
      .select("resumen")
      .eq("empresa_id", empresaId)
      .eq("modelo", "184")
      .eq("ejercicio", ejercicio)
      .maybeSingle();
    const prevInputs = ((prev?.resumen as Record<string, unknown> | undefined)?.inputs_aplicados ?? {}) as Modelo184Input;
    const inputs: Modelo184Input = {
      ...prevInputs,
      ingresos_totales: Number(prevInputs.ingresos_totales ?? 0),
      gastos_totales: Number(prevInputs.gastos_totales ?? 0),
      comuneros: Array.isArray(prevInputs.comuneros) ? prevInputs.comuneros : [],
    };
    const r = calcular184(inputs);
    return {
      casillas: r.casillas as unknown as Record<string, number>,
      warnings: r.warnings,
      resumen: { reparto: r.reparto, inputs_aplicados: inputs },
    };
  }
  if (modelo === "720") {
    const { data: prev } = await admin
      .from("aeat_declaraciones")
      .select("resumen")
      .eq("empresa_id", empresaId)
      .eq("modelo", "720")
      .eq("ejercicio", ejercicio)
      .maybeSingle();
    const prevInputs = ((prev?.resumen as Record<string, unknown> | undefined)?.inputs_aplicados ?? {}) as { bienes?: BienExtranjero[] };
    const bienes: BienExtranjero[] = prevInputs?.bienes ?? [];
    const r = calcular720({ bienes });
    return {
      casillas: r.casillas as unknown as Record<string, number>,
      warnings: r.warnings,
      resumen: { bloques: r.bloques, inputs_aplicados: { bienes } },
    };
  }
  if (modelo === "309" || modelo === "210" || modelo === "296" || modelo === "123") {
    const { data: prev } = await admin
      .from("aeat_declaraciones")
      .select("resumen,casillas")
      .eq("empresa_id", empresaId)
      .eq("modelo", modelo)
      .eq("ejercicio", ejercicio)
      .eq("periodo", periodo)
      .maybeSingle();
    const inputs = ((prev?.resumen as Record<string, unknown> | undefined)?.inputs_aplicados ?? {}) as Record<string, unknown>;
    let r;
    if (modelo === "309") r = calcular309({ base_imponible: Number(inputs.base_imponible ?? 0), iva_pct: Number(inputs.iva_pct ?? 21), retenciones_aplicadas: Number(inputs.retenciones_aplicadas ?? 0) });
    else if (modelo === "210") r = calcular210({ tipo_renta: (inputs.tipo_renta as "trabajo" | "actividades" | "dividendos" | "intereses" | "ganancias_patrimoniales" | "inmuebles" | "otros") ?? "otros", ingresos_brutos: Number(inputs.ingresos_brutos ?? 0), es_residente_ue_eee: inputs.es_residente_ue_eee !== false, gastos_deducibles: Number(inputs.gastos_deducibles ?? 0), retenciones_practicadas: Number(inputs.retenciones_practicadas ?? 0), pais_residencia: inputs.pais_residencia as string | undefined });
    else if (modelo === "296") r = calcular296({ perceptores: (inputs.perceptores as Array<{ nombre: string; nif: string; pais: string; base: number; retencion: number }>) ?? [] });
    else r = calcular123({ rentas: (inputs.rentas as Array<{ perceptor_nif: string; perceptor_nombre: string; base: number; retencion_pct?: number }>) ?? [] });
    return { casillas: r.casillas as unknown as Record<string, number>, warnings: r.warnings, resumen: { ...r.resumen, inputs_aplicados: inputs } };
  }
  if (modelo === "036" || modelo === "037") {
    const { data: prev } = await admin
      .from("aeat_declaraciones")
      .select("resumen")
      .eq("empresa_id", empresaId)
      .eq("modelo", modelo)
      .eq("ejercicio", ejercicio)
      .maybeSingle();
    const prevInputs = ((prev?.resumen as Record<string, unknown> | undefined)?.inputs_aplicados ?? {}) as Modelo036Input;
    const { data: emp } = await admin.from("empresas").select("nombre,nif").eq("id", empresaId).maybeSingle();
    const inputs: Modelo036Input = {
      causa: prevInputs.causa ?? "alta",
      motivos_modificacion: prevInputs.motivos_modificacion ?? [],
      fecha_efectos: prevInputs.fecha_efectos ?? new Date().toISOString().slice(0, 10),
      nif: prevInputs.nif ?? emp?.nif ?? "",
      apellidos_razon: prevInputs.apellidos_razon ?? emp?.nombre ?? "",
      nombre: prevInputs.nombre,
      forma_juridica: prevInputs.forma_juridica,
      fecha_constitucion: prevInputs.fecha_constitucion,
      domicilio_fiscal: prevInputs.domicilio_fiscal,
      cp: prevInputs.cp,
      municipio: prevInputs.municipio,
      provincia: prevInputs.provincia,
      telefono: prevInputs.telefono,
      email: prevInputs.email,
      iaes: prevInputs.iaes ?? [],
      regimen_iva: prevInputs.regimen_iva,
      inicio_iva: prevInputs.inicio_iva,
      regimen_irpf: prevInputs.regimen_irpf,
      inicio_irpf: prevInputs.inicio_irpf,
      obligado_retener: prevInputs.obligado_retener,
      locales: prevInputs.locales ?? [],
      alta_roi: prevInputs.alta_roi,
    };
    const r = modelo === "036" ? calcular036(inputs) : calcular037(inputs);
    return {
      casillas: r.casillas as unknown as Record<string, number>,
      warnings: r.warnings,
      resumen: { ...r.resumen, inputs_aplicados: inputs },
    };
  }
  if (modelo === "193") {
    const { data } = await admin
      .from("aeat_declaraciones")
      .select("modelo,ejercicio,periodo,status,casillas")
      .eq("empresa_id", empresaId)
      .eq("modelo", "123")
      .eq("ejercicio", ejercicio);
    const decls: DeclTrim[] = (data ?? []).map((d) => ({
      modelo: d.modelo,
      ejercicio: d.ejercicio,
      periodo: d.periodo,
      status: d.status,
      casillas: d.casillas as Casillas123,
    }));
    const r = calcular193({ declaraciones123: decls });
    return { casillas: r.casillas as unknown as Record<string, number>, warnings: r.warnings, resumen: r.resumen };
  }
  throw new Error("Modelo no soportado");
}

async function compute202(
  admin: ReturnType<typeof createSupabaseAdmin>,
  empresaId: string,
  ejercicio: number,
  periodoTrim: "1T" | "2T" | "3T" | "4T" | "ANUAL",
  inputs: Modelo202Input,
): Promise<{ casillas: Record<string, number>; warnings: string[]; resumen: Record<string, unknown> }> {
  const pagoPeriodo: "1P" | "2P" | "3P" = inputs.periodo ?? trimestreToPago202(periodoTrim);

  // Auto-completar cifra de negocios desde facturas emitidas del ejercicio anterior
  let cifra = inputs.cifra_negocios;
  if (cifra == null) {
    const prevYear = ejercicio - 1;
    const { data: emit } = await admin
      .from("facturas")
      .select("base")
      .eq("empresa_id", empresaId)
      .in("tipo", ["emitida", "simplificada"])
      .gte("fecha_emision", `${prevYear}-01-01`)
      .lte("fecha_emision", `${prevYear}-12-31`);
    cifra = (emit ?? []).reduce((s, f) => s + Number(f.base ?? 0), 0);
  }

  let cuotaIsAnterior = inputs.cuota_is_ejercicio_anterior;
  if (inputs.modalidad === "A" && cuotaIsAnterior == null) {
    const { data: m200 } = await admin
      .from("aeat_declaraciones")
      .select("casillas")
      .eq("empresa_id", empresaId)
      .eq("modelo", "200")
      .eq("ejercicio", ejercicio - 1)
      .maybeSingle();
    const c599 = (m200?.casillas as { c599?: number } | undefined)?.c599 ?? 0;
    cuotaIsAnterior = Math.max(0, Number(c599));
  }

  // Para modalidad B: BI acumulada y pagos fraccionados anteriores (1P/2P ya presentados)
  let biAcumulada = inputs.base_imponible_acumulada;
  if (inputs.modalidad === "B" && biAcumulada == null) {
    const hastaMes = pagoPeriodo === "1P" ? 3 : pagoPeriodo === "2P" ? 9 : 11;
    const from = `${ejercicio}-01-01`;
    const to = `${ejercicio}-${String(hastaMes).padStart(2, "0")}-${hastaMes === 9 ? 30 : hastaMes === 11 ? 30 : 31}`;
    // Aproximación: resultado contable acumulado del periodo. Usa journal entries del año.
    const [{ data: entries }, { data: lines }] = await Promise.all([
      admin.from("journal_entries").select("id,entry_date,status").eq("empresa_id", empresaId).gte("entry_date", from).lte("entry_date", to).neq("status", "draft"),
      admin.from("journal_lines").select("debit,credit,account_id,entry_id").eq("empresa_id", empresaId),
    ]);
    const validIds = new Set((entries ?? []).map((e) => e.id));
    const accountIds = Array.from(new Set((lines ?? []).map((l) => l.account_id)));
    const { data: accounts } = await admin.from("pgc_accounts").select("id,code").in("id", accountIds);
    const codeMap = new Map((accounts ?? []).map((a) => [a.id, a.code]));
    let ingresos = 0;
    let gastos = 0;
    for (const l of lines ?? []) {
      if (!validIds.has(l.entry_id)) continue;
      const code = codeMap.get(l.account_id);
      if (!code) continue;
      const g = Number(code.charAt(0));
      const debit = Number(l.debit ?? 0);
      const credit = Number(l.credit ?? 0);
      if (g === 7) ingresos += credit - debit;
      if (g === 6) gastos += debit - credit;
    }
    biAcumulada = Math.round((ingresos - gastos) * 100) / 100;
  }

  let pagosAnteriores = inputs.pagos_fraccionados_anteriores;
  if (inputs.modalidad === "B" && pagosAnteriores == null && pagoPeriodo !== "1P") {
    const previos = pagoPeriodo === "2P" ? ["1P"] : ["1P", "2P"];
    const trimMap: Record<string, "1T" | "2T" | "4T"> = { "1P": "1T", "2P": "2T", "3P": "4T" };
    const trimPrevios = previos.map((p) => trimMap[p]);
    const { data: m202prev } = await admin
      .from("aeat_declaraciones")
      .select("casillas")
      .eq("empresa_id", empresaId)
      .eq("modelo", "202")
      .eq("ejercicio", ejercicio)
      .in("periodo", trimPrevios);
    pagosAnteriores = (m202prev ?? []).reduce((s, d) => s + Math.max(0, Number((d.casillas as { c14?: number } | undefined)?.c14 ?? 0)), 0);
  }

  const r = calcular202({
    modalidad: inputs.modalidad,
    periodo: pagoPeriodo,
    cuota_is_ejercicio_anterior: cuotaIsAnterior,
    base_imponible_acumulada: biAcumulada,
    retenciones_acumuladas: inputs.retenciones_acumuladas,
    pagos_fraccionados_anteriores: pagosAnteriores,
    cifra_negocios: cifra,
  });

  return {
    casillas: r.casillas as unknown as Record<string, number>,
    warnings: r.warnings,
    resumen: {
      modalidad: r.modalidad,
      pago_periodo: pagoPeriodo,
      inputs_aplicados: {
        modalidad: inputs.modalidad,
        periodo: pagoPeriodo,
        cuota_is_ejercicio_anterior: cuotaIsAnterior,
        base_imponible_acumulada: biAcumulada,
        retenciones_acumuladas: inputs.retenciones_acumuladas ?? 0,
        pagos_fraccionados_anteriores: pagosAnteriores ?? 0,
        cifra_negocios: cifra,
      },
    },
  };
}

async function compute200(
  admin: ReturnType<typeof createSupabaseAdmin>,
  empresaId: string,
  ejercicio: number,
  inputs: Modelo200Input,
): Promise<{ casillas: Record<string, number>; warnings: string[]; resumen: Record<string, unknown> }> {
  // Auto-completa lo que no venga en inputs leyendo el sistema
  let resultadoContable = inputs.resultado_contable;
  if (resultadoContable == null) {
    resultadoContable = await autoResultadoContable(admin, empresaId, ejercicio);
  }

  // Retenciones soportadas: sumar facturas recibidas con metadata.retencion_irpf
  let retencionesSoportadas = inputs.retenciones_soportadas;
  if (retencionesSoportadas == null) {
    const { data: rec } = await admin
      .from("facturas")
      .select("metadata")
      .eq("empresa_id", empresaId)
      .eq("tipo", "recibida")
      .gte("fecha_emision", `${ejercicio}-01-01`)
      .lte("fecha_emision", `${ejercicio}-12-31`);
    retencionesSoportadas = (rec ?? []).reduce((s, f) => {
      const m = (f.metadata ?? {}) as Record<string, unknown>;
      return s + Number(m.retencion_irpf ?? 0);
    }, 0);
  }

  // Pagos fraccionados 202 ya guardados
  let pagosFracc = inputs.pagos_fraccionados;
  if (pagosFracc == null) {
    const { data: m202 } = await admin
      .from("aeat_declaraciones")
      .select("resultado")
      .eq("empresa_id", empresaId)
      .eq("modelo", "202")
      .eq("ejercicio", ejercicio)
      .in("status", ["presentado", "revisado"]);
    pagosFracc = (m202 ?? []).reduce((s, d) => s + Math.max(0, Number(d.resultado ?? 0)), 0);
  }

  // Cifra de negocios: si no se da, suma facturas emitidas
  let cifraNegocios = inputs.cifra_negocios;
  if (cifraNegocios == null) {
    const { data: emit } = await admin
      .from("facturas")
      .select("base")
      .eq("empresa_id", empresaId)
      .in("tipo", ["emitida", "simplificada"])
      .gte("fecha_emision", `${ejercicio}-01-01`)
      .lte("fecha_emision", `${ejercicio}-12-31`);
    cifraNegocios = (emit ?? []).reduce((s, f) => s + Number(f.base ?? 0), 0);
  }

  const r = calcular200({
    ...inputs,
    resultado_contable: resultadoContable,
    retenciones_soportadas: retencionesSoportadas,
    pagos_fraccionados: pagosFracc,
    cifra_negocios: cifraNegocios,
  });

  return {
    casillas: r.casillas as unknown as Record<string, number>,
    warnings: r.warnings,
    resumen: { ...r.resumen, inputs_aplicados: { resultado_contable: resultadoContable, retenciones_soportadas: retencionesSoportadas, pagos_fraccionados: pagosFracc, cifra_negocios: cifraNegocios } },
  };
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
  const anualModels = ["100", "184", "190", "193", "200", "232", "296", "347", "390", "720"] as const;
  const periodo = (anualModels.includes(modelo as "100" | "184" | "190" | "193" | "200" | "232" | "296" | "347" | "390" | "720")
    ? "ANUAL"
    : (parsed.data.periodo ?? trimestre)) as Trimestre | "ANUAL";

  const { data: empresa } = await admin
    .from("empresas")
    .select("id,nombre,nif")
    .eq("id", parsed.data.empresa_id)
    .single();

  let result;
  if (modelo === "200") {
    // Cargar inputs guardados si existen
    const { data: prev } = await admin
      .from("aeat_declaraciones")
      .select("resumen")
      .eq("empresa_id", parsed.data.empresa_id)
      .eq("modelo", "200")
      .eq("ejercicio", ejercicio)
      .maybeSingle();
    const prevInputs = ((prev?.resumen as Record<string, unknown> | undefined)?.inputs_aplicados ?? {}) as Modelo200Input;
    result = await compute200(admin, parsed.data.empresa_id, ejercicio, prevInputs);
  } else if (modelo === "202") {
    const { data: prev } = await admin
      .from("aeat_declaraciones")
      .select("resumen")
      .eq("empresa_id", parsed.data.empresa_id)
      .eq("modelo", "202")
      .eq("ejercicio", ejercicio)
      .eq("periodo", periodo)
      .maybeSingle();
    const prevInputs = ((prev?.resumen as Record<string, unknown> | undefined)?.inputs_aplicados ?? {}) as Partial<Modelo202Input>;
    const inputs: Modelo202Input = {
      modalidad: (prevInputs.modalidad as "A" | "B") ?? "A",
      periodo: (prevInputs.periodo as "1P" | "2P" | "3P") ?? trimestreToPago202(periodo as "1T" | "2T" | "3T" | "4T" | "ANUAL"),
      cuota_is_ejercicio_anterior: prevInputs.cuota_is_ejercicio_anterior,
      base_imponible_acumulada: prevInputs.base_imponible_acumulada,
      retenciones_acumuladas: prevInputs.retenciones_acumuladas,
      pagos_fraccionados_anteriores: prevInputs.pagos_fraccionados_anteriores,
      cifra_negocios: prevInputs.cifra_negocios,
    };
    result = await compute202(admin, parsed.data.empresa_id, ejercicio, periodo as "1T" | "2T" | "3T" | "4T" | "ANUAL", inputs);
  } else {
    result = await compute(modelo as Modelo, admin, parsed.data.empresa_id, ejercicio, periodo);
  }
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

  let result;
  if (modelo === "200") {
    result = await compute200(admin, parsed.data.empresa_id, parsed.data.ejercicio, parsed.data.inputs_200 ?? {});
  } else if (modelo === "202") {
    const inputs: Modelo202Input = parsed.data.inputs_202 ?? {
      modalidad: "A",
      periodo: trimestreToPago202(parsed.data.periodo),
    };
    result = await compute202(admin, parsed.data.empresa_id, parsed.data.ejercicio, parsed.data.periodo, inputs);
  } else if (modelo === "100" && parsed.data.inputs_100) {
    const r = calcular100(parsed.data.inputs_100 as unknown as Modelo100Input);
    result = { casillas: r.casillas as unknown as Record<string, number>, warnings: r.warnings, resumen: { ...r.resumen, inputs_aplicados: parsed.data.inputs_100 } };
  } else if (modelo === "184" && parsed.data.inputs_184) {
    const r = calcular184(parsed.data.inputs_184 as unknown as Modelo184Input);
    result = { casillas: r.casillas as unknown as Record<string, number>, warnings: r.warnings, resumen: { reparto: r.reparto, inputs_aplicados: parsed.data.inputs_184 } };
  } else if (modelo === "720" && parsed.data.inputs_720) {
    const inputsObj = parsed.data.inputs_720 as { bienes?: BienExtranjero[] };
    const r = calcular720({ bienes: inputsObj.bienes ?? [] });
    result = { casillas: r.casillas as unknown as Record<string, number>, warnings: r.warnings, resumen: { bloques: r.bloques, inputs_aplicados: parsed.data.inputs_720 } };
  } else if ((modelo === "036" || modelo === "037") && parsed.data.inputs_036) {
    const inputs = parsed.data.inputs_036 as unknown as Modelo036Input;
    const r = modelo === "036" ? calcular036(inputs) : calcular037(inputs);
    result = { casillas: r.casillas as unknown as Record<string, number>, warnings: r.warnings, resumen: { ...r.resumen, inputs_aplicados: parsed.data.inputs_036 } };
  } else {
    result = await compute(modelo as Modelo, admin, parsed.data.empresa_id, parsed.data.ejercicio, parsed.data.periodo);
  }
  const resultado =
    modelo === "200" ? (result.casillas as { c599?: number }).c599 ?? 0
    : modelo === "202" ? (result.casillas as { c14?: number }).c14 ?? 0
    : modelo === "100" ? (result.casillas as { c0670?: number }).c0670 ?? 0
    : modelo === "184" ? 0
    : modelo === "720" ? 0
    : modelo === "111" ? (result.casillas as { c28?: number }).c28 ?? 0
    : modelo === "115" ? (result.casillas as { c28?: number }).c28 ?? 0
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
