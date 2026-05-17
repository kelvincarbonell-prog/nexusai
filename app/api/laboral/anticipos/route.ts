import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";

/**
 * Anticipos de nómina: el trabajador recibe un adelanto que se descuenta
 * de la siguiente (o varias) nómina(s).
 *
 * GET    /api/laboral/anticipos?empresa_id=...&trabajador_id=...
 * POST   /api/laboral/anticipos  (gestor/admin only)
 * PATCH  /api/laboral/anticipos  cambiar estado o saldo
 */

const Create = z.object({
  empresa_id: z.string().uuid(),
  trabajador_id: z.string().uuid(),
  importe: z.number().min(1).max(50_000),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  motivo: z.string().max(500).optional(),
  cuotas: z.number().int().min(1).max(24).default(1),
});

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const sp = request.nextUrl.searchParams;
  const empresaId = sp.get("empresa_id");
  if (!empresaId) return jsonError("Falta empresa_id");
  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, empresaId))) return jsonError("Sin permiso", 403);

  let q = admin
    .from("anticipos_nomina")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("fecha", { ascending: false })
    .limit(200);
  const trabId = sp.get("trabajador_id");
  if (trabId) q = q.eq("trabajador_id", trabId);
  const { data, error } = await q;
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Create.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  const cuotaImporte = Math.round((parsed.data.importe / parsed.data.cuotas) * 100) / 100;
  const { data, error } = await admin
    .from("anticipos_nomina")
    .insert({
      empresa_id: parsed.data.empresa_id,
      trabajador_id: parsed.data.trabajador_id,
      gestor_id: user.id,
      importe: parsed.data.importe,
      saldo_pendiente: parsed.data.importe,
      cuotas: parsed.data.cuotas,
      cuota_importe: cuotaImporte,
      fecha: parsed.data.fecha,
      motivo: parsed.data.motivo ?? null,
      estado: "activo",
    })
    .select("*")
    .single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo crear", 500);
  return NextResponse.json({ ok: true, item: data });
}

const Patch = z.object({
  id: z.string().uuid(),
  estado: z.enum(["activo", "pagado", "cancelado"]).optional(),
  saldo_pendiente: z.number().min(0).optional(),
});

export async function PATCH(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");
  const admin = createSupabaseAdmin();
  const { data: row } = await admin
    .from("anticipos_nomina")
    .select("empresa_id")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!row) return jsonError("Anticipo no encontrado", 404);
  if (!(await isGestorOrAdmin(admin, user.id, row.empresa_id))) return jsonError("Sin permiso", 403);

  const { id, ...patch } = parsed.data;
  const { data, error } = await admin
    .from("anticipos_nomina")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo actualizar", 500);
  return NextResponse.json({ ok: true, item: data });
}
