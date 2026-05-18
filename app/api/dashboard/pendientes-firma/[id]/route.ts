import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";

/**
 * Devuelve el contenido base64 a firmar para una entidad pendiente.
 * Reutiliza los generadores de TXT/XML existentes.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;
  const sp = request.nextUrl.searchParams;
  const kind = sp.get("kind") ?? "";
  const empresaId = sp.get("empresa_id");
  if (!empresaId) return jsonError("Falta empresa_id");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, empresaId))) return jsonError("Sin acceso", 403);

  if (kind === "modelo_aeat") {
    const { data: decl } = await admin
      .from("aeat_declaraciones")
      .select("modelo,ejercicio,periodo,casillas")
      .eq("id", id)
      .maybeSingle();
    if (!decl) return jsonError("Declaración no encontrada", 404);

    // Llama al endpoint genérico de fichero TXT y nos devuelve el contenido
    const baseUrl = `${request.nextUrl.origin}/api/aeat/${decl.modelo}/fichero?empresa_id=${empresaId}&ejercicio=${decl.ejercicio}&periodo=${decl.periodo}`;
    const auth = request.headers.get("authorization") ?? "";
    const res = await fetch(baseUrl, { headers: { Authorization: auth } });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return jsonError(j.error ?? "No se pudo generar el TXT", 500);
    }
    const txt = await res.text();
    const b64 = Buffer.from(txt, "utf-8").toString("base64");
    return NextResponse.json({
      ok: true,
      contenido_b64: b64,
      tipo_mime: "text/plain",
      sugerencia_sede: `https://www2.agenciatributaria.gob.es/wlpl/inwinvoc/es.aeat.dit.adu.eeca.catalogo.frm.LoginInicialFP?modelo=${decl.modelo}`,
    });
  }

  return jsonError(`Tipo '${kind}' aún no soporta firma directa. Usa Abrir para revisar.`);
}
