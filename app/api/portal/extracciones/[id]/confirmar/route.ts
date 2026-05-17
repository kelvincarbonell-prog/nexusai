import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";
import { asentarFacturaRecibida, asentarGasto, autoAsientosActivado } from "@/lib/accounting/auto-asientos";
import { categorizeExpense } from "@/lib/agents/expense-categorizer";

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

  // 1) Auto-categorización IA: sugerencia de cuenta PGC en base a vendor/concepto.
  //    Se ejecuta antes para que el asiento use la cuenta correcta.
  let cuentaPgc: string | undefined;
  let categoriaConfianza: number | undefined;
  let categoriaFuente: string | undefined;
  try {
    const cat = await categorizeExpense({
      empresa_id: extr.empresa_id,
      vendor_name: datos.vendor_name,
      vendor_nif: datos.vendor_nif,
      concepto: datos.concepto,
      total: typeof datos.total === "number" ? datos.total : undefined,
    });
    if (cat) {
      cuentaPgc = cat.pgc_account_code;
      categoriaConfianza = cat.confidence;
      categoriaFuente = cat.source;
      // Guardar histórico para que la próxima vez sea aún más rápida
      try {
        await admin
          .from("expense_categorization_history")
          .insert({
            empresa_id: extr.empresa_id,
            vendor_nif: datos.vendor_nif ?? null,
            vendor_name: datos.vendor_name ?? null,
            concepto: datos.concepto ?? null,
            pgc_account_code: cat.pgc_account_code,
            confidence: cat.confidence,
            learned_from: cat.source,
            created_by: user.id,
          });
      } catch {
        // no bloquea
      }
    }
  } catch {
    // No bloquea — si la categorización falla, usa cuenta por defecto en el asiento.
  }

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
          cuenta_pgc: cuentaPgc ?? null,
          categoria_confianza: categoriaConfianza ?? null,
          categoria_fuente: categoriaFuente ?? null,
        },
      })
      .select("*")
      .single();
    if (error || !factura) return jsonError(error?.message ?? "Error", 500);

    await admin
      .from("facturas_recibidas_extracciones")
      .update({ factura_id: factura.id, status: "reviewed" })
      .eq("id", id);

    // 2) Auto-asentado contable
    let asiento_id: string | null = null;
    try {
      if (facturaTipo === "recibida" && (await autoAsientosActivado(admin, extr.empresa_id))) {
        const asiento = await asentarFacturaRecibida(
          admin,
          {
            id: factura.id,
            empresa_id: factura.empresa_id,
            fecha_emision: factura.fecha_emision,
            contacto_nombre: factura.contacto_nombre,
            numero: factura.numero,
            base: Number(factura.base ?? 0),
            iva: Number(factura.iva ?? 0),
            total: Number(factura.total ?? 0),
            metadata: (factura.metadata ?? {}) as Record<string, unknown>,
          },
          user.id,
          { cuenta_pgc: cuentaPgc },
        );
        asiento_id = asiento?.id ?? null;
      }
    } catch {
      // No bloquea
    }

    return NextResponse.json({ ok: true, factura, asiento_id, cuenta_pgc: cuentaPgc, categoria_confianza: categoriaConfianza });
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
        cuenta_pgc: cuentaPgc ?? null,
        categoria_confianza: categoriaConfianza ?? null,
        categoria_fuente: categoriaFuente ?? null,
      },
    })
    .select("*")
    .single();
  if (error || !gasto) return jsonError(error?.message ?? "Error", 500);

  await admin
    .from("facturas_recibidas_extracciones")
    .update({ gasto_id: gasto.id, status: "reviewed" })
    .eq("id", id);

  // 2) Auto-asentado contable
  let asiento_id: string | null = null;
  try {
    if (await autoAsientosActivado(admin, extr.empresa_id)) {
      const asiento = await asentarGasto(
        admin,
        {
          id: gasto.id,
          empresa_id: gasto.empresa_id,
          fecha: gasto.fecha,
          proveedor: gasto.proveedor,
          concepto: gasto.concepto,
          base: Number(gasto.base ?? 0),
          iva: Number(gasto.iva ?? 0),
          total: Number(gasto.total ?? 0),
          metadata: (gasto.metadata ?? {}) as Record<string, unknown>,
        },
        user.id,
        { cuenta_pgc: cuentaPgc },
      );
      asiento_id = asiento?.id ?? null;
    }
  } catch {
    // No bloquea
  }

  return NextResponse.json({ ok: true, gasto, asiento_id, cuenta_pgc: cuentaPgc, categoria_confianza: categoriaConfianza });
}
