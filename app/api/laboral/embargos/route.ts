import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";
import { calcularEmbargoLegal } from "@/lib/laboral/embargos";

/**
 * Embargos / deducciones judiciales.
 * GET   /api/laboral/embargos?empresa_id=...&trabajador_id=...
 * POST  /api/laboral/embargos
 * PATCH /api/laboral/embargos  (cerrar, suspender, ajustar)
 *
 * También expone POST /api/laboral/embargos?simulate=1 para previsualizar
 * el importe legal sin guardar.
 */

const Create = z.object({
  empresa_id: z.string().uuid(),
  trabajador_id: z.string().uuid(),
  juzgado: z.string().max(180),
  procedimiento: z.string().max(120).optional(),
  beneficiario: z.string().max(180).optional(),
  deuda_total: z.number().min(1).max(10_000_000),
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  pension_alimentos: z.boolean().default(false),
  porcentaje_pension: z.number().min(0).max(100).optional(),
  iban_beneficiario: z.string().max(40).optional(),
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
    .from("embargos")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("fecha_inicio", { ascending: false })
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

  const body = await request.json().catch(() => null);
  const sp = request.nextUrl.searchParams;
  const simulate = sp.get("simulate") === "1";

  // Modo simulación: liquido_mensual obligatorio, no guarda nada
  if (simulate) {
    const SimSchema = z.object({
      liquido_mensual: z.number().min(0).max(100_000),
      pension_alimentos: z.boolean().default(false),
      porcentaje_pension: z.number().min(0).max(100).optional(),
      smi_mensual: z.number().min(0).max(10_000).optional(),
    });
    const sim = SimSchema.safeParse(body);
    if (!sim.success) return jsonError("Datos de simulación inválidos");
    const r = calcularEmbargoLegal(sim.data);
    return NextResponse.json({ ok: true, simulacion: r });
  }

  const parsed = Create.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  const { data, error } = await admin
    .from("embargos")
    .insert({
      empresa_id: parsed.data.empresa_id,
      trabajador_id: parsed.data.trabajador_id,
      gestor_id: user.id,
      juzgado: parsed.data.juzgado,
      procedimiento: parsed.data.procedimiento ?? null,
      beneficiario: parsed.data.beneficiario ?? null,
      deuda_total: parsed.data.deuda_total,
      saldo_pendiente: parsed.data.deuda_total,
      fecha_inicio: parsed.data.fecha_inicio,
      fecha_fin: parsed.data.fecha_fin ?? null,
      pension_alimentos: parsed.data.pension_alimentos,
      porcentaje_pension: parsed.data.porcentaje_pension ?? null,
      iban_beneficiario: parsed.data.iban_beneficiario ?? null,
      estado: "activo",
    })
    .select("*")
    .single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo crear", 500);
  return NextResponse.json({ ok: true, item: data });
}

const Patch = z.object({
  id: z.string().uuid(),
  estado: z.enum(["activo", "suspendido", "finalizado"]).optional(),
  saldo_pendiente: z.number().min(0).optional(),
  fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function PATCH(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");
  const admin = createSupabaseAdmin();
  const { data: row } = await admin.from("embargos").select("empresa_id").eq("id", parsed.data.id).maybeSingle();
  if (!row) return jsonError("Embargo no encontrado", 404);
  if (!(await isGestorOrAdmin(admin, user.id, row.empresa_id))) return jsonError("Sin permiso", 403);

  const { id, ...patch } = parsed.data;
  const { data, error } = await admin
    .from("embargos")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo actualizar", 500);
  return NextResponse.json({ ok: true, item: data });
}
