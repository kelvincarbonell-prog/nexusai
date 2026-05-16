import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";
import { generatePresupuestoPDF } from "@/lib/billing/pdf-presupuesto";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;

  const admin = createSupabaseAdmin();
  const { data: pres } = await admin.from("presupuestos").select("*").eq("id", id).single();
  if (!pres) return jsonError("Presupuesto no encontrado", 404);
  if (!(await canAccessLaborCompany(admin, user.id, pres.empresa_id))) return jsonError("Sin acceso", 403);

  const [{ data: lineas }, { data: empresa }] = await Promise.all([
    admin.from("presupuestos_lineas").select("*").eq("presupuesto_id", id).order("line_number"),
    admin.from("empresas").select("nombre,nif,metadata").eq("id", pres.empresa_id).single(),
  ]);
  if (!empresa) return jsonError("Empresa no encontrada", 404);
  const meta = (empresa.metadata ?? {}) as Record<string, unknown>;

  const bytes = await generatePresupuestoPDF({
    empresa: {
      nombre: empresa.nombre,
      nif: empresa.nif ?? undefined,
      direccion: meta.cliente_direccion as string | undefined,
      logo_url: meta.logo_url as string | undefined,
      color_primario: meta.color_primario as string | undefined,
    },
    presupuesto: pres,
    lineas: lineas ?? [],
  });

  return new NextResponse(bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pres.numero ?? id.slice(0, 8)}.pdf"`,
    },
  });
}
