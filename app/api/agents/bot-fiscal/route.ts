import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";
import { scanEmpresa } from "@/lib/agents/bot-fiscal";

const Query = z.object({
  empresa_id: z.string().uuid(),
});

/**
 * GET /api/agents/bot-fiscal?empresa_id=...
 * Devuelve alertas proactivas priorizadas.
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("Parámetros inválidos");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) {
    return jsonError("Sin acceso", 403);
  }

  const result = await scanEmpresa(admin, parsed.data.empresa_id);
  return NextResponse.json({ ok: true, ...result });
}
