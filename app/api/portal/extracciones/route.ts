import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const empresaId = request.nextUrl.searchParams.get("empresa_id");
  if (!empresaId) return jsonError("Falta empresa_id");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, empresaId))) return jsonError("Sin acceso", 403);

  const { data, error } = await admin
    .from("facturas_recibidas_extracciones")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, items: data ?? [] });
}
