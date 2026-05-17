import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";

/**
 * Marca como leídos todos los mensajes de la empresa cuyo remitente no soy yo.
 */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ empresa_id: string }> }) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const { empresa_id } = await ctx.params;
  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, empresa_id))) return jsonError("Sin acceso", 403);

  const { error } = await admin
    .from("mensajes")
    .update({ leido: true, fecha_lectura: new Date().toISOString() })
    .eq("empresa_id", empresa_id)
    .neq("remitente_id", user.id)
    .eq("leido", false);
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}
