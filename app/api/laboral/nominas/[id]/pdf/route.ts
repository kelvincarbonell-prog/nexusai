import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";
import { generatePayrollPDF } from "@/lib/laboral/payroll/pdf";
import type { ConceptoLinea, NominaResult } from "@/lib/laboral/payroll/calc";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;

  const admin = createSupabaseAdmin();
  const { data: nomina } = await admin
    .from("nominas")
    .select("id,empresa_id,trabajador_id,periodo,total,metadata")
    .eq("id", id)
    .single();
  if (!nomina) return jsonError("Nómina no encontrada", 404);
  if (!(await canAccessLaborCompany(admin, user.id, nomina.empresa_id))) return jsonError("Sin acceso", 403);

  const [{ data: empresa }, { data: trabajador }] = await Promise.all([
    admin.from("empresas").select("nombre,nif,metadata").eq("id", nomina.empresa_id).single(),
    nomina.trabajador_id
      ? admin.from("trabajadores").select("nombre,dni,nss,puesto").eq("id", nomina.trabajador_id).single()
      : Promise.resolve({ data: null as { nombre: string; dni?: string; nss?: string; puesto?: string } | null }),
  ]);
  if (!empresa) return jsonError("Empresa no encontrada", 404);

  const meta = (nomina.metadata ?? {}) as Partial<NominaResult> & { conceptos?: ConceptoLinea[]; base_extras?: number };
  if (!meta.conceptos || !meta.devengo_bruto) {
    return jsonError("La nómina no tiene desglose calculado. Recalcúlala primero.", 400);
  }

  const result: NominaResult = {
    devengo_bruto: meta.devengo_bruto ?? 0,
    base_cotizacion_cc: meta.base_cotizacion_cc ?? 0,
    base_cotizacion_atyepy: meta.base_cotizacion_atyepy ?? 0,
    base_irpf: meta.base_irpf ?? 0,
    ss_trabajador: meta.ss_trabajador ?? 0,
    irpf_retenido: meta.irpf_retenido ?? 0,
    total_deducciones: meta.total_deducciones ?? 0,
    liquido: meta.liquido ?? 0,
    ss_empresa: meta.ss_empresa ?? 0,
    conceptos: meta.conceptos ?? [],
    irpf_pct_aplicado: meta.irpf_pct_aplicado ?? 0,
  };

  // Plantilla: ?template=clasico|moderno|minimal o desde empresa.metadata.nomina_template
  const url = new URL(request.url);
  const templateParam = url.searchParams.get("template");
  const empresaMeta = (empresa.metadata ?? {}) as Record<string, unknown>;
  const templateAll = (templateParam ?? (empresaMeta.nomina_template as string | undefined) ?? "moderno") as "moderno" | "clasico" | "minimal";
  const template: "moderno" | "clasico" | "minimal" = ["moderno", "clasico", "minimal"].includes(templateAll) ? templateAll : "moderno";

  const { bytes } = await generatePayrollPDF({
    empresa: {
      nombre: empresa.nombre,
      nif: empresa.nif ?? "",
      direccion: (empresa.metadata as { direccion?: string } | null)?.direccion,
    },
    trabajador: {
      nombre: trabajador?.nombre ?? "Trabajador/a",
      dni: trabajador?.dni,
      nss: trabajador?.nss,
      puesto: trabajador?.puesto,
    },
    template,
    periodo: nomina.periodo,
    result,
    generado_en: new Date().toISOString(),
  });

  return new NextResponse(bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="nomina_${nomina.periodo}_${nomina.id}.pdf"`,
    },
  });
}
