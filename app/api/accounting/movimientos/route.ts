import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany, isGestorOrAdmin } from "@/lib/laboral/access";

const Query = z.object({
  empresa_id: z.string().uuid(),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  estado: z.enum(["todos", "conciliados", "pendientes"]).default("todos"),
});

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("Parámetros inválidos");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);

  let q = admin
    .from("bank_movements")
    .select("*")
    .eq("empresa_id", parsed.data.empresa_id)
    .order("fecha_operacion", { ascending: false })
    .limit(500);
  if (parsed.data.desde) q = q.gte("fecha_operacion", parsed.data.desde);
  if (parsed.data.hasta) q = q.lte("fecha_operacion", parsed.data.hasta);
  if (parsed.data.estado === "conciliados") q = q.eq("reconciled", true);
  if (parsed.data.estado === "pendientes") q = q.eq("reconciled", false);

  const { data, error } = await q;
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, items: data ?? [] });
}

const Conciliar = z.object({
  movimiento_id: z.string().uuid(),
  factura_id: z.string().uuid().nullable().optional(),
  gasto_id: z.string().uuid().nullable().optional(),
});

/**
 * Vincula un movimiento bancario con una factura o gasto.
 */
export async function PATCH(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Conciliar.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  const { data: mov } = await admin
    .from("bank_movements")
    .select("empresa_id")
    .eq("id", parsed.data.movimiento_id)
    .maybeSingle();
  if (!mov) return jsonError("Movimiento no encontrado", 404);
  if (!(await isGestorOrAdmin(admin, user.id, mov.empresa_id))) return jsonError("Sin permiso", 403);

  const { error } = await admin
    .from("bank_movements")
    .update({
      factura_id: parsed.data.factura_id ?? null,
      gasto_id: parsed.data.gasto_id ?? null,
      reconciled: Boolean(parsed.data.factura_id || parsed.data.gasto_id),
    })
    .eq("id", parsed.data.movimiento_id);
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}
