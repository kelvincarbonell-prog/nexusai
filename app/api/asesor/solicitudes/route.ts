import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Bandeja del gestor: todas las solicitudes de las empresas que gestiona,
 * agregadas en una sola vista. Filtros por estado.
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const admin = createSupabaseAdmin();

  const { data: profile } = await admin.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  const isAdmin = profile?.rol === "admin";

  const empresasRes = isAdmin
    ? await admin.from("empresas").select("id,nombre,nif").order("nombre").limit(500)
    : await admin
        .from("empresas")
        .select("id,nombre,nif")
        .or(`gestor_id.eq.${user.id},owner_user_id.eq.${user.id}`)
        .order("nombre");
  const empresas = empresasRes.data ?? [];
  if (empresas.length === 0) {
    return NextResponse.json({ ok: true, items: [], resumen: { pendientes: 0, en_proceso: 0, resueltas: 0, urgentes: 0 } });
  }
  const empresaIds = empresas.map((e) => e.id);

  const estado = request.nextUrl.searchParams.get("estado");
  let q = admin
    .from("solicitudes_laborales")
    .select("id,empresa_id,tipo,descripcion,estado,metadata,user_id,created_at,updated_at")
    .in("empresa_id", empresaIds)
    .order("created_at", { ascending: false })
    .limit(300);
  if (estado && ["pendiente", "en_proceso", "resuelta", "rechazada"].includes(estado)) {
    q = q.eq("estado", estado);
  }
  const { data: items, error } = await q;
  if (error) return jsonError(error.message, 500);

  const empresaMap = new Map(empresas.map((e) => [e.id, e]));
  const enriched = (items ?? []).map((s) => ({
    ...s,
    empresa: empresaMap.get(s.empresa_id) ?? null,
  }));

  const resumen = {
    pendientes: enriched.filter((s) => s.estado === "pendiente").length,
    en_proceso: enriched.filter((s) => s.estado === "en_proceso").length,
    resueltas: enriched.filter((s) => s.estado === "resuelta").length,
    urgentes: enriched.filter((s) => (s.metadata as Record<string, unknown> | null)?.prioridad === "urgente" && s.estado !== "resuelta").length,
  };

  return NextResponse.json({ ok: true, items: enriched, resumen });
}

const PatchSchema = z.object({
  id: z.string().uuid(),
  estado: z.enum(["pendiente", "en_proceso", "resuelta", "rechazada"]),
  nota: z.string().max(2000).optional(),
});

export async function PATCH(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  const { data: solicitud } = await admin
    .from("solicitudes_laborales")
    .select("id,empresa_id,metadata")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!solicitud) return jsonError("Solicitud no encontrada", 404);

  // Verifica que el user gestiona esa empresa
  const { data: empresa } = await admin
    .from("empresas")
    .select("gestor_id,owner_user_id")
    .eq("id", solicitud.empresa_id)
    .maybeSingle();
  const { data: profile } = await admin.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  const isAdmin = profile?.rol === "admin";
  if (!isAdmin && empresa?.gestor_id !== user.id && empresa?.owner_user_id !== user.id) {
    return jsonError("Sin acceso", 403);
  }

  const meta = (solicitud.metadata ?? {}) as Record<string, unknown>;
  if (parsed.data.nota) meta.nota_gestor = parsed.data.nota;
  meta.actualizada_por = user.id;
  meta.actualizada_en = new Date().toISOString();

  const { data: updated, error } = await admin
    .from("solicitudes_laborales")
    .update({ estado: parsed.data.estado, metadata: meta, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .select("*")
    .single();
  if (error || !updated) return jsonError(error?.message ?? "No se pudo actualizar", 500);
  return NextResponse.json({ ok: true, item: updated });
}
