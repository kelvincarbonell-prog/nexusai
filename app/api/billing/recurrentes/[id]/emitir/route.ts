import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";
import { siguienteEmision } from "@/lib/billing/calc";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;

  const admin = createSupabaseAdmin();
  const { data: rec } = await admin
    .from("facturas_recurrentes")
    .select("*")
    .eq("id", id)
    .single();
  if (!rec) return jsonError("Suscripción no encontrada", 404);
  if (!(await isGestorOrAdmin(admin, user.id, rec.empresa_id))) return jsonError("Sin permiso", 403);
  if (rec.estado !== "activa") return jsonError(`La suscripción está ${rec.estado}.`);

  const fecha = new Date().toISOString().slice(0, 10);
  const { data: factura, error } = await admin
    .from("facturas")
    .insert({
      empresa_id: rec.empresa_id,
      gestor_id: user.id,
      tipo: "emitida",
      contacto_nombre: rec.cliente_nombre,
      fecha_emision: fecha,
      base: rec.base,
      iva: rec.base * Number(rec.iva_pct ?? 0) / 100,
      total: rec.total,
      estado: "emitida",
      metadata: {
        recurrente_id: rec.id,
        concepto: rec.concepto,
        cliente_nif: rec.cliente_nif,
        cliente_email: rec.cliente_email,
      },
    })
    .select("*")
    .single();
  if (error || !factura) return jsonError(error?.message ?? "No se pudo emitir", 500);

  const proxima = siguienteEmision(new Date(rec.proxima_emision), rec.frecuencia, rec.dia_emision);
  await admin
    .from("facturas_recurrentes")
    .update({
      ultima_emision: fecha,
      num_emisiones: (rec.num_emisiones ?? 0) + 1,
      proxima_emision: proxima.toISOString().slice(0, 10),
    })
    .eq("id", id);

  return NextResponse.json({ ok: true, factura });
}
