import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";

const Query = z.object({
  empresa_id: z.string().uuid(),
  periodo: z.enum(["mes", "trimestre", "anyo"]).default("mes"),
  ref: z.string().regex(/^\d{4}-\d{2}$/).optional(), // ejemplo "2026-05"
});

/**
 * Comparativa de KPIs ejecutivos:
 *   actual vs periodo anterior vs mismo periodo año anterior
 * Devuelve: facturado, gastos, margen, IVA repercutido vs soportado,
 *           nº facturas, top 5 clientes/proveedores.
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("Parámetros inválidos");

  const admin = createSupabaseAdmin();
  const empresa_id = parsed.data.empresa_id;
  if (!(await canAccessLaborCompany(admin, user.id, empresa_id))) return jsonError("Sin acceso", 403);

  const ref = parsed.data.ref ?? new Date().toISOString().slice(0, 7);
  const [refYear, refMonth] = ref.split("-").map(Number);

  function rangoMes(year: number, month: number): { from: string; to: string; label: string } {
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      from: `${year}-${String(month).padStart(2, "0")}-01`,
      to: `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`,
      label: `${String(month).padStart(2, "0")}/${year}`,
    };
  }

  function rangoTrimestre(year: number, t: number): { from: string; to: string; label: string } {
    const startMonth = (t - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const last = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
    return {
      from: `${year}-${String(startMonth).padStart(2, "0")}-01`,
      to: `${year}-${String(endMonth).padStart(2, "0")}-${String(last).padStart(2, "0")}`,
      label: `${t}T ${year}`,
    };
  }

  function rangoAnyo(year: number): { from: string; to: string; label: string } {
    return { from: `${year}-01-01`, to: `${year}-12-31`, label: String(year) };
  }

  let actual: { from: string; to: string; label: string };
  let anterior: { from: string; to: string; label: string };
  let yoy: { from: string; to: string; label: string };

  if (parsed.data.periodo === "mes") {
    actual = rangoMes(refYear, refMonth);
    const prevMonth = refMonth === 1 ? 12 : refMonth - 1;
    const prevYear = refMonth === 1 ? refYear - 1 : refYear;
    anterior = rangoMes(prevYear, prevMonth);
    yoy = rangoMes(refYear - 1, refMonth);
  } else if (parsed.data.periodo === "trimestre") {
    const t = Math.ceil(refMonth / 3);
    actual = rangoTrimestre(refYear, t);
    if (t === 1) anterior = rangoTrimestre(refYear - 1, 4);
    else anterior = rangoTrimestre(refYear, t - 1);
    yoy = rangoTrimestre(refYear - 1, t);
  } else {
    actual = rangoAnyo(refYear);
    anterior = rangoAnyo(refYear - 1);
    yoy = rangoAnyo(refYear - 1);
  }

  async function metrics(rango: { from: string; to: string }) {
    const [emit, reci, gas] = await Promise.all([
      admin
        .from("facturas")
        .select("id,contacto_nombre,base,iva,total,fecha_emision")
        .eq("empresa_id", empresa_id)
        .in("tipo", ["emitida", "simplificada"])
        .gte("fecha_emision", rango.from)
        .lte("fecha_emision", rango.to),
      admin
        .from("facturas")
        .select("id,contacto_nombre,base,iva,total,fecha_emision")
        .eq("empresa_id", empresa_id)
        .eq("tipo", "recibida")
        .gte("fecha_emision", rango.from)
        .lte("fecha_emision", rango.to),
      admin
        .from("gastos")
        .select("id,proveedor,base,iva,total,fecha")
        .eq("empresa_id", empresa_id)
        .gte("fecha", rango.from)
        .lte("fecha", rango.to),
    ]);
    const facturado = (emit.data ?? []).reduce((s, f) => s + Number(f.base ?? 0), 0);
    const ivaRep = (emit.data ?? []).reduce((s, f) => s + Number(f.iva ?? 0), 0);
    const gastosTotal = (reci.data ?? []).reduce((s, f) => s + Number(f.base ?? 0), 0)
                       + (gas.data ?? []).reduce((s, g) => s + Number(g.base ?? 0), 0);
    const ivaSop = (reci.data ?? []).reduce((s, f) => s + Number(f.iva ?? 0), 0)
                 + (gas.data ?? []).reduce((s, g) => s + Number(g.iva ?? 0), 0);
    const margen = facturado - gastosTotal;
    const margenPct = facturado > 0 ? (margen / facturado) * 100 : 0;

    // Top 5 clientes / proveedores por base
    const topClientes = aggregateTop(emit.data ?? [], "contacto_nombre", "base");
    const topProveedores = aggregateTop([...(reci.data ?? []), ...(gas.data ?? []).map((g) => ({ ...g, contacto_nombre: g.proveedor }))], "contacto_nombre", "base");

    return {
      facturado: Math.round(facturado * 100) / 100,
      gastos: Math.round(gastosTotal * 100) / 100,
      iva_repercutido: Math.round(ivaRep * 100) / 100,
      iva_soportado: Math.round(ivaSop * 100) / 100,
      iva_neto: Math.round((ivaRep - ivaSop) * 100) / 100,
      margen: Math.round(margen * 100) / 100,
      margen_pct: Math.round(margenPct * 10) / 10,
      n_facturas: emit.data?.length ?? 0,
      n_recibidas: (reci.data?.length ?? 0) + (gas.data?.length ?? 0),
      top_clientes: topClientes,
      top_proveedores: topProveedores,
    };
  }

  const [mActual, mAnterior, mYoy] = await Promise.all([metrics(actual), metrics(anterior), metrics(yoy)]);

  function delta(a: number, b: number): { abs: number; pct: number | null } {
    if (b === 0) return { abs: a, pct: a > 0 ? null : 0 };
    return { abs: a - b, pct: Math.round(((a - b) / Math.abs(b)) * 1000) / 10 };
  }

  return NextResponse.json({
    ok: true,
    periodo: parsed.data.periodo,
    actual: { ...mActual, label: actual.label },
    anterior: { ...mAnterior, label: anterior.label },
    yoy: { ...mYoy, label: yoy.label },
    deltas: {
      facturado_vs_prev: delta(mActual.facturado, mAnterior.facturado),
      facturado_vs_yoy: delta(mActual.facturado, mYoy.facturado),
      gastos_vs_prev: delta(mActual.gastos, mAnterior.gastos),
      gastos_vs_yoy: delta(mActual.gastos, mYoy.gastos),
      margen_vs_prev: delta(mActual.margen, mAnterior.margen),
      margen_vs_yoy: delta(mActual.margen, mYoy.margen),
    },
  });
}

type RecordWithCN = { contacto_nombre?: string | null; base?: number | null };

function aggregateTop(rows: RecordWithCN[], keyField: "contacto_nombre", valueField: "base") {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = r[keyField] ?? "Sin nombre";
    map.set(key, (map.get(key) ?? 0) + Number(r[valueField] ?? 0));
  }
  return Array.from(map.entries())
    .map(([nombre, total]) => ({ nombre, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
}
