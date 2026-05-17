import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Bandeja del gestor: devuelve todas las conversaciones de las empresas
 * gestionadas por el usuario, con el último mensaje y el contador de no leídos.
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const admin = createSupabaseAdmin();

  // Empresas que gestiona este usuario
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
  if (empresas.length === 0) return NextResponse.json({ ok: true, conversaciones: [] });

  const empresaIds = empresas.map((e) => e.id);

  // Todos los mensajes de las empresas gestionadas
  const { data: mensajes } = await admin
    .from("mensajes")
    .select("id,empresa_id,remitente_id,contenido,leido,created_at")
    .in("empresa_id", empresaIds)
    .order("created_at", { ascending: false })
    .limit(2000);

  // Agrupar por empresa
  type Conv = {
    empresa_id: string;
    empresa_nombre: string;
    empresa_nif: string | null;
    ultimo_mensaje: string | null;
    ultimo_emisor: string | null;
    ultimo_at: string | null;
    no_leidos: number;
    total: number;
    es_mio_ultimo: boolean;
  };
  const map = new Map<string, Conv>();
  for (const e of empresas) {
    map.set(e.id, {
      empresa_id: e.id,
      empresa_nombre: e.nombre ?? "",
      empresa_nif: e.nif ?? null,
      ultimo_mensaje: null,
      ultimo_emisor: null,
      ultimo_at: null,
      no_leidos: 0,
      total: 0,
      es_mio_ultimo: false,
    });
  }
  for (const m of mensajes ?? []) {
    const c = map.get(m.empresa_id);
    if (!c) continue;
    c.total += 1;
    if (!m.leido && m.remitente_id !== user.id) c.no_leidos += 1;
    if (c.ultimo_at === null) {
      c.ultimo_mensaje = m.contenido;
      c.ultimo_emisor = m.remitente_id;
      c.ultimo_at = m.created_at;
      c.es_mio_ultimo = m.remitente_id === user.id;
    }
  }

  // Ordenar: con no leídos primero, después por fecha del último mensaje.
  const conversaciones = Array.from(map.values())
    .filter((c) => c.total > 0)
    .sort((a, b) => {
      if (a.no_leidos !== b.no_leidos) return b.no_leidos - a.no_leidos;
      return (b.ultimo_at ?? "").localeCompare(a.ultimo_at ?? "");
    });

  const totalNoLeidos = conversaciones.reduce((s, c) => s + c.no_leidos, 0);

  return NextResponse.json({ ok: true, conversaciones, total_no_leidos: totalNoLeidos });
}
