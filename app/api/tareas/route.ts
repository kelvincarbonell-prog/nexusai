import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";

const CreateSchema = z.object({
  empresa_id: z.string().uuid().optional(),
  asignado_a: z.string().uuid().optional(),
  titulo: z.string().min(1).max(180),
  descripcion: z.string().max(2000).optional(),
  prioridad: z.enum(["baja", "media", "alta", "urgente"]).default("media"),
  fecha_limite: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const UpdateSchema = z.object({
  id: z.string().uuid(),
  estado: z.enum(["pendiente", "en_curso", "completada", "cancelada"]).optional(),
  prioridad: z.enum(["baja", "media", "alta", "urgente"]).optional(),
  titulo: z.string().min(1).max(180).optional(),
  descripcion: z.string().max(2000).optional(),
  fecha_limite: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  asignado_a: z.string().uuid().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const admin = createSupabaseAdmin();
  const empresaId = request.nextUrl.searchParams.get("empresa_id");
  let query = admin.from("tareas").select("*").order("fecha_limite", { ascending: true, nullsFirst: false }).limit(200);
  if (empresaId) {
    if (!(await canAccessLaborCompany(admin, user.id, empresaId))) {
      return jsonError("Sin acceso", 403);
    }
    query = query.eq("empresa_id", empresaId);
  } else {
    query = query.or(`gestor_id.eq.${user.id},asignado_a.eq.${user.id}`);
  }
  const { data } = await query;
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");
  const admin = createSupabaseAdmin();
  if (parsed.data.empresa_id) {
    if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) {
      return jsonError("Sin acceso", 403);
    }
  }
  const { data, error } = await admin
    .from("tareas")
    .insert({
      ...parsed.data,
      gestor_id: user.id,
      asignado_a: parsed.data.asignado_a ?? user.id,
    })
    .select("*")
    .single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo crear", 500);
  return NextResponse.json({ ok: true, tarea: data });
}

export async function PATCH(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = UpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");
  const admin = createSupabaseAdmin();
  const { id, ...update } = parsed.data;
  const { data: tarea } = await admin.from("tareas").select("empresa_id,gestor_id,asignado_a").eq("id", id).maybeSingle();
  if (!tarea) return jsonError("Tarea no encontrada", 404);
  const isOwner = tarea.gestor_id === user.id || tarea.asignado_a === user.id;
  const hasCompanyAccess = tarea.empresa_id ? await canAccessLaborCompany(admin, user.id, tarea.empresa_id) : isOwner;
  if (!isOwner && !hasCompanyAccess) return jsonError("Sin acceso", 403);
  if (update.estado === "completada") {
    (update as Record<string, unknown>).completada_en = new Date().toISOString();
  }
  const { data, error } = await admin.from("tareas").update(update).eq("id", id).select("*").single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo actualizar", 500);
  return NextResponse.json({ ok: true, tarea: data });
}

export async function DELETE(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return jsonError("Falta id");
  const admin = createSupabaseAdmin();
  const { data: tarea } = await admin.from("tareas").select("empresa_id,gestor_id").eq("id", id).maybeSingle();
  if (!tarea) return jsonError("Tarea no encontrada", 404);
  const isOwner = tarea.gestor_id === user.id;
  const hasCompanyAccess = tarea.empresa_id ? await canAccessLaborCompany(admin, user.id, tarea.empresa_id) : isOwner;
  if (!isOwner && !hasCompanyAccess) return jsonError("Sin acceso", 403);
  await admin.from("tareas").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
