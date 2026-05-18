/**
 * Riesgo de inspección AEAT — heurística basada en red flags que
 * típicamente disparan revisiones de Hacienda.
 *
 * IMPORTANTE: orientativo. La probabilidad real depende de muchos factores
 * (campañas anuales AEAT, denuncias, sectores foco). Esto sirve para que
 * el gestor priorice sus revisiones internas.
 *
 * Fuente: prácticas de gestoría + Plan Anual de Control Tributario AEAT.
 */

import type { createSupabaseAdmin } from "@/lib/supabase/admin";

type SupabaseAdmin = ReturnType<typeof createSupabaseAdmin>;

export type RedFlag = {
  codigo: string;
  titulo: string;
  detalle: string;
  peso: number;            // 0..30 puntos
};

export type RiesgoInspeccion = {
  empresa_id: string;
  score: number;           // 0..100
  nivel: "bajo" | "medio" | "alto" | "muy_alto";
  red_flags: RedFlag[];
  recomendaciones: string[];
  ts: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function calcularRiesgoInspeccion(
  admin: SupabaseAdmin,
  empresaId: string,
): Promise<RiesgoInspeccion> {
  const flags: RedFlag[] = [];
  const recomendaciones: string[] = [];
  const hoy = new Date();
  const year = hoy.getUTCFullYear();
  const yearPrev = year - 1;

  const { data: empresa } = await admin
    .from("empresas")
    .select("id,nombre,nif,account_type,tipo,metadata,created_at")
    .eq("id", empresaId)
    .maybeSingle();
  if (!empresa) {
    return { empresa_id: empresaId, score: 0, nivel: "bajo", red_flags: [], recomendaciones: [], ts: hoy.toISOString() };
  }

  // 1) Variación brusca de facturación YoY (>= +120% o <= -50% sugiere revisión)
  const [{ data: factActual }, { data: factPrev }] = await Promise.all([
    admin.from("facturas").select("base,tipo,fecha_emision").eq("empresa_id", empresaId).gte("fecha_emision", `${year}-01-01`).lte("fecha_emision", `${year}-12-31`).in("tipo", ["emitida", "simplificada"]),
    admin.from("facturas").select("base,tipo,fecha_emision").eq("empresa_id", empresaId).gte("fecha_emision", `${yearPrev}-01-01`).lte("fecha_emision", `${yearPrev}-12-31`).in("tipo", ["emitida", "simplificada"]),
  ]);
  const ingresosActual = (factActual ?? []).reduce((s, f) => s + Number(f.base ?? 0), 0);
  const ingresosPrev = (factPrev ?? []).reduce((s, f) => s + Number(f.base ?? 0), 0);
  if (ingresosPrev > 5000) {
    const crecimiento = (ingresosActual - ingresosPrev) / ingresosPrev;
    if (crecimiento >= 1.2) {
      flags.push({ codigo: "facturacion_explota", titulo: "Crecimiento extremo de facturación", detalle: `+${Math.round(crecimiento * 100)}% YoY (${round2(ingresosPrev)} → ${round2(ingresosActual)} €). Hacienda revisa saltos súbitos.`, peso: 20 });
      recomendaciones.push("Documenta el motivo del crecimiento (nuevos contratos, clientes grandes) y archiva los justificantes.");
    } else if (crecimiento <= -0.5) {
      flags.push({ codigo: "facturacion_caida", titulo: "Caída fuerte de facturación", detalle: `${Math.round(crecimiento * 100)}% YoY. Posible foco de inspección.`, peso: 15 });
    }
  }

  // 2) Margen muy bajo o negativo (ingresos - gastos)
  const [{ data: gastos }, { data: facturasRecibidas }] = await Promise.all([
    admin.from("gastos").select("base").eq("empresa_id", empresaId).gte("fecha", `${year}-01-01`).lte("fecha", `${year}-12-31`),
    admin.from("facturas").select("base").eq("empresa_id", empresaId).eq("tipo", "recibida").gte("fecha_emision", `${year}-01-01`).lte("fecha_emision", `${year}-12-31`),
  ]);
  const gastosTotal = (gastos ?? []).reduce((s, g) => s + Number(g.base ?? 0), 0) + (facturasRecibidas ?? []).reduce((s, f) => s + Number(f.base ?? 0), 0);
  if (ingresosActual > 10000) {
    const margenPct = ((ingresosActual - gastosTotal) / ingresosActual) * 100;
    if (margenPct < 5 && margenPct > -1000) {
      flags.push({ codigo: "margen_bajo", titulo: "Margen extremadamente bajo", detalle: `Margen del ${round2(margenPct)}% — Hacienda compara con la media del sector.`, peso: 12 });
      recomendaciones.push("Revisa que todos los ingresos estén facturados y que los gastos sean realmente afectos a la actividad.");
    }
    if (margenPct < -10) {
      flags.push({ codigo: "perdidas_recurrentes", titulo: "Pérdidas significativas", detalle: `Margen ${round2(margenPct)}%. Si se repite varios años, AEAT puede cuestionar la actividad económica.`, peso: 15 });
    }
  }

  // 3) IVA trimestral con variación brusca (cuotas)
  type Q = { mes: number; iva: number };
  const ivaQ: Q[] = [];
  for (let t = 1; t <= 4; t++) {
    const desde = `${year}-${String((t - 1) * 3 + 1).padStart(2, "0")}-01`;
    const hasta = `${year}-${String(t * 3).padStart(2, "0")}-${t === 1 ? "31" : t === 2 ? "30" : t === 3 ? "30" : "31"}`;
    const { data: fs } = await admin.from("facturas").select("iva").eq("empresa_id", empresaId).in("tipo", ["emitida", "simplificada"]).gte("fecha_emision", desde).lte("fecha_emision", hasta);
    ivaQ.push({ mes: t, iva: (fs ?? []).reduce((s, f) => s + Number(f.iva ?? 0), 0) });
  }
  for (let i = 1; i < ivaQ.length; i++) {
    if (ivaQ[i - 1].iva > 1000 && ivaQ[i].iva < ivaQ[i - 1].iva * 0.2) {
      flags.push({ codigo: "iva_brusco", titulo: `IVA del ${ivaQ[i].mes}T cae bruscamente`, detalle: `De ${round2(ivaQ[i - 1].iva)}€ a ${round2(ivaQ[i].iva)}€. Posible omisión de operaciones.`, peso: 10 });
      break;
    }
  }

  // 4) Operaciones intracomunitarias sin 349 presentado
  const { data: intracom } = await admin.from("facturas").select("id,metadata,fecha_emision").eq("empresa_id", empresaId).gte("fecha_emision", `${year}-01-01`).limit(1000);
  const intracomCount = (intracom ?? []).filter((f) => (f.metadata as Record<string, unknown> | null)?.intracomunitaria === true).length;
  if (intracomCount > 0) {
    const { data: m349 } = await admin.from("aeat_presentaciones").select("id").eq("empresa_id", empresaId).eq("modelo", "349").eq("ejercicio", year);
    if ((m349 ?? []).length === 0) {
      flags.push({ codigo: "349_pendiente", titulo: "Operaciones intracomunitarias sin 349 presentado", detalle: `${intracomCount} facturas intracom este ejercicio. El 349 es mensual o trimestral.`, peso: 18 });
      recomendaciones.push("Presenta el modelo 349 del último periodo antes de cualquier revisión.");
    }
  }

  // 5) Modelo 347 con discrepancia evidente (>3005€ con un proveedor pero no declarado)
  const { data: facturasYear } = await admin.from("facturas").select("contacto_nif,total,tipo").eq("empresa_id", empresaId).gte("fecha_emision", `${year}-01-01`).lte("fecha_emision", `${year}-12-31`);
  const porNif = new Map<string, number>();
  for (const f of facturasYear ?? []) {
    const nif = (f.contacto_nif ?? "").toUpperCase();
    if (!nif) continue;
    porNif.set(nif, (porNif.get(nif) ?? 0) + Number(f.total ?? 0));
  }
  const candidatos347 = Array.from(porNif.entries()).filter(([, v]) => v > 3005.06).length;
  const { data: m347 } = await admin.from("aeat_presentaciones").select("id").eq("empresa_id", empresaId).eq("modelo", "347").eq("ejercicio", year);
  if (candidatos347 > 0 && (m347 ?? []).length === 0 && hoy.getUTCMonth() >= 1) {
    flags.push({ codigo: "347_pendiente", titulo: `347 pendiente con ${candidatos347} terceros declarables`, detalle: "El 347 vence el 28 de febrero. Si no se presenta, sanción mínima 300€.", peso: 10 });
  }

  // 6) Modelos vencidos sin presentar (riesgo de sanción + atención AEAT)
  const { data: presentaciones } = await admin.from("aeat_presentaciones").select("modelo,ejercicio,periodo").eq("empresa_id", empresaId);
  const presentadasSet = new Set((presentaciones ?? []).map((p) => `${p.modelo}|${p.ejercicio}|${p.periodo}`));
  const obligaciones = obligacionesObligatoriasAnyo(year, empresa.tipo === "empresa" ? "empresa" : "autonomo");
  const noPresentadas = obligaciones.filter((o) => !presentadasSet.has(`${o.modelo}|${o.ejercicio}|${o.periodo}`) && new Date(o.fecha + "T00:00:00") < hoy);
  if (noPresentadas.length > 1) {
    flags.push({ codigo: "modelos_atrasados", titulo: `${noPresentadas.length} modelos AEAT vencidos sin presentar`, detalle: noPresentadas.slice(0, 3).map((o) => `${o.modelo} ${o.periodo}`).join(", "), peso: 18 });
    recomendaciones.push("Presenta cuanto antes con recargo. Un historial limpio reduce drásticamente el riesgo de revisión.");
  }

  // 7) Operaciones con paraísos fiscales
  const { data: paraisos } = await admin.from("facturas").select("metadata").eq("empresa_id", empresaId).gte("fecha_emision", `${year}-01-01`);
  const conParaisos = (paraisos ?? []).some((f) => (f.metadata as Record<string, unknown> | null)?.paraiso_fiscal === true);
  if (conParaisos) {
    flags.push({ codigo: "paraisos", titulo: "Operaciones con paraísos fiscales detectadas", detalle: "Toda operación con paraíso fiscal exige presentar 232 (>100k€ totales) o justificación específica.", peso: 25 });
  }

  // 8) Domicilio fiscal cambiante (>2 cambios en 12 meses)
  const meta = (empresa.metadata ?? {}) as Record<string, unknown>;
  const historialDomicilio = (meta.historial_domicilio as Array<{ fecha: string }> | undefined) ?? [];
  const ultimosCambios = historialDomicilio.filter((h) => new Date(h.fecha).getTime() > hoy.getTime() - 365 * 86_400_000).length;
  if (ultimosCambios > 2) {
    flags.push({ codigo: "domicilio_volatil", titulo: "Más de 2 cambios de domicilio fiscal en 12 meses", detalle: "Patrón vigilado por AEAT por riesgo de sociedades pantalla.", peso: 12 });
  }

  // Cálculo del score
  const score = Math.min(100, flags.reduce((s, f) => s + f.peso, 0));
  const nivel: RiesgoInspeccion["nivel"] = score >= 60 ? "muy_alto" : score >= 40 ? "alto" : score >= 20 ? "medio" : "bajo";

  if (nivel === "muy_alto" || nivel === "alto") {
    recomendaciones.push("Programa una revisión interna a fondo este trimestre antes de que llegue un requerimiento.");
  }
  if (flags.length === 0) {
    recomendaciones.push("Sin red flags relevantes. Buen trabajo.");
  }

  return {
    empresa_id: empresaId,
    score,
    nivel,
    red_flags: flags.sort((a, b) => b.peso - a.peso),
    recomendaciones,
    ts: hoy.toISOString(),
  };
}

function obligacionesObligatoriasAnyo(year: number, tipo: "autonomo" | "empresa"): Array<{ modelo: string; ejercicio: number; periodo: string; fecha: string }> {
  const out: Array<{ modelo: string; ejercicio: number; periodo: string; fecha: string }> = [];
  const trimestrales = [{ p: "1T", f: `${year}-04-20` }, { p: "2T", f: `${year}-07-20` }, { p: "3T", f: `${year}-10-20` }, { p: "4T", f: `${year + 1}-01-30` }];
  for (const t of trimestrales) {
    out.push({ modelo: "303", ejercicio: year, periodo: t.p, fecha: t.f });
    out.push({ modelo: "111", ejercicio: year, periodo: t.p, fecha: t.f });
    if (tipo === "autonomo") out.push({ modelo: "130", ejercicio: year, periodo: t.p, fecha: t.f });
  }
  out.push({ modelo: "390", ejercicio: year - 1, periodo: "ANUAL", fecha: `${year}-01-30` });
  if (tipo === "empresa") out.push({ modelo: "200", ejercicio: year - 1, periodo: "ANUAL", fecha: `${year}-07-25` });
  return out;
}
