import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";

/**
 * Listas mínimas para alimentar los selectores de las solicitudes
 * inteligentes del portal cliente (sin exponer datos sensibles del
 * resto de empresas).
 *
 * GET ?empresa_id=...&kind=trabajadores|facturas
 *
 * Devuelve:
 *   trabajadores: [{ id, nombre, dni, activo, fecha_alta }]
 *   facturas: [{ id, numero, contacto_nombre, fecha_emision, total }]
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const sp = request.nextUrl.searchParams;
  const empresaId = sp.get("empresa_id");
  const kind = sp.get("kind");
  if (!empresaId) return jsonError("Falta empresa_id");
  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, empresaId))) return jsonError("Sin acceso", 403);

  if (kind === "trabajadores") {
    const { data } = await admin
      .from("trabajadores")
      .select("id,nombre,apellidos,dni,activo,fecha_alta")
      .eq("empresa_id", empresaId)
      .order("activo", { ascending: false })
      .order("nombre")
      .limit(500);
    return NextResponse.json({ ok: true, items: data ?? [] });
  }

  if (kind === "facturas") {
    const { data } = await admin
      .from("facturas")
      .select("id,numero,serie,contacto_nombre,fecha_emision,total,tipo,estado")
      .eq("empresa_id", empresaId)
      .in("tipo", ["emitida", "simplificada"])
      .order("fecha_emision", { ascending: false })
      .limit(200);
    return NextResponse.json({ ok: true, items: data ?? [] });
  }

  return jsonError("kind requerido: trabajadores | facturas");
}
