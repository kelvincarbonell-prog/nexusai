import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";

/**
 * Detector de facturas duplicadas:
 *  - Mismo contacto_nombre normalizado + mismo importe ±0.50 € + fecha cercana (±15 días)
 *  - O mismo número de factura
 *  - O mismo importe exacto en la misma fecha de emisión
 */

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const empresaId = request.nextUrl.searchParams.get("empresa_id");
  if (!empresaId) return jsonError("Falta empresa_id");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, empresaId))) return jsonError("Sin acceso", 403);

  const { data: facturas } = await admin
    .from("facturas")
    .select("id,numero,contacto_nombre,fecha_emision,total,tipo")
    .eq("empresa_id", empresaId)
    .order("fecha_emision", { ascending: false })
    .limit(1000);

  const grupos: Array<{ tipo: string; razon: string; ids: string[]; nombres: string[]; importes: number[] }> = [];

  // 1. Por número exacto
  const porNumero = new Map<string, typeof facturas>();
  for (const f of facturas ?? []) {
    if (!f.numero) continue;
    const key = `${f.tipo}|${f.numero.trim().toUpperCase()}`;
    const prev = porNumero.get(key) ?? [];
    prev.push(f);
    porNumero.set(key, prev);
  }
  for (const [key, lista] of porNumero.entries()) {
    if (!lista || lista.length < 2) continue;
    grupos.push({
      tipo: "numero_repetido",
      razon: `Número de factura repetido: ${key.split("|")[1]}`,
      ids: lista.map((f) => f.id),
      nombres: lista.map((f) => f.contacto_nombre ?? "?"),
      importes: lista.map((f) => Number(f.total ?? 0)),
    });
  }

  // 2. Por contacto + importe ±0.50 + fecha ±15 días
  const procesados = new Set<string>();
  for (let i = 0; i < (facturas ?? []).length; i++) {
    const f = (facturas ?? [])[i];
    if (procesados.has(f.id)) continue;
    const candidatos: typeof facturas = [f];
    for (let j = i + 1; j < (facturas ?? []).length; j++) {
      const g = (facturas ?? [])[j];
      if (procesados.has(g.id)) continue;
      if (!f.contacto_nombre || !g.contacto_nombre) continue;
      if (f.contacto_nombre.toLowerCase().trim() !== g.contacto_nombre.toLowerCase().trim()) continue;
      if (Math.abs(Number(f.total) - Number(g.total)) > 0.5) continue;
      if (!f.fecha_emision || !g.fecha_emision) continue;
      const d1 = new Date(f.fecha_emision + "T00:00:00").getTime();
      const d2 = new Date(g.fecha_emision + "T00:00:00").getTime();
      if (Math.abs(d1 - d2) > 15 * 86_400_000) continue;
      candidatos.push(g);
    }
    if (candidatos.length >= 2) {
      candidatos.forEach((c) => procesados.add(c.id));
      grupos.push({
        tipo: "posible_duplicado",
        razon: `${candidatos.length} facturas de ${f.contacto_nombre} por ~${Number(f.total).toFixed(2)} € en ±15 días`,
        ids: candidatos.map((c) => c.id),
        nombres: candidatos.map((c) => c.contacto_nombre ?? "?"),
        importes: candidatos.map((c) => Number(c.total ?? 0)),
      });
    }
  }

  return NextResponse.json({ ok: true, duplicados: grupos, total_grupos: grupos.length });
}
