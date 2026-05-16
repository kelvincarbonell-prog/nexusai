import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";

const Schema = z.object({
  tipo: z.enum(["factura", "gasto"]),
  factura_tipo: z.enum(["emitida", "recibida"]).optional(),
});

type Datos = {
  vendor_name?: string;
  vendor_nif?: string;
  invoice_number?: string;
  issue_date?: string;
  due_date?: string;
  concepto?: string;
  base?: number;
  iva?: number;
  iva_pct?: number;
  irpf?: number;
  irpf_pct?: number;
  total?: number;
};

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  const { data: extr } = await admin
    .from("facturas_recibidas_extracciones")
    .select("*")
    .eq("id", id)
    .single();
  if (!extr) return jsonError("Extracción no encontrada", 404);
  if (!(await canAccessLaborCompany(admin, user.id, extr.empresa_id))) return jsonError("Sin acceso", 403);
  if (extr.factura_id || extr.gasto_id) return jsonError("Esta extracción ya fue confirmada");

  const datos = (extr.datos_extraidos ?? {}) as Datos;

  if (parsed.data.tipo === "factura") {
    const facturaTipo = parsed.data.factura_tipo ?? "recibida";
    const contactoLabel = facturaTipo === "emitida" ? "Cliente" : "Proveedor";
    const { data: factura, error } = await admin
      .from("facturas")
      .insert({
        empresa_id: extr.empresa_id,
        gestor_id: user.id,
        tipo: facturaTipo,
        numero: datos.invoice_number ?? null,
        contacto_nombre: datos.vendor_name ?? contactoLabel,
        fecha_emision: datos.issue_date ?? null,
        fecha_vencimiento: datos.due_date ?? null,
        base: Number(datos.base ?? 0),
        iva: Number(datos.iva ?? 0),
        total: Number(datos.total ?? (datos.base ?? 0) + (datos.iva ?? 0)),
        estado: "borrador",
        metadata: {
          contacto_nif: datos.vendor_nif ?? null,
          retencion_irpf: Number(datos.irpf ?? 0),
          concepto: datos.concepto ?? null,
          origen_ocr: extr.id,
        },
      })
      .select("*")
      .single();
    if (error || !factura) return jsonError(error?.message ?? "Error", 500);

    await admin
      .from("facturas_recibidas_extracciones")
      .update({ factura_id: factura.id, status: "reviewed" })
      .eq("id", id);

    return NextResponse.json({ ok: true, factura });
  }

  // gasto
  const { data: gasto, error } = await admin
    .from("gastos")
    .insert({
      empresa_id: extr.empresa_id,
      gestor_id: user.id,
      proveedor: datos.vendor_name ?? "Proveedor",
      concepto: datos.concepto ?? datos.invoice_number ?? "Factura recibida",
      fecha: datos.issue_date ?? new Date().toISOString().slice(0, 10),
      base: Number(datos.base ?? 0),
      iva: Number(datos.iva ?? 0),
      total: Number(datos.total ?? (datos.base ?? 0) + (datos.iva ?? 0)),
      estado: "pendiente",
      metadata: {
        proveedor_nif: datos.vendor_nif ?? null,
        retencion_irpf: Number(datos.irpf ?? 0),
        origen_ocr: extr.id,
      },
    })
    .select("*")
    .single();
  if (error || !gasto) return jsonError(error?.message ?? "Error", 500);

  await admin
    .from("facturas_recibidas_extracciones")
    .update({ gasto_id: gasto.id, status: "reviewed" })
    .eq("id", id);

  return NextResponse.json({ ok: true, gasto });
}
