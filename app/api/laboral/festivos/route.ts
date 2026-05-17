import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { festivosAnyo, CCAAS, diasLaborables } from "@/lib/laboral/festivos";

/**
 * GET /api/laboral/festivos?anyo=2026&ccaa=ES-MD
 *   → festivos nacionales + autonómicos
 *
 * GET /api/laboral/festivos?from=2026-01-01&to=2026-12-31&ccaa=ES-MD
 *   → días laborables en el rango (cuenta vacaciones, contratos, etc.)
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const sp = request.nextUrl.searchParams;
  const ccaa = sp.get("ccaa") ?? undefined;
  const from = sp.get("from");
  const to = sp.get("to");

  if (from && to) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return jsonError("from/to deben ser YYYY-MM-DD");
    }
    const total = diasLaborables(from, to, ccaa);
    return NextResponse.json(
      { ok: true, from, to, ccaa, dias_laborables: total },
      { headers: { "cache-control": "private, max-age=3600, stale-while-revalidate=86400" } },
    );
  }

  const anyo = Number(sp.get("anyo") ?? new Date().getUTCFullYear());
  const items = festivosAnyo(anyo, ccaa);
  return NextResponse.json(
    { ok: true, anyo, ccaa: ccaa ?? null, ccaas_disponibles: CCAAS, items, total: items.length },
    { headers: { "cache-control": "private, max-age=3600, stale-while-revalidate=86400" } },
  );
}
