import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { CONVENIOS, buscarConvenios, getConvenio } from "@/lib/laboral/convenios";

/**
 * GET /api/laboral/convenios            → todos
 * GET /api/laboral/convenios?q=metal    → búsqueda
 * GET /api/laboral/convenios?codigo=X   → detalle de un convenio
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const codigo = request.nextUrl.searchParams.get("codigo");
  if (codigo) {
    const c = getConvenio(codigo);
    if (!c) return jsonError("Convenio no encontrado", 404);
    return NextResponse.json({ ok: true, convenio: c });
  }

  const q = request.nextUrl.searchParams.get("q") ?? "";
  const items = q ? buscarConvenios(q) : CONVENIOS;
  return NextResponse.json({ ok: true, items, total: items.length });
}
