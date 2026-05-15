import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";

const FichajeSchema = z.object({
  empresa_id: z.string().uuid(),
  trabajador_id: z.string().uuid(),
  accion: z.enum(["entrada", "salida"]),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  descanso_min: z.number().min(0).max(600).optional(),
  observaciones: z.string().max(500).optional(),
  fuente: z.enum(["manual", "voz", "movil", "web", "reloj"]).default("web"),
});

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const empresaId = request.nextUrl.searchParams.get("empresa_id");
  const trabajadorId = request.nextUrl.searchParams.get("trabajador_id");
  const desde = request.nextUrl.searchParams.get("desde");
  const hasta = request.nextUrl.searchParams.get("hasta");
  if (!empresaId) return jsonError("Falta empresa_id");
  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, empresaId))) return jsonError("Sin acceso", 403);
  let q = admin.from("registro_horario").select("*").eq("empresa_id", empresaId).order("fecha", { ascending: false }).limit(200);
  if (trabajadorId) q = q.eq("trabajador_id", trabajadorId);
  if (desde) q = q.gte("fecha", desde);
  if (hasta) q = q.lte("fecha", hasta);
  const { data, error } = await q;
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = FichajeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");
  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);

  const fecha = parsed.data.fecha ?? new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  const { data: open } = await admin
    .from("registro_horario")
    .select("*")
    .eq("empresa_id", parsed.data.empresa_id)
    .eq("trabajador_id", parsed.data.trabajador_id)
    .eq("fecha", fecha)
    .is("hora_salida", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (parsed.data.accion === "entrada") {
    if (open) return jsonError("Ya hay un fichaje abierto sin salida.");
    const { data, error } = await admin
      .from("registro_horario")
      .insert({
        empresa_id: parsed.data.empresa_id,
        trabajador_id: parsed.data.trabajador_id,
        user_id: user.id,
        fecha,
        hora_entrada: now,
        descanso_min: parsed.data.descanso_min ?? 0,
        observaciones: parsed.data.observaciones,
        fuente: parsed.data.fuente,
      })
      .select("*")
      .single();
    if (error || !data) return jsonError(error?.message ?? "No se pudo registrar", 500);
    return NextResponse.json({ ok: true, item: data, accion: "entrada" });
  }

  if (!open) return jsonError("No hay un fichaje de entrada abierto para hoy.");
  const { data, error } = await admin
    .from("registro_horario")
    .update({
      hora_salida: now,
      descanso_min: parsed.data.descanso_min ?? open.descanso_min ?? 0,
      observaciones: parsed.data.observaciones ?? open.observaciones,
    })
    .eq("id", open.id)
    .select("*")
    .single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo cerrar fichaje", 500);
  return NextResponse.json({ ok: true, item: data, accion: "salida" });
}
