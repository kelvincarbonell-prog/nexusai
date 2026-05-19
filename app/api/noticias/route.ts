import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Lista noticias (paginado + filtros). Auth requerida.
 * Params: ?categoria=fiscal&fuente=aeat&q=keyword&limit=20&offset=0
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const sp = request.nextUrl.searchParams;
  const categoria = sp.get("categoria");
  const fuente = sp.get("fuente");
  const q = sp.get("q")?.trim();
  const limit = Math.min(50, Math.max(1, Number(sp.get("limit") ?? 20)));
  const offset = Math.max(0, Number(sp.get("offset") ?? 0));

  const admin = createSupabaseAdmin();
  let query = admin
    .from("noticias")
    .select("id,slug,titulo,resumen,fuente_codigo,fuente_nombre,fuente_url,categoria,tags,importancia,fecha_publicacion,created_at", { count: "exact" })
    .order("fecha_publicacion", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (categoria) query = query.eq("categoria", categoria);
  if (fuente) query = query.eq("fuente_codigo", fuente);
  if (q) query = query.or(`titulo.ilike.%${q}%,resumen.ilike.%${q}%`);

  const { data, count } = await query;
  return NextResponse.json({ ok: true, items: data ?? [], total: count ?? 0, limit, offset });
}
