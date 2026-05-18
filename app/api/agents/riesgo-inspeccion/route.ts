import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";
import { calcularRiesgoInspeccion } from "@/lib/agents/inspection-risk";

const Q = z.object({ empresa_id: z.string().uuid() });

/**
 * GET /api/agents/riesgo-inspeccion?empresa_id=...
 *
 * Devuelve el score 0-100, nivel (bajo/medio/alto/muy_alto), red flags y
 * recomendaciones para reducir riesgo.
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Q.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("Parámetros inválidos");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);

  const r = await calcularRiesgoInspeccion(admin, parsed.data.empresa_id);
  return NextResponse.json({ ok: true, ...r });
}
