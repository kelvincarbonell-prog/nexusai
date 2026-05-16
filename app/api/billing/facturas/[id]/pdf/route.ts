import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";
import { generateFacturaPDF } from "@/lib/billing/pdf-factura";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;

  const admin = createSupabaseAdmin();
  const { data: factura } = await admin.from("facturas").select("*").eq("id", id).single();
  if (!factura) return jsonError("Factura no encontrada", 404);
  if (!(await canAccessLaborCompany(admin, user.id, factura.empresa_id))) return jsonError("Sin acceso", 403);

  const { data: empresa } = await admin.from("empresas").select("nombre,nif,metadata").eq("id", factura.empresa_id).single();
  if (!empresa) return jsonError("Empresa no encontrada", 404);
  const meta = (empresa.metadata ?? {}) as Record<string, unknown>;
  const factMeta = (factura.metadata ?? {}) as Record<string, unknown>;

  const bytes = await generateFacturaPDF({
    empresa: {
      nombre: empresa.nombre,
      nif: empresa.nif ?? undefined,
      direccion: meta.cliente_direccion as string | undefined,
      logo_url: meta.logo_url as string | undefined,
      color_primario: meta.color_primario as string | undefined,
      pie_factura: meta.pie_factura as string | undefined,
    },
    factura: {
      numero: factura.numero,
      contacto_nombre: factura.contacto_nombre,
      contacto_nif: factMeta.cliente_nif as string | undefined,
      fecha_emision: factura.fecha_emision,
      fecha_vencimiento: factura.fecha_vencimiento,
      base: Number(factura.base ?? 0),
      iva: Number(factura.iva ?? 0),
      total: Number(factura.total ?? 0),
      estado: factura.estado ?? "borrador",
      payment_link_url: factura.payment_link_url,
      metadata: factMeta,
    },
  });

  return new NextResponse(bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${factura.numero ?? id.slice(0, 8)}.pdf"`,
    },
  });
}
