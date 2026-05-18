import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";

/**
 * Convierte un presupuesto aprobado en factura emitida en un clic.
 * - Copia líneas + importes
 * - Reusa contacto
 * - Crea factura en estado "emitida" (no enviada) lista para revisar
 * - Marca el presupuesto como facturado y enlaza
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;

  const admin = createSupabaseAdmin();
  const { data: pres } = await admin.from("presupuestos").select("*").eq("id", id).maybeSingle();
  if (!pres) return jsonError("Presupuesto no encontrado", 404);
  if (!(await canAccessLaborCompany(admin, user.id, pres.empresa_id))) return jsonError("Sin acceso", 403);

  if (pres.factura_id) return jsonError("Este presupuesto ya está convertido en factura.", 409);

  const { data: lineas } = await admin.from("presupuestos_lineas").select("*").eq("presupuesto_id", id).order("line_number");

  // Siguiente número de factura de la empresa
  const ejercicio = new Date().getUTCFullYear();
  const { data: ultima } = await admin
    .from("facturas")
    .select("numero")
    .eq("empresa_id", pres.empresa_id)
    .eq("tipo", "emitida")
    .like("numero", `%${ejercicio}%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let nextNum = 1;
  if (ultima?.numero) {
    const m = String(ultima.numero).match(/(\d+)\s*$/);
    if (m) nextNum = Number(m[1]) + 1;
  }
  const numero = `FAC-${ejercicio}-${String(nextNum).padStart(4, "0")}`;

  const hoyISO = new Date().toISOString().slice(0, 10);
  const condDias = Number((pres.metadata as Record<string, unknown> | null)?.condiciones_pago_dias ?? 30);
  const vto = new Date(Date.now() + condDias * 86_400_000).toISOString().slice(0, 10);

  const { data: factura, error } = await admin
    .from("facturas")
    .insert({
      empresa_id: pres.empresa_id,
      gestor_id: user.id,
      tipo: "emitida",
      numero,
      serie: "FAC",
      fecha_emision: hoyISO,
      fecha_vencimiento: vto,
      contacto_nombre: pres.contacto_nombre,
      contacto_nif: pres.contacto_nif,
      contacto_email: pres.contacto_email,
      descripcion: pres.descripcion ?? `Factura de presupuesto ${pres.numero ?? pres.id.slice(0, 8)}`,
      base: pres.base,
      iva: pres.iva,
      iva_pct: pres.iva_pct,
      total: pres.total,
      estado: "emitida",
      metadata: { ...((pres.metadata ?? {}) as Record<string, unknown>), presupuesto_id: pres.id },
    })
    .select("*")
    .single();
  if (error || !factura) return jsonError(error?.message ?? "No se pudo crear la factura", 500);

  // Copia líneas
  if (lineas && lineas.length > 0) {
    try {
      await admin.from("facturas_lineas").insert(
        lineas.map((l, i) => ({
          factura_id: factura.id,
          empresa_id: pres.empresa_id,
          line_number: i + 1,
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          precio_unitario: l.precio_unitario,
          descuento_pct: l.descuento_pct ?? 0,
          iva_pct: l.iva_pct,
          irpf_pct: l.irpf_pct ?? 0,
          base: l.base,
          iva: l.iva,
          total: l.total,
        })),
      );
    } catch {
      // si facturas_lineas no existe, no rompe (los totales viven en factura)
    }
  }

  // Marca presupuesto como facturado
  await admin
    .from("presupuestos")
    .update({ estado: "facturado", factura_id: factura.id, fecha_aprobacion: hoyISO, updated_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({
    ok: true,
    factura: { id: factura.id, numero: factura.numero, total: factura.total, fecha_vencimiento: factura.fecha_vencimiento },
  });
}
