import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Lista los asesores/gestores disponibles en la plataforma (rol = admin | gestor | asesor).
 * Necesario para el dropdown de asignación de asesor en clientes.
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const admin = createSupabaseAdmin();
  const { data: profile } = await admin.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  const isAdmin = profile?.rol === "admin";

  // Si es gestor: devuelve a sí mismo + cualquier otro gestor del mismo nombre_gestoria
  // Si es admin: devuelve todos los gestores
  if (isAdmin) {
    const { data } = await admin
      .from("perfiles")
      .select("id,nombre,email,rol")
      .in("rol", ["admin", "gestor", "asesor"])
      .order("nombre");
    return NextResponse.json({ ok: true, asesores: data ?? [] });
  }

  const { data: self } = await admin.from("perfiles").select("id,nombre,email,rol,nombre_gestoria").eq("id", user.id).maybeSingle();
  if (!self?.nombre_gestoria) {
    return NextResponse.json({ ok: true, asesores: self ? [self] : [] });
  }
  const { data } = await admin
    .from("perfiles")
    .select("id,nombre,email,rol")
    .eq("nombre_gestoria", self.nombre_gestoria)
    .in("rol", ["admin", "gestor", "asesor"]);
  return NextResponse.json({ ok: true, asesores: data ?? [] });
}
