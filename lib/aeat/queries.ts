import type { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { FacturaInput, GastoInput } from "@/lib/aeat/calc/m303";

type SupabaseAdmin = ReturnType<typeof createSupabaseAdmin>;

export type Trimestre = "1T" | "2T" | "3T" | "4T";

export function trimestreToRange(year: number, trimestre: Trimestre): { from: string; to: string } {
  const startMonth = (Number(trimestre[0]) - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    from: `${year}-${pad(startMonth)}-01`,
    to: `${year}-${pad(endMonth)}-${pad(lastDay)}`,
  };
}

export function currentTrimestre(date = new Date()): { year: number; trimestre: Trimestre } {
  const month = date.getUTCMonth() + 1;
  const t = (Math.ceil(month / 3) as 1 | 2 | 3 | 4);
  return { year: date.getUTCFullYear(), trimestre: `${t}T` as Trimestre };
}

export async function fetchPeriodoFiscal(
  admin: SupabaseAdmin,
  empresaId: string,
  year: number,
  trimestre: Trimestre,
): Promise<{ facturas: FacturaInput[]; gastos: GastoInput[]; from: string; to: string }> {
  const { from, to } = trimestreToRange(year, trimestre);
  const [factRes, gastRes] = await Promise.all([
    admin
      .from("facturas")
      .select("id,tipo,base,iva,fecha_emision,metadata")
      .eq("empresa_id", empresaId)
      .gte("fecha_emision", from)
      .lte("fecha_emision", to),
    admin
      .from("gastos")
      .select("id,base,iva,fecha,metadata")
      .eq("empresa_id", empresaId)
      .gte("fecha", from)
      .lte("fecha", to),
  ]);
  const facturas: FacturaInput[] = (factRes.data ?? []).map((row) => ({
    id: row.id,
    tipo: row.tipo as "emitida" | "recibida" | "simplificada",
    base: Number(row.base ?? 0),
    iva: Number(row.iva ?? 0),
    fecha_emision: row.fecha_emision ?? null,
    metadata: (row.metadata ?? null) as Record<string, unknown> | null,
  }));
  const gastos: GastoInput[] = (gastRes.data ?? []).map((row) => ({
    id: row.id,
    base: Number(row.base ?? 0),
    iva: Number(row.iva ?? 0),
    fecha: row.fecha ?? null,
    metadata: (row.metadata ?? null) as Record<string, unknown> | null,
  }));
  return { facturas, gastos, from, to };
}
