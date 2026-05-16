import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { diasLaborablesAno, diasLaborablesMes, festivosDe } from "@/lib/laboral/calendar";

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const params = request.nextUrl.searchParams;
  const year = Number(params.get("ejercicio") ?? new Date().getUTCFullYear());
  const month = params.get("mes") ? Number(params.get("mes")) : null;
  const ccaa = params.get("ccaa") ?? undefined;

  const festivos = festivosDe(year, ccaa);

  if (month) {
    return NextResponse.json({
      ok: true,
      ejercicio: year,
      mes: month,
      ccaa,
      dias_laborables: diasLaborablesMes(year, month, ccaa),
      festivos: festivos.filter((f) => f.startsWith(`${year}-${String(month).padStart(2, "0")}`)),
    });
  }

  const porMes = Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    dias_laborables: diasLaborablesMes(year, i + 1, ccaa),
  }));

  return NextResponse.json({
    ok: true,
    ejercicio: year,
    ccaa,
    dias_laborables_ano: diasLaborablesAno(year, ccaa),
    festivos,
    por_mes: porMes,
  });
}
