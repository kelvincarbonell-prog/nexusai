import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany, isGestorOrAdmin } from "@/lib/laboral/access";

const ContratoSchema = z.object({
  empresa_id: z.string().uuid(),
  trabajador_id: z.string().uuid(),
  tipo_contrato: z.string().min(2).max(60),
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  jornada_horas: z.number().min(0).max(60).default(40),
  salario_bruto_anual: z.number().min(0).max(1_000_000),
  convenio: z.string().max(180).optional(),
  categoria: z.string().max(120).optional(),
  estado: z.enum(["activo", "finalizado", "suspendido"]).default("activo"),
  storage_path: z.string().max(500).optional(),
});

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const empresaId = request.nextUrl.searchParams.get("empresa_id");
  const trabajadorId = request.nextUrl.searchParams.get("trabajador_id");
  if (!empresaId) return jsonError("Falta empresa_id");
  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, empresaId))) return jsonError("Sin acceso", 403);
  let q = admin.from("contratos_laborales").select("*").eq("empresa_id", empresaId).order("fecha_inicio", { ascending: false });
  if (trabajadorId) q = q.eq("trabajador_id", trabajadorId);
  const { data, error } = await q;
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = ContratoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");
  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);
  const { data, error } = await admin
    .from("contratos_laborales")
    .insert({ ...parsed.data, gestor_id: user.id })
    .select("*")
    .single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo crear", 500);
  return NextResponse.json({ ok: true, item: data });
}
