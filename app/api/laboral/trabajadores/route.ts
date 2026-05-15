import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany, isGestorOrAdmin } from "@/lib/laboral/access";

const TrabajadorSchema = z.object({
  empresa_id: z.string().uuid(),
  nombre: z.string().min(2).max(180),
  dni: z.string().max(20).optional(),
  nss: z.string().max(20).optional(),
  fecha_nacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fecha_alta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fecha_baja: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  email: z.string().email().optional(),
  telefono: z.string().max(30).optional(),
  iban: z.string().max(40).optional(),
  puesto: z.string().max(120).optional(),
  categoria: z.string().max(120).optional(),
  tipo_contrato: z.string().max(60).optional(),
  jornada_horas: z.number().min(0).max(60).optional(),
  salario_bruto_anual: z.number().min(0).max(1_000_000).optional(),
  irpf_pct: z.number().min(0).max(60).optional(),
  convenio: z.string().max(180).optional(),
  activo: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const empresaId = request.nextUrl.searchParams.get("empresa_id");
  if (!empresaId) return jsonError("Falta empresa_id");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, empresaId))) return jsonError("Sin acceso", 403);

  const { data, error } = await admin
    .from("trabajadores")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("nombre");
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = TrabajadorSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  const { empresa_id, ...rest } = parsed.data;
  const { data, error } = await admin
    .from("trabajadores")
    .insert({ empresa_id, gestor_id: user.id, ...rest })
    .select("*")
    .single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo crear", 500);
  return NextResponse.json({ ok: true, item: data });
}
