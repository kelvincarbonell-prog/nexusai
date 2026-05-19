import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const { slug } = await ctx.params;
  const admin = createSupabaseAdmin();
  const { data: noticia } = await admin
    .from("noticias")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!noticia) return jsonError("Noticia no encontrada", 404);

  // Incrementa contador (best-effort)
  admin.from("noticias").update({ vista_count: (noticia.vista_count ?? 0) + 1 }).eq("id", noticia.id).then(() => {});

  return NextResponse.json({ ok: true, noticia });
}
