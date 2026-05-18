import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";
import { CONVENIOS } from "@/lib/laboral/convenios";

/**
 * Sugerencias inteligentes para el laboralista:
 *   - convenio_para_cnae: dado el CNAE de la empresa, devuelve el convenio
 *     más probable.
 *   - puesto_para_convenio: dado un convenio, sugiere categorías más comunes.
 *   - irpf_estimado: dado bruto + hijos + ascendientes, devuelve % IRPF.
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const sp = request.nextUrl.searchParams;
  const kind = sp.get("kind");
  const empresaId = sp.get("empresa_id");
  if (!empresaId) return jsonError("Falta empresa_id");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, empresaId))) return jsonError("Sin acceso", 403);

  if (kind === "convenio_para_cnae") {
    const { data: empresa } = await admin.from("empresas").select("cnae").eq("id", empresaId).maybeSingle();
    const cnae = (sp.get("cnae") ?? empresa?.cnae ?? "").toString().padStart(2, "0").slice(0, 2);
    if (!cnae || cnae === "00") {
      return NextResponse.json({ ok: true, sugeridos: [], razon: "Empresa sin CNAE configurado." });
    }
    const sugeridos = CONVENIOS
      .map((c) => ({
        codigo: c.codigo,
        nombre: c.nombre,
        cnae: c.cnae ?? "",
        score: (c.cnae ?? "") === cnae ? 100 : (c.cnae ?? "").startsWith(cnae[0]) ? 40 : 0,
      }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    return NextResponse.json({ ok: true, cnae, sugeridos });
  }

  if (kind === "irpf_estimado") {
    const bruto = Number(sp.get("bruto") ?? 0);
    const hijos = Number(sp.get("hijos") ?? 0);
    if (bruto <= 0) return jsonError("Bruto requerido");
    const { calcularIrpfPct } = await import("@/lib/laboral/payroll/calc");
    const pct = calcularIrpfPct(bruto, { hijos });
    return NextResponse.json({ ok: true, bruto, hijos, irpf_pct: pct });
  }

  return jsonError("kind no reconocido");
}
