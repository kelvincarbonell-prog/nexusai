import type { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { Trimestre } from "@/lib/aeat/queries";
import { trimestreToRange } from "@/lib/aeat/queries";
import type { NominaInput, FacturaProfesionalInput } from "@/lib/aeat/calc/m111";
import type { GastoAlquilerInput } from "@/lib/aeat/calc/m115";
import type { FacturaInput as F130, GastoInput as G130 } from "@/lib/aeat/calc/m130";

type SupabaseAdmin = ReturnType<typeof createSupabaseAdmin>;

export async function fetchDatos111(
  admin: SupabaseAdmin,
  empresaId: string,
  year: number,
  trimestre: Trimestre,
): Promise<{ nominas: NominaInput[]; facturasProfesionales: FacturaProfesionalInput[] }> {
  const { from, to } = trimestreToRange(year, trimestre);
  const startMonth = from.slice(0, 7);
  const endMonth = to.slice(0, 7);
  const [nomRes, factRes] = await Promise.all([
    admin
      .from("nominas")
      .select("id,trabajador_id,periodo,total,metadata")
      .eq("empresa_id", empresaId)
      .gte("periodo", startMonth)
      .lte("periodo", endMonth),
    admin
      .from("facturas")
      .select("id,base,iva,fecha_emision,metadata")
      .eq("empresa_id", empresaId)
      .eq("tipo", "recibida")
      .gte("fecha_emision", from)
      .lte("fecha_emision", to),
  ]);
  const nominas: NominaInput[] = (nomRes.data ?? []).map((r) => ({
    id: r.id,
    trabajador_id: r.trabajador_id,
    periodo: r.periodo,
    total: Number(r.total ?? 0),
    metadata: r.metadata as { base_irpf?: number; irpf_retenido?: number } | null,
  }));
  const facturasProfesionales: FacturaProfesionalInput[] = (factRes.data ?? [])
    .filter((r) => {
      const m = (r.metadata ?? {}) as Record<string, unknown>;
      return Boolean(m.es_profesional) || Boolean(m.retencion_irpf) || Boolean(m.retencion_pct);
    })
    .map((r) => {
      const m = (r.metadata ?? {}) as Record<string, unknown>;
      return {
        id: r.id,
        base: Number(r.base ?? 0),
        irpf: typeof m.retencion_irpf === "number" ? (m.retencion_irpf as number) : undefined,
        irpf_pct: typeof m.retencion_pct === "number" ? (m.retencion_pct as number) : undefined,
        fecha_emision: r.fecha_emision,
        metadata: m,
      };
    });
  return { nominas, facturasProfesionales };
}

export async function fetchDatos115(
  admin: SupabaseAdmin,
  empresaId: string,
  year: number,
  trimestre: Trimestre,
): Promise<GastoAlquilerInput[]> {
  const { from, to } = trimestreToRange(year, trimestre);
  const { data } = await admin
    .from("gastos")
    .select("id,proveedor,base,fecha,metadata,concepto")
    .eq("empresa_id", empresaId)
    .gte("fecha", from)
    .lte("fecha", to);
  return (data ?? [])
    .filter((g) => {
      const m = (g.metadata ?? {}) as Record<string, unknown>;
      const cuenta = String(m.cuenta_pgc ?? "");
      const isAlquiler =
        cuenta.startsWith("621") ||
        Boolean(m.es_alquiler) ||
        (g.concepto ?? "").toLowerCase().includes("alquiler") ||
        (g.concepto ?? "").toLowerCase().includes("arrendamiento");
      return isAlquiler;
    })
    .map((g) => ({
      id: g.id,
      proveedor: g.proveedor ?? null,
      base: Number(g.base ?? 0),
      fecha: g.fecha,
      metadata: (g.metadata ?? null) as Record<string, unknown> | null,
    }));
}

export async function fetchDatos130(
  admin: SupabaseAdmin,
  empresaId: string,
  year: number,
  trimestre: Trimestre,
): Promise<{ facturas: F130[]; gastos: G130[]; pagosAnteriores: number }> {
  // 130 es acumulado del ejercicio hasta el final del trimestre actual
  const endMonth = Number(trimestre[0]) * 3;
  const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
  const from = `${year}-01-01`;
  const to = `${year}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const [factRes, gastRes, pagosRes] = await Promise.all([
    admin
      .from("facturas")
      .select("id,tipo,base,fecha_emision,metadata")
      .eq("empresa_id", empresaId)
      .gte("fecha_emision", from)
      .lte("fecha_emision", to),
    admin
      .from("gastos")
      .select("id,base,fecha")
      .eq("empresa_id", empresaId)
      .gte("fecha", from)
      .lte("fecha", to),
    admin
      .from("aeat_declaraciones")
      .select("resultado,periodo")
      .eq("empresa_id", empresaId)
      .eq("modelo", "130")
      .eq("ejercicio", year)
      .neq("periodo", trimestre)
      .in("status", ["presentado", "revisado"]),
  ]);
  const facturas: F130[] = (factRes.data ?? []).map((r) => {
    const m = (r.metadata ?? {}) as Record<string, unknown>;
    return {
      id: r.id,
      tipo: r.tipo as "emitida" | "recibida" | "simplificada",
      base: Number(r.base ?? 0),
      irpf: typeof m.retencion_irpf === "number" ? (m.retencion_irpf as number) : undefined,
      fecha_emision: r.fecha_emision,
    };
  });
  const gastos: G130[] = (gastRes.data ?? []).map((r) => ({
    id: r.id,
    base: Number(r.base ?? 0),
    fecha: r.fecha,
  }));
  const pagosAnteriores = (pagosRes.data ?? [])
    .map((d) => Number(d.resultado ?? 0))
    .filter((n) => n > 0)
    .reduce((s, n) => s + n, 0);
  return { facturas, gastos, pagosAnteriores };
}
