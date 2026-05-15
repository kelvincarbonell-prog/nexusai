import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";
import { buildCalendar } from "@/lib/aeat/calendar";

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const empresaId = request.nextUrl.searchParams.get("empresa_id");
  if (!empresaId) return jsonError("Falta empresa_id");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, empresaId))) return jsonError("Sin acceso", 403);

  const [{ data: empresa }, { data: declaraciones }] = await Promise.all([
    admin.from("empresas").select("account_type").eq("id", empresaId).single(),
    admin
      .from("aeat_declaraciones")
      .select("modelo,ejercicio,periodo,status")
      .eq("empresa_id", empresaId)
      .in("status", ["presentado", "revisado"]),
  ]);

  const obligaciones = buildCalendar({
    empresaTipo: (empresa?.account_type === "autonomo" ? "autonomo" : "empresa") as "autonomo" | "empresa",
    presentadas: (declaraciones ?? []).map((d) => ({ modelo: d.modelo, ejercicio: d.ejercicio, periodo: d.periodo })),
  });

  return NextResponse.json({ ok: true, obligaciones });
}
